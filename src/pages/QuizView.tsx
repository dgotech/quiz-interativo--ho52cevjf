import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { quizService } from '@/services/quizService'
import type { QuizRecord, PerguntaRecord, TentativaRecord } from '@/types/quiz'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Play,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Award,
  Sparkles,
  Loader2,
  AlertCircle,
  Edit3,
  Share2,
  Copy,
  Check,
  Globe,
  ExternalLink,
  Users,
  User,
  RefreshCw,
  Eye,
} from 'lucide-react'
import { QuizQuestionsEditor } from '@/components/QuizQuestionsEditor'
import { RelatorioIndividual } from '@/components/RelatorioIndividual'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { exportarQuizParaExcel } from '@/lib/quizExcelExport'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function QuizView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

  const [quiz, setQuiz] = useState<QuizRecord | null>(null)
  const [perguntas, setPerguntas] = useState<PerguntaRecord[]>([])
  const [tentativas, setTentativas] = useState<TentativaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Aba ativa: 'overview' | 'questions'
  const [activeTab, setActiveTab] = useState<'overview' | 'questions'>('overview')

  // Modal para ver conteúdo original extraído
  const [showOriginalModal, setShowOriginalModal] = useState(false)

  // Estados de compartilhamento
  const [copied, setCopied] = useState(false)
  const [togglingShare, setTogglingShare] = useState(false)
  const [regeneratingToken, setRegeneratingToken] = useState(false)

  // Estado de regeneração de perguntas com IA
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false)
  const [regeneratingQuestions, setRegeneratingQuestions] = useState(false)

  // Estado de exportação Excel
  const [exportingExcel, setExportingExcel] = useState(false)

  // Acordeão de detalhes da tentativa
  const [expandedTentativaId, setExpandedTentativaId] = useState<string | null>(null)

  // Modal com o Relatório Individual Completo da tentativa clicada
  const [selectedTentativaParaRelatorio, setSelectedTentativaParaRelatorio] =
    useState<TentativaRecord | null>(null)

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      const [quizData, pergsData, tentsData] = await Promise.all([
        quizService.getQuiz(id),
        quizService.getPerguntas(id),
        quizService.getTentativasDoQuiz(id),
      ])
      setQuiz(quizData)
      setPerguntas(pergsData)
      setTentativas(tentsData)
    } catch (err: unknown) {
      console.error('Erro ao carregar quiz:', err)
      setError('Quiz não encontrado ou você não possui permissão para visualizá-lo.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-[#5A6172] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#6C4DF6]" />
        <p className="text-sm">Carregando detalhes do quiz...</p>
      </div>
    )
  }

  if (error || !quiz) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-500 mx-auto flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#1A1D2E]">{error || 'Quiz não encontrado'}</h2>
        <p className="text-sm text-[#5A6172]">
          O quiz solicitado pode ter sido excluído ou não existe mais no seu banco de dados.
        </p>
        <Link to="/quizzes">
          <Button variant="outline" className="rounded-xl">
            Voltar para Meus Quizzes
          </Button>
        </Link>
      </div>
    )
  }

  const isPpt = quiz.tipo_arquivo === 'pptx'
  const hasCompleted = tentativas.length > 0
  const bestScore = hasCompleted ? Math.max(...tentativas.map((t) => t.pontuacao || 0)) : 0
  const isOwner = !!user && user.id === quiz.usuario_id

  const shareUrl = quiz.token_publico ? `${window.location.origin}/p/${quiz.token_publico}` : ''

  // Ação de exportar perguntas e tentativas para Excel
  const handleExportExcel = () => {
    if (!quiz) return
    setExportingExcel(true)
    try {
      const result = exportarQuizParaExcel(quiz, perguntas, tentativas)
      toast({
        title: 'Planilha gerada com sucesso!',
        description: `O arquivo ${result.fileName} foi baixado com perguntas, gabarito e histórico.`,
      })
    } catch (err) {
      console.error('Erro na exportação para Excel:', err)
      toast({
        title: 'Erro ao gerar planilha',
        description: 'Não foi possível exportar os dados para Excel no momento.',
        variant: 'destructive',
      })
    } finally {
      setExportingExcel(false)
    }
  }

  // Ação de confirmar e disparar a regeneração de perguntas com IA
  const handleConfirmRegenerate = async () => {
    if (!quiz) return
    setRegeneratingQuestions(true)
    try {
      const res = await quizService.regenerarPerguntas(quiz.id)
      setConfirmRegenerateOpen(false)
      toast({
        title: 'Novas perguntas geradas!',
        description: res.message || 'O conjunto de perguntas foi atualizado com sucesso pela IA.',
      })
      await loadData()
      // Leva o usuário para a aba de revisão para ver o novo conjunto imediatamente
      setActiveTab('questions')
    } catch (err: unknown) {
      console.error('Erro ao refazer perguntas:', err)
      const message =
        (err as { response?: { message?: string } })?.response?.message ||
        (err as { message?: string })?.message ||
        'Não foi possível formular novas perguntas com a IA. Tente novamente em instantes.'
      toast({
        title: 'Falha ao refazer perguntas',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setRegeneratingQuestions(false)
    }
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast({
        title: 'Link copiado!',
        description: 'Qualquer pessoa com o link pode responder sem precisar de cadastro.',
      })
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.error('Falha ao copiar:', err)
      toast({
        title: 'Não foi possível copiar',
        description: 'Copie manualmente o link exibido no campo.',
        variant: 'destructive',
      })
    }
  }

  const handleToggleShare = async (checked: boolean) => {
    if (!quiz) return
    setTogglingShare(true)
    try {
      const updated = await quizService.alternarCompartilhamento(quiz.id, checked)
      setQuiz(updated)
      toast({
        title: checked ? 'Link público ativado' : 'Link público desativado',
        description: checked
          ? 'Agora qualquer pessoa pode acessar e responder pelo link compartilhado.'
          : 'O acesso público foi pausado. Apenas você tem acesso ao quiz.',
      })
    } catch (err) {
      console.error('Erro ao alternar compartilhamento:', err)
      toast({
        title: 'Erro ao alterar status',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setTogglingShare(false)
    }
  }

  const handleRegenerateToken = async () => {
    if (!quiz) return
    if (!confirm('Deseja gerar um novo link? O link anterior deixará de funcionar.')) return
    setRegeneratingToken(true)
    try {
      const updated = await quizService.regenerarToken(quiz.id)
      setQuiz(updated)
      toast({
        title: 'Novo link gerado com sucesso!',
        description: 'Envie o novo endereço para os participantes.',
      })
    } catch (err) {
      console.error('Erro ao regenerar token:', err)
      toast({
        title: 'Erro ao gerar novo link',
        variant: 'destructive',
      })
    } finally {
      setRegeneratingToken(false)
    }
  }

  const formatarData = (dataStr: string) => {
    try {
      const d = new Date(dataStr)
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    } catch (_) {
      return dataStr
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* Botão Voltar */}
      <div className="flex items-center justify-between">
        <Link
          to="/quizzes"
          className="inline-flex items-center text-xs font-semibold text-[#5A6172] hover:text-[#1A1D2E] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Voltar para Meus Quizzes
        </Link>

        {/* Abas de Navegação */}
        <div className="flex items-center bg-[#ECEFF6] p-1 rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-white text-[#1A1D2E] shadow-sm'
                : 'text-[#5A6172] hover:text-[#1A1D2E]'
            }`}
          >
            Visão Geral & Tentativas
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'questions'
                ? 'bg-white text-[#6C4DF6] shadow-sm'
                : 'text-[#5A6172] hover:text-[#1A1D2E]'
            }`}
          >
            <span>Revisar & Editar Perguntas</span>
            <span className="w-5 h-5 rounded-full bg-[#6C4DF6]/10 text-[#6C4DF6] text-[10px] flex items-center justify-center font-bold">
              {perguntas.length}
            </span>
          </button>
        </div>
      </div>

      {/* Cabeçalho do Quiz */}
      <div className="bg-white rounded-3xl border border-[#E5E8F0] p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md ${
              isPpt
                ? 'bg-gradient-to-br from-orange-400 to-rose-500 shadow-orange-500/20'
                : 'bg-gradient-to-br from-emerald-400 to-teal-600 shadow-teal-500/20'
            }`}
          >
            {isPpt ? <FileText className="w-7 h-7" /> : <FileSpreadsheet className="w-7 h-7" />}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {hasCompleted ? (
                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 gap-1 px-3 py-0.5 rounded-full text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Concluído ({bestScore}% de melhor nota)
                </Badge>
              ) : (
                <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 gap-1 px-3 py-0.5 rounded-full text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Pendente
                </Badge>
              )}
              <span className="text-xs text-[#5A6172]">{formatarData(quiz.created)}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1D2E] tracking-tight">
              {quiz.nome_quiz}
            </h1>

            <p className="text-xs font-mono text-[#5A6172] flex items-center gap-1.5">
              <span>Arquivo: {quiz.nome_arquivo}</span>
              <span>•</span>
              <span className="font-sans font-medium text-[#1A1D2E]">
                {perguntas.length} {perguntas.length === 1 ? 'pergunta' : 'perguntas geradas'}
              </span>
            </p>
          </div>
        </div>

        {/* Botões Primários */}
        <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-2.5">
          <Button
            onClick={() => navigate(`/quiz/${quiz.id}/play`)}
            size="lg"
            className="w-full sm:w-auto h-12 px-7 rounded-2xl font-bold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-lg shadow-[#6C4DF6]/25 transition-all transform hover:-translate-y-0.5"
          >
            <Play className="w-5 h-5 mr-2 fill-current" />
            {hasCompleted ? 'Responder novamente' : 'Responder quiz'}
          </Button>

          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            {isOwner && (
              <>
                <Button
                  onClick={handleExportExcel}
                  disabled={exportingExcel}
                  variant="outline"
                  size="sm"
                  title="Exportar perguntas, alternativas e tentativas para planilha Excel"
                  className="rounded-xl border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100 font-semibold text-xs h-9 px-3"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
                  {exportingExcel ? 'Exportando...' : 'Exportar Excel'}
                </Button>

                <Button
                  onClick={() => setConfirmRegenerateOpen(true)}
                  disabled={regeneratingQuestions}
                  variant="outline"
                  size="sm"
                  title="Formular novas perguntas inéditas com Inteligência Artificial a partir do documento já salvo"
                  className="rounded-xl border-[#6C4DF6]/30 bg-purple-50/50 text-[#6C4DF6] hover:bg-[#6C4DF6]/15 font-semibold text-xs h-9 px-3"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 ${regeneratingQuestions ? 'animate-spin' : ''}`}
                  />
                  Refazer perguntas
                </Button>
              </>
            )}

            <Button
              onClick={() => setActiveTab(activeTab === 'questions' ? 'overview' : 'questions')}
              variant="outline"
              size="sm"
              className="rounded-xl border-[#E5E8F0] font-semibold text-xs h-9 px-3"
            >
              <Edit3 className="w-4 h-4 mr-1.5 text-[#6C4DF6]" />
              {activeTab === 'questions' ? 'Ver visão geral' : 'Revisar & editar'}
            </Button>
          </div>
        </div>
      </div>

      {/* CARD DE COMPARTILHAMENTO PÚBLICO (SEM LOGIN) */}
      <div className="bg-white rounded-3xl border border-[#E5E8F0] p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#6C4DF6] flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-[#1A1D2E]">
                  Compartilhar Quiz por Link
                </h3>
                {quiz.publico_ativo ? (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Globe className="w-3 h-3 text-emerald-600" />
                    Link Ativo
                  </Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Privado
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[#5A6172]">
                Envie para grupos no WhatsApp, Telegram ou e-mail. Participantes jogam sem precisar
                criar conta!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center bg-[#F7F8FC] p-2 rounded-2xl border border-[#E5E8F0]">
            <span className="text-xs font-semibold text-[#1A1D2E]">
              {quiz.publico_ativo ? 'Link Ativo' : 'Link Desativado'}
            </span>
            <Switch
              checked={!!quiz.publico_ativo}
              disabled={togglingShare}
              onCheckedChange={handleToggleShare}
            />
          </div>
        </div>

        {quiz.publico_ativo ? (
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 flex items-center bg-[#F7F8FC] border border-[#E5E8F0] rounded-2xl px-3.5 py-2.5 text-xs text-[#1A1D2E] font-mono overflow-hidden">
                <Globe className="w-4 h-4 text-[#6C4DF6] mr-2 shrink-0" />
                <span className="truncate select-all flex-1">{shareUrl}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={handleCopyLink}
                  className="rounded-2xl h-11 px-5 font-bold text-xs bg-[#6C4DF6] text-white hover:bg-[#5939e6] shadow-sm flex items-center gap-2 flex-1 sm:flex-initial"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Link
                    </>
                  )}
                </Button>

                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button
                    variant="outline"
                    className="rounded-2xl h-11 px-3.5 text-xs font-semibold border-[#E5E8F0] text-[#1A1D2E] hover:bg-slate-50"
                    title="Testar link como participante"
                  >
                    <ExternalLink className="w-4 h-4 text-[#5A6172]" />
                  </Button>
                </a>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#5A6172] pt-1">
              <span>
                ✨ <strong>Sem cadastro:</strong> O convidado só informa o nome e joga na hora.
              </span>
              <button
                type="button"
                onClick={handleRegenerateToken}
                disabled={regeneratingToken}
                className="text-[#6C4DF6] hover:underline font-semibold flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${regeneratingToken ? 'animate-spin' : ''}`} />
                Renovar link
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              O compartilhamento está desativado. Ative a chave acima para gerar o link e liberar o
              acesso sem login.
            </span>
          </div>
        )}
      </div>

      {/* RENDERIZAÇÃO CONDICIONAL BASEADA NA ABA ATIVA */}
      {activeTab === 'questions' ? (
        <QuizQuestionsEditor
          quizId={quiz.id}
          perguntas={perguntas}
          onRefresh={loadData}
          quiz={quiz}
          tentativas={tentativas}
          onRegenerateClick={() => setConfirmRegenerateOpen(true)}
          onExportExcelClick={handleExportExcel}
          isOwner={isOwner}
        />
      ) : (
        <>
          {/* Seção Material de Estudo */}
          <div className="bg-white rounded-3xl border border-[#E5E8F0] p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#6C4DF6] flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#1A1D2E]">Material de Estudo</h3>
                  <p className="text-xs text-[#5A6172]">
                    Conteúdo estruturado e interpretado a partir do seu arquivo
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setShowOriginalModal(true)}
                variant="outline"
                className="rounded-xl border-[#6C4DF6] text-[#6C4DF6] hover:bg-[#6C4DF6]/10 font-semibold text-xs h-9"
              >
                Visualizar arquivo original
              </Button>
            </div>

            <div className="p-4 rounded-2xl bg-[#F7F8FC] border border-[#E5E8F0] text-xs text-[#5A6172] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00C4A7] shrink-0" />
              <span>
                <strong>Dica de aprendizagem:</strong> Use o material para revisar os pontos-chave
                antes de responder ou repetir o quiz!
              </span>
            </div>
          </div>

          {/* Histórico de Tentativas Anteriores */}
          <div className="bg-white rounded-3xl border border-[#E5E8F0] p-6 sm:p-8 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-[#1A1D2E]">Tentativas Anteriores</h3>
                <p className="text-xs text-[#5A6172]">
                  {tentativas.length > 0
                    ? `Você já completou este quiz ${tentativas.length} ${tentativas.length === 1 ? 'vez' : 'vezes'}.`
                    : 'Você ainda não respondeu este quiz. Clique no botão acima para iniciar!'}
                </p>
              </div>

              {hasCompleted && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800">
                  <Award className="w-4 h-4 text-amber-500" />
                  Melhor: {bestScore}%
                </div>
              )}
            </div>

            {tentativas.length === 0 ? (
              <div className="py-10 text-center rounded-2xl bg-[#F7F8FC] border border-dashed border-[#D1D5DB]">
                <Play className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-[#1A1D2E]">Nenhuma tentativa registrada</p>
                <p className="text-xs text-[#5A6172] mt-1">
                  Teste seus conhecimentos agora e veja sua pontuação detalhada aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tentativas.map((tent, index) => {
                  const tentativaNumero = tentativas.length - index
                  const isExpanded = expandedTentativaId === tent.id
                  const score = tent.pontuacao || 0
                  const participantName = tent.nome_jogador
                    ? `${tent.nome_jogador} (Convidado)`
                    : 'Você (Admin/Dono)'

                  return (
                    <div
                      key={tent.id}
                      className="rounded-2xl border border-[#E5E8F0] bg-[#FDFDFF] overflow-hidden transition-all hover:border-[#6C4DF6]/40 shadow-sm"
                    >
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div
                          className="flex items-center gap-3 cursor-pointer flex-1"
                          onClick={() => setSelectedTentativaParaRelatorio(tent)}
                          title="Clique para abrir o relatório individual completo deste participante"
                        >
                          <div
                            className={`w-10 h-10 rounded-xl font-extrabold text-sm flex items-center justify-center shrink-0 ${
                              score >= 70
                                ? 'bg-emerald-100 text-emerald-700'
                                : score >= 50
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {score}%
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-[#1A1D2E] hover:text-[#6C4DF6] transition-colors">
                                Tentativa #{tentativaNumero}
                              </h4>
                              {tent.nome_jogador ? (
                                <Badge className="bg-purple-50 text-[#6C4DF6] border-purple-200 text-[10px] font-semibold gap-1 px-2 py-0">
                                  <User className="w-3 h-3" />
                                  {tent.nome_jogador} (Convidado)
                                </Badge>
                              ) : (
                                <Badge className="bg-slate-100 text-[#5A6172] border-slate-200 text-[10px] font-semibold gap-1 px-2 py-0">
                                  <User className="w-3 h-3" />
                                  Você (Admin/Dono)
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-[#5A6172]">{formatarData(tent.created)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedTentativaParaRelatorio(tent)}
                            className="rounded-xl border-[#6C4DF6]/30 bg-purple-50/60 text-[#6C4DF6] hover:bg-[#6C4DF6]/15 font-bold text-xs h-8 px-3"
                            title="Abrir o relatório individual completo do participante com explicações"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Relatório Completo
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedTentativaId(isExpanded ? null : tent.id)}
                            className="text-xs font-semibold text-[#5A6172] hover:text-[#1A1D2E] hover:bg-slate-100 h-8 px-2.5 rounded-xl"
                          >
                            {isExpanded ? (
                              <>
                                Fechar <ChevronUp className="w-3.5 h-3.5 ml-1" />
                              </>
                            ) : (
                              <>
                                Expandir <ChevronDown className="w-3.5 h-3.5 ml-1" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Detalhes expandidos rápidos diretamente na lista */}
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 border-t border-[#E5E8F0] bg-[#F7F8FC] space-y-4 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-[#5A6172]">
                              Resumo das Respostas Registradas ({participantName}):
                            </h5>
                            <button
                              type="button"
                              onClick={() => setSelectedTentativaParaRelatorio(tent)}
                              className="text-xs font-bold text-[#6C4DF6] hover:underline flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> Ver no Relatório Completo
                            </button>
                          </div>

                          <div className="space-y-3">
                            {perguntas.map((p, pIndex) => {
                              const respEnviada = (tent.respostas || []).find(
                                (r) => r.pergunta_id === p.id,
                              )
                              const isObj = p.tipo === 'multipla_escolha'
                              const acertou =
                                isObj && respEnviada?.resposta_dada === p.resposta_correta

                              const opcaoUser = isObj
                                ? p.opcoes?.find((o) => o.label === respEnviada?.resposta_dada)
                                : null
                              const opcaoCorreta = isObj
                                ? p.opcoes?.find((o) => o.label === p.resposta_correta)
                                : null

                              return (
                                <div
                                  key={p.id}
                                  className={`p-3.5 rounded-xl border text-xs ${
                                    !isObj
                                      ? 'border-purple-200 bg-purple-50/40'
                                      : acertou
                                        ? 'border-emerald-200 bg-emerald-50/60'
                                        : 'border-rose-200 bg-rose-50/60'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-bold text-[#1A1D2E] text-xs">
                                      {pIndex + 1}. {p.enunciado}
                                    </p>
                                    {isObj ? (
                                      <span
                                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${
                                          acertou
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-rose-100 text-rose-800'
                                        }`}
                                      >
                                        {acertou ? 'Correto' : 'Incorreto'}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 bg-purple-100 text-purple-800">
                                        Dissertativa
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-2 space-y-1.5 text-[#5A6172]">
                                    <p>
                                      <strong>Resposta do participante:</strong>{' '}
                                      <span className="font-semibold text-[#1A1D2E]">
                                        {respEnviada?.resposta_dada ? (
                                          isObj ? (
                                            `Opção ${respEnviada.resposta_dada}${
                                              opcaoUser ? ` - ${opcaoUser.texto}` : ''
                                            }`
                                          ) : (
                                            respEnviada.resposta_dada
                                          )
                                        ) : (
                                          <span className="italic text-slate-400">
                                            (Não respondeu)
                                          </span>
                                        )}
                                      </span>
                                    </p>

                                    {isObj && (
                                      <p>
                                        <strong>Gabarito oficial:</strong>{' '}
                                        <span className="font-bold text-emerald-700">
                                          Opção {p.resposta_correta}
                                          {opcaoCorreta ? ` - ${opcaoCorreta.texto}` : ''}
                                        </span>
                                      </p>
                                    )}

                                    {!isObj && p.resposta_correta && (
                                      <p>
                                        <strong>Resposta esperada (modelo):</strong>{' '}
                                        <span className="font-medium text-purple-900 italic">
                                          {p.resposta_correta}
                                        </span>
                                      </p>
                                    )}

                                    {p.explicacao && (
                                      <div className="mt-2 pt-2 border-t border-slate-200/80 text-slate-700 bg-white/70 p-2.5 rounded-lg">
                                        <p className="font-bold text-amber-800 flex items-center gap-1.5 text-[11px] mb-0.5">
                                          💡 Explicação Pedagógica da Questão:
                                        </p>
                                        <p className="italic text-xs">{p.explicacao}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal do Relatório Individual Completo do Participante */}
      <Dialog
        open={!!selectedTentativaParaRelatorio}
        onOpenChange={(open) => {
          if (!open) setSelectedTentativaParaRelatorio(null)
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col rounded-3xl p-6 sm:p-8 bg-[#1A1D2E] text-white border border-white/20">
          <DialogHeader className="shrink-0 pb-3 border-b border-white/10 text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#00C4A7] bg-[#00C4A7]/15 px-3 py-1 rounded-full border border-[#00C4A7]/30">
                Quiz - Zara 2026
              </span>
              <span className="text-xs text-slate-400 font-mono">{quiz.nome_quiz}</span>
            </div>
            <DialogTitle className="text-2xl font-black text-white mt-1">
              Relatório Individual de Desempenho
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300">
              Visualização detalhada da tentativa com resumo por questão, comparação de respostas
              dissertativas e explicações das respostas certas.
            </DialogDescription>
          </DialogHeader>

          {selectedTentativaParaRelatorio && (
            <div className="flex-1 overflow-y-auto py-4 pr-1">
              <RelatorioIndividual
                nomeParticipante={
                  selectedTentativaParaRelatorio.nome_jogador
                    ? `${selectedTentativaParaRelatorio.nome_jogador} (Convidado)`
                    : 'Você (Admin/Dono)'
                }
                pontuacao={selectedTentativaParaRelatorio.pontuacao || 0}
                perguntas={perguntas}
                respostas={selectedTentativaParaRelatorio.respostas || []}
                dataTentativa={formatarData(selectedTentativaParaRelatorio.created)}
                modoModal={true}
              />
            </div>
          )}

          <div className="pt-3 border-t border-white/10 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-400">
              Dica: Você também pode exportar todas as tentativas em planilha Excel pela aba
              principal.
            </span>
            <Button
              onClick={() => setSelectedTentativaParaRelatorio(null)}
              className="rounded-2xl px-6 h-10 font-bold bg-[#6C4DF6] text-white hover:bg-[#5939e6]"
            >
              Fechar Relatório
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para Visualizar Arquivo Original / Conteúdo Extraído */}
      <Dialog open={showOriginalModal} onOpenChange={setShowOriginalModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col rounded-3xl p-6">
          <DialogHeader className="shrink-0 pb-3 border-b border-[#E5E8F0]">
            <DialogTitle className="text-xl font-bold text-[#1A1D2E] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#6C4DF6]" />
              Material Extraído: {quiz.nome_arquivo}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5A6172]">
              Conteúdo textual e tabelas identificadas pela IA durante o upload do documento.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 pr-2 text-sm text-[#1A1D2E] leading-relaxed whitespace-pre-wrap font-sans bg-[#F7F8FC] p-4 rounded-2xl border border-[#E5E8F0]">
            {quiz.conteudo_extraido || 'Nenhum texto disponível para visualização.'}
          </div>

          <div className="pt-3 border-t border-[#E5E8F0] flex justify-end shrink-0">
            <Button
              onClick={() => setShowOriginalModal(false)}
              className="rounded-xl px-5 h-10 font-semibold bg-[#1A1D2E] text-white hover:bg-slate-800"
            >
              Fechar Material
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação para Refazer Perguntas com IA */}
      <AlertDialog open={confirmRegenerateOpen} onOpenChange={setConfirmRegenerateOpen}>
        <AlertDialogContent className="rounded-3xl max-w-lg p-6 sm:p-7">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-[#6C4DF6] flex items-center justify-center mb-1">
              <RefreshCw className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-xl font-extrabold text-[#1A1D2E]">
              Refazer perguntas com IA?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#5A6172] space-y-2 pt-1">
              <p>
                A Inteligência Artificial irá analisar o documento já salvo (
                <strong className="text-[#1A1D2E]">{quiz.nome_arquivo}</strong>) e gerar um conjunto
                completamente novo e variado de perguntas (10 de múltipla escolha e 3
                dissertativas).
              </p>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs">
                ⚠️ <strong>Atenção:</strong> As <strong>{perguntas.length} perguntas atuais</strong>{' '}
                serão substituídas pelas novas propostas. O nome do quiz e o total de tentativas
                anteriores são preservados.
              </div>
              <p className="text-[11px] text-[#5A6172]">
                Não é necessário enviar o arquivo novamente. Deseja continuar?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-3 gap-2">
            <AlertDialogCancel disabled={regeneratingQuestions} className="rounded-xl text-xs h-10">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmRegenerate()
              }}
              disabled={regeneratingQuestions}
              className="rounded-xl text-xs font-bold bg-[#6C4DF6] hover:bg-[#5939e6] text-white h-10 px-5 flex items-center gap-1.5"
            >
              {regeneratingQuestions ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Formulando novas perguntas com IA...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Sim, gerar novas perguntas
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
