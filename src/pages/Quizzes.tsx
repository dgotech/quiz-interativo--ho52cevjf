import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { quizService } from '@/services/quizService'
import { useRealtime } from '@/hooks/use-realtime'
import type { QuizRecord, TentativaRecord } from '@/types/quiz'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  FileText,
  FileSpreadsheet,
  MoreVertical,
  Play,
  Eye,
  Trash2,
  PlusCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Share2,
} from 'lucide-react'

export default function Quizzes() {
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([])
  const [tentativas, setTentativas] = useState<TentativaRecord[]>([])
  const [perguntasCountMap, setPerguntasCountMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'todos' | 'pptx' | 'xlsx'>('todos')

  // Modal de exclusão
  const [quizToDelete, setQuizToDelete] = useState<QuizRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const navigate = useNavigate()
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    try {
      const [quizzesList, tentList] = await Promise.all([
        quizService.getQuizzes('-created'),
        quizService.getMinhasTentativas(),
      ])
      setQuizzes(quizzesList)
      setTentativas(tentList)

      const countMap: Record<string, number> = {}
      await Promise.all(
        quizzesList.map(async (q) => {
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
      console.error('Erro ao carregar quizzes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Atualização em tempo real
  useRealtime<QuizRecord>('quizzes', () => {
    loadData()
  })
  useRealtime<TentativaRecord>('tentativas', () => {
    loadData()
  })

  const quizzesRespondidosIds = new Set(tentativas.map((t) => t.quiz_id))

  // Filtragem
  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesSearch =
      quiz.nome_quiz.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quiz.nome_arquivo.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTipo = tipoFilter === 'todos' || quiz.tipo_arquivo === tipoFilter
    return matchesSearch && matchesTipo
  })

  const formatarData = (dataStr: string) => {
    try {
      const d = new Date(dataStr)
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(d)
    } catch (_) {
      return dataStr
    }
  }

  const handleDeleteConfirm = async () => {
    if (!quizToDelete) return
    setIsDeleting(true)
    try {
      await quizService.excluirQuiz(quizToDelete.id)
      toast({
        title: 'Quiz excluído',
        description: `"${quizToDelete.nome_quiz}" foi removido com sucesso.`,
      })
      setQuizzes((prev) => prev.filter((q) => q.id !== quizToDelete.id))
      setQuizToDelete(null)
    } catch (err) {
      console.error('Erro ao excluir:', err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover este quiz. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header com CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1D2E] tracking-tight">
            Meus Quizzes
          </h1>
          <p className="text-sm text-[#5A6172] mt-0.5">
            Gerencie, revise o conteúdo e teste seus conhecimentos quando quiser.
          </p>
        </div>

        <Link to="/new">
          <Button className="h-11 px-5 rounded-2xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-md shadow-[#6C4DF6]/25 transition-all">
            <PlusCircle className="w-4 h-4 mr-2" />
            Novo Quiz
          </Button>
        </Link>
      </div>

      {/* Barra de Busca e Filtro */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-[#E5E8F0] shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por nome do quiz ou arquivo original..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-[#FDFDFF] border-[#D1D5DB] text-sm focus-visible:ring-[#6C4DF6]"
          />
        </div>

        <div className="w-full sm:w-56">
          <Select
            value={tipoFilter}
            onValueChange={(val: 'todos' | 'pptx' | 'xlsx') => setTipoFilter(val)}
          >
            <SelectTrigger className="h-10 rounded-xl bg-[#FDFDFF] border-[#D1D5DB] text-sm">
              <SelectValue placeholder="Filtrar por formato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os formatos</SelectItem>
              <SelectItem value="pptx">Apresentação (PPT)</SelectItem>
              <SelectItem value="xlsx">Planilha (Excel)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de Cards */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-[#5A6172] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#6C4DF6]" />
          <p className="text-sm">Carregando seus quizzes...</p>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-[#D1D5DB] p-8">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-[#5A6172] mx-auto flex items-center justify-center mb-4">
            <Search className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-[#1A1D2E]">Nenhum quiz encontrado</h3>
          <p className="text-xs text-[#5A6172] max-w-sm mx-auto mt-1 mb-5">
            {searchQuery || tipoFilter !== 'todos'
              ? 'Tente ajustar os filtros ou o termo de pesquisa utilizado.'
              : 'Você ainda não possui nenhum quiz criado. Faça o upload do seu primeiro arquivo!'}
          </p>
          <Link to="/new">
            <Button className="h-10 px-5 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] to-[#00C4A7]">
              <PlusCircle className="w-4 h-4 mr-2" />
              Criar Quiz
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredQuizzes.map((quiz) => {
            const isPpt = quiz.tipo_arquivo === 'pptx'
            const isConcluido = quizzesRespondidosIds.has(quiz.id)
            const numPerguntas = perguntasCountMap[quiz.id] || quiz.total_perguntas || 0
            const isProcessando =
              quiz.status_processamento === 'processando' ||
              quiz.status_processamento === 'pendente'
            const isErro = quiz.status_processamento === 'erro'

            return (
              <div
                key={quiz.id}
                className="bg-white rounded-2xl border border-[#E5E8F0] shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col justify-between group overflow-hidden"
              >
                <div className="p-5 flex-1 flex flex-col">
                  {/* Topo do Card com Ícone e Menu de Ações */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md ${
                        isPpt
                          ? 'bg-gradient-to-br from-orange-400 to-rose-500 shadow-orange-500/20'
                          : 'bg-gradient-to-br from-emerald-400 to-teal-600 shadow-teal-500/20'
                      }`}
                    >
                      {isPpt ? (
                        <FileText className="w-6 h-6" />
                      ) : (
                        <FileSpreadsheet className="w-6 h-6" />
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#1A1D2E] hover:bg-slate-100 transition-colors"
                          aria-label="Opções do quiz"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => navigate(`/quiz/${quiz.id}`)}>
                          <Eye className="w-4 h-4 mr-2 text-slate-500" />
                          Abrir quiz
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/quiz/${quiz.id}/play`)}>
                          <Play className="w-4 h-4 mr-2 text-[#6C4DF6]" />
                          Responder novamente
                        </DropdownMenuItem>
                        {quiz.token_publico && (
                          <DropdownMenuItem
                            onClick={async () => {
                              const url = `${window.location.origin}/p/${quiz.token_publico}`
                              try {
                                await navigator.clipboard.writeText(url)
                                toast({
                                  title: 'Link copiado!',
                                  description: 'Link público copiado para a área de transferência.',
                                })
                              } catch (_) {
                                toast({
                                  title: 'Erro ao copiar',
                                  variant: 'destructive',
                                })
                              }
                            }}
                          >
                            <Share2 className="w-4 h-4 mr-2 text-[#00C4A7]" />
                            Copiar link público
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setQuizToDelete(quiz)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Título e Arquivo */}
                  <div
                    onClick={() => navigate(`/quiz/${quiz.id}`)}
                    className="cursor-pointer flex-1"
                  >
                    <h3 className="font-extrabold text-base text-[#1A1D2E] group-hover:text-[#6C4DF6] transition-colors line-clamp-2">
                      {quiz.nome_quiz}
                    </h3>
                    <p className="text-xs text-[#5A6172] mt-1 font-mono truncate">
                      {quiz.nome_arquivo}
                    </p>
                  </div>

                  {/* Informações de Metadados */}
                  <div className="mt-5 pt-4 border-t border-[#E5E8F0] flex items-center justify-between text-xs text-[#5A6172]">
                    <div className="flex items-center gap-1.5 font-medium">
                      {isProcessando ? (
                        <span className="text-[#6C4DF6] font-semibold flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Processando...
                        </span>
                      ) : isErro ? (
                        <span className="text-red-500 font-semibold">Falha na extração</span>
                      ) : (
                        <span>
                          {numPerguntas} {numPerguntas === 1 ? 'questão' : 'questões'}
                        </span>
                      )}
                      <span>•</span>
                      <span>{formatarData(quiz.created)}</span>
                    </div>

                    {isProcessando ? (
                      <Badge className="bg-indigo-50 text-[#6C4DF6] border-indigo-200 gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Gerando IA
                      </Badge>
                    ) : isErro ? (
                      <Badge className="bg-red-50 text-red-600 border-red-200 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                        Atenção
                      </Badge>
                    ) : isConcluido ? (
                      <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Concluído
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Pendente
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Barra de Ação Rápida no Rodapé */}
                <div className="bg-[#F7F8FC] px-5 py-3 border-t border-[#E5E8F0] flex items-center gap-2">
                  <Button
                    onClick={() => navigate(`/quiz/${quiz.id}/play`)}
                    size="sm"
                    disabled={isProcessando || isErro || numPerguntas === 0}
                    className="flex-1 h-9 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-[#6C4DF6] to-[#00C4A7] hover:opacity-95 shadow-sm disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    {isProcessando
                      ? 'Processando...'
                      : isConcluido
                        ? 'Jogar de novo'
                        : 'Iniciar Quiz'}
                  </Button>
                  <Button
                    onClick={() => navigate(`/quiz/${quiz.id}`)}
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 rounded-xl border-[#D1D5DB] text-xs font-semibold text-[#5A6172]"
                  >
                    Detalhes
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={!!quizToDelete} onOpenChange={(open) => !open && setQuizToDelete(null)}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1A1D2E]">
              Excluir este quiz?
            </DialogTitle>
            <DialogDescription className="text-sm text-[#5A6172] pt-2">
              Tem certeza que deseja excluir o quiz{' '}
              <strong className="text-[#1A1D2E]">"{quizToDelete?.nome_quiz}"</strong>? Todas as
              perguntas e históricos de tentativas associados serão excluídos permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              variant="outline"
              onClick={() => setQuizToDelete(null)}
              disabled={isDeleting}
              className="rounded-xl border-[#D1D5DB]"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="rounded-xl bg-[#E74C3C] hover:bg-red-700 text-white font-semibold"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Sim, excluir quiz'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
