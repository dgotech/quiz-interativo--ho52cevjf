routerAdd(
  'POST',
  '/backend/v1/quizzes/generate',
  (e) => {
    const authUser = e.auth
    if (!authUser || !authUser.id) {
      return e.json(401, { message: 'Não autorizado' })
    }

    const files = e.findUploadedFiles('file')
    if (!files || files.length === 0) {
      return e.json(400, {
        message: 'Nenhum arquivo enviado. Por favor, envie um arquivo .pptx ou .xlsx',
      })
    }

    const uploadedFile = files[0]
    const originalName = uploadedFile.originalName || 'documento'
    const ext = originalName.split('.').pop().toLowerCase()

    if (ext !== 'pptx' && ext !== 'xlsx') {
      return e.json(400, {
        message:
          'Formato inválido. Apenas apresentações (.pptx) ou planilhas (.xlsx) são suportadas.',
      })
    }

    let markdown = ''
    try {
      const docResult = $documents.toMarkdown({ file: uploadedFile })
      markdown = docResult.markdown || ''
    } catch (err) {
      console.log('Erro ao converter documento:', err)
      if (err && err.status === 422) {
        return e.json(422, {
          message:
            'Não foi possível extrair texto do documento enviado. Certifique-se de que o arquivo contém texto legível.',
        })
      }
      return e.json(500, { message: 'Erro ao processar o conteúdo do documento. Tente novamente.' })
    }

    if (!markdown || markdown.trim().length < 20) {
      return e.json(400, {
        message: 'O documento possui pouco ou nenhum texto identificável para gerar um quiz.',
      })
    }

    // Chamar Skip AI para interpretar o documento e gerar perguntas
    const systemPrompt =
      'Você é um especialista educacional e criador de quizzes interativos em português (PT-BR). Analise o documento em Markdown fornecido e gere um quiz rico, instigante e bem estruturado. Você DEVE retornar APENAS um JSON válido e puro sem formatação markdown extra fora do json.'

    const userPrompt =
      'Abaixo está o conteúdo extraído de um documento (' +
      ext.toUpperCase() +
      ' - ' +
      originalName +
      '):\n\n' +
      markdown.slice(0, 24000) +
      '\n\nInstruções detalhadas:\n' +
      '1. Crie um título conciso e atraente para o quiz baseado no tema principal (nome_quiz).\n' +
      "2. Gere 10 perguntas de múltipla escolha (tipo: 'multipla_escolha') com 4 alternativas: A, B, C, D. Cada opção deve ter label ('A', 'B', 'C', 'D') e texto. Especifique 'resposta_correta' ('A', 'B', 'C' ou 'D') e uma 'explicacao' clara do porquê da resposta.\n" +
      "3. Gere 3 perguntas abertas/dissertativas (tipo: 'aberta') desafiadoras que peçam síntese ou raciocínio crítico sobre o conteúdo. Para perguntas abertas: opcoes = null, resposta_correta = null, e 'explicacao' contendo pontos-chave esperados na resposta.\n" +
      '4. Retorne RIGOROSAMENTE a estrutura JSON abaixo:\n' +
      '{\n' +
      '  "nome_quiz": "Título do Quiz",\n' +
      '  "perguntas": [\n' +
      '    {\n' +
      '      "enunciado": "Texto da pergunta",\n' +
      '      "tipo": "multipla_escolha",\n' +
      '      "opcoes": [\n' +
      '        {"label": "A", "texto": "Texto da alternativa A"},\n' +
      '        {"label": "B", "texto": "Texto da alternativa B"},\n' +
      '        {"label": "C", "texto": "Texto da alternativa C"},\n' +
      '        {"label": "D", "texto": "Texto da alternativa D"}\n' +
      '      ],\n' +
      '      "resposta_correta": "A",\n' +
      '      "explicacao": "Explicação pedagógica da resposta."\n' +
      '    },\n' +
      '    {\n' +
      '      "enunciado": "Texto da pergunta aberta",\n' +
      '      "tipo": "aberta",\n' +
      '      "opcoes": null,\n' +
      '      "resposta_correta": null,\n' +
      '      "explicacao": "Critérios e conceitos fundamentais esperados."\n' +
      '    }\n' +
      '  ]\n' +
      '}'

    let aiResponse
    try {
      aiResponse = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      })
    } catch (err) {
      console.log('Erro na Skip AI:', err)
      return e.json(500, {
        message: 'Erro ao gerar perguntas com a IA. Tente novamente mais tarde.',
      })
    }

    let generatedContent = ''
    if (aiResponse && aiResponse.choices && aiResponse.choices.length > 0) {
      generatedContent = aiResponse.choices[0].message.content || ''
    }

    // Limpar json caso venha encapsulado em ```json ... ```
    let jsonString = generatedContent.trim()
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.slice(7)
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.slice(3)
    }
    if (jsonString.endsWith('```')) {
      jsonString = jsonString.slice(0, -3)
    }
    jsonString = jsonString.trim()

    let quizData
    try {
      quizData = JSON.parse(jsonString)
    } catch (parseErr) {
      console.log('Falha no JSON.parse da IA:', parseErr, jsonString)
      // Tenta encontrar o bloco {...}
      const firstBrace = jsonString.indexOf('{')
      const lastBrace = jsonString.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1) {
        try {
          quizData = JSON.parse(jsonString.substring(firstBrace, lastBrace + 1))
        } catch (innerErr) {
          return e.json(500, {
            message: 'A IA não retornou um formato JSON válido. Por favor, tente enviar novamente.',
          })
        }
      } else {
        return e.json(500, { message: 'Falha ao processar estrutura das perguntas geradas.' })
      }
    }

    const quizTitle = (quizData.nome_quiz && quizData.nome_quiz.trim()) || 'Quiz: ' + originalName
    const questionsList = Array.isArray(quizData.perguntas) ? quizData.perguntas : []

    if (questionsList.length === 0) {
      return e.json(400, { message: 'Nenhuma pergunta pôde ser extraída do documento.' })
    }

    // Salvar no banco usando $app
    let createdQuizId = ''
    try {
      const quizzesCol = $app.findCollectionByNameOrId('quizzes')
      const quizRecord = new Record(quizzesCol)
      quizRecord.set('tipo_arquivo', ext)
      quizRecord.set('nome_arquivo', originalName)
      quizRecord.set('nome_quiz', quizTitle)
      quizRecord.set('conteudo_extraido', markdown)
      quizRecord.set('usuario_id', authUser.id)
      quizRecord.set('token_publico', $security.randomString(32))
      quizRecord.set('publico_ativo', true)
      $app.save(quizRecord)
      createdQuizId = quizRecord.id

      const perguntasCol = $app.findCollectionByNameOrId('perguntas')
      for (let i = 0; i < questionsList.length; i++) {
        const q = questionsList[i]
        const pRecord = new Record(perguntasCol)
        pRecord.set('quiz_id', createdQuizId)
        pRecord.set('enunciado', q.enunciado || 'Pergunta ' + (i + 1))
        const qTipo = q.tipo === 'aberta' ? 'aberta' : 'multipla_escolha'
        pRecord.set('tipo', qTipo)
        pRecord.set('opcoes', Array.isArray(q.opcoes) ? q.opcoes : null)
        pRecord.set('resposta_correta', q.resposta_correta || null)
        pRecord.set('explicacao', q.explicacao || '')
        pRecord.set('ordem', i + 1)
        $app.save(pRecord)
      }
    } catch (dbErr) {
      console.log('Erro ao salvar quiz no banco:', dbErr)
      return e.json(500, { message: 'Erro ao salvar o quiz gerado no banco de dados.' })
    }

    return e.json(200, {
      success: true,
      quiz_id: createdQuizId,
      nome_quiz: quizTitle,
      total_perguntas: questionsList.length,
    })
  },
  $apis.requireAuth(),
)
