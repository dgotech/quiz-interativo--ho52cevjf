import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { quizService } from '@/services/quizService'
import type { QuizRecord, PerguntaRecord, RespostaItem } from '@/types/quiz'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Trophy,
  Loader2,
  Clock,
  Sparkles,
  RotateCcw,
  ListOrdered,
  BookOpen,
} from 'lucide-react'

export default function QuizPlay() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [quiz, setQuiz] = useState<QuizRecord | null>(null)
  const [perguntas, setPerguntas] = useState<PerguntaRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Estados do Jogo: 'intro' | 'playing' | 'result'
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'result'>('intro')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, string>>({}) // perguntaId -> resposta
  const [savingResult, setSavingResult] = useState(false)
  const [finalScore, setFinalScore] = useState(0)

  // Cronômetro
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Modo revisão na tela de resultado
  const [showReview, setShowReview] = useState(false)

  const loadQuiz = useCallback(async () => {
    if (!id) return
    try {
      const [quizData, pergsData] = await Promise.all([
        quizService.getQuiz(id),
        quizService.getPerguntas(id),
      ])
      setQuiz(quizData)
      setPerguntas(pergsData)
    } catch (err) {
      console.error('Erro ao carregar quiz para jogar:', err)
      toast({
        title: 'Erro ao abrir quiz',
        description: 'Não foi possível carregar as perguntas do quiz.',
        variant: 'destructive',
      })
      navigate('/quizzes')
    } finally {
      setLoading(false)
    }
  }, [id, navigate, toast])

  useEffect(() => {
    loadQuiz()
  }, [loadQuiz])

  // Gerenciamento do cronômetro
  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState])

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartGame = () => {
    setGameState('playing')
    setCurrentIndex(0)
    setSecondsElapsed(0)
    setRespostas({})
  }

  const currentQuestion = perguntas[currentIndex]
  const isLastQuestion = currentIndex === perguntas.length - 1

  const currentAnswer = currentQuestion ? respostas[currentQuestion.id] || '' : ''

  const handleSelectOption = (label: string) => {
    if (!currentQuestion) return
    setRespostas((prev) => ({
      ...prev,
      [currentQuestion.id]: label,
    }))
  }

  const handleTextAnswerChange = (val: string) => {
    if (!currentQuestion) return
    setRespostas((prev) => ({
      ...prev,
      [currentQuestion.id]: val,
    }))
  }

  const canGoNext = !!currentAnswer && currentAnswer.trim().length > 0

  const handleNext = () => {
    if (!canGoNext) return
    if (isLastQuestion) {
      finishGame()
    } else {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const finishGame = async () => {
    if (!quiz || !user) return
    setSavingResult(true)

    // Calcular pontuação baseado nas questões de múltipla escolha
    const objQuestions = perguntas.filter((p) => p.tipo === 'multipla_escolha')
    let correctCount = 0

    const formattedRespostas: RespostaItem[] = perguntas.map((p) => {
      const respDada = respostas[p.id] || ''
      const isCorreta = p.tipo === 'multipla_escolha' && respDada === p.resposta_correta
      if (isCorreta) correctCount++
      return {
        pergunta_id: p.id,
        resposta_dada: respDada,
        correta: p.tipo === 'multipla_escolha' ? isCorreta : undefined,
      }
    })

    const calculatedScore =
      objQuestions.length > 0 ? Math.round((correctCount / objQuestions.length) * 100) : 100

    setFinalScore(calculatedScore)

    try {
      await quizService.salvarTentativa({
        quiz_id: quiz.id,
        usuario_id: user.id,
        respostas: formattedRespostas,
        pontuacao: calculatedScore,
      })
      setGameState('result')
    } catch (err) {
      console.error('Erro ao salvar tentativa:', err)
      toast({
        title: 'Aviso',
        description: 'Suas respostas foram contabilizadas localmente.',
      })
      setGameState('result')
    } finally {
      setSavingResult(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1D2E] flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C4A7]" />
        <p className="text-sm text-slate-300">Preparando sua experiência de quiz...</p>
      </div>
    )
  }

  if (!quiz || perguntas.length === 0) {
    return (
      <div className="min-h-screen bg-[#1A1D2E] flex flex-col items-center justify-center text-white p-6 text-center">
        <p className="text-lg font-bold mb-4">Este quiz não possui perguntas configuradas.</p>
        <Button
          onClick={() => navigate('/quizzes')}
          variant="outline"
          className="text-white border-white/20"
        >
          Voltar para Quizzes
        </Button>
      </div>
    )
  }

  // TELA 1: INTRODUÇÃO DO JOGO
  if (gameState === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1D2E] via-[#2A1F52] to-[#143B39] text-white flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        {/* Fundo decorativo */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#6C4DF6]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#00C4A7]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-xl bg-white/10 backdrop-blur-xl border border-white/15 p-8 sm:p-10 rounded-3xl shadow-2xl relative z-10 text-center animate-fade-in space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center shadow-lg shadow-[#6C4DF6]/30 mx-auto">
            <Trophy className="w-8 h-8 text-white" />
          </div>

          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-[#00C4A7] bg-[#00C4A7]/10 px-3 py-1 rounded-full border border-[#00C4A7]/20">
              Desafio Interativo
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-3 tracking-tight">
              {quiz.nome_quiz}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 font-mono">
              Origem: {quiz.nome_arquivo}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
              <span className="text-2xl font-black text-white">{perguntas.length}</span>
              <p className="text-xs text-slate-400 mt-0.5">Perguntas no total</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
              <span className="text-2xl font-black text-[#00C4A7]">Feedback</span>
              <p className="text-xs text-slate-400 mt-0.5">Com explicações</p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Responda no seu ritmo. Suas respostas de múltipla escolha pontuam automaticamente e as
            dissertativas enriquecem seu raciocínio.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => navigate(`/quiz/${quiz.id}`)}
              variant="outline"
              className="h-12 rounded-2xl border-white/20 text-slate-300 hover:text-white hover:bg-white/10 sm:w-1/3"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button
              onClick={handleStartGame}
              className="flex-1 h-12 rounded-2xl font-bold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-xl shadow-[#6C4DF6]/30 transition-all transform active:scale-95"
            >
              Começar Desafio
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // TELA 2: JOGANDO AS PERGUNTAS
  if (gameState === 'playing' && currentQuestion) {
    const progressPercent = Math.round(((currentIndex + 1) / perguntas.length) * 100)
    const isObj = currentQuestion.tipo === 'multipla_escolha'

    return (
      <div className="min-h-screen bg-[#1A1D2E] text-white flex flex-col justify-between p-4 sm:p-8 animate-fade-in">
        {/* Barra Superior de Progresso e Cronômetro */}
        <header className="max-w-3xl w-full mx-auto space-y-4 shrink-0">
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-400 font-semibold">
            <div className="flex items-center gap-2">
              <Link
                to={`/quiz/${quiz.id}`}
                className="hover:text-white flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Sair</span>
              </Link>
              <span>•</span>
              <span className="text-white font-bold truncate max-w-[180px] sm:max-w-xs">
                {quiz.nome_quiz}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-slate-200">
                <Clock className="w-3.5 h-3.5 text-[#00C4A7]" />
                <span className="font-mono">{formatTimer(secondsElapsed)}</span>
              </div>
              <span className="text-[#00C4A7] font-bold">
                {currentIndex + 1} de {perguntas.length}
              </span>
            </div>
          </div>

          {/* Barra de Progresso com transição */}
          <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#6C4DF6] to-[#00C4A7] h-full rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </header>

        {/* Pergunta Central */}
        <div className="max-w-3xl w-full mx-auto my-8 flex-1 flex flex-col justify-center space-y-8">
          <div className="space-y-3">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-[#00C4A7] bg-[#00C4A7]/15 px-3 py-1 rounded-full border border-[#00C4A7]/30">
              {isObj ? 'Questão de Múltipla Escolha' : 'Questão Aberta / Dissertativa'}
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white leading-snug">
              {currentQuestion.enunciado}
            </h2>
          </div>

          {/* Opções de Múltipla Escolha */}
          {isObj && currentQuestion.opcoes && (
            <div className="grid grid-cols-1 gap-3.5">
              {currentQuestion.opcoes.map((opcao) => {
                const isSelected = currentAnswer === opcao.label

                return (
                  <div
                    key={opcao.label}
                    onClick={() => handleSelectOption(opcao.label)}
                    className={`p-4 sm:p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                      isSelected
                        ? 'bg-[#6C4DF6]/20 border-[#6C4DF6] text-white shadow-lg shadow-[#6C4DF6]/25 scale-[1.01]'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/30 hover:bg-white/[0.08]'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        isSelected ? 'bg-[#6C4DF6] text-white' : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {opcao.label}
                    </div>

                    <p className="text-sm sm:text-base font-medium flex-1">{opcao.texto}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pergunta Aberta: Textarea */}
          {!isObj && (
            <div className="space-y-2">
              <Textarea
                placeholder="Digite sua resposta explicativa com suas palavras..."
                value={currentAnswer}
                onChange={(e) => handleTextAnswerChange(e.target.value)}
                rows={6}
                className="rounded-2xl bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus-visible:ring-[#00C4A7] text-sm sm:text-base p-4 leading-relaxed"
              />
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Dica: Explique sua resposta de forma completa.</span>
                <span>{currentAnswer.length} caracteres</span>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações de Navegação */}
        <footer className="max-w-3xl w-full mx-auto flex items-center justify-between gap-4 pt-4 shrink-0">
          <Button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            variant="ghost"
            className="rounded-xl text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canGoNext || savingResult}
            className="h-12 px-8 rounded-2xl font-bold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-lg shadow-[#6C4DF6]/25 disabled:opacity-40 transition-all"
          >
            {savingResult ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gravando resultado...
              </>
            ) : isLastQuestion ? (
              <>
                Concluir Quiz
                <CheckCircle2 className="w-5 h-5 ml-2" />
              </>
            ) : (
              <>
                Próxima
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </footer>
      </div>
    )
  }

  // TELA 3: RESULTADO FINAL COM GAMIFICAÇÃO & ANIMAÇÃO DE CONFETE
  const objQuestions = perguntas.filter((p) => p.tipo === 'multipla_escolha')
  const correctCount = objQuestions.filter((p) => respostas[p.id] === p.resposta_correta).length

  const getEmotionalMessage = (score: number) => {
    if (score >= 90)
      return { title: 'Excelente!', desc: 'Você dominou o conteúdo deste documento com maestria!' }
    if (score >= 70)
      return {
        title: 'Muito bem!',
        desc: 'Ótimo desempenho! Você compreendeu os tópicos principais.',
      }
    if (score >= 50)
      return {
        title: 'Bom esforço!',
        desc: 'Você está no caminho certo. Vale a pena revisar alguns pontos.',
      }
    return {
      title: 'Continue estudando!',
      desc: 'Releia o material e tente novamente para fixar os conceitos.',
    }
  }

  const emotion = getEmotionalMessage(finalScore)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1D2E] via-[#2A1F52] to-[#143B39] text-white flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Efeito simulado de confetes coloridos */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-around">
        <span className="w-3 h-3 rounded-full bg-[#6C4DF6] animate-bounce delay-100 mt-12 opacity-80" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#00C4A7] animate-bounce delay-300 mt-24 opacity-80" />
        <span className="w-3.5 h-3.5 rounded-full bg-[#F1C40F] animate-bounce delay-150 mt-8 opacity-80" />
        <span className="w-2 h-2 rounded-full bg-[#E74C3C] animate-bounce delay-500 mt-16 opacity-80" />
        <span className="w-3 h-3 rounded-full bg-[#2ECC71] animate-bounce delay-200 mt-20 opacity-80" />
      </div>

      <div className="w-full max-w-xl bg-white/10 backdrop-blur-xl border border-white/15 p-6 sm:p-10 rounded-3xl shadow-2xl relative z-10 text-center animate-fade-in space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] flex items-center justify-center shadow-2xl shadow-[#6C4DF6]/40 mx-auto animate-pulse">
          <Trophy className="w-10 h-10 text-white" />
        </div>

        <div>
          <span className="text-xs uppercase font-extrabold tracking-wider text-[#00C4A7] bg-[#00C4A7]/10 px-3 py-1 rounded-full border border-[#00C4A7]/20">
            Quiz Finalizado
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-3">{emotion.title}</h1>
          <p className="text-sm text-slate-300 mt-1.5">{emotion.desc}</p>
        </div>

        {/* Card com Estatísticas da Tentativa */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
          <div>
            <span className="text-2xl sm:text-3xl font-black text-white">{finalScore}%</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Pontuação</p>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-[#00C4A7]">
              {correctCount}/{objQuestions.length}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Acertos objetivas</p>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
              {formatTimer(secondsElapsed)}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Tempo total</p>
          </div>
        </div>

        {/* Botão para Alternar Revisão */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setShowReview(!showReview)}
            variant="outline"
            className="flex-1 h-12 rounded-2xl border-white/20 text-white hover:bg-white/10 font-semibold"
          >
            <ListOrdered className="w-4 h-4 mr-2" />
            {showReview ? 'Ocultar revisão' : 'Revisar respostas'}
          </Button>

          <Button
            onClick={handleStartGame}
            className="flex-1 h-12 rounded-2xl font-bold text-white bg-gradient-to-r from-[#6C4DF6] to-[#00C4A7] hover:opacity-95 shadow-lg shadow-[#6C4DF6]/25"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Jogar novamente
          </Button>
        </div>

        <div className="pt-1 flex items-center justify-center gap-4 text-xs">
          <Link
            to={`/quiz/${quiz.id}`}
            className="text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Página do Quiz
          </Link>
          <span>•</span>
          <Link
            to="/quizzes"
            className="text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-[#00C4A7]" />
            Ver outros quizzes
          </Link>
        </div>

        {/* Bloco de Revisão Detalhada */}
        {showReview && (
          <div className="mt-6 pt-6 border-t border-white/10 text-left space-y-4 max-h-96 overflow-y-auto pr-2 animate-fade-in">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Gabarito & Revisão Pergunta a Pergunta
            </h3>

            {perguntas.map((p, pIdx) => {
              const respUser = respostas[p.id] || ''
              const isObjP = p.tipo === 'multipla_escolha'
              const acertou = isObjP && respUser === p.resposta_correta

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-2xl border text-xs leading-relaxed ${
                    !isObjP
                      ? 'bg-white/5 border-white/10'
                      : acertou
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-rose-500/10 border-rose-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-bold text-white">
                      {pIdx + 1}. {p.enunciado}
                    </span>
                    {isObjP && (
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${
                          acertou
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {acertou ? 'Acertou' : 'Errou'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-slate-300">
                    <p>
                      <strong>Sua resposta:</strong>{' '}
                      <span className="text-white font-medium">
                        {respUser || '(Não respondeu)'}
                      </span>
                    </p>
                    {isObjP && (
                      <p>
                        <strong>Alternativa correta:</strong>{' '}
                        <span className="text-emerald-400 font-bold">
                          Opção {p.resposta_correta}
                        </span>
                      </p>
                    )}
                    {p.explicacao && (
                      <p className="mt-2 pt-1 border-t border-white/10 text-slate-400 italic">
                        💡 <strong>Explicação:</strong> {p.explicacao}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
