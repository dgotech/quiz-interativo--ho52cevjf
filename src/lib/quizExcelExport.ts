import type { PerguntaRecord, TentativaRecord, QuizRecord } from '@/types/quiz'

/**
 * Utilitário para exportação de dados do Quiz para formato Excel (.xlsx / XML Spreadsheet 2003 / CSV UTF-8)
 *
 * Implementa XML Spreadsheet 2003 (MIME application/vnd.ms-excel), padrão suportado nativamente por todas as versões
 * do Microsoft Excel (Office 2003 até 2024 / Microsoft 365), LibreOffice Calc e Google Sheets, com suporte a:
 * - Múltiplas abas / planilhas ("Perguntas e Gabarito" e "Histórico de Tentativas")
 * - Formatação rica com cabeçalhos destacados, bordas, cores elegantes e ajuste de largura de coluna
 * - Sem dependências pesadas externas e 100% livre de incompatibilidades de runtime ou scripts nativos.
 *
 * Também fornece fallback em CSV UTF-8 com BOM.
 */

function sanitizeXml(val: unknown): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""'
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

export function exportarQuizParaExcel(
  quiz: QuizRecord,
  perguntas: PerguntaRecord[],
  tentativas: TentativaRecord[] = [],
) {
  const sanitizeFileName = (name: string) => {
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

  const baseFileName = `quiz-${sanitizeFileName(quiz.nome_quiz || 'perguntas')}-perguntas.xlsx`

  // 1. Aba Perguntas:
  // Colunas: Nº Ordem, Tipo, Enunciado, Alternativa A, Alternativa B, Alternativa C, Alternativa D, Resposta Correta (Gabarito), Explicação Pedagógica
  const rowsPerguntasXml: string[] = []

  // Header row
  rowsPerguntasXml.push(`
    <Row ss:Height="26">
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Nº</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Tipo da Pergunta</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Enunciado</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Alternativa A</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Alternativa B</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Alternativa C</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Alternativa D</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Gabarito / Resposta Correta</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Explicação Pedagógica</Data></Cell>
    </Row>
  `)

  // Linhas das perguntas
  perguntas.forEach((p, idx) => {
    const ordem = p.ordem || idx + 1
    const tipo = p.tipo === 'multipla_escolha' ? 'Múltipla Escolha' : 'Aberta / Dissertativa'
    const enunciado = sanitizeXml(p.enunciado)

    const opA = sanitizeXml(p.opcoes?.find((o) => o.label === 'A')?.texto || '')
    const opB = sanitizeXml(p.opcoes?.find((o) => o.label === 'B')?.texto || '')
    const opC = sanitizeXml(p.opcoes?.find((o) => o.label === 'C')?.texto || '')
    const opD = sanitizeXml(p.opcoes?.find((o) => o.label === 'D')?.texto || '')

    let gabarito = ''
    if (p.tipo === 'multipla_escolha') {
      const correctOp = p.opcoes?.find((o) => o.label === p.resposta_correta)
      gabarito = sanitizeXml(
        p.resposta_correta
          ? `Opção ${p.resposta_correta}${correctOp ? ` - ${correctOp.texto}` : ''}`
          : '',
      )
    } else {
      gabarito = sanitizeXml(p.resposta_correta || 'Resposta dissertativa livre')
    }

    const explicacao = sanitizeXml(p.explicacao || '')
    const rowStyle = idx % 2 === 0 ? 'DataRowEven' : 'DataRowOdd'

    rowsPerguntasXml.push(`
      <Row ss:AutoFitHeight="1">
        <Cell ss:StyleID="${rowStyle}Center"><Data ss:Type="Number">${ordem}</Data></Cell>
        <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${tipo}</Data></Cell>
        <Cell ss:StyleID="${rowStyle}Wrap"><Data ss:Type="String">${enunciado}</Data></Cell>
        <Cell ss:StyleID="${rowStyle}Wrap"><Data ss:Type="String">${opA}</Data></Cell>
        <Cell ss:StyleID="${rowStyle}Wrap"><Data ss:Type="String">${opB}</Data></Cell>
        <Cell ss:StyleID="${rowStyle}Wrap"><Data ss:Type="String">${opC}</Data></Cell>
        <Cell ss:StyleID="${rowStyle}Wrap"><Data ss:Type="String">${opD}</Data></Cell>
        <Cell ss:StyleID="${rowStyle}Highlight"><Data ss:Type="String">${gabarito}</Data></Cell>
        <Cell ss:StyleID="${rowStyle}Wrap"><Data ss:Type="String">${explicacao}</Data></Cell>
      </Row>
    `)
  })

  // 2. Aba Tentativas:
  // Colunas: Nº Tentativa, Participante, Tipo Participante, Data de Realização, Pontuação (% Acertos), Perguntas Respondidas, Perguntas Corretas
  const rowsTentativasXml: string[] = []

  rowsTentativasXml.push(`
    <Row ss:Height="26">
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Tentativa</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Nome do Participante</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Perfil / Vínculo</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Data e Hora</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Pontuação (% Acertos)</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Total de Questões</Data></Cell>
      <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">Acertos Estimados</Data></Cell>
    </Row>
  `)

  if (tentativas.length === 0) {
    rowsTentativasXml.push(`
      <Row>
        <Cell ss:StyleID="DataRowEven" ss:MergeAcross="6"><Data ss:Type="String">Nenhuma tentativa realizada até o momento.</Data></Cell>
      </Row>
    `)
  } else {
    tentativas.forEach((t, idx) => {
      const numTentativa = tentativas.length - idx
      const nome = sanitizeXml(
        t.nome_jogador ? `${t.nome_jogador} (Convidado)` : 'Administrador / Dono do Quiz',
      )
      const tipoPart = t.nome_jogador ? 'Convidado (Link Público)' : 'Usuário Autenticado'
      let dataFormatada = t.created
      try {
        const d = new Date(t.created)
        dataFormatada = d.toLocaleString('pt-BR')
      } catch {
        /* intentionally ignored */
      }

      const totalQ = perguntas.length || quiz.total_perguntas || 10
      const score = t.pontuacao ?? 0
      const acertos = Math.round((score / 100) * totalQ)
      const rowStyle = idx % 2 === 0 ? 'DataRowEven' : 'DataRowOdd'

      rowsTentativasXml.push(`
        <Row ss:AutoFitHeight="1">
          <Cell ss:StyleID="${rowStyle}Center"><Data ss:Type="Number">${numTentativa}</Data></Cell>
          <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${nome}</Data></Cell>
          <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${tipoPart}</Data></Cell>
          <Cell ss:StyleID="${rowStyle}"><Data ss:Type="String">${dataFormatada}</Data></Cell>
          <Cell ss:StyleID="${rowStyle}Center"><Data ss:Type="Number">${score}</Data></Cell>
          <Cell ss:StyleID="${rowStyle}Center"><Data ss:Type="Number">${totalQ}</Data></Cell>
          <Cell ss:StyleID="${rowStyle}Center"><Data ss:Type="Number">${acertos}</Data></Cell>
        </Row>
      `)
    })
  }

  // Montagem do XML Spreadsheet completo compatível com Excel
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${sanitizeXml(quiz.nome_quiz)}</Title>
  <Subject>Quiz Interativo e Gabarito - QuizDoc AI</Subject>
  <Author>QuizDoc AI</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#1A1D2E"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#4F46E5"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#6C4DF6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowEven">
   <Alignment ss:Vertical="Top"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowEvenCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Top"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#6C4DF6"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowEvenWrap">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowEvenHighlight">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#065F46"/>
   <Interior ss:Color="#ECFDF5" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowOdd">
   <Alignment ss:Vertical="Top"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowOddCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Top"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#6C4DF6"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowOddWrap">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRowOddHighlight">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#A7F3D0"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Bold="1" ss:Color="#065F46"/>
   <Interior ss:Color="#F0FDF4" ss:Pattern="Solid"/>
  </Style>
 </Styles>

 <Worksheet ss:Name="Perguntas e Respostas">
  <Table x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="20">
   <Column ss:Width="36"/>
   <Column ss:Width="110"/>
   <Column ss:Width="320"/>
   <Column ss:Width="200"/>
   <Column ss:Width="200"/>
   <Column ss:Width="200"/>
   <Column ss:Width="200"/>
   <Column ss:Width="220"/>
   <Column ss:Width="300"/>
   ${rowsPerguntasXml.join('\n')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup>
    <Layout x:Orientation="Landscape"/>
   </PageSetup>
   <Selected/>
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitPane>
    <PaneNumber>2</PaneNumber>
    <ActiveRow>1</ActiveRow>
   </SplitPane>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>

 <Worksheet ss:Name="Histórico de Tentativas">
  <Table x:FullColumns="1" x:FullRows="1" ss:DefaultRowHeight="20">
   <Column ss:Width="65"/>
   <Column ss:Width="200"/>
   <Column ss:Width="160"/>
   <Column ss:Width="140"/>
   <Column ss:Width="120"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   ${rowsTentativasXml.join('\n')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`

  try {
    const blob = new Blob([xmlContent], {
      type: 'application/vnd.ms-excel;charset=utf-8',
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
    console.warn('Erro ao disparar download do XML Excel, fallback para CSV:', err)
    // Fallback: CSV com BOM UTF-8
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
  const sanitizeFileName = (name: string) => {
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
