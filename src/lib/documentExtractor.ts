/**
 * Utilitário de extração direta de texto no cliente para arquivos PPTX e XLSX
 * usando as APIs nativas do navegador (DecompressionStream 'deflate-raw' ou 'gzip', DOMParser).
 *
 * Arquivos .pptx e .xlsx são containers ZIP padrão PKZIP que contêm arquivos XML com todo o texto:
 * - PPTX: ppt/slides/slide*.xml (tags <a:t>) e ppt/notesSlides/notesSlide*.xml
 * - XLSX: xl/sharedStrings.xml (tags <t>) e xl/worksheets/sheet*.xml (tags <v>, <t>)
 *
 * Isso permite extrair 100% do conteúdo textual de apresentações de 26MB+ em milissegundos
 * diretamente no navegador, transformando 26MB em poucos kilobytes de texto estruturado em Markdown,
 * contornando qualquer limite rígido de proxy reverso (ex: 10MB/16MB/32MB de body).
 */

interface ZipLocalEntry {
  fileName: string
  compressionMethod: number
  compressedSize: number
  uncompressedSize: number
  dataOffset: number
}

/**
 * Lê entradas de arquivos locais de um ArrayBuffer de arquivo ZIP
 */
function parseZipEntries(buffer: ArrayBuffer): ZipLocalEntry[] {
  const dataView = new DataView(buffer)
  const entries: ZipLocalEntry[] = []
  let offset = 0
  const maxLen = buffer.byteLength

  // Percorre entradas locais (PK\x03\x04 = 0x04034b50)
  while (offset + 30 <= maxLen) {
    const sig = dataView.getUint32(offset, true)
    if (sig !== 0x04034b50) {
      // Se não for mais cabeçalho local (chegou ao diretório central 0x02014b50), interrompe
      break
    }

    const generalPurpose = dataView.getUint16(offset + 6, true)
    const compressionMethod = dataView.getUint16(offset + 8, true)
    let compressedSize = dataView.getUint32(offset + 18, true)
    let uncompressedSize = dataView.getUint32(offset + 22, true)
    const fileNameLength = dataView.getUint16(offset + 26, true)
    const extraLength = dataView.getUint16(offset + 28, true)

    const fileNameBytes = new Uint8Array(buffer, offset + 30, fileNameLength)
    const fileName = new TextDecoder('utf-8').decode(fileNameBytes)
    const dataOffset = offset + 30 + fileNameLength + extraLength

    // Se o bit 3 (data descriptor) estiver ligado e compressedSize for 0,
    // precisamos estimar ou ler do data descriptor após o stream
    const hasDataDescriptor = (generalPurpose & 0x08) !== 0

    if (!hasDataDescriptor || compressedSize > 0) {
      entries.push({
        fileName,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        dataOffset,
      })
      offset = dataOffset + compressedSize
    } else {
      // Procura a próxima assinatura PK para avançar com segurança
      let nextPk = dataOffset
      while (nextPk + 4 <= maxLen) {
        if (
          dataView.getUint32(nextPk, true) === 0x04034b50 ||
          dataView.getUint32(nextPk, true) === 0x02014b50
        ) {
          break
        }
        nextPk++
      }
      compressedSize = nextPk - dataOffset
      entries.push({
        fileName,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        dataOffset,
      })
      offset = nextPk
    }
  }

  return entries
}

/**
 * Descomprime um trecho de dados do arquivo ZIP
 */
async function decompressEntry(buffer: ArrayBuffer, entry: ZipLocalEntry): Promise<string> {
  if (entry.compressedSize <= 0) return ''

  const rawBytes = new Uint8Array(buffer, entry.dataOffset, entry.compressedSize)

  if (entry.compressionMethod === 0x00) {
    // Não comprimido
    return new TextDecoder('utf-8').decode(rawBytes)
  }

  if (entry.compressionMethod === 0x08) {
    // DEFLATE
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(rawBytes)
            controller.close()
          },
        })
        const ds = new DecompressionStream('deflate-raw')
        const decompressedStream = stream.pipeThrough(ds)
        const response = new Response(decompressedStream)
        const blob = await response.blob()
        return await blob.text()
      } catch (err) {
        console.warn(`Falha ao descomprimir ${entry.fileName} com deflate-raw:`, err)
      }
    }
  }

  // Fallback caso não seja possível descomprimir via stream (ex: caracteres legíveis brutos)
  return new TextDecoder('utf-8', { fatal: false }).decode(rawBytes)
}

/**
 * Extrai texto de apresentação PowerPoint (.pptx)
 */
