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

export interface QuizRecord extends RecordModel {
  tipo_arquivo: TipoArquivo
  nome_arquivo: string
  nome_quiz: string
  conteudo_extraido?: string
  usuario_id: string
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
  usuario_id: string
  respostas: RespostaItem[]
  pontuacao: number // 0 a 100
  expand?: {
    quiz_id?: QuizRecord
    usuario_id?: UserRecord
  }
}
