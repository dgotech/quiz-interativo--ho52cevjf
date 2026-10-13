import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { competicaoService } from '@/services/competicaoService'
import { quizService } from '@/services/quizService'
import type {
  CompeticaoRecord,
  GrupoRecord,
  ParticipacaoRecord,
  QuizRecord,
  PerguntaRecord,
  RankingGrupo,
  RespostaItem,
} from '@/types/quiz'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Trophy,
  Users,
  Play,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Lightbulb,
  AlertCircle,
  User,
  Crown,
  Loader2,
  Hourglass,
  HelpCircle,
  Flame,
} from 'lucide-react'
import { RelatorioIndividual } from '@/components/RelatorioIndividual'

export default function CompeticaoPlayer() {
  const { codigo } = useParams<{ codigo: string }>()
  const { toast } = useToast()

  const [competicao, setCompeticao] = useState<CompeticaoRecord | null>(null)
  const [quiz, setQuiz] = useState<QuizRecord | null>(null)
  const [perguntas, setPerguntas] = useState<PerguntaRecord[]>([])
  const [grupos, setGrupos] = useState<GrupoRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Identificação do Convidado
  const [apelido, setApelido] = useState(() => {
    return localStorage.getItem('competicao_jogador_apelido') || ''
  })
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('')
  const [minhaParticipacao, setMinhaParticipacao] = useState<ParticipacaoRecord | null>(null)

  // Estados do Jogo: 'join' | 'waiting' | 'playing' | 'result'
  const [gameState, setGameState] = useState<'join' | 'waiting' | 'playing' | 'result'>('join')
  const [joining, setJoining] = useState(false)

  // Perguntas e Respostas
  const [currentIndex, setCurrentIndex] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [confirmedQuestions, setConfirmedQuestions] = useState<Record<string, boolean>>({})
  const [finalScore, setFinalScore] = useState(0)
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Placar dos grupos em tempo real
  const [rankingGrupos, setRankingGrupos] = useState<RankingGrupo[]>([])

  // Polling para acompanhar status da competição e ranking ao vivo
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Carregar dados da competição a partir do código
  const carregarCompeticao = useCallback(async () => {
    if (!codigo) {
      setErrorMessage('Código de competição não fornecido.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const comp = await competicaoService.getCompeticaoPorCodigo(codigo)
      if (!comp) {
        setErrorMessage(`Competição com código "${codigo}" não foi encontrada ou não está ativa.`)
        setLoading(false)
        return
      }

      setCompeticao(comp)

      const [qz, grps, pergs, parts] = await Promise.all([
        quizService.getQuiz(comp.quiz),
        competicaoService.getGrupos(comp.id),
        quizService.getPerguntas(comp.quiz),
        competicaoService.getParticipacoes(comp.id),
      ])

      setQuiz(qz)
      setGrupos(grps)
      setPerguntas(pergs)
      setRankingGrupos(competicaoService.calcularRankingGrupos(grps, parts))

      if (grps.length > 0 && !selectedGrupoId) {
        setSelectedGrupoId(grps[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar competição pelo código:', err)
      setErrorMessage('Erro ao conectar à competição. Verifique o código e tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [codigo, selectedGrupoId])

  useEffect(() => {
    carregarCompeticao()
  }, [carregarCompeticao])

  // Polling para acompanhar se o Host iniciou o jogo ou se encerrou
  useEffect(() => {
    if (!competicao) return

    const poll = async () => {
      try {
        const [compAtual, partsAtual, grpsAtual] = await Promise.all([
          competicaoService.getCompeticao(competicao.id),
          competicaoService.getParticipacoes(competicao.id),
          competicaoService.getGrupos(competicao.id),
        ])

        setCompeticao(compAtual)
        setRankingGrupos(competicaoService.calcularRankingGrupos(grpsAtual, partsAtual))

        // Se o jogador estiver na sala de espera ('waiting') e o host iniciar a competição ('em_andamento')
        if (gameState === 'waiting' && compAtual.status === 'em_andamento') {
          setGameState('playing')
          setCurrentIndex(0)
          setSecondsElapsed(0)
          toast({
            title: '🚀 A competição começou!',
            description: 'Boa sorte! Responda com atenção e rapidez.',
          })
        }
      } catch {
        /* ignore */
      }
    }

    pollingRef.current = setInterval(poll, 2000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [competicao?.id, gameState, toast])

  // Cronômetro do jogador
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

  // Ação: Convidado se cadastra e entra na sala de espera
  const handleEntrar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!competicao || !selectedGrupoId) return
    const cleanApelido = apelido.trim()
    if (!cleanApelido) {
      toast({
        title: 'Informe seu apelido',
        description: 'Digite como você quer ser chamado na competição.',
        variant: 'destructive',
      })
      return
    }

    setJoining(true)
    try {
      localStorage.setItem('competicao_jogador_apelido', cleanApelido)
      const part = await competicaoService.entrarNaCompeticao({
        competicaoId: competicao.id,
        grupoId: selectedGrupoId,
        apelido: cleanApelido,
      })

      setMinhaParticipacao(part)

      // Se a competição já estiver em andamento, vai direto para o jogo; se não, sala de espera
      if (competicao.status === 'em_andamento') {
        setGameState('playing')
        setCurrentIndex(0)
      } else {
        setGameState('waiting')
      }

      toast({
        title: 'Você entrou na competição!',
        description: `Equipe selecionada: ${
          grupos.find((g) => g.id === selectedGrupoId)?.nome || ''
        }`,
      })
    } catch (err) {
      console.error('Erro ao entrar na competição:', err)
      toast({
        title: 'Não foi possível entrar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setJoining(false)
    }
  }

  // Interação durante as perguntas
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

  const hasAnswered = !!currentAnswer && currentAnswer.trim().length > 0

  // Confirmar Resposta e Enviar Pontuação Parcial para o Placar ao Vivo do Host
  const handleConfirmAnswer = async () => {
    if (!currentQuestion || !hasAnswered) return

    setConfirmedQuestions((prev) => ({
      ...prev,
      [currentQuestion.id]: true,
    }))

    // Calcular pontuação incremental e enviar para a coleção participacoes
    if (minhaParticipacao) {
      const objQuestions = perguntas.filter((p) => p.tipo === 'multipla_escolha')
      const totalObj = objQuestions.length || 1

      // Conta quantos acertos até agora
      let acertosAteAgora = 0
      for (const p of perguntas) {
        const resp = p.id === currentQuestion.id ? currentAnswer : respostas[p.id]
        if (p.tipo === 'multipla_escolha' && resp === p.resposta_correta) {
          acertosAteAgora++
        }
      }

      const pontosAtuais = Math.round((acertosAteAgora / totalObj) * 100)

      try {
        await competicaoService.atualizarProgressoParticipante(minhaParticipacao.id, {
          pontuacao: pontosAtuais,
          acertos: acertosAteAgora,
          total_perguntas: Object.keys(confirmedQuestions).length + 1,
          tempo_segundos: secondsElapsed,
        })
      } catch {
        /* ignore */
      }
    }
  }

  // Próxima Pergunta ou Concluir
  const handleNext = async () => {
    if (isLastQuestion) {
      await finishGame()
    } else {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const finishGame = async () => {
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

    if (minhaParticipacao) {
      try {
        await competicaoService.atualizarProgressoParticipante(minhaParticipacao.id, {
          pontuacao: calculatedScore,
          acertos: correctCount,
          total_perguntas: perguntas.length,
          tempo_segundos: secondsElapsed,
          finalizada: true,
          respostas_detalhe: formattedRespostas,
        })
      } catch {
        /* ignore */
      }
    }

    setGameState('result')
  }

  const meuGrupo = grupos.find((g) => g.id === selectedGrupoId)

  // TELA DE CARREGAMENTO
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F111A] text-white flex flex-col items-center justify-center p-4 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-[#00C4A7]" />
        <p className="text-sm text-slate-300">Conectando à sala de competição...</p>
      </div>
    )
  }

  // TELA DE ERRO (CÓDIGO INVÁLIDO)
  if (errorMessage || !competicao || !quiz) {
    return (
      <div className="min-h-screen bg-[#0F111A] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/15 p-8 rounded-3xl shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Sala não encontrada</h2>
          <p className="text-sm text-slate-300">{errorMessage}</p>
          <div className="pt-2">
            <Link to="/login">
              <Button variant="outline" className="rounded-xl border-white/20 text-white text-xs">
                Ir para o Quiz - Zara 2026
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // =========================================================
  // FASE A: ENTRADA (PEDE APELIDO E ESCOLHA DO GRUPO)
  // =========================================================
  if (gameState === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F111A] via-[#1E163B] to-[#0A2624] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        <div className="w-full max-w-lg bg-white/10 backdrop-blur-xl border border-white/15 p-6 sm:p-8 rounded-3xl shadow-2xl relative z-10 animate-fade-in space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <span className="text-[11px] uppercase font-black tracking-wider text-[#00C4A7] bg-[#00C4A7]/15 px-3 py-1 rounded-full border border-[#00C4A7]/30 inline-block">
              Modo Competição • Ao Vivo
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {quiz.nome_quiz}
            </h1>
            <p className="text-xs text-slate-300">
              Código da Sala:{' '}
              <strong className="text-amber-300 font-mono">{competicao.codigo}</strong>
            </p>
          </div>

          {/* Formulário de Entrada */}
          <form onSubmit={handleEntrar} className="space-y-5">
            {/* Apelido */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#00C4A7]" />
                Seu Apelido de Jogador
              </label>
              <Input
                type="text"
                placeholder="Ex: Ana Zara, Pedro, Léo..."
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                className="h-12 rounded-2xl bg-white/10 border-white/20 text-white placeholder:text-slate-400 text-sm focus-visible:ring-[#00C4A7]"
                maxLength={40}
                required
              />
            </div>

            {/* Escolha do Grupo */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#6C4DF6]" />
                Escolha sua Equipe / Grupo
              </label>

              {grupos.length === 0 ? (
                <p className="text-xs text-amber-300">
                  Nenhum grupo foi configurado pelo host ainda.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {grupos.map((grp) => {
                    const isSelected = selectedGrupoId === grp.id
                    return (
                      <div
                        key={grp.id}
                        onClick={() => setSelectedGrupoId(grp.id)}
                        className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-white/20 border-white shadow-lg shadow-white/10 scale-[1.01]'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: grp.cor || '#6C4DF6' }}
                          />
                          <span className="font-bold text-sm text-white">{grp.nome}</span>
                        </div>

                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-[#00C4A7] text-white flex items-center justify-center text-xs">
                            <CheckCircle2 className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={joining || !apelido.trim() || !selectedGrupoId}
              className="w-full h-12 rounded-2xl font-black text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-xl shadow-[#6C4DF6]/30 text-base"
            >
              {joining ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Play className="w-5 h-5 mr-2 fill-current" />
              )}
              Entrar na Competição
            </Button>
          </form>
        </div>
      </div>
    )
  }

  // =========================================================
  // FASE B: SALA DE ESPERA (AGUARDANDO O HOST INICIAR)
  // =========================================================
  if (gameState === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F111A] via-[#1E163B] to-[#0A2624] text-white flex flex-col items-center justify-center p-4 sm:p-6 text-center">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/15 p-8 sm:p-10 rounded-3xl shadow-2xl space-y-6 animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center mx-auto shadow-xl shadow-[#6C4DF6]/30 animate-pulse">
            <Hourglass className="w-10 h-10 text-white" />
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase font-extrabold tracking-widest text-[#00C4A7] bg-[#00C4A7]/15 px-3.5 py-1 rounded-full border border-[#00C4A7]/30 inline-block">
              Você está dentro!
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Aguardando o Host iniciar...
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Fique de olho na tela principal / projetor. O quiz começará automaticamente para todos
              ao mesmo tempo!
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-left">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Seu apelido:</span>
              <strong className="text-white">{apelido}</strong>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Sua equipe:</span>
              <Badge
                className="text-white font-bold text-xs"
                style={{ backgroundColor: meuGrupo?.cor || '#6C4DF6' }}
              >
                {meuGrupo?.nome}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Total de perguntas:</span>
              <strong className="text-white">{perguntas.length}</strong>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Conectado em tempo real com a sala
          </div>
        </div>
      </div>
    )
  }

  // =========================================================
  // FASE C: JOGANDO AS PERGUNTAS COM FEEDBACK IMEDIATO
  // =========================================================
  if (gameState === 'playing' && currentQuestion) {
    const progressPercent = Math.round(((currentIndex + 1) / perguntas.length) * 100)

    return (
      <div className="min-h-screen bg-[#0F111A] text-white flex flex-col justify-between p-4 sm:p-6 animate-fade-in">
        {/* Barra superior */}
        <header className="max-w-2xl w-full mx-auto space-y-3 shrink-0">
          <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: meuGrupo?.cor || '#6C4DF6' }}
              />
              <span className="font-bold text-white">{meuGrupo?.nome}</span>
              <span>•</span>
              <span className="text-slate-400">{apelido}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[#00C4A7] font-bold">
                {currentIndex + 1}/{perguntas.length}
              </span>
            </div>
          </div>

          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#6C4DF6] to-[#00C4A7] h-full rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </header>

        {/* Pergunta e Alternativas */}
        <div className="max-w-2xl w-full mx-auto my-6 flex-1 flex flex-col justify-center space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C4A7] bg-[#00C4A7]/15 px-2.5 py-0.5 rounded-full border border-[#00C4A7]/30 inline-block">
              {isObj ? 'Múltipla Escolha' : 'Dissertativa'}
            </span>
            <h2 className="text-lg sm:text-2xl font-black text-white leading-snug">
              {currentQuestion.enunciado}
            </h2>
          </div>

          {/* Alternativas */}
          {isObj && currentQuestion.opcoes && (
            <div className="grid grid-cols-1 gap-3">
              {currentQuestion.opcoes.map((opcao) => {
                const isSelected = currentAnswer === opcao.label
                const isTheCorrectOption = currentQuestion.resposta_correta === opcao.label

                let cardStyle = ''
                let badgeStyle = ''

                if (isCurrentConfirmed) {
                  if (isTheCorrectOption) {
                    cardStyle =
                      'bg-emerald-500/25 border-emerald-400 text-white shadow-lg shadow-emerald-500/20 scale-[1.01]'
                    badgeStyle = 'bg-emerald-500 text-white'
                  } else if (isSelected && !isTheCorrectOption) {
                    cardStyle =
                      'bg-rose-500/25 border-rose-400 text-white shadow-lg shadow-rose-500/20'
                    badgeStyle = 'bg-rose-500 text-white'
                  } else {
                    cardStyle = 'bg-white/5 border-white/5 text-slate-500 opacity-50'
                    badgeStyle = 'bg-white/10 text-slate-500'
                  }
                } else {
                  if (isSelected) {
                    cardStyle =
                      'bg-[#6C4DF6]/25 border-[#6C4DF6] text-white shadow-lg shadow-[#6C4DF6]/20 scale-[1.01]'
                    badgeStyle = 'bg-[#6C4DF6] text-white'
                  } else {
                    cardStyle =
                      'bg-white/5 border-white/10 text-slate-200 hover:border-white/30 hover:bg-white/[0.08]'
                    badgeStyle = 'bg-white/10 text-slate-400'
                  }
                }

                return (
                  <div
                    key={opcao.label}
                    onClick={() => handleSelectOption(opcao.label)}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3.5 ${
                      isCurrentConfirmed ? 'cursor-default' : 'cursor-pointer'
                    } ${cardStyle}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${badgeStyle}`}
                    >
                      {opcao.label}
                    </div>
                    <p className="text-sm font-medium flex-1">{opcao.texto}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pergunta Aberta */}
          {!isObj && (
            <div className="space-y-2">
              <Input
                placeholder="Digite sua resposta..."
                value={currentAnswer}
                disabled={isCurrentConfirmed}
                onChange={(e) =>
                  setRespostas((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))
                }
                className="h-14 rounded-2xl bg-white/5 border-white/15 text-white placeholder:text-slate-400 text-base"
              />
            </div>
          )}

          {/* Feedback Imediato */}
          {isCurrentConfirmed && (
            <div
              className={`p-4 rounded-2xl border-2 animate-fade-in ${
                !isObj
                  ? 'bg-purple-500/20 border-purple-400 text-purple-100'
                  : isCorrect
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                    : 'bg-rose-500/20 border-rose-400 text-rose-100'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {!isObj ? (
                  <CheckCircle2 className="w-5 h-5 text-purple-400" />
                ) : isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400" />
                )}
                <span>
                  {!isObj
                    ? 'Resposta enviada para a equipe!'
                    : isCorrect
                      ? '🎉 Acertou! Pontos somados para seu grupo!'
                      : `❌ Incorreto! A certa era a Opção ${currentQuestion.resposta_correta}.`}
                </span>
              </div>
              {currentQuestion.explicacao && (
                <p className="text-xs text-slate-300 italic mt-2 border-t border-white/10 pt-2">
                  💡 {currentQuestion.explicacao}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Rodapé de navegação */}
        <footer className="max-w-2xl w-full mx-auto flex items-center justify-end gap-3 pt-2 shrink-0">
          {!isCurrentConfirmed ? (
            <Button
              onClick={handleConfirmAnswer}
              disabled={!hasAnswered}
              className="h-12 px-8 rounded-2xl font-bold text-white bg-gradient-to-r from-[#6C4DF6] to-[#00C4A7] hover:opacity-95 shadow-lg shadow-[#6C4DF6]/25 disabled:opacity-40"
            >
              Confirmar Resposta
              <CheckCircle2 className="w-5 h-5 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="h-12 px-8 rounded-2xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 shadow-lg"
            >
              {isLastQuestion ? 'Concluir Desafio' : 'Próxima'}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </footer>
      </div>
    )
  }

  // =========================================================
  // FASE D: RESULTADO FINAL (INDIVIDUAL + PLACAR DOS GRUPOS)
  // =========================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F111A] via-[#1E163B] to-[#0A2624] text-white flex flex-col items-center justify-start py-8 px-4 sm:px-6">
      <div className="w-full max-w-2xl space-y-6 animate-fade-in">
        {/* Card de Pontuação Individual */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/15 p-6 sm:p-8 rounded-3xl shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center mx-auto shadow-xl">
            <Trophy className="w-8 h-8 text-white" />
          </div>

          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider text-[#00C4A7] bg-[#00C4A7]/15 px-3 py-1 rounded-full border border-[#00C4A7]/30">
              Desafio Concluído!
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-2">
              Mandou bem, {apelido}!
            </h1>
            <p className="text-xs text-slate-300">
              Você representou a equipe <strong className="text-white">{meuGrupo?.nome}</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 max-w-xs mx-auto">
            <span className="text-4xl font-black text-emerald-300 font-mono">{finalScore}%</span>
            <p className="text-xs text-slate-300 mt-1">Sua Pontuação Individual</p>
          </div>
        </div>

        {/* PLACAR GERAL DOS GRUPOS AO VIVO */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/15 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-black text-white">Placar Geral dos Grupos</h3>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
              Ao Vivo
            </Badge>
          </div>

          <div className="space-y-3">
            {rankingGrupos.map((item, index) => {
              const grp = item.grupo
              const isMyGroup = grp.id === selectedGrupoId

              return (
                <div
                  key={grp.id}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                    isMyGroup
                      ? 'bg-white/15 border-[#00C4A7] shadow-lg shadow-[#00C4A7]/10'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                        index === 0
                          ? 'bg-amber-400 text-slate-950'
                          : index === 1
                            ? 'bg-slate-300 text-slate-950'
                            : index === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {index + 1}º
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-sm sm:text-base">
                          {grp.nome}
                        </span>
                        {isMyGroup && (
                          <Badge className="bg-[#00C4A7] text-slate-950 font-bold text-[10px] px-2 py-0">
                            Sua Equipe
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {item.totalParticipantes} membros • Média: {item.mediaAcertosPercentual}%
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xl sm:text-2xl font-black font-mono text-white">
                      {item.pontosTotais.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      pts
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
