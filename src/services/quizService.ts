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

  // Chamar endpoint server-side para gerar quiz a partir do arquivo
  async gerarQuiz(
    file: File,
  ): Promise<{ quiz_id: string; nome_quiz: string; total_perguntas: number; truncated?: boolean }> {
    const formData = new FormData()
    formData.append('file', file)

    const token = pb.authStore.token
    const response = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/quizzes/generate`,
      {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: formData,
      },
    )

    if (!response.ok) {
      let errorMsg = 'Falha ao processar o documento'
      try {
        const errorData = await response.json()
        if (errorData.message) {
          errorMsg = errorData.message
        }
      } catch {
        /* intentionally ignored */
      }
      throw new Error(errorMsg)
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
