export interface UserRecord {
  id: string
  email: string
  name: string
  avatar?: string
  created: string
  updated: string
  verified?: boolean
}

export type TipoArquivo = 'pptx' | 'xlsx'

import type { RecordModel } from 'pocketbase'

export type StatusProcessamento = 'pendente' | 'processando' | 'concluido' | 'erro'

export interface QuizRecord extends RecordModel {
  tipo_arquivo: TipoArquivo
  nome_arquivo: string
  nome_quiz: string
  conteudo_extraido?: string
  arquivo?: string
  status_processamento?: StatusProcessamento
  erro_processamento?: string
  total_perguntas?: number
  usuario_id: string
  token_publico?: string
  publico_ativo?: boolean
  expand?: {
    usuario_id?: UserRecord
  }
}
export interface OpcaoQuiz {
  label: 'A' | 'B' | 'C' | 'D'
  texto: string
}

export type TipoPergunta = 'multipla_escolha' | 'aberta'

export interface PerguntaRecord {
  id: string
  quiz_id: string
  enunciado: string
  tipo: TipoPergunta
  opcoes?: OpcaoQuiz[] | null
  resposta_correta?: string | null
  explicacao?: string
  ordem: number
  created: string
  updated: string
}

export interface RespostaItem {
  pergunta_id: string
  resposta_dada: string // "A", "B", etc. ou texto livre da resposta aberta
  correta?: boolean
}

export interface TentativaRecord extends RecordModel {
  quiz_id: string
  usuario_id?: string
  nome_jogador?: string
  respostas: RespostaItem[]
  pontuacao: number // 0 a 100
  expand?: {
    quiz_id?: QuizRecord
    usuario_id?: UserRecord
  }
}

// ============================================
// Tipos para Modo Competição (Estilo Mentimeter)
// ============================================

export type StatusCompeticao = 'aguardando' | 'em_andamento' | 'encerrada'

export interface CompeticaoRecord extends RecordModel {
  quiz: string
  codigo: string
  titulo?: string
  status: StatusCompeticao
  ativa?: boolean
  criado_por?: string
  expand?: {
    quiz?: QuizRecord
    criado_por?: UserRecord
  }
}

export interface GrupoRecord extends RecordModel {
  competicao: string
  nome: string
  cor: string // Ex: hex #6C4DF6 ou classe de cor
  ordem?: number
}

export interface ParticipacaoRecord extends RecordModel {
  competicao: string
  grupo: string
  apelido: string
  pontuacao: number // pontuação acumulada do jogador
  acertos: number
  total_perguntas: number
  tempo_segundos?: number
  finalizada?: boolean
  respostas_detalhe?: RespostaItem[]
  expand?: {
    grupo?: GrupoRecord
    competicao?: CompeticaoRecord
  }
}

export interface RankingGrupo {
  grupo: GrupoRecord
  pontosTotais: number
  totalParticipantes: number
  totalAcertos: number
  totalPerguntasRespondidas: number
  mediaAcertosPercentual: number
  melhorJogador?: {
    apelido: string
    pontuacao: number
    acertos: number
  }
  participantes: ParticipacaoRecord[]
}
