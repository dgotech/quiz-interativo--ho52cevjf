/**
 * Hook onRecordAfterCreateSuccess('quizzes')
 *
 * Dispara automaticamente após a criação de um registro na coleção 'quizzes'.
 *
 * Suporta dois fluxos:
 * 1. Upload com arquivo anexado: usa $documents.toMarkdown({ record, field: 'arquivo' }) para arquivos normais.
 * 2. Upload leve com conteudo_extraido já fornecido (para arquivos grandes >10MB onde o cliente extraiu o texto):
 *    nesse caso, o conteúdo já está salvo e pulamos o $documents.toMarkdown, indo direto para a Skip AI ($ai.chat).
 *
 * Também atualiza status_processamento ('processando' -> 'concluido' ou 'erro') e cria as perguntas na coleção 'perguntas'.
 */
onRecordAfterCreateSuccess((e) => {
  const quizRecord = e.record
  const arquivoName = quizRecord.getString('arquivo')
  let existingContent = quizRecord.getString('conteudo_extraido')

  // Se não houver arquivo nem texto previamente extraído, não há o que processar
  if (!arquivoName && (!existingContent || existingContent.trim().length === 0)) {
    return e.next()
  }

  // Se já estiver concluído ou em processamento, evitar reentrâncias
  const currentStatus = quizRecord.getString('status_processamento')
  if (currentStatus === 'concluido' || currentStatus === 'processando') {
    return e.next()
  }

  const recordId = quizRecord.id
  const originalFileName = quizRecord.getString('nome_arquivo') || arquivoName || 'documento'
  const ext = originalFileName.split('.').pop().toLowerCase()

  try {
    // 1. Atualizar status para 'processando'
    const recordToUpdate = $app.findRecordById('quizzes', recordId)
    recordToUpdate.set('status_processamento', 'processando')
    $app.save(recordToUpdate)

    // 2. Obter Markdown (se já veio no campo conteudo_extraido ou extraindo via $documents.toMarkdown)
    let markdown = existingContent || ''
    let isTruncated = false

    if (!markdown || markdown.trim().length < 20) {
      if (arquivoName) {
        try {
          const docResult = $documents.toMarkdown({
            record: recordToUpdate,
            field: 'arquivo',
          })
          markdown = docResult.markdown || ''
          isTruncated = !!docResult.truncated
        } catch (docErr) {
          console.log('Erro ao converter documento em Markdown via $documents:', docErr)
          recordToUpdate.set('status_processamento', 'erro')
          if (docErr && docErr.status === 422) {
            recordToUpdate.set(
              'erro_processamento',
              'Não foi possível extrair texto legível do arquivo enviado. Certifique-se de que a apresentação ou planilha contém texto editável.',
            )
          } else if (docErr && docErr.status === 413) {
            recordToUpdate.set(
              'erro_processamento',
              'O volume de texto e dados da apresentação excede o limite máximo de conversão. Tente remover mídias pesadas ou reduzir a quantidade de slides.',
            )
          } else {
            recordToUpdate.set(
              'erro_processamento',
              'Falha na extração de texto do documento. O arquivo pode estar corrompido ou protegido por senha.',
            )
          }
          $app.save(recordToUpdate)
          return e.next()
        }
      }
    }

    if (!markdown || markdown.trim().length < 15) {
      recordToUpdate.set('status_processamento', 'erro')
      recordToUpdate.set(
        'erro_processamento',
        'O documento possui pouco ou nenhum texto identificável para gerar um quiz.',
      )
      $app.save(recordToUpdate)
      return e.next()
    }

    // Salvar o conteúdo extraído no quiz se ainda não estiver salvo
    if (!existingContent) {
      recordToUpdate.set('conteudo_extraido', markdown)
    }

    // 3. Gerar perguntas com Skip AI ($ai.chat)
    const systemPrompt =
      'Você é um especialista educacional e criador de quizzes interativos em português (PT-BR). Analise o documento em Markdown fornecido e gere um quiz rico, instigante e bem estruturado. Você DEVE retornar APENAS um JSON válido e puro sem formatação markdown extra fora do json.'

    const userPrompt =
      'Abaixo está o conteúdo extraído de um documento (' +
      ext.toUpperCase() +
      ' - ' +
      originalFileName +
      (isTruncated ? ' [conteúdo parcial devido ao tamanho do arquivo]' : '') +
      '):\n\n' +
      markdown.slice(0, 32000) +
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
    } catch (aiErr) {
      console.log('Erro ao chamar Skip AI:', aiErr)
      recordToUpdate.set('status_processamento', 'erro')
      recordToUpdate.set(
        'erro_processamento',
        'Erro ao formular perguntas com a inteligência artificial. Tente processar novamente.',
      )
      $app.save(recordToUpdate)
      return e.next()
    }

    let generatedContent = ''
    if (aiResponse && aiResponse.choices && aiResponse.choices.length > 0) {
      generatedContent = aiResponse.choices[0].message.content || ''
    }

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

    let quizData = null
    try {
      quizData = JSON.parse(jsonString)
    } catch (parseErr) {
      console.log('Falha ao parsear JSON direto da IA, tentando extrair objeto {}:', parseErr)
      const firstBrace = jsonString.indexOf('{')
      const lastBrace = jsonString.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace !== -1) {
        try {
          quizData = JSON.parse(jsonString.substring(firstBrace, lastBrace + 1))
        } catch (innerErr) {
          console.log('JSON parse falhou no bloco isolado:', innerErr)
        }
      }
    }

    if (!quizData || !Array.isArray(quizData.perguntas) || quizData.perguntas.length === 0) {
      recordToUpdate.set('status_processamento', 'erro')
      recordToUpdate.set(
        'erro_processamento',
        'A IA não conseguiu estruturar as perguntas no formato esperado. Tente reenviar o documento.',
      )
      $app.save(recordToUpdate)
      return e.next()
    }

    const quizTitle =
      (quizData.nome_quiz && quizData.nome_quiz.trim()) ||
      recordToUpdate.getString('nome_quiz') ||
      'Quiz: ' + originalFileName

    const questionsList = quizData.perguntas

    // 4. Salvar as perguntas criadas na coleção 'perguntas'
    const perguntasCol = $app.findCollectionByNameOrId('perguntas')
    for (let i = 0; i < questionsList.length; i++) {
      const q = questionsList[i]
      const pRecord = new Record(perguntasCol)
      pRecord.set('quiz_id', recordId)
      pRecord.set('enunciado', q.enunciado || 'Pergunta ' + (i + 1))
      const qTipo = q.tipo === 'aberta' ? 'aberta' : 'multipla_escolha'
      pRecord.set('tipo', qTipo)
      pRecord.set('opcoes', Array.isArray(q.opcoes) ? q.opcoes : null)
      pRecord.set('resposta_correta', q.resposta_correta || null)
      pRecord.set('explicacao', q.explicacao || '')
      pRecord.set('ordem', i + 1)
      $app.save(pRecord)
    }

    // 5. Finalizar atualização do quiz para status 'concluido'
    recordToUpdate.set('nome_quiz', quizTitle)
    recordToUpdate.set('total_perguntas', questionsList.length)
    recordToUpdate.set('status_processamento', 'concluido')
    recordToUpdate.set('erro_processamento', '')
    $app.save(recordToUpdate)
  } catch (globalErr) {
    console.log('Erro inesperado no hook onRecordAfterCreateSuccess(quizzes):', globalErr)
    try {
      const recordToUpdate = $app.findRecordById('quizzes', recordId)
      recordToUpdate.set('status_processamento', 'erro')
      recordToUpdate.set(
        'erro_processamento',
        'Erro interno no processamento do documento. Tente novamente.',
      )
      $app.save(recordToUpdate)
    } catch (_) {}
  }

  return e.next()
}, 'quizzes')

