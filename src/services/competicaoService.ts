import pb from '@/lib/pocketbase/client'
import type {
  CompeticaoRecord,
  GrupoRecord,
  ParticipacaoRecord,
  RankingGrupo,
  StatusCompeticao,
  QuizRecord,
} from '@/types/quiz'

// Cores vibrantes padrão para os grupos estilo Mentimeter/Kahoot
export const CORES_GRUPOS_PADRAO = [
  {
    nome: 'Roxo Elétrico',
    hex: '#6C4DF6',
    bgClass: 'bg-[#6C4DF6]',
    borderClass: 'border-[#6C4DF6]',
    textClass: 'text-[#6C4DF6]',
  },
  {
    nome: 'Verde Esmeralda',
    hex: '#00C4A7',
    bgClass: 'bg-[#00C4A7]',
    borderClass: 'border-[#00C4A7]',
    textClass: 'text-[#00C4A7]',
  },
  {
    nome: 'Laranja Coral',
    hex: '#FF6B4A',
    bgClass: 'bg-[#FF6B4A]',
    borderClass: 'border-[#FF6B4A]',
    textClass: 'text-[#FF6B4A]',
  },
  {
    nome: 'Azul Celeste',
    hex: '#3B82F6',
    bgClass: 'bg-[#3B82F6]',
    borderClass: 'border-[#3B82F6]',
    textClass: 'text-[#3B82F6]',
  },
  {
    nome: 'Amarelo Ouro',
    hex: '#F59E0B',
    bgClass: 'bg-[#F59E0B]',
    borderClass: 'border-[#F59E0B]',
    textClass: 'text-[#F59E0B]',
  },
  {
    nome: 'Rosa Choque',
    hex: '#EC4899',
    bgClass: 'bg-[#EC4899]',
    borderClass: 'border-[#EC4899]',
    textClass: 'text-[#EC4899]',
  },
]

