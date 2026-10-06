import pb from '@/lib/pocketbase/client'
import type { QuizRecord, PerguntaRecord, TentativaRecord, UserRecord } from '@/types/quiz'
import { extrairTextoDocumentoNoCliente } from '@/lib/documentExtractor'

export const quizService = {
  // Obter quizzes do usuário logado
  async getQuizzes(sort = '-created'): Promise<QuizRecord[]> {
    return pb.collection('quizzes').getFullList<QuizRecord>({
      sort,
    })
  },

  // Obter quiz único por ID
  async getQuiz(id: string): Promise<QuizRecord> {
    return pb.collection('quizzes').getOne<QuizRecord>(id)
  },

  // Obter quiz público ativo por token
  async getQuizByToken(token: string): Promise<QuizRecord> {
    return pb
      .collection('quizzes')
      .getFirstListItem<QuizRecord>(`token_publico = "${token}" && publico_ativo = true`)
  },

  // Alternar ou atualizar status de compartilhamento público de um quiz
  async alternarCompartilhamento(id: string, publicoAtivo: boolean): Promise<QuizRecord> {
    return pb.collection('quizzes').update<QuizRecord>(id, {
      publico_ativo: publicoAtivo,
    })
  },

  // Gerar novo token público para o quiz (caso queira renovar link)
  async regenerarToken(id: string): Promise<QuizRecord> {
    // Gerar token de 32 caracteres alfanuméricos
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return pb.collection('quizzes').update<QuizRecord>(id, {
      token_publico: token,
      publico_ativo: true,
    })
  },

  // Obter perguntas de um quiz ordenadas por ordem asc
  async getPerguntas(quizId: string): Promise<PerguntaRecord[]> {
    return pb.collection('perguntas').getFullList<PerguntaRecord>({
      filter: `quiz_id = "${quizId}"`,
      sort: 'ordem',
    })
  },

  // Atualizar uma pergunta existente
  async atualizarPergunta(
    id: string,
    data: Partial<Omit<PerguntaRecord, 'id' | 'quiz_id' | 'created' | 'updated'>>,
  ): Promise<PerguntaRecord> {
    return pb.collection('perguntas').update<PerguntaRecord>(id, data)
  },

  // Criar uma nova pergunta no quiz
  async criarPergunta(
    data: Omit<PerguntaRecord, 'id' | 'created' | 'updated'>,
  ): Promise<PerguntaRecord> {
    return pb.collection('perguntas').create<PerguntaRecord>(data)
  },

  // Excluir uma pergunta
  async excluirPergunta(id: string): Promise<boolean> {
    return pb.collection('perguntas').delete(id)
  },

  // Reordenar perguntas em lote atualizando o campo ordem
  async reordenarPerguntas(
    perguntasComNovaOrdem: Array<{ id: string; ordem: number }>,
  ): Promise<void> {
    await Promise.all(
      perguntasComNovaOrdem.map((p) => pb.collection('perguntas').update(p.id, { ordem: p.ordem })),
    )
  },

  // Obter tentativas de um quiz
  async getTentativasDoQuiz(quizId: string): Promise<TentativaRecord[]> {
    return pb.collection('tentativas').getFullList<TentativaRecord>({
      filter: `quiz_id = "${quizId}"`,
      sort: '-created',
    })
  },

  // Obter todas as tentativas do usuário
  async getMinhasTentativas(): Promise<TentativaRecord[]> {
    return pb.collection('tentativas').getFullList<TentativaRecord>({
      sort: '-created',
    })
  },

  // Salvar uma tentativa realizada
  async salvarTentativa(data: {
    quiz_id: string
    usuario_id?: string
    nome_jogador?: string
    respostas: Array<{ pergunta_id: string; resposta_dada: string; correta?: boolean }>
    pontuacao: number
  }): Promise<TentativaRecord> {
    return pb.collection('tentativas').create<TentativaRecord>(data)
  },

  // Excluir quiz
  async excluirQuiz(id: string): Promise<boolean> {
    return pb.collection('quizzes').delete(id)
  },

  // Validar se a sessão atual ainda é válida no backend antes de operações pesadas
  async validarSessao(): Promise<{
    valida: boolean
    erro?: 'SESSION_EXPIRED' | 'NETWORK_WARNING'
  }> {
    if (!pb.authStore.isValid || !pb.authStore.token) {
      return { valida: false, erro: 'SESSION_EXPIRED' }
    }
    try {
      // Salvar snapshot antes caso o authRefresh falhe por oscilação de rede
      const prevToken = pb.authStore.token
      const prevModel = pb.authStore.model
      try {
        await pb.collection('users').authRefresh()
        return { valida: true }
      } catch (refreshErr: unknown) {
        const status =
          (refreshErr as { status?: number })?.status ||
          (refreshErr as { response?: { status?: number } })?.response?.status

        // Apenas consideramos sessão expirada e limpamos se o backend retornou 401 ou 403 explicitamente
        if (status === 401 || status === 403) {
          pb.authStore.clear()
          return { valida: false, erro: 'SESSION_EXPIRED' }
        }

        // Se foi erro de rede (Failed to fetch, timeout, 5xx), restaurar token anterior se o authStore tiver sido esvaziado
        if (!pb.authStore.token && prevToken) {
          pb.authStore.save(prevToken, prevModel)
        }

        console.warn(
          'Verificação de sessão online não concluiu (rede/servidor instável). Mantendo token local:',
          refreshErr,
        )
        return { valida: true, erro: 'NETWORK_WARNING' }
      }
    } catch (outerErr: unknown) {
      console.warn('Erro defensivo ao validar sessão:', outerErr)
      return { valida: pb.authStore.isValid }
    }
  },

  // Gerar novo token de 32 chars
  gerarTokenAleatorio(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return token
  },

  /**
   * Envia o documento para processamento inteligente:
   *
   * 1. Para arquivos normais (<= 12MB): envia o binário completo diretamente pelo canal nativo
   *    do PocketBase (POST /api/collections/quizzes/records).
   * 2. Para arquivos pesados (> 12MB, como apresentações ricas com mídias de 25MB+):
   *    extrai o texto e conteúdo dos slides diretamente no navegador em milissegundos
   *    usando DecompressionStream nativo e envia o conteúdo estruturado sem o peso das imagens/vídeos.
   *    Isso garante 100% de sucesso mesmo com limites rígidos de proxy de infraestrutura (10MB-16MB)
   *    e velocidade ultrarrápida.
   * 3. Se um upload de arquivo direto falhar por queda de conexão/proxy, realiza fallback inteligente
   *    para a extração textual local automaticamente.
   */
  async criarQuizEProcessar(
    file: File,
    onProgress?: (phase: string) => void,
    signal?: AbortSignal,
  ): Promise<{ quiz_id: string; nome_quiz: string; total_perguntas: number; truncated?: boolean }> {
    // Preservar snapshot da sessão
    const initialToken = pb.authStore.token
    const initialModel = pb.authStore.model

    if (!pb.authStore.isValid || !initialToken) {
      const err = new Error('Sua sessão expirou. Faça login novamente para enviar seu documento.')
      ;(err as { code?: string }).code = 'SESSION_EXPIRED'
      throw err
    }

    const ensureAuth = () => {
      if (initialToken && (!pb.authStore.token || !pb.authStore.isValid)) {
        pb.authStore.save(initialToken, initialModel)
      }
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'pptx'
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '').trim() || 'Novo Quiz'
    const isHeavyFile = file.size > 12 * 1024 * 1024 // > 12MB

    let createdRecord: QuizRecord | null = null

    // ESTRATÉGIA A: Arquivo grande (> 12MB)
    // Extrai o texto no cliente antes do envio para evitar o limite de body do proxy da nuvem
    if (isHeavyFile) {
      onProgress?.(
        'Arquivo grande detectado (~' +
          (file.size / (1024 * 1024)).toFixed(1) +
          ' MB). Extraindo texto e tópicos...',
      )

      let extractedText = ''
      try {
        extractedText = await extrairTextoDocumentoNoCliente(file)
      } catch (extractErr) {
        console.warn(
          'Extração no cliente não pôde ser concluída, tentando envio direto:',
          extractErr,
        )
      }

      if (extractedText && extractedText.trim().length >= 15) {
        onProgress?.('Texto extraído com sucesso! Enviando para a Inteligência Artificial...')

        const payload = {
          nome_arquivo: file.name,
          nome_quiz: cleanTitle,
          tipo_arquivo: ext === 'xlsx' ? 'xlsx' : 'pptx',
          usuario_id: pb.authStore.model?.id || '',
          token_publico: this.gerarTokenAleatorio(),
          publico_ativo: true,
          status_processamento: 'pendente',
          conteudo_extraido: extractedText,
        }

        try {
          createdRecord = await pb.collection('quizzes').create<QuizRecord>(payload, {
            signal,
            requestKey: null,
          })
        } catch (err: unknown) {
          ensureAuth()
          const status =
            (err as { status?: number })?.status ||
            (err as { response?: { status?: number } })?.response?.status

          if (status === 401 || status === 403) {
            pb.authStore.clear()
            const authErr = new Error('Sua sessão expirou. Faça login novamente.')
            ;(authErr as { code?: string }).code = 'SESSION_EXPIRED'
            throw authErr
          }

          console.error('Falha ao enviar registro leve com texto extraído:', err)
          const netErr = new Error(
            'Não foi possível registrar o quiz no servidor. Verifique sua conexão e tente novamente.',
          )
          ;(netErr as { code?: string }).code = 'NETWORK_ERROR'
          throw netErr
        }
      }
    }

    // ESTRATÉGIA B: Arquivo de tamanho padrão (<= 12MB) ou se a extração no cliente não rodou
    if (!createdRecord) {
      onProgress?.('Enviando arquivo ao servidor...')

      const formData = new FormData()
      formData.append('arquivo', file)
      formData.append('nome_arquivo', file.name)
      formData.append('nome_quiz', cleanTitle)
      formData.append('tipo_arquivo', ext === 'xlsx' ? 'xlsx' : 'pptx')
      formData.append('usuario_id', pb.authStore.model?.id || '')
      formData.append('token_publico', this.gerarTokenAleatorio())
      formData.append('publico_ativo', 'true')
      formData.append('status_processamento', 'pendente')

      try {
        createdRecord = await pb.collection('quizzes').create<QuizRecord>(formData, {
          signal,
          requestKey: null,
        })
      } catch (uploadErr: unknown) {
        ensureAuth()

        const status =
          (uploadErr as { status?: number })?.status ||
          (uploadErr as { response?: { status?: number } })?.response?.status

        if (status === 401 || status === 403) {
          pb.authStore.clear()
          const authErr = new Error('Sua sessão expirou. Faça login novamente.')
          ;(authErr as { code?: string }).code = 'SESSION_EXPIRED'
          throw authErr
        }

        const isAbort =
          signal?.aborted ||
          (uploadErr instanceof DOMException && uploadErr.name === 'AbortError') ||
          (uploadErr as { name?: string })?.name === 'AbortError'

        if (isAbort) {
          const cancelErr = new Error('O envio foi cancelado.')
          ;(cancelErr as { code?: string }).code = 'ABORTED'
          throw cancelErr
        }

        // Se falhou por limite de tamanho do proxy ou interrupção de conexão de arquivo pesado,
        // tentamos extrair o texto localmente antes de desistir!
        console.warn(
          'Upload binário direto interrompido pela rede/proxy. Tentando fallback com extração de texto...',
        )
        try {
          onProgress?.(
            'A rede interrompeu o arquivo pesado. Extraindo texto dos slides localmente...',
          )
          const fallbackText = await extrairTextoDocumentoNoCliente(file)
          if (fallbackText && fallbackText.trim().length >= 15) {
            const fallbackPayload = {
              nome_arquivo: file.name,
              nome_quiz: cleanTitle,
              tipo_arquivo: ext === 'xlsx' ? 'xlsx' : 'pptx',
              usuario_id: pb.authStore.model?.id || '',
              token_publico: this.gerarTokenAleatorio(),
              publico_ativo: true,
              status_processamento: 'pendente',
              conteudo_extraido: fallbackText,
            }
            createdRecord = await pb.collection('quizzes').create<QuizRecord>(fallbackPayload, {
              signal,
              requestKey: null,
            })
          }
        } catch (fallbackErr) {
          ensureAuth()
          console.error('Fallback de extração local também falhou:', fallbackErr)
        }

        if (!createdRecord) {
          const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
          const msg = isOnline
            ? 'A comunicação com o servidor foi interrompida durante o envio do arquivo. Tente novamente.'
            : 'Dispositivo desconectado da internet. Verifique sua conexão e tente novamente.'

          const netErr = new Error(msg)
          ;(netErr as { code?: string }).code = 'NETWORK_ERROR'
          throw netErr
        }
      }
    }

    const quizId = createdRecord.id

    // 2. Polling inteligente para acompanhar o status_processamento
    // O hook onRecordAfterCreateSuccess roda no backend logo após a inserção.
    onProgress?.('Convertendo documento e gerando perguntas...')

    const maxWaitTimeMs = 5 * 60 * 1000 // até 5 minutos
    const startTime = Date.now()
    const pollIntervalMs = 2500

    while (Date.now() - startTime < maxWaitTimeMs) {
      if (signal?.aborted) {
        const cancelErr = new Error('Operação cancelada pelo usuário.')
        ;(cancelErr as { code?: string }).code = 'ABORTED'
        throw cancelErr
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs))

      let currentQuiz: QuizRecord
      try {
        currentQuiz = await pb.collection('quizzes').getOne<QuizRecord>(quizId, {
          requestKey: null,
          signal,
        })
      } catch (pollErr: unknown) {
        // Ignora erros temporários no polling de status
        console.warn('Oscilação temporária ao consultar status do processamento:', pollErr)
        continue
      }

      const status = currentQuiz.status_processamento

      if (status === 'processando') {
        const elapsed = Math.round((Date.now() - startTime) / 1000)
        if (elapsed > 18) {
          onProgress?.('Formulando perguntas pedagógicas com Inteligência Artificial...')
        } else if (elapsed > 8) {
          onProgress?.('Extraindo tópicos e tabelas do documento...')
        }
      } else if (status === 'concluido') {
        return {
          quiz_id: currentQuiz.id,
          nome_quiz: currentQuiz.nome_quiz,
          total_perguntas: currentQuiz.total_perguntas || 10,
          truncated:
            !!currentQuiz.conteudo_extraido && currentQuiz.conteudo_extraido.length > 30000,
        }
      } else if (status === 'erro') {
        const errorMsg =
          currentQuiz.erro_processamento ||
          'Não foi possível concluir a geração do quiz a partir deste documento.'
        const procErr = new Error(errorMsg)
        ;(procErr as { code?: string }).code = 'PROCESSING_ERROR'
        throw procErr
      }
    }

    // Se esgotou o tempo de polling
    const timeoutErr = new Error(
      'O processamento do documento está demorando mais que o habitual. Você pode conferir o status em "Meus Quizzes" em alguns instantes.',
    )
    ;(timeoutErr as { code?: string }).code = 'TIMEOUT'
    throw timeoutErr
  },

  // Método legado mantido por compatibilidade caso chamado em outro ponto
  async gerarQuiz(
    file: File,
    signal?: AbortSignal,
  ): Promise<{ quiz_id: string; nome_quiz: string; total_perguntas: number; truncated?: boolean }> {
    return this.criarQuizEProcessar(file, undefined, signal)
  },

  // Reprocessar quiz sob demanda
  async reprocessarQuiz(id: string): Promise<void> {
    await pb.send(`/backend/v1/quizzes/${id}/reprocess`, {
      method: 'POST',
    })
  },

  // Obter URL do arquivo original armazenado no PocketBase
  getFileUrl(record: QuizRecord, filename?: string): string {
    const file = filename || record.arquivo
    if (!file) return ''
    return pb.files.getURL(record, file)
  },

  // Obter URL do avatar do usuário
  getAvatarUrl(user: UserRecord): string | null {
    if (!user || !user.avatar) return null
    return pb.files.getURL(user, user.avatar, { thumb: '100x100' })
  },

  // Obter estatísticas do usuário
  async getEstatisticas(): Promise<{
    totalQuizzes: number
    quizzesConcluidos: number
    mediaAcertos: number
  }> {
    const [quizzes, tentativas] = await Promise.all([
      pb.collection('quizzes').getFullList<QuizRecord>(),
      pb.collection('tentativas').getFullList<TentativaRecord>(),
    ])

    const totalQuizzes = quizzes.length
    // Agrupa tentativas por quiz_id
    const quizzesComTentativa = new Set(tentativas.map((t) => t.quiz_id))
    const quizzesConcluidos = quizzesComTentativa.size

    // Calcular média das melhores notas por quiz ou média geral
    let mediaAcertos = 0
    if (tentativas.length > 0) {
      const somaPontos = tentativas.reduce((acc, curr) => acc + (curr.pontuacao || 0), 0)
      mediaAcertos = Math.round(somaPontos / tentativas.length)
    }

    return {
      totalQuizzes,
      quizzesConcluidos,
      mediaAcertos,
    }
  },
}
