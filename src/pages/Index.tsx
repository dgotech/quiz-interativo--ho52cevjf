import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { quizService } from '@/services/quizService'
import { useRealtime } from '@/hooks/use-realtime'
import type { QuizRecord, TentativaRecord, PerguntaRecord } from '@/types/quiz'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  FileSpreadsheet,
  PlusCircle,
  Trophy,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Sparkles,
  BarChart3,
  Loader2,
} from 'lucide-react'

export default function Index() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [quizzes, setQuizzes] = useState<QuizRecord[]>([])
  const [tentativas, setTentativas] = useState<TentativaRecord[]>([])
  const [perguntasCountMap, setPerguntasCountMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [quizzesList, tentList] = await Promise.all([
        quizService.getQuizzes('-created'),
        quizService.getMinhasTentativas(),
      ])
      setQuizzes(quizzesList)
      setTentativas(tentList)

      // Obter contagem de perguntas para os quizzes mais recentes
      const top5 = quizzesList.slice(0, 5)
      const countMap: Record<string, number> = {}
      await Promise.all(
        top5.map(async (q) => {
          try {
            const pergs = await quizService.getPerguntas(q.id)
            countMap[q.id] = pergs.length
          } catch (_) {
            countMap[q.id] = 0
          }
        }),
      )
      setPerguntasCountMap(countMap)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Atualização em tempo real quando quizzes ou tentativas mudam
  useRealtime<QuizRecord>('quizzes', () => {
    loadData()
  })
  useRealtime<TentativaRecord>('tentativas', () => {
    loadData()
  })

  // Estatísticas calculadas
  const totalQuizzes = quizzes.length
  const quizzesRespondidosIds = new Set(tentativas.map((t) => t.quiz_id))
  const quizzesConcluidos = quizzesRespondidosIds.size
  const mediaAcertos =
    tentativas.length > 0
      ? Math.round(tentativas.reduce((acc, t) => acc + (t.pontuacao || 0), 0) / tentativas.length)
      : 0

  const ultimosQuizzes = quizzes.slice(0, 5)

  const formatarData = (dataStr: string) => {
    try {
      const d = new Date(dataStr)
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(d)
    } catch (_) {
      return dataStr
    }
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-white via-white to-purple-50/50 p-6 md:p-8 rounded-3xl border border-[#E5E8F0] shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6C4DF6]/10 text-xs font-semibold text-[#6C4DF6] mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Ambiente de Aprendizado
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[#1A1D2E] tracking-tight">
            Olá, {user?.name || 'Estudante'} 👋
          </h1>
          <p className="text-sm md:text-base text-[#5A6172] mt-1">
            O que vamos aprender e testar hoje? Envie seus slides ou planilhas para começar.
          </p>
        </div>

        <div>
          <Link to="/new">
            <Button className="h-12 px-6 rounded-2xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-lg shadow-[#6C4DF6]/25 transition-all transform hover:-translate-y-0.5">
              <PlusCircle className="w-5 h-5 mr-2" />
              Novo Quiz
            </Button>
          </Link>
        </div>
      </div>

      {/* Resumo em 3 Cards com Sparklines / Mini barras */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Total de Quizzes */}
        <div className="bg-white p-6 rounded-2xl border border-[#E5E8F0] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5A6172]">
              Quizzes Criados
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#6C4DF6] flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1A1D2E]">{totalQuizzes}</span>
            <span className="text-xs text-[#5A6172]">documentos processados</span>
          </div>
          {/* Mini barra de progresso visual */}
          <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#6C4DF6] to-[#8E6FFF] h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(totalQuizzes * 10, 100)}%` }}
            />
          </div>
        </div>

        {/* Card 2: Quizzes Concluídos */}
        <div className="bg-white p-6 rounded-2xl border border-[#E5E8F0] shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5A6172]">
              Quizzes Concluídos
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00C4A7] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1A1D2E]">{quizzesConcluidos}</span>
            <span className="text-xs text-[#5A6172]">com tentativas respondidas</span>
          </div>
          {/* Mini barra */}
          <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#00C4A7] to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{
                width: `${totalQuizzes > 0 ? (quizzesConcluidos / totalQuizzes) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Card 3: Média de Acertos */}
        <div className="bg-white p-6 rounded-2xl border border-[#E5E8F0] shadow-sm hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5A6172]">
              Média de Acertos
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#1A1D2E]">{mediaAcertos}%</span>
            <span className="text-xs text-[#5A6172]">aproveitamento global</span>
          </div>
          {/* Mini barra */}
          <div className="mt-4 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-400 to-orange-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${mediaAcertos}%` }}
            />
          </div>
        </div>
      </div>

      {/* Seção "Últimos Quizzes" */}
      <div className="bg-white rounded-3xl border border-[#E5E8F0] p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-[#1A1D2E] tracking-tight">
              Últimos Quizzes
            </h2>
            <p className="text-xs text-[#5A6172] mt-0.5">Seus materiais de estudo mais recentes</p>
          </div>
          {quizzes.length > 0 && (
            <Link
              to="/quizzes"
              className="text-xs font-bold text-[#6C4DF6] hover:text-[#5A3DDE] flex items-center gap-1"
            >
              Ver todos ({quizzes.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-[#5A6172] gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#6C4DF6]" />
            <p className="text-xs">Carregando seus quizzes...</p>
          </div>
        ) : ultimosQuizzes.length === 0 ? (
          <div className="py-12 text-center rounded-2xl bg-[#F7F8FC] border border-dashed border-[#D1D5DB] p-8">
            <div className="w-14 h-14 rounded-2xl bg-[#6C4DF6]/10 text-[#6C4DF6] mx-auto flex items-center justify-center mb-4">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-[#1A1D2E]">Nenhum quiz criado ainda</h3>
            <p className="text-xs text-[#5A6172] max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
              Faça o upload da sua primeira apresentação em PowerPoint (.pptx) ou planilha Excel
              (.xlsx) para gerar perguntas automáticas.
            </p>
            <Link to="/new">
              <Button className="h-10 px-5 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] to-[#00C4A7]">
                <PlusCircle className="w-4 h-4 mr-2" />
                Criar meu primeiro quiz
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E8F0]">
            {ultimosQuizzes.map((quiz) => {
              const isPpt = quiz.tipo_arquivo === 'pptx'
              const isConcluido = quizzesRespondidosIds.has(quiz.id)
              const numPerguntas = perguntasCountMap[quiz.id] || 0

              return (
                <div
                  key={quiz.id}
                  onClick={() => navigate(`/quiz/${quiz.id}`)}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F7F8FC] -mx-4 px-4 rounded-xl transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                        isPpt
                          ? 'bg-gradient-to-br from-orange-400 to-rose-500 text-white'
                          : 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white'
                      }`}
                    >
                      {isPpt ? (
                        <FileText className="w-5 h-5" />
                      ) : (
                        <FileSpreadsheet className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-[#1A1D2E] group-hover:text-[#6C4DF6] transition-colors truncate">
                        {quiz.nome_quiz}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[#5A6172] flex-wrap">
                        <span className="truncate max-w-[160px] sm:max-w-[240px] font-mono text-[11px]">
                          {quiz.nome_arquivo}
                        </span>
                        <span>•</span>
                        <span>{formatarData(quiz.created)}</span>
                        {numPerguntas > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-[#1A1D2E]">
                              {numPerguntas} {numPerguntas === 1 ? 'pergunta' : 'perguntas'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {isConcluido ? (
                      <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Concluído
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 gap-1.5 px-3 py-1 rounded-full text-xs font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Pendente
                      </Badge>
                    )}

                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 group-hover:text-[#6C4DF6] group-hover:bg-[#6C4DF6]/10 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* CTA Final */}
      <div className="bg-gradient-to-r from-[#1A1D2E] via-[#2A1F52] to-[#143B39] text-white p-6 sm:p-8 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-xl shadow-[#1A1D2E]/10">
        <div className="space-y-1">
          <h3 className="text-xl font-extrabold tracking-tight">Pronto para criar outro teste?</h3>
          <p className="text-xs sm:text-sm text-slate-300">
            Nossa IA analisa seu arquivo em instantes e estrutura perguntas com gabarito explicado.
          </p>
        </div>
        <Link to="/new" className="shrink-0">
          <Button className="h-11 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-md shadow-[#6C4DF6]/30 transition-all">
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Quiz
          </Button>
        </Link>
      </div>
    </div>
  )
}