export const competicaoService = {
  // Gerar código único e curto (ex: ZARA-73 ou 6 caracteres fáceis de digitar)
  gerarCodigo(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // sem 0/O e 1/I para evitar confusão visual no projetor
    let result = 'ZARA-'
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  },

  // Obter competições de um quiz
  async getCompeticoesDoQuiz(quizId: string): Promise<CompeticaoRecord[]> {
    return pb.collection('competicoes').getFullList<CompeticaoRecord>({
      filter: `quiz = "${quizId}"`,
      sort: '-created',
      expand: 'quiz,criado_por',
    })
  },

  // Obter competição única por ID
  async getCompeticao(id: string): Promise<CompeticaoRecord> {
    return pb.collection('competicoes').getOne<CompeticaoRecord>(id, {
      expand: 'quiz,criado_por',
    })
  },

  // Obter competição pelo código digitado pelo jogador
  async getCompeticaoPorCodigo(codigo: string): Promise<CompeticaoRecord | null> {
    const clean = codigo.trim().toUpperCase()
    try {
      return await pb
        .collection('competicoes')
        .getFirstListItem<CompeticaoRecord>(`codigo = "${clean}" && ativa = true`, {
          expand: 'quiz',
        })
    } catch {
      return null
    }
  },

  // Criar uma nova competição e seus grupos iniciais
  async criarCompeticao(
    quiz: QuizRecord,
    gruposNomes: string[],
    tituloCustomizado?: string,
  ): Promise<{ competicao: CompeticaoRecord; grupos: GrupoRecord[] }> {
    const codigo = this.gerarCodigo()
    const titulo = tituloCustomizado || `Competição — ${quiz.nome_quiz}`
    const userId = pb.authStore.model?.id || ''

    const competicao = await pb.collection('competicoes').create<CompeticaoRecord>({
      quiz: quiz.id,
      codigo,
      titulo,
      status: 'aguardando' as StatusCompeticao,
      ativa: true,
      criado_por: userId || undefined,
    })

    // Se o usuário não passou grupos, cria 3 grupos padrão legais
    const nomes =
      gruposNomes && gruposNomes.length > 0
        ? gruposNomes
        : ['Equipe Zara Alfa', 'Equipe Zara Beta', 'Equipe Zara Gama']

    const gruposCriados: GrupoRecord[] = []

    for (let i = 0; i < nomes.length; i++) {
      const corObj = CORES_GRUPOS_PADRAO[i % CORES_GRUPOS_PADRAO.length]
      const grp = await pb.collection('grupos').create<GrupoRecord>({
        competicao: competicao.id,
        nome: nomes[i].trim() || `Grupo ${i + 1}`,
        cor: corObj.hex,
        ordem: i + 1,
      })
      gruposCriados.push(grp)
    }

    return { competicao, grupos: gruposCriados }
  },

  // Obter grupos de uma competição
  async getGrupos(competicaoId: string): Promise<GrupoRecord[]> {
    return pb.collection('grupos').getFullList<GrupoRecord>({
      filter: `competicao = "${competicaoId}"`,
      sort: 'ordem,created',
    })
  },

  // Adicionar um novo grupo a uma competição existente
  async criarGrupo(competicaoId: string, nome: string, cor?: string): Promise<GrupoRecord> {
    const existing = await this.getGrupos(competicaoId)
    const corFinal = cor || CORES_GRUPOS_PADRAO[existing.length % CORES_GRUPOS_PADRAO.length].hex
    return pb.collection('grupos').create<GrupoRecord>({
      competicao: competicaoId,
      nome: nome.trim(),
      cor: corFinal,
      ordem: existing.length + 1,
    })
  },

  // Excluir grupo
  async excluirGrupo(id: string): Promise<boolean> {
    return pb.collection('grupos').delete(id)
  },

  // Atualizar status da competição ('aguardando' | 'em_andamento' | 'encerrada')
  async atualizarStatus(id: string, status: StatusCompeticao): Promise<CompeticaoRecord> {
    return pb.collection('competicoes').update<CompeticaoRecord>(id, {
      status,
      ativa: status !== 'encerrada', // se encerrar, ativa pode ser false ou true (mantemos ativa=true para poder ver resultado, mas status='encerrada')
    })
  },

  // Reabrir ou reiniciar competição
  async reiniciarCompeticao(id: string): Promise<CompeticaoRecord> {
    // limpa pontuações de participações ou redefine status para 'aguardando'
    return pb.collection('competicoes').update<CompeticaoRecord>(id, {
      status: 'aguardando',
      ativa: true,
    })
  },

  // Excluir competição
  async excluirCompeticao(id: string): Promise<boolean> {
    return pb.collection('competicoes').delete(id)
  },

  // Obter participações em tempo real / polling
  async getParticipacoes(competicaoId: string): Promise<ParticipacaoRecord[]> {
    return pb.collection('participacoes').getFullList<ParticipacaoRecord>({
      filter: `competicao = "${competicaoId}"`,
      sort: '-pontuacao,-created',
      expand: 'grupo',
    })
  },

  // Entrar na competição (convidado cria sua participação)
  async entrarNaCompeticao(params: {
    competicaoId: string
    grupoId: string
    apelido: string
  }): Promise<ParticipacaoRecord> {
    return pb.collection('participacoes').create<ParticipacaoRecord>({
      competicao: params.competicaoId,
      grupo: params.grupoId,
      apelido: params.apelido.trim(),
      pontuacao: 0,
      acertos: 0,
      total_perguntas: 0,
      tempo_segundos: 0,
      finalizada: false,
    })
  },

  // Atualizar progresso do participante ao responder uma questão ao vivo
  async atualizarProgressoParticipante(
    participacaoId: string,
    data: {
      pontuacao: number
      acertos: number
      total_perguntas: number
      tempo_segundos?: number
      finalizada?: boolean
      respostas_detalhe?: unknown
    },
  ): Promise<ParticipacaoRecord> {
    return pb.collection('participacoes').update<ParticipacaoRecord>(participacaoId, data)
  },

  // Calcular ranking dos grupos agrupando os membros de cada grupo
  calcularRankingGrupos(
    grupos: GrupoRecord[],
    participacoes: ParticipacaoRecord[],
  ): RankingGrupo[] {
    const mapaGrupos = new Map<string, RankingGrupo>()

    // Inicializa todos os grupos mesmo se ainda não tiverem membros
    for (const g of grupos) {
      mapaGrupos.set(g.id, {
        grupo: g,
        pontosTotais: 0,
        totalParticipantes: 0,
        totalAcertos: 0,
        totalPerguntasRespondidas: 0,
        mediaAcertosPercentual: 0,
        participantes: [],
      })
    }

    // Agrega as participações
    for (const p of participacoes) {
      const entry = mapaGrupos.get(p.grupo)
      if (!entry) continue

      entry.participantes.push(p)
      entry.pontosTotais += p.pontuacao || 0
      entry.totalParticipantes += 1
      entry.totalAcertos += p.acertos || 0
      entry.totalPerguntasRespondidas += p.total_perguntas || 0
    }

    // Calcula médias e identifica o melhor jogador de cada grupo
    const ranking: RankingGrupo[] = []

    mapaGrupos.forEach((entry) => {
      // Ordena participantes do grupo por maior pontuação individual
      entry.participantes.sort((a, b) => (b.pontuacao || 0) - (a.pontuacao || 0))

      if (entry.participantes.length > 0) {
        const top = entry.participantes[0]
        entry.melhorJogador = {
          apelido: top.apelido,
          pontuacao: top.pontuacao || 0,
          acertos: top.acertos || 0,
        }
      }

      if (entry.totalPerguntasRespondidas > 0) {
        entry.mediaAcertosPercentual = Math.round(
          (entry.totalAcertos / entry.totalPerguntasRespondidas) * 100,
        )
      } else {
        entry.mediaAcertosPercentual = 0
      }

      ranking.push(entry)
    })

    // Ordena os grupos pela SOMA TOTAL DE PONTOS (decrescente).
    // Em caso de empate, desempate por média de acertos ou total de participantes
    ranking.sort((a, b) => {
      if (b.pontosTotais !== a.pontosTotais) {
        return b.pontosTotais - a.pontosTotais
      }
      return b.mediaAcertosPercentual - a.mediaAcertosPercentual
    })

    return ranking
  },
}
