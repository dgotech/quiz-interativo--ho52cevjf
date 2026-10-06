import pb from '@/lib/pocketbase/client'
import type { QuizRecord, PerguntaRecord, TentativaRecord, UserRecord } from '@/types/quiz'

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

  // Chamar endpoint server-side para gerar quiz a partir do arquivo
  async gerarQuiz(
    file: File,
    signal?: AbortSignal,
  ): Promise<{ quiz_id: string; nome_quiz: string; total_perguntas: number; truncated?: boolean }> {
    // 1. Snapshot defensivo da autenticação atual
    const initialToken = pb.authStore.token
    const initialModel = pb.authStore.model

    // 2. Validar e tentar renovar sessão ativamente antes de transferir arquivo grande
    const sessaoStatus = await this.validarSessao()
    if (!sessaoStatus.valida && sessaoStatus.erro === 'SESSION_EXPIRED') {
      const err = new Error('Sua sessão expirou. Faça login novamente para enviar seu documento.')
      ;(err as { code?: string }).code = 'SESSION_EXPIRED'
      throw err
    }

    const formData = new FormData()
    formData.append('file', file)

    // Pegar o token mais recente (ou o snapshot inicial se estiver intacto)
    const token = pb.authStore.token || initialToken

    // Configurar timeout generoso (8 minutos) para permitir envio de até 100MB, conversão e chamada de IA
    const controller = new AbortController()
    const timeoutMs = 8 * 60 * 1000 // 480 segundos
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, timeoutMs)

    // Se o chamador forneceu um signal de cancelamento, conectar ao nosso controller
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    let response: Response
    try {
      response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/quizzes/generate`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: formData,
        signal: controller.signal,
      })
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId)

      // Garantir absolutamente que um erro de rede/timeout NUNCA deslogue o usuário
      if (!pb.authStore.isValid && initialToken) {
        pb.authStore.save(initialToken, initialModel)
      }

      const isAbort =
        (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') ||
        (fetchErr as { name?: string })?.name === 'AbortError'

      if (isAbort) {
        // Se foi o sinal externo cancelado pelo usuário
        if (signal?.aborted) {
          const cancelErr = new Error('O envio foi cancelado.')
          ;(cancelErr as { code?: string }).code = 'ABORTED'
          throw cancelErr
        }

        const timeoutErr = new Error(
          'O processamento do documento demorou mais que o esperado pelo servidor. Tente enviar novamente ou use uma versão com menos slides/tabelas.',
        )
        ;(timeoutErr as { code?: string }).code = 'TIMEOUT'
        throw timeoutErr
      }

      // Tratar erros genéricos de rede (Failed to fetch, CORS, queda de conexão, upload interrompido)
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
      const networkMessage = isOnline
        ? 'A comunicação com o servidor de processamento foi interrompida durante o envio. Sua conexão está ativa, mas o servidor demorou a responder ou o envio foi reiniciado. Tente novamente.'
        : 'Parece que seu dispositivo está desconectado da rede. Verifique sua conexão e tente novamente.'

      const networkErr = new Error(networkMessage)
      ;(networkErr as { code?: string }).code = 'NETWORK_ERROR'
      throw networkErr
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      let errorMsg = ''
      try {
        const errorData = await response.json()
        if (errorData.message) {
          errorMsg = errorData.message
        }
      } catch {
        /* intentionally ignored */
      }

      // Apenas deslogar se o servidor respondeu 401 explícito
      if (response.status === 401) {
        pb.authStore.clear()
        const authErr = new Error(
          'Sua sessão expirou. Faça login novamente e tente enviar o arquivo.',
        )
        ;(authErr as { code?: string }).code = 'SESSION_EXPIRED'
        throw authErr
      }

      // Para QUALQUER outro status (413, 422, 500, 502, 504), manter a sessão do usuário intacta
      if (!pb.authStore.isValid && initialToken) {
        pb.authStore.save(initialToken, initialModel)
      }

      if (response.status === 413) {
        const sizeErr = new Error(
          errorMsg || 'O arquivo excede o limite suportado pelo servidor de 100MB.',
        )
        ;(sizeErr as { code?: string }).code = 'FILE_TOO_LARGE'
        throw sizeErr
      }

      if (response.status === 422) {
        const docErr = new Error(
          errorMsg ||
            'Não foi possível extrair texto do documento. Certifique-se de que o arquivo contém texto selecionável (não imagens escaneadas sem OCR).',
        )
        ;(docErr as { code?: string }).code = 'DOCUMENT_UNREADABLE'
        throw docErr
      }

      if (response.status === 504 || response.status === 408) {
        const gatewayErr = new Error(
          'O servidor demorou para concluir o processamento da apresentação. O processamento com IA em arquivos grandes pode levar mais tempo. Tente novamente.',
        )
        ;(gatewayErr as { code?: string }).code = 'TIMEOUT'
        throw gatewayErr
      }

      if (response.status >= 500) {
        const serverErr = new Error(
          errorMsg ||
            'O servidor encontrou um problema ao analisar o documento. Tente novamente em alguns instantes.',
        )
        ;(serverErr as { code?: string }).code = 'SERVER_ERROR'
        throw serverErr
      }

      throw new Error(
        errorMsg || 'Falha ao processar o documento. Verifique os dados e tente novamente.',
      )
    }

    return response.json()
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