export async function extrairTextoPPTXNoCliente(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const entries = parseZipEntries(arrayBuffer)

  // Filtrar arquivos de slides e notas: ppt/slides/slide*.xml e ppt/notesSlides/notesSlide*.xml
  const slideEntries = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.fileName))
    .sort((a, b) => {
      const numA = parseInt(a.fileName.replace(/\D/g, ''), 10) || 0
      const numB = parseInt(b.fileName.replace(/\D/g, ''), 10) || 0
      return numA - numB
    })

  const notesEntries = entries.filter((e) =>
    /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(e.fileName),
  )

  const slideResults: string[] = []

  for (let i = 0; i < slideEntries.length; i++) {
    const entry = slideEntries[i]
    try {
      const xmlString = await decompressEntry(arrayBuffer, entry)
      if (!xmlString) continue

      // Extrair tags <a:t>...</a:t>
      const textMatches = xmlString.match(/<a:t[^>]*>([^<]+)<\/a:t>/g)
      if (textMatches && textMatches.length > 0) {
        const texts = textMatches
          .map((m) => m.replace(/<[^>]+>/g, '').trim())
          .filter((t) => t.length > 0)

        if (texts.length > 0) {
          slideResults.push(`### Slide ${i + 1}\n` + texts.join('\n'))
        }
      }
    } catch (slideErr) {
      console.warn(`Erro ao extrair slide ${entry.fileName}:`, slideErr)
    }
  }

  // Extrair notas adicionais se houver
  for (let i = 0; i < notesEntries.length; i++) {
    const entry = notesEntries[i]
    try {
      const xmlString = await decompressEntry(arrayBuffer, entry)
      const textMatches = xmlString.match(/<a:t[^>]*>([^<]+)<\/a:t>/g)
      if (textMatches && textMatches.length > 0) {
        const texts = textMatches
          .map((m) => m.replace(/<[^>]+>/g, '').trim())
          .filter((t) => t.length > 0 && !t.startsWith('Slide '))
        if (texts.length > 0) {
          slideResults.push(`#### Notas Adicionais:\n` + texts.join('\n'))
        }
      }
    } catch {
      /* intentionally ignored */
    }
  }

  return slideResults.join('\n\n')
}

/**
 * Extrai texto de planilha Excel (.xlsx)
 */
export async function extrairTextoXLSXNoCliente(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const entries = parseZipEntries(arrayBuffer)

  // 1. Extrair sharedStrings.xml (tabela de strings compartilhadas do Excel)
  const sharedStringEntry = entries.find((e) => /xl\/sharedStrings\.xml$/i.test(e.fileName))
  const sharedStrings: string[] = []

  if (sharedStringEntry) {
    try {
      const xml = await decompressEntry(arrayBuffer, sharedStringEntry)
      const matches = xml.match(/<t[^>]*>([^<]*)<\/t>/g)
      if (matches) {
        for (const m of matches) {
          sharedStrings.push(m.replace(/<[^>]+>/g, '').trim())
        }
      }
    } catch (err) {
      console.warn('Erro ao ler sharedStrings.xml:', err)
    }
  }

  // 2. Extrair dados das planilhas: xl/worksheets/sheet*.xml
  const sheetEntries = entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(e.fileName))
  const sheetResults: string[] = []

  for (let s = 0; s < sheetEntries.length; s++) {
    const entry = sheetEntries[s]
    try {
      const xml = await decompressEntry(arrayBuffer, entry)
      // Buscar linhas <row>
      const rowMatches = xml.match(/<row[^>]*>([\s\S]*?)<\/row>/g)
      if (rowMatches && rowMatches.length > 0) {
        const rowsText: string[] = []
        for (const rowXml of rowMatches.slice(0, 100)) {
          // Extrair células
          const cellMatches = rowXml.match(/<c[^>]*>([\s\S]*?)<\/c>/g)
          if (!cellMatches) continue

          const cellVals: string[] = []
          for (const cellXml of cellMatches) {
            const isShared = cellXml.includes('t="s"')
            const valMatch = cellXml.match(/<v>([^<]+)<\/v>/)
            if (valMatch) {
              const val = valMatch[1]
              if (isShared) {
                const sIdx = parseInt(val, 10)
                cellVals.push(sharedStrings[sIdx] || val)
              } else {
                cellVals.push(val)
              }
            } else {
              // Tenta tag inline <t>
              const tMatch = cellXml.match(/<t[^>]*>([^<]+)<\/t>/)
              if (tMatch) cellVals.push(tMatch[1])
            }
          }
          if (cellVals.length > 0) {
            rowsText.push(cellVals.join(' | '))
          }
        }

        if (rowsText.length > 0) {
          sheetResults.push(`### Planilha ${s + 1}\n` + rowsText.join('\n'))
        }
      }
    } catch (err) {
      console.warn(`Erro ao ler ${entry.fileName}:`, err)
    }
  }

  return sheetResults.join('\n\n')
}

/**
 * Função unificada para extrair texto no cliente quando necessário
 */
export async function extrairTextoDocumentoNoCliente(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx') {
    return extrairTextoXLSXNoCliente(file)
  }
  return extrairTextoPPTXNoCliente(file)
}
