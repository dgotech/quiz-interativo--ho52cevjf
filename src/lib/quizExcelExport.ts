import * as XLSX from 'xlsx'
import type { PerguntaRecord, TentativaRecord, QuizRecord } from '@/types/quiz'

/**
 * Utilitário para exportação de dados do Quiz para formato Excel (.xlsx real / ZIP OOXML)
 *
 * Gera um arquivo binário .xlsx moderno e válido usando a biblioteca `xlsx` (SheetJS),
 * abrindo perfeitamente e sem avisos de integridade ou extensão no Microsoft Excel (desktop e 365),
 * LibreOffice Calc, Google Sheets e visualizadores móveis.
 *
 * Contém duas abas estruturadas:
 * 1. "Perguntas e Respostas": Ordem, Tipo, Enunciado, Alternativas A-D, Gabarito / Resposta Correta, Explicação Pedagógica
 * 2. "Histórico de Tentativas": Nº Tentativa, Participante, Tipo/Perfil, Data e Hora, Pontuação (% Acertos), Total de Questões, Acertos Estimados
 */

export function sanitizeFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'quiz'
  )
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

/**
 * Exporta os dados do quiz para uma planilha .xlsx autêntica com duas abas formatadas.
 */
export function exportarQuizParaExcel(
  quiz: QuizRecord,
  perguntas: PerguntaRecord[],
  tentativas: TentativaRecord[] = [],
) {
  const baseFileName = `quiz-${sanitizeFileName(quiz.nome_quiz || 'perguntas')}-perguntas.xlsx`

  try {
    const workbook = XLSX.utils.book_new()

    // ----------------------------------------------------
    // Aba 1: "Perguntas e Respostas"
    // ----------------------------------------------------
    const headersPerguntas = [
      'Nº',
      'Tipo da Pergunta',
      'Enunciado',
      'Alternativa A',
      'Alternativa B',
      'Alternativa C',
      'Alternativa D',
      'Gabarito / Resposta Correta',
      'Explicação Pedagógica',
    ]

    const dadosPerguntas: (string | number)[][] = [headersPerguntas]

    perguntas.forEach((p, idx) => {
      const ordem = p.ordem || idx + 1
      const tipo = p.tipo === 'multipla_escolha' ? 'Múltipla Escolha' : 'Aberta / Dissertativa'
      const enunciado = p.enunciado || ''

      const opA = p.opcoes?.find((o) => o.label === 'A')?.texto || ''
      const opB = p.opcoes?.find((o) => o.label === 'B')?.texto || ''
      const opC = p.opcoes?.find((o) => o.label === 'C')?.texto || ''
      const opD = p.opcoes?.find((o) => o.label === 'D')?.texto || ''

      let gabarito = ''
      if (p.tipo === 'multipla_escolha') {
        const correctOp = p.opcoes?.find((o) => o.label === p.resposta_correta)
        gabarito = p.resposta_correta
          ? `Opção ${p.resposta_correta}${correctOp ? ` - ${correctOp.texto}` : ''}`
          : ''
      } else {
        gabarito = p.resposta_correta || 'Resposta dissertativa livre'
      }

      const explicacao = p.explicacao || ''

      dadosPerguntas.push([ordem, tipo, enunciado, opA, opB, opC, opD, gabarito, explicacao])
    })

    const wsPerguntas = XLSX.utils.aoa_to_sheet(dadosPerguntas)

    // Largura recomendada das colunas para legibilidade e visualização confortável
    wsPerguntas['!cols'] = [
      { wch: 6 }, // Nº
      { wch: 22 }, // Tipo da Pergunta
      { wch: 55 }, // Enunciado
      { wch: 32 }, // Alternativa A
      { wch: 32 }, // Alternativa B
      { wch: 32 }, // Alternativa C
      { wch: 32 }, // Alternativa D
      { wch: 38 }, // Gabarito / Resposta Correta
      { wch: 50 }, // Explicação Pedagógica
    ]

    XLSX.utils.book_append_sheet(workbook, wsPerguntas, 'Perguntas e Respostas')

    // ----------------------------------------------------
    // Aba 2: "Histórico de Tentativas"
    // ----------------------------------------------------
    const headersTentativas = [
      'Tentativa',
      'Nome do Participante',
      'Perfil / Vínculo',
      'Data e Hora',
      'Pontuação (% Acertos)',
      'Total de Questões',
      'Acertos Estimados',
    ]

    const dadosTentativas: (string | number)[][] = [headersTentativas]

    if (tentativas.length === 0) {
      dadosTentativas.push([
        '—',
        'Nenhuma tentativa realizada até o momento.',
        '—',
        '—',
        '—',
        perguntas.length || quiz.total_perguntas || 0,
        '—',
      ])
    } else {
      tentativas.forEach((t, idx) => {
        const numTentativa = tentativas.length - idx
        const nome = t.nome_jogador
          ? `${t.nome_jogador} (Convidado)`
          : 'Administrador / Dono do Quiz'
        const tipoPart = t.nome_jogador ? 'Convidado (Link Público)' : 'Usuário Autenticado'

        let dataFormatada = t.created || ''
        try {
          const d = new Date(t.created)
          if (!isNaN(d.getTime())) {
            dataFormatada = d.toLocaleString('pt-BR')
          }
        } catch {
          /* intentionally ignored */
        }

        const totalQ = perguntas.length || quiz.total_perguntas || 10
        const score = typeof t.pontuacao === 'number' ? t.pontuacao : 0
        const acertos = Math.round((score / 100) * totalQ)

        dadosTentativas.push([numTentativa, nome, tipoPart, dataFormatada, score, totalQ, acertos])
      })
    }

    const wsTentativas = XLSX.utils.aoa_to_sheet(dadosTentativas)

    wsTentativas['!cols'] = [
      { wch: 12 }, // Tentativa
      { wch: 35 }, // Nome do Participante
      { wch: 28 }, // Perfil / Vínculo
      { wch: 22 }, // Data e Hora
      { wch: 24 }, // Pontuação (% Acertos)
      { wch: 18 }, // Total de Questões
      { wch: 18 }, // Acertos Estimados
    ]

    XLSX.utils.book_append_sheet(workbook, wsTentativas, 'Histórico de Tentativas')

    // Gerar o binário XLSX no navegador como ArrayBuffer (ZIP OOXML válido)
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    })

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', baseFileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    return { success: true, fileName: baseFileName }
  } catch (err) {
    console.warn('Erro ao gerar XLSX real com SheetJS, tentando fallback CSV:', err)
    return exportarQuizParaCSV(quiz, perguntas, tentativas)
  }
}