/**
 * Rota auxiliar para caso o usuário queira reprocessar um quiz existente
 * ou disparar o processamento sob demanda sem re-upload:
 * POST /backend/v1/quizzes/{id}/reprocess
 */
routerAdd(
  'POST',
  '/backend/v1/quizzes/{id}/reprocess',
  (e) => {
    const authUser = e.auth
    if (!authUser || !authUser.id) {
      return e.json(401, { message: 'Não autorizado' })
    }

    const quizId = e.request.pathValue('id')
    let quizRecord
    try {
      quizRecord = $app.findRecordById('quizzes', quizId)
    } catch (_) {
      return e.json(404, { message: 'Quiz não encontrado' })
    }

    if (quizRecord.getString('usuario_id') !== authUser.id) {
      return e.json(403, { message: 'Acesso negado' })
    }

    const arquivoName = quizRecord.getString('arquivo')
    const conteudo = quizRecord.getString('conteudo_extraido')
    if (!arquivoName && !conteudo) {
      return e.json(400, {
        message: 'Este quiz não possui arquivo anexado ou conteúdo para reprocessamento.',
      })
    }

    quizRecord.set('status_processamento', 'processando')
    quizRecord.set('erro_processamento', '')
    $app.save(quizRecord)

    return e.json(200, {
      success: true,
      quiz_id: quizId,
      status: 'processando',
    })
  },
  $apis.requireAuth(),
)
