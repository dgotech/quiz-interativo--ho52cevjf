import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { competicaoService, CORES_GRUPOS_PADRAO } from '@/services/competicaoService'
import { quizService } from '@/services/quizService'
import type {
  CompeticaoRecord,
  GrupoRecord,
  ParticipacaoRecord,
  RankingGrupo,
  QuizRecord,
  PerguntaRecord,
} from '@/types/quiz'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  Trophy,
  Users,
  Play,
  RotateCcw,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Flame,
  Award,
  Crown,
  Medal,
  CheckCircle2,
  StopCircle,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Maximize2,
  Volume2,
  Tv,
} from 'lucide-react'

export default function CompeticaoHost() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [competicao, setCompeticao] = useState<CompeticaoRecord | null>(null)
  const [quiz, setQuiz] = useState<QuizRecord | null>(null)
  const [perguntas, setPerguntas] = useState<PerguntaRecord[]>([])
  const [grupos, setGrupos] = useState<GrupoRecord[]>([])
  const [participacoes, setParticipacoes] = useState<ParticipacaoRecord[]>([])
  const [ranking, setRanking] = useState<RankingGrupo[]>([])

  const [loading, setLoading] = useState(true)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Criar novo grupo modal/input
  const [novoGrupoNome, setNovoGrupoNome] = useState('')
  const [adicionandoGrupo, setAdicionandoGrupo] = useState(false)

  // Polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Carregar dados iniciais
  const carregarDados = useCallback(async () => {
    if (!id) return
    try {
      const comp = await competicaoService.getCompeticao(id)
      setCompeticao(comp)

      const [qz, grps, parts] = await Promise.all([
        quizService.getQuiz(comp.quiz),
        competicaoService.getGrupos(comp.id),
        competicaoService.getParticipacoes(comp.id),
      ])

      setQuiz(qz)
      setGrupos(grps)
      setParticipacoes(parts)
      setRanking(competicaoService.calcularRankingGrupos(grps, parts))

      const pergs = await quizService.getPerguntas(qz.id)
      setPerguntas(pergs)
    } catch (err) {
      console.error('Erro ao carregar competição host:', err)
      toast({
        title: 'Competição não encontrada',
        description: 'Verifique se o link ou identificador da competição está correto.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [id, toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Polling em tempo real (a cada 2.5s) para atualizar participantes e placar ao vivo
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
        setGrupos(grpsAtual)
        setParticipacoes(partsAtual)
        setRanking(competicaoService.calcularRankingGrupos(grpsAtual, partsAtual))
      } catch (err) {
        // silencioso para não poluir
      }
    }

    pollingRef.current = setInterval(poll, 2500)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [competicao?.id])

  // Copiar link do jogador
  const playerUrl = competicao ? `${window.location.origin}/competir/${competicao.codigo}` : ''

  const handleCopyLink = async () => {
    if (!playerUrl) return
    try {
      await navigator.clipboard.writeText(playerUrl)
      setCopiedLink(true)
      toast({
        title: 'Link copiado!',
        description: 'Envie para os participantes entrarem direto no celular.',
      })
      setTimeout(() => setCopiedLink(false), 2500)
    } catch {
      /* ignore */
    }
  }

  const handleCopyCode = async () => {
    if (!competicao) return
    try {
      await navigator.clipboard.writeText(competicao.codigo)
      setCopiedCode(true)
      toast({
        title: 'Código copiado!',
        description: `Código ${competicao.codigo} copiado para a área de transferência.`,
      })
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      /* ignore */
    }
  }

  // Ações do Host: Iniciar Competição
  const handleIniciar = async () => {
    if (!competicao) return
    setActionLoading(true)
    try {
      const updated = await competicaoService.atualizarStatus(competicao.id, 'em_andamento')
      setCompeticao(updated)
      toast({
        title: '🔥 Competição Iniciada!',
        description: 'Os participantes agora podem responder as perguntas pelo celular.',
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao iniciar',
        description: 'Não foi possível iniciar a competição no momento.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Ações do Host: Encerrar e Mostrar Pódio
  const handleEncerrar = async () => {
    if (!competicao) return
    setActionLoading(true)
    try {
      const updated = await competicaoService.atualizarStatus(competicao.id, 'encerrada')
      setCompeticao(updated)
      toast({
        title: '🏆 Competição Encerrada!',
        description: 'O pódio final dos grupos está pronto!',
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao encerrar',
        description: 'Não foi possível encerrar a competição.',
        variant: 'destructive',
      })
    } finally {
      setActionLoading(false)
    }
  }

  // Ações do Host: Reiniciar para Nova Rodada
  const handleReiniciar = async () => {
    if (!competicao) return
    if (
      !confirm(
        'Deseja reabrir a competição para uma nova rodada? O status voltará para aguardando participantes.',
      )
    )
      return
    setActionLoading(true)
    try {
      const updated = await competicaoService.reiniciarCompeticao(competicao.id)
      setCompeticao(updated)
      toast({
        title: 'Competição reaberta!',
        description: 'O status voltou para Aguardando Início.',
      })
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  // Adicionar Grupo na tela de espera
  const handleAdicionarGrupo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!competicao || !novoGrupoNome.trim()) return
    setAdicionandoGrupo(true)
    try {
      await competicaoService.criarGrupo(competicao.id, novoGrupoNome)
      setNovoGrupoNome('')
      const updatedGrps = await competicaoService.getGrupos(competicao.id)
      setGrupos(updatedGrps)
      setRanking(competicaoService.calcularRankingGrupos(updatedGrps, participacoes))
      toast({
        title: 'Grupo adicionado!',
        description: `Novo grupo "${novoGrupoNome.trim()}" criado com sucesso.`,
      })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro ao criar grupo',
        variant: 'destructive',
      })
    } finally {
      setAdicionandoGrupo(false)
    }
  }

  // Remover Grupo
  const handleRemoverGrupo = async (grupoId: string) => {
    if (!confirm('Excluir este grupo? As participações dele serão removidas.')) return
    try {
      await competicaoService.excluirGrupo(grupoId)
      if (competicao) {
        const [grps, parts] = await Promise.all([
          competicaoService.getGrupos(competicao.id),
          competicaoService.getParticipacoes(competicao.id),
        ])
        setGrupos(grps)
        setParticipacoes(parts)
        setRanking(competicaoService.calcularRankingGrupos(grps, parts))
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Modo tela cheia
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F111A] text-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-[#6C4DF6]" />
        <p className="text-sm text-slate-400">Carregando painel do host...</p>
      </div>
    )
  }

  if (!competicao || !quiz) {
    return (
      <div className="min-h-screen bg-[#0F111A] text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold mb-2">Competição não encontrada</h2>
        <Link to="/quizzes">
          <Button variant="outline" className="rounded-xl border-white/20 text-white">
            Voltar para Meus Quizzes
          </Button>
        </Link>
      </div>
    )
  }

  const status = competicao.status
  const totalJogadores = participacoes.length
  const totalJogadoresFinalizados = participacoes.filter((p) => p.finalizada).length

  return (
    <div className="min-h-screen bg-[#0B0D17] text-white flex flex-col justify-between selection:bg-[#6C4DF6] selection:text-white">
      {/* BARRA SUPERIOR DO HOST / PROJETOR */}
      <header className="border-b border-white/10 bg-[#121626]/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link
            to={`/quiz/${quiz.id}`}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors py-1 px-2.5 rounded-lg hover:bg-white/5"
            title="Voltar ao Quiz"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar ao Quiz</span>
          </Link>

          <div className="h-4 w-px bg-white/20 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-extrabold tracking-wider bg-gradient-to-r from-[#6C4DF6] to-[#00C4A7] text-white px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Tv className="w-3 h-3" /> Modo Competição
            </span>
            <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md">
              {quiz.nome_quiz}
            </h1>
          </div>
        </div>

        {/* Status + Ações do topo */}
        <div className="flex items-center gap-2 sm:gap-3">
          {status === 'aguardando' && (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-semibold px-3 py-1 rounded-full animate-pulse">
              ⏳ Aguardando Jogadores ({totalJogadores})
            </Badge>
          )}
          {status === 'em_andamento' && (
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Ao Vivo ({totalJogadoresFinalizados}/{totalJogadores} terminaram)
            </Badge>
          )}
          {status === 'encerrada' && (
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" /> Pódio Final Definido
            </Badge>
          )}

          <Button
            onClick={handleToggleFullscreen}
            variant="ghost"
            size="sm"
            className="rounded-xl text-slate-300 hover:text-white hover:bg-white/10 h-8 px-2.5 text-xs"
            title="Alternar Tela Cheia (Projetor)"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL DO PROJETOR */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-start">
        {/* ========================================================= */}
        {/* FASE 1: AGUARDANDO JOGADORES (LOBBY / SALA DE ESPERA)    */}
        {/* ========================================================= */}
        {status === 'aguardando' && (
          <div className="space-y-8 animate-fade-in my-auto py-4">
            {/* Bloco de Entrada Gigante para o Projetor */}
            <div className="text-center space-y-4">
              <span className="text-xs sm:text-sm uppercase font-extrabold tracking-widest text-[#00C4A7] bg-[#00C4A7]/15 px-4 py-1.5 rounded-full border border-[#00C4A7]/30 inline-block">
                Entre pelo seu celular ou computador
              </span>

              <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight">
                Acesse{' '}
                <span className="text-[#00C4A7] underline underline-offset-8">/competir</span>
              </h2>

              <p className="text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto">
                Ou use o link direto digitando o código da sala abaixo:
              </p>

              {/* CÓDIGO GIGANTE */}
              <div className="inline-flex flex-col sm:flex-row items-center gap-3 bg-white/10 backdrop-blur-xl border-2 border-white/20 p-4 sm:p-6 rounded-3xl shadow-2xl">
                <div className="text-center">
                  <span className="text-xs uppercase font-extrabold text-slate-400 block tracking-wider">
                    Código de Entrada
                  </span>
                  <span className="text-4xl sm:text-6xl md:text-7xl font-black font-mono tracking-widest text-amber-300 select-all">
                    {competicao.codigo}
                  </span>
                </div>

                <div className="flex sm:flex-col gap-2">
                  <Button
                    onClick={handleCopyCode}
                    variant="outline"
                    className="rounded-2xl border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs h-10 px-4"
                  >
                    {copiedCode ? (
                      <Check className="w-4 h-4 mr-1 text-emerald-300" />
                    ) : (
                      <Copy className="w-4 h-4 mr-1" />
                    )}
                    {copiedCode ? 'Copiado!' : 'Copiar Código'}
                  </Button>
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    className="rounded-2xl border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs h-10 px-4"
                  >
                    {copiedLink ? (
                      <Check className="w-4 h-4 mr-1 text-emerald-300" />
                    ) : (
                      <ExternalLink className="w-4 h-4 mr-1" />
                    )}
                    {copiedLink ? 'Link Copiado!' : 'Copiar Link'}
                  </Button>
                </div>
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Link direto: <span className="text-white select-all">{playerUrl}</span>
              </div>
            </div>

            {/* GRUPOS CONFIGURADOS E PARTICIPANTES ENTRANDO */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#6C4DF6]" />
                  <h3 className="text-lg sm:text-xl font-extrabold text-white">
                    Equipes / Grupos na Competição ({grupos.length})
                  </h3>
                  <Badge className="bg-white/10 text-slate-200 border-white/20 text-xs">
                    {totalJogadores} {totalJogadores === 1 ? 'jogador' : 'jogadores conectados'}
                  </Badge>
                </div>

                {/* Adicionar novo grupo */}
                <form onSubmit={handleAdicionarGrupo} className="flex items-center gap-2">
                  <Input
                    placeholder="Nome de novo grupo..."
                    value={novoGrupoNome}
                    onChange={(e) => setNovoGrupoNome(e.target.value)}
                    className="h-9 text-xs rounded-xl bg-white/10 border-white/20 text-white placeholder:text-slate-400 w-44 sm:w-56"
                    maxLength={40}
                  />
                  <Button
                    type="submit"
                    disabled={adicionandoGrupo || !novoGrupoNome.trim()}
                    size="sm"
                    className="h-9 px-3 rounded-xl bg-[#6C4DF6] hover:bg-[#5939e6] text-white font-bold text-xs"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Grupo
                  </Button>
                </form>
              </div>

              {/* Grid dos Grupos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ranking.map((item, index) => {
                  const grp = item.grupo
                  return (
                    <div
                      key={grp.id}
                      className="bg-white/5 border-2 rounded-3xl p-5 backdrop-blur-sm transition-all hover:scale-[1.01]"
                      style={{ borderColor: grp.cor || '#6C4DF6' }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full shadow-sm shrink-0"
                            style={{ backgroundColor: grp.cor || '#6C4DF6' }}
                          />
                          <h4 className="font-extrabold text-base text-white tracking-tight">
                            {grp.nome}
                          </h4>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Badge
                            className="text-white text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${grp.cor || '#6C4DF6'}40` }}
                          >
                            {item.totalParticipantes}{' '}
                            {item.totalParticipantes === 1 ? 'membro' : 'membros'}
                          </Badge>
                          {grupos.length > 2 && item.totalParticipantes === 0 && (
                            <button
                              type="button"
                              onClick={() => handleRemoverGrupo(grp.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Remover grupo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Lista de apelidos que já entraram neste grupo */}
                      <div className="min-h-[80px] p-3 rounded-2xl bg-black/30 border border-white/5">
                        {item.participantes.length === 0 ? (
                          <p className="text-xs text-slate-500 italic text-center py-4">
                            Aguardando membros escolherem esta equipe...
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {item.participantes.map((p) => (
                              <span
                                key={p.id}
                                className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-white/10 text-white border border-white/10 flex items-center gap-1 animate-fade-in"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                {p.apelido}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* BOTÃO DE INICIAR A COMPETIÇÃO */}
            <div className="text-center pt-4">
              <Button
                onClick={handleIniciar}
                disabled={actionLoading || totalJogadores === 0}
                size="lg"
                className="h-16 px-12 rounded-3xl font-black text-lg sm:text-xl text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-2xl shadow-[#6C4DF6]/40 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:transform-none"
              >
                {actionLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                ) : (
                  <Play className="w-6 h-6 mr-3 fill-current" />
                )}
                Iniciar Competição Agora!
              </Button>
              {totalJogadores === 0 && (
                <p className="text-xs text-amber-300 mt-2">
                  ⚠️ Aguarde pelo menos 1 jogador entrar com o código para poder iniciar.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FASE 2: COMPETIÇÃO EM ANDAMENTO (PLACAR AO VIVO)         */}
        {/* ========================================================= */}
        {status === 'em_andamento' && (
          <div className="space-y-6 animate-fade-in py-2">
            {/* Banner de cabeçalho do jogo */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/10 backdrop-blur-xl border border-white/15 p-5 rounded-3xl">
              <div className="flex items-center gap-3 text-center sm:text-left">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center shrink-0 shadow-lg">
                  <Flame className="w-7 h-7 text-amber-300 animate-bounce" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    Placar Ao Vivo Entre Grupos
                  </h2>
                  <p className="text-xs text-slate-300">
                    O ranking atualiza em tempo real a cada resposta correta confirmada pelos
                    jogadores!
                  </p>
                </div>
              </div>

              {/* Botão de Encerrar */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleEncerrar}
                  disabled={actionLoading}
                  className="rounded-2xl h-12 px-6 font-bold text-sm bg-gradient-to-r from-rose-500 to-amber-500 text-white hover:opacity-90 shadow-xl shadow-rose-500/20"
                >
                  <StopCircle className="w-4 h-4 mr-2" />
                  Encerrar e Ver Pódio Final
                </Button>
              </div>
            </div>

            {/* BARRAS DE PROGRESSO / RANKING AO VIVO ESTILO MENTIMETER */}
            <div className="space-y-4">
              {ranking.map((item, index) => {
                const grp = item.grupo
                const isLeader = index === 0 && item.pontosTotais > 0
                const maxPontos = Math.max(...ranking.map((r) => r.pontosTotais), 100)
                const percentualBarra = Math.min(
                  Math.round((item.pontosTotais / maxPontos) * 100),
                  100,
                )

                return (
                  <div
                    key={grp.id}
                    className={`bg-white/10 backdrop-blur-md rounded-3xl p-5 border-2 transition-all duration-500 relative overflow-hidden ${
                      isLeader
                        ? 'border-amber-400 shadow-xl shadow-amber-400/20'
                        : 'border-white/10'
                    }`}
                  >
                    {/* Barra de progresso de fundo animada */}
                    <div
                      className="absolute inset-y-0 left-0 opacity-20 transition-all duration-700 ease-out rounded-3xl"
                      style={{
                        width: `${Math.max(percentualBarra, 4)}%`,
                        backgroundColor: grp.cor || '#6C4DF6',
                      }}
                    />

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Posição + Nome do Grupo */}
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-md ${
                            index === 0
                              ? 'bg-amber-400 text-slate-900 ring-4 ring-amber-300/40'
                              : index === 1
                                ? 'bg-slate-300 text-slate-900 ring-2 ring-slate-200/40'
                                : index === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          {index === 0 ? (
                            <Crown className="w-6 h-6 text-slate-900" />
                          ) : (
                            `${index + 1}º`
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-black text-white">
                              {grp.nome}
                            </h3>
                            {isLeader && (
                              <Badge className="bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                Liderando 🔥
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-300 mt-1 flex-wrap">
                            <span>👥 {item.totalParticipantes} participantes</span>
                            <span>•</span>
                            <span>🎯 {item.totalAcertos} acertos no total</span>
                            {item.melhorJogador && (
                              <>
                                <span>•</span>
                                <span className="text-[#00C4A7] font-semibold">
                                  ⭐ Destaque: {item.melhorJogador.apelido} (
                                  {item.melhorJogador.pontuacao} pts)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Pontos Totais do Grupo */}
                      <div className="text-right shrink-0">
                        <span className="text-3xl sm:text-5xl font-black text-white font-mono tracking-tight">
                          {item.pontosTotais.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-xs uppercase font-extrabold text-slate-400 block tracking-wider">
                          Pontos do Grupo
                        </span>
                      </div>
                    </div>

                    {/* Membros e seus status individuais pequenos */}
                    {item.participantes.length > 0 && (
                      <div className="relative z-10 mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-2 items-center text-xs text-slate-300">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">
                          Membros:
                        </span>
                        {item.participantes.map((p) => (
                          <span
                            key={p.id}
                            className={`px-2 py-0.5 rounded-lg text-xs font-medium border flex items-center gap-1 ${
                              p.finalizada
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-white/5 text-slate-300 border-white/10'
                            }`}
                          >
                            <span>{p.apelido}</span>
                            <span className="font-mono font-bold text-white">
                              ({p.pontuacao || 0} pts)
                            </span>
                            {p.finalizada && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* FASE 3: COMPETIÇÃO ENCERRADA (O PÓDIO FINAL ESTILO MENTIMETER) */}
        {/* ========================================================= */}
        {status === 'encerrada' && (
          <div className="space-y-10 animate-fade-in py-6 my-auto">
            {/* Confetes no topo */}
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-200 text-slate-900 mx-auto flex items-center justify-center shadow-2xl shadow-yellow-500/30 animate-bounce">
                <Trophy className="w-12 h-12 text-slate-900" />
              </div>

              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-300 bg-amber-400/20 px-4 py-1 rounded-full border border-amber-400/40">
                Resultado Final Oficial
              </span>

              <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
                Pódio dos Campeões!
              </h2>

              <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto">
                Parabéns a todos os participantes pela energia e conhecimento compartilhado!
              </p>
            </div>

            {/* PÓDIO VISUAL CLÁSSICO: 2º LUGAR, 1º LUGAR (MAIOR E CENTRAL), 3º LUGAR */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-5xl mx-auto pt-6">
              {/* 2º LUGAR */}
              {ranking[1] && (
                <div className="order-2 md:order-1 bg-white/10 backdrop-blur-xl border-2 border-slate-300/40 rounded-3xl p-6 text-center space-y-3 shadow-xl transform md:translate-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-300 text-slate-900 mx-auto flex items-center justify-center font-black text-xl shadow-md">
                    2º
                  </div>
                  <h4 className="text-2xl font-black text-white">{ranking[1].grupo.nome}</h4>
                  <div className="p-3 rounded-2xl bg-black/30 border border-white/5 space-y-1">
                    <span className="text-3xl font-black text-slate-200 font-mono">
                      {ranking[1].pontosTotais.toLocaleString('pt-BR')} pts
                    </span>
                    <p className="text-xs text-slate-400">
                      {ranking[1].totalParticipantes} membros • Média de acertos:{' '}
                      {ranking[1].mediaAcertosPercentual}%
                    </p>
                  </div>
                  {ranking[1].melhorJogador && (
                    <p className="text-xs text-slate-300">
                      ⭐ Melhor do grupo:{' '}
                      <strong className="text-white">{ranking[1].melhorJogador.apelido}</strong> (
                      {ranking[1].melhorJogador.pontuacao} pts)
                    </p>
                  )}
                </div>
              )}

              {/* 1º LUGAR (CAMPEÃO - DESTAQUE MÁXIMO) */}
              {ranking[0] && (
                <div className="order-1 md:order-2 bg-gradient-to-b from-amber-400/25 via-amber-400/10 to-transparent backdrop-blur-2xl border-4 border-amber-400 rounded-3xl p-8 text-center space-y-4 shadow-2xl shadow-amber-400/30 relative transform md:-translate-y-4">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-black text-xs uppercase px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                    <Crown className="w-4 h-4 fill-current" /> Grande Campeão!
                  </div>

                  <div className="w-20 h-20 rounded-3xl bg-amber-400 text-slate-950 mx-auto flex items-center justify-center font-black text-3xl shadow-xl ring-8 ring-amber-400/30">
                    <Trophy className="w-10 h-10" />
                  </div>

                  <div>
                    <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                      {ranking[0].grupo.nome}
                    </h3>
                    <p className="text-xs uppercase font-extrabold text-amber-300 tracking-wider mt-1">
                      Medalha de Ouro 🥇
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-amber-400/30 space-y-1">
                    <span className="text-4xl sm:text-5xl font-black text-amber-300 font-mono">
                      {ranking[0].pontosTotais.toLocaleString('pt-BR')} pts
                    </span>
                    <p className="text-xs text-slate-300">
                      {ranking[0].totalParticipantes} membros • Média de acertos:{' '}
                      {ranking[0].mediaAcertosPercentual}%
                    </p>
                  </div>

                  {ranking[0].melhorJogador && (
                    <div className="p-2.5 rounded-xl bg-amber-400/15 border border-amber-400/30 text-xs text-amber-200">
                      ⭐ <strong>MVP do Grupo Campeão:</strong> {ranking[0].melhorJogador.apelido} (
                      {ranking[0].melhorJogador.pontuacao} pts)
                    </div>
                  )}
                </div>
              )}

              {/* 3º LUGAR */}
              {ranking[2] && (
                <div className="order-3 bg-white/10 backdrop-blur-xl border-2 border-amber-700/40 rounded-3xl p-6 text-center space-y-3 shadow-xl transform md:translate-y-8">
                  <div className="w-14 h-14 rounded-2xl bg-amber-700 text-white mx-auto flex items-center justify-center font-black text-xl shadow-md">
                    3º
                  </div>
                  <h4 className="text-2xl font-black text-white">{ranking[2].grupo.nome}</h4>
                  <div className="p-3 rounded-2xl bg-black/30 border border-white/5 space-y-1">
                    <span className="text-3xl font-black text-amber-500 font-mono">
                      {ranking[2].pontosTotais.toLocaleString('pt-BR')} pts
                    </span>
                    <p className="text-xs text-slate-400">
                      {ranking[2].totalParticipantes} membros • Média de acertos:{' '}
                      {ranking[2].mediaAcertosPercentual}%
                    </p>
                  </div>
                  {ranking[2].melhorJogador && (
                    <p className="text-xs text-slate-300">
                      ⭐ Melhor do grupo:{' '}
                      <strong className="text-white">{ranking[2].melhorJogador.apelido}</strong> (
                      {ranking[2].melhorJogador.pontuacao} pts)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Ações Finais: Reabrir ou voltar ao Quiz */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <Button
                onClick={handleReiniciar}
                variant="outline"
                className="rounded-2xl border-white/20 text-white hover:bg-white/10 h-12 px-6 font-bold text-sm"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reiniciar Esta Competição
              </Button>

              <Link to={`/quiz/${quiz.id}`}>
                <Button className="rounded-2xl bg-[#6C4DF6] text-white hover:bg-[#5939e6] h-12 px-8 font-bold text-sm shadow-xl shadow-[#6C4DF6]/30">
                  Voltar à Visão Geral do Quiz
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* RODAPÉ DISCRETO DO PROJETOR */}
      <footer className="border-t border-white/10 bg-[#0B0D17] px-6 py-3 text-center text-xs text-slate-400">
        Quiz - Zara 2026 • Modo Competição Ao Vivo entre Grupos estilo Mentimeter
      </footer>
    </div>
  )
}
