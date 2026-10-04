import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { quizService } from '@/services/quizService'
import type { QuizRecord, PerguntaRecord, RespostaItem } from '@/types/quiz'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  XCircle,
  HelpCircle,
  Lightbulb,
  User,
  AlertCircle,
  Share2,
} from 'lucide-react'

export default function PublicQuizPlay() {
  const { token } = useParams<{ token: string }>()
  const { user } = useAuth()
  const { toast } = useToast()

  const [quiz, setQuiz] = useState<QuizRecord | null>(null)
  const [perguntas, setPerguntas] = useState<PerguntaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Nome do jogador convidado
  const [guestName, setGuestName] = useState(() => {
    return user?.name || localStorage.getItem('quiz_guest_name') || ''
  })

  // Estados do Jogo: 'intro' | 'playing' | 'result'
  const [gameState, setGameState] = useState<'intro' | 'playing' | 'result'>('intro')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [confirmedQuestions, setConfirmedQuestions] = useState<Record<string, boolean>>({})
  const [savingResult, setSavingResult] = useState(false)
  const [finalScore, setFinalScore] = useState(0)

  // Cronômetro
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Modo revisão na tela de resultado
  const [showReview, setShowReview] = useState(false)

  const loadQuiz = useCallback(async () => {
    if (!token) {
      setErrorMessage('Link de compartilhamento inválido.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const quizData = await quizService.getQuizByToken(token)
      if (!quizData) {
        setErrorMessage('Este quiz não está ativo ou não foi encontrado.')
        setLoading(false)
        return
      }

      setQuiz(quizData)
      const pergsData = await quizService.getPerguntas(quizData.id)
      setPerguntas(pergsData)
    } catch (err) {
      console.error('Erro ao carregar quiz público:', err)
      setErrorMessage(
        'Este quiz não está disponível no momento. Verifique com o organizador se o link está ativo.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadQuiz()
  }, [loadQuiz])

  // Cronômetro
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
    const trimmed = guestName.trim()
    if (trimmed) {
      try {
        localStorage.setItem('quiz_guest_name', trimmed)
      } catch {
        /* intentionally ignored */
      }
    }
    setGameState('playing')
    setCurrentIndex(0)
    setSecondsElapsed(0)
    setRespostas({})
    setConfirmedQuestions({})
  }

  const currentQuestion = perguntas[currentIndex]
  const isLastQuestion = currentIndex === perguntas.length - 1

  const currentAnswer = currentQuestion ? respostas[currentQuestion.id] || '' : ''
  const isCurrentConfirmed = currentQuestion ? !!confirmedQuestions[currentQuestion.id] : false
  const isObj = currentQuestion?.tipo === 'multipla_escolha'
  const isCorrect =
    isObj && currentQuestion?.resposta_correta
      ? currentAnswer === currentQuestion.resposta_correta
      : false

  const handleSelectOption = (label: string) => {
    if (!currentQuestion || isCurrentConfirmed) return
    setRespostas((prev) => ({
      ...prev,
      [currentQuestion.id]: label,
    }))
  }

  const handleTextAnswerChange = (val: string) => {
    if (!currentQuestion || isCurrentConfirmed) return
    setRespostas((prev) => ({
      ...prev,
      [currentQuestion.id]: val,
    }))
  }

  const hasAnswered = !!currentAnswer && currentAnswer.trim().length > 0

  // Confirmar resposta para ver feedback imediato
  const handleConfirmAnswer = () => {
    if (!currentQuestion || !hasAnswered) return
    setConfirmedQuestions((prev) => ({
      ...prev,
      [currentQuestion.id]: true,
    }))
  }

  // Avançar para próxima pergunta ou concluir
  const handleNext = () => {
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
    if (!quiz) return
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

    const finalPlayerName = guestName.trim() || 'Jogador Convidado'

    try {
      await quizService.salvarTentativa({
        quiz_id: quiz.id,
        usuario_id: user?.id || undefined,
        nome_jogador: finalPlayerName,
        respostas: formattedRespostas,
        pontuacao: calculatedScore,
      })
      setGameState('result')
    } catch (err) {
      console.error('Erro ao salvar tentativa pública:', err)
      toast({
        title: 'Pontuação calculada!',
        description: 'Seu resultado foi gerado com sucesso.',
      })
      setGameState('result')
    } finally {
      setSavingResult(false)
    }
  }

  // TELA DE CARREGAMENTO
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1D2E] flex flex-col items-center justify-center text-white gap-4 p-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#00C4A7]" />
        <p className="text-sm text-slate-300 font-medium">Carregando quiz compartilhado...</p>
      </div>
    )
  }

  // TELA DE ERRO (LINK EXPIRADO OU DESATIVADO)
  if (errorMessage || !quiz || perguntas.length === 0) {
    return (
      <div className="min-h-screen bg-[#1A1D2E] flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/15 p-8 rounded-3xl shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Quiz indisponível</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            {errorMessage ||
              'Este quiz não possui perguntas configuradas ou o link de compartilhamento foi desativado.'}
          </p>
          <div className="pt-2">
            <Link to="/login">
              <Button
                variant="outline"
                className="rounded-xl border-white/20 text-white hover:bg-white/10 text-xs"
              >
                Ir para a página inicial do QuizDoc AI
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // TELA 1: INTRODUÇÃO DO JOGO PÚBLICO (PEDIR NOME)
  if (gameState === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1A1D2E] via-[#2A1F52] to-[#143B39] text-white flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        {/* Fundo decorativo */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#6C4DF6]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#00C4A7]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-xl bg-white/10 backdrop-blur-xl border border-white/15 p-8 sm:p-10 rounded-3xl shadow-2xl relative z-10 text-center animate-fade-in space-y-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center shadow-md">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              QuizDoc AI • Convite Aberto
            </span>
          </div>

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

          <div className="grid grid-cols-2 gap-4 py-1">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
              <span className="text-2xl font-black text-white">{perguntas.length}</span>
              <p className="text-xs text-slate-400 mt-0.5">Perguntas</p>
            </div>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
              <span className="text-2xl font-black text-[#00C4A7]">Feedback</span>
              <p className="text-xs text-slate-400 mt-0.5">Imediato por questão</p>
            </div>
          </div>

          {/* Campo de identificação do participante */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#00C4A7]" />
              Como você gostaria de ser identificado?
            </label>
            <Input
              type="text"
              placeholder="Digite seu nome (ou apelido)..."
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="rounded-xl bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-[#00C4A7] text-sm h-11"
              maxLength={60}
            />
            <p className="text-[11px] text-slate-400">
              💡 Não precisa de e-mail nem senha. Seu nome aparecerá no ranking do quiz.
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleStartGame}
              className="w-full h-12 rounded-2xl font-bold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-xl shadow-[#6C4DF6]/30 transition-all transform active:scale-95 text-base"
            >
              Começar a Responder
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
              <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-slate-300 font-normal">
                {guestName.trim() || 'Participante'}
              </span>
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

          {/* Opções de Múltipla Escolha com Feedback Imediato */}
          {isObj && currentQuestion.opcoes && (
            <div className="grid grid-cols-1 gap-3.5">
              {currentQuestion.opcoes.map((opcao) => {
                const isSelected = currentAnswer === opcao.label
                const isTheCorrectOption = currentQuestion.resposta_correta === opcao.label

                let cardStyle = ''
                let badgeStyle = ''

                if (isCurrentConfirmed) {
                  if (isTheCorrectOption) {
                    cardStyle =
                      'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-[1.01]'
                    badgeStyle = 'bg-emerald-500 text-white ring-2 ring-emerald-300'
                  } else if (isSelected && !isTheCorrectOption) {
                    cardStyle =
                      'bg-rose-500/20 border-rose-500 text-white shadow-lg shadow-rose-500/20'
                    badgeStyle = 'bg-rose-500 text-white ring-2 ring-rose-300'
                  } else {
                    cardStyle = 'bg-white/5 border-white/5 text-slate-400 opacity-60'
                    badgeStyle = 'bg-white/10 text-slate-500'
                  }
                } else {
                  if (isSelected) {
                    cardStyle =
                      'bg-[#6C4DF6]/20 border-[#6C4DF6] text-white shadow-lg shadow-[#6C4DF6]/25 scale-[1.01]'
                    badgeStyle = 'bg-[#6C4DF6] text-white'
                  } else {
                    cardStyle =
                      'bg-white/5 border-white/10 text-slate-300 hover:border-white/30 hover:bg-white/[0.08]'
                    badgeStyle = 'bg-white/10 text-slate-400'
                  }
                }

                return (
                  <div
                    key={opcao.label}
                    onClick={() => handleSelectOption(opcao.label)}
                    className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                      isCurrentConfirmed ? 'cursor-default' : 'cursor-pointer'
                    } ${cardStyle}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${badgeStyle}`}
                    >
                      {opcao.label}
                    </div>

                    <p className="text-sm sm:text-base font-medium flex-1">{opcao.texto}</p>

                    {isCurrentConfirmed && isTheCorrectOption && (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shrink-0 animate-fade-in shadow-sm">
                        <CheckCircle2 className="w-4 h-4" /> Alternativa Correta
                      </span>
                    )}

                    {isCurrentConfirmed && isSelected && !isTheCorrectOption && (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-white shrink-0 animate-fade-in shadow-sm">
                        <XCircle className="w-4 h-4" /> Sua Escolha (Incorreta)
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Pergunta Aberta */}
          {!isObj && (
            <div className="space-y-3">
              <Textarea
                placeholder="Digite sua resposta explicativa com suas palavras..."
                value={currentAnswer}
                disabled={isCurrentConfirmed}
                onChange={(e) => handleTextAnswerChange(e.target.value)}
                rows={6}
                className="rounded-2xl bg-white/5 border-white/15 text-white placeholder:text-slate-500 focus-visible:ring-[#00C4A7] text-sm sm:text-base p-4 leading-relaxed disabled:opacity-80"
              />
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Dica: Explique com suas próprias palavras.</span>
                <span>{currentAnswer.length} caracteres</span>
              </div>
            </div>
          )}

          {/* Banner de Feedback Imediato */}
          {isCurrentConfirmed && (
            <div
              className={`p-5 rounded-2xl border-2 animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl ${
                !isObj
                  ? 'bg-purple-500/15 border-purple-400/40 text-purple-100'
                  : isCorrect
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
                    : 'bg-rose-500/20 border-rose-400/50 text-rose-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    !isObj
                      ? 'bg-purple-500 text-white'
                      : isCorrect
                        ? 'bg-emerald-500 text-white'
                        : 'bg-rose-500 text-white'
                  }`}
                >
                  {!isObj ? (
                    <HelpCircle className="w-6 h-6" />
                  ) : isCorrect ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <XCircle className="w-6 h-6" />
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                    {!isObj
                      ? 'Resposta registrada!'
                      : isCorrect
                        ? '🎉 Mandou bem! Resposta correta!'
                        : '❌ Não foi dessa vez!'}
                  </h4>

                  {isObj && !isCorrect && (
                    <p className="text-xs sm:text-sm text-slate-200">
                      A alternativa correta é a{' '}
                      <strong className="text-emerald-300 font-extrabold underline underline-offset-2">
                        Opção {currentQuestion.resposta_correta}
                      </strong>
                      .
                    </p>
                  )}

                  {!isObj && currentQuestion.resposta_correta && (
                    <p className="text-xs text-purple-200">
                      <strong>Gabarito sugerido:</strong> {currentQuestion.resposta_correta}
                    </p>
                  )}

                  {currentQuestion.explicacao && (
                    <p className="text-xs text-slate-300 italic pt-1 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{currentQuestion.explicacao}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações de Navegação */}
        <footer className="max-w-3xl w-full mx-auto flex items-center justify-between gap-4 pt-4 shrink-0">
          <Button
            onClick={handlePrev}
            disabled={currentIndex === 0 || savingResult}
            variant="ghost"
            className="rounded-xl text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          {!isCurrentConfirmed ? (
            <Button
              onClick={handleConfirmAnswer}
              disabled={!hasAnswered}
              className="h-12 px-8 rounded-2xl font-bold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-lg shadow-[#6C4DF6]/25 disabled:opacity-40 transition-all transform active:scale-95"
            >
              Confirmar Resposta
              <CheckCircle2 className="w-5 h-5 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={savingResult}
              className={`h-12 px-8 rounded-2xl font-bold text-white transition-all shadow-lg transform active:scale-95 ${
                isLastQuestion
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 shadow-emerald-500/25'
                  : 'bg-gradient-to-r from-[#6C4DF6] to-[#00C4A7] hover:opacity-95 shadow-[#6C4DF6]/25'
              }`}
            >
              {savingResult ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando resultado...
                </>
              ) : isLastQuestion ? (
                <>
                  Ver Resultado Final
                  <Trophy className="w-5 h-5 ml-2" />
                </>
              ) : (
                <>
                  Próxima Pergunta
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          )}
        </footer>
      </div>
    )
  }

  // TELA 3: RESULTADO FINAL
  const objQuestions = perguntas.filter((p) => p.tipo === 'multipla_escolha')
  const correctCount = objQuestions.filter((p) => respostas[p.id] === p.resposta_correta).length

  const getEmotionalMessage = (score: number) => {
    if (score >= 90) return { title: 'Excelente!', desc: 'Você dominou o conteúdo com maestria!' }
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
      title: 'Continue praticando!',
      desc: 'Tente novamente para fixar os conceitos e melhorar a pontuação.',
    }
  }

  const emotion = getEmotionalMessage(finalScore)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1D2E] via-[#2A1F52] to-[#143B39] text-white flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Confetes animados */}
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
            Parabéns, {guestName.trim() || 'Convidado'}!
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-3">{emotion.title}</h1>
          <p className="text-sm text-slate-300 mt-1.5">{emotion.desc}</p>
        </div>

        {/* Card com Estatísticas */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
          <div>
            <span className="text-2xl sm:text-3xl font-black text-white">{finalScore}%</span>
            <p className="text-[11px] text-slate-400 mt-0.5">Pontuação</p>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-[#00C4A7]">
              {correctCount}/{objQuestions.length}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Acertos</p>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
              {formatTimer(secondsElapsed)}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Tempo</p>
          </div>
        </div>

        {/* Botões de Ação */}
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

        {/* Link para criar conta se quiser criar seus próprios quizzes */}
        <div className="pt-4 border-t border-white/10 text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#00C4A7]" />
          <span>Gostou? Crie seus próprios quizzes com IA no</span>
          <Link to="/signup" className="text-white underline hover:text-[#00C4A7] font-semibold">
            QuizDoc AI
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