/**
 * Fallback em formato CSV com UTF-8 BOM (; como delimitador comum no Excel em português)
 */
export function exportarQuizParaCSV(
  quiz: QuizRecord,
  perguntas: PerguntaRecord[],
  _tentativas: TentativaRecord[] = [],
) {
  const csvFileName = `quiz-${sanitizeFileName(quiz.nome_quiz || 'perguntas')}-perguntas.csv`

  const headers = [
    'Nº',
    'Tipo',
    'Enunciado',
    'Alternativa A',
    'Alternativa B',
    'Alternativa C',
    'Alternativa D',
    'Gabarito Correto',
    'Explicação',
  ]

  const csvLines: string[] = []
  csvLines.push(headers.map(escapeCsvCell).join(';'))

  perguntas.forEach((p, idx) => {
    const ordem = p.ordem || idx + 1
    const tipo = p.tipo === 'multipla_escolha' ? 'Múltipla Escolha' : 'Aberta / Dissertativa'
    const enunciado = p.enunciado || ''
    const opA = p.opcoes?.find((o) => o.label === 'A')?.texto || ''
    const opB = p.opcoes?.find((o) => o.label === 'B')?.texto || ''
    const opC = p.opcoes?.find((o) => o.label === 'C')?.texto || ''
    const opD = p.opcoes?.find((o) => o.label === 'D')?.texto || ''

    let gabarito = ''
    if (p.tipo === 'multipla_escolha') {
      const correctOp = p.opcoes?.find((o) => o.label === p.resposta_correta)
      gabarito = p.resposta_correta
        ? `Opção ${p.resposta_correta}${correctOp ? ` - ${correctOp.texto}` : ''}`
        : ''
    } else {
      gabarito = p.resposta_correta || 'Resposta dissertativa'
    }

    const explicacao = p.explicacao || ''

    const line = [ordem, tipo, enunciado, opA, opB, opC, opD, gabarito, explicacao]

    csvLines.push(line.map(escapeCsvCell).join(';'))
  })

  // Prepend BOM \uFEFF para Excel no Windows reconhecer UTF-8 automaticamente
  const csvContent = '\uFEFF' + csvLines.join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', csvFileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return { success: true, fileName: csvFileName }
}
