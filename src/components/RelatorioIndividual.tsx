import React, { useState } from 'react'
import type { PerguntaRecord, RespostaItem } from '@/types/quiz'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Lightbulb,
  Award,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  Filter,
  Check,
  AlertTriangle,
} from 'lucide-react'

export interface IndividualReportProps {
  nomeParticipante?: string
  pontuacao: number
  perguntas: PerguntaRecord[]
  respostas: RespostaItem[]
  tempoSegundos?: number
  dataTentativa?: string
  className?: string
  modoModal?: boolean
}

export function RelatorioIndividual({
  nomeParticipante,
  pontuacao,
  perguntas,
  respostas,
  tempoSegundos,
  dataTentativa,
  className = '',
  modoModal = false,
}: IndividualReportProps) {
  // Filtro de perguntas na revisão: 'todas' | 'erradas' | 'certas' | 'abertas'
  const [filtro, setFiltro] = useState<'todas' | 'erradas' | 'certas' | 'abertas'>('todas')
  // Accordion de perguntas individuais abertas para ver explicações
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const objPerguntas = perguntas.filter((p) => p.tipo === 'multipla_escolha')
  const abertasPerguntas = perguntas.filter((p) => p.tipo === 'aberta')

  // Mapear respostas por id de pergunta
  const respostasMap = React.useMemo(() => {
    const map = new Map<string, string>()
    respostas.forEach((r) => {
      map.set(r.pergunta_id, r.resposta_dada)
    })
    return map
  }, [respostas])

  // Contagem de acertos e erros
  const acertosCount = objPerguntas.filter((p) => {
    const resp = respostasMap.get(p.id)
    return resp && p.resposta_correta && resp === p.resposta_correta
  }).length

  const errosCount = objPerguntas.length - acertosCount

  // Lista das perguntas erradas
  const perguntasErradas = objPerguntas.filter((p) => {
    const resp = respostasMap.get(p.id)
    return !resp || resp !== p.resposta_correta
  })

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const expandAll = (open: boolean) => {
    const next: Record<string, boolean> = {}
    perguntas.forEach((p) => {
      next[p.id] = open
    })
    setExpandedIds(next)
  }

  // Filtragem das perguntas para a lista
  const perguntasFiltradas = perguntas.filter((p) => {
    const resp = respostasMap.get(p.id)
    const isObj = p.tipo === 'multipla_escolha'
    const acertou = isObj && !!resp && resp === p.resposta_correta

    if (filtro === 'erradas') return isObj && !acertou
    if (filtro === 'certas') return isObj && acertou
    if (filtro === 'abertas') return !isObj
    return true
  })

  const getEmotionalBadge = (score: number) => {
    if (score >= 90)
      return {
        texto: 'Desempenho Excelente 🏆',
        bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      }
    if (score >= 70)
      return {
        texto: 'Ótimo Resultado 👏',
        bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      }
    if (score >= 50)
      return {
        texto: 'Bom Esforço 👍',
        bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      }
    return {
      texto: 'Precisa Revisar 📚',
      bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    }
  }

  const badgeStatus = getEmotionalBadge(pontuacao)

  return (
    <div className={`space-y-6 text-left ${className}`}>
      {/* CABEÇALHO DO RELATÓRIO INDIVIDUAL */}
      <div
        className={`p-5 sm:p-6 rounded-3xl border ${
          modoModal
            ? 'bg-slate-900/80 border-slate-700/60 text-white'
            : 'bg-white/10 backdrop-blur-md border-white/20 text-white shadow-xl'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#00C4A7] bg-[#00C4A7]/15 px-3 py-1 rounded-full border border-[#00C4A7]/30">
                Relatório Individual do Participante
              </span>
              <span
                className={`text-xs font-bold px-3 py-0.5 rounded-full border ${badgeStatus.bg}`}
              >
                {badgeStatus.texto}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white pt-1">
              {nomeParticipante || 'Participante'}
            </h3>

            {dataTentativa && (
              <p className="text-xs text-slate-300 font-medium">Realizado em {dataTentativa}</p>
            )}
          </div>

          {/* Cards de Métricas Rápidas */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[70px]">
              <span className="text-2xl font-black text-[#00C4A7]">{pontuacao}%</span>
              <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider mt-0.5">
                Nota
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[70px]">
              <span className="text-2xl font-black text-emerald-400">
                {acertosCount}/{objPerguntas.length}
              </span>
              <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider mt-0.5">
                Acertos
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[70px]">
              <span className="text-2xl font-black text-amber-400 font-mono">
                {typeof tempoSegundos === 'number' ? formatTimer(tempoSegundos) : '—'}
              </span>
              <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider mt-0.5">
                Tempo
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Progresso de Acertos Objetivos */}
        {objPerguntas.length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-400" />
                Desempenho em Questões Objetivas
              </span>
              <span>
                {acertosCount} de {objPerguntas.length} certas ({pontuacao}%)
              </span>
            </div>
            <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${pontuacao}%` }}
                title={`${acertosCount} acertos`}
              />
              <div
                className="bg-rose-500/80 h-full transition-all duration-500"
                style={{ width: `${100 - pontuacao}%` }}
                title={`${errosCount} erros`}
              />
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO DESTACADA: EXPLICAÇÃO DAS RESPOSTAS ERRADAS (SE HOUVER) */}
      {perguntasErradas.length > 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-rose-950/40 via-rose-900/20 to-slate-900/60 border-2 border-rose-500/40 shadow-xl space-y-4">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-white flex items-center gap-2">
                  <span>Explicação das Respostas Incorretas</span>
                  <Badge className="bg-rose-500 text-white font-bold text-[10px] px-2 py-0.5">
                    {perguntasErradas.length} {perguntasErradas.length === 1 ? 'erro' : 'erros'}
                  </Badge>
                </h4>
                <p className="text-xs text-rose-200/80">
                  Veja abaixo exatamente o que você respondeu, qual era a alternativa correta e o
                  porquê pedagógico.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {perguntasErradas.map((p) => {
              const respUser = respostasMap.get(p.id) || ''
              const opcaoUser = p.opcoes?.find((o) => o.label === respUser)
              const opcaoCorreta = p.opcoes?.find((o) => o.label === p.resposta_correta)
              const originalIndex = perguntas.findIndex((item) => item.id === p.id) + 1

              return (
                <div
                  key={`errada-${p.id}`}
                  className="p-4 sm:p-5 rounded-2xl bg-rose-950/30 border border-rose-500/30 space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-extrabold text-sm text-white">
                      Pergunta {originalIndex}: {p.enunciado}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold text-[11px] shrink-0 border border-rose-500/30 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Errou
                    </span>
                  </div>

                  {/* Resposta do usuário vs Resposta correta */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <p className="text-[10px] uppercase font-bold text-rose-300 flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-rose-400" /> Sua Resposta:
                      </p>
                      <p className="text-white font-semibold mt-1">
                        {respUser ? (
                          <>
                            <strong className="text-rose-300">Opção {respUser}:</strong>{' '}
                            {opcaoUser ? opcaoUser.texto : ''}
                          </>
                        ) : (
                          <span className="italic text-slate-400">(Não respondeu)</span>
                        )}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Resposta Correta:
                      </p>
                      <p className="text-white font-semibold mt-1">
                        <strong className="text-emerald-300">Opção {p.resposta_correta}:</strong>{' '}
                        {opcaoCorreta ? opcaoCorreta.texto : ''}
                      </p>
                    </div>
                  </div>

                  {/* Explicação pedagógica */}
                  {p.explicacao && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-slate-200">
                      <p className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px] mb-1">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                        Explicação Pedagógica:
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed italic">
                        {p.explicacao}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* SEÇÃO COMPLETA: RESUMO DETALHADO POR PERGUNTA */}
      <div
        className={`p-5 sm:p-6 rounded-3xl border ${
          modoModal
            ? 'bg-slate-900/60 border-slate-700/60 text-white'
            : 'bg-white/10 backdrop-blur-md border-white/20 text-white shadow-xl'
        } space-y-4`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-extrabold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#00C4A7]" />
              Resumo Pergunta a Pergunta
            </h4>
            <p className="text-xs text-slate-300">
              Acompanhe cada enunciado, a resposta registrada e abra a explicação de qualquer
              questão.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => expandAll(true)}
              className="text-xs h-8 px-3 rounded-xl border-white/20 text-white hover:bg-white/10"
            >
              Expandir todas
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => expandAll(false)}
              className="text-xs h-8 px-3 rounded-xl border-white/20 text-white hover:bg-white/10"
            >
              Recolher todas
            </Button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1 text-[11px]">
            <Filter className="w-3 h-3 text-[#00C4A7]" /> Filtrar:
          </span>
          <button
            type="button"
            onClick={() => setFiltro('todas')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              filtro === 'todas'
                ? 'bg-[#6C4DF6] text-white shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Todas ({perguntas.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltro('erradas')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              filtro === 'erradas'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Erradas ({perguntasErradas.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltro('certas')}
            className={`px-3 py-1 rounded-xl font-bold transition-all ${
              filtro === 'certas'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Certas ({acertosCount})
          </button>
          {abertasPerguntas.length > 0 && (
            <button
              type="button"
              onClick={() => setFiltro('abertas')}
              className={`px-3 py-1 rounded-xl font-bold transition-all ${
                filtro === 'abertas'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              Dissertativas ({abertasPerguntas.length})
            </button>
          )}
        </div>

        {/* Lista de Perguntas */}
        <div className="space-y-3 pt-2">
          {perguntasFiltradas.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-xs">
              Nenhuma pergunta correspondente ao filtro selecionado.
            </div>
          ) : (
            perguntasFiltradas.map((p) => {
              const originalIndex = perguntas.findIndex((item) => item.id === p.id) + 1
              const respUser = respostasMap.get(p.id) || ''
              const isObj = p.tipo === 'multipla_escolha'
              const acertou = isObj && !!respUser && respUser === p.resposta_correta
              const isExpanded = !!expandedIds[p.id]

              const opcaoUser = isObj ? p.opcoes?.find((o) => o.label === respUser) : null
              const opcaoCorreta = isObj
                ? p.opcoes?.find((o) => o.label === p.resposta_correta)
                : null

              let cardBg = 'bg-white/5 border-white/10'
              if (isObj) {
                cardBg = acertou
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-rose-500/10 border-rose-500/30'
              } else {
                cardBg = 'bg-purple-500/10 border-purple-500/30'
              }

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border transition-all text-xs overflow-hidden ${cardBg}`}
                >
                  {/* Cabeçalho da Pergunta com botão de expandir */}
                  <div
                    onClick={() => toggleExpand(p.id)}
                    className="p-4 sm:p-5 flex items-start justify-between gap-3 cursor-pointer hover:bg-white/[0.04]"
                  >
                    <div className="space-y-1.5 flex-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-sm text-white">#{originalIndex}</span>
                        <Badge
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isObj
                              ? acertou
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          }`}
                        >
                          {isObj ? (
                            acertou ? (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Acertou
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Errou
                              </span>
                            )
                          ) : (
                            <span className="flex items-center gap-1">
                              <HelpCircle className="w-3 h-3" /> Dissertativa
                            </span>
                          )}
                        </Badge>
                      </div>

                      <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                        {p.enunciado}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-full text-slate-300 hover:text-white hover:bg-white/10"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Resumo compacto de resposta */}
                  <div className="px-4 pb-4 pt-0 text-slate-300 space-y-2">
                    {/* Bloco Objetiva */}
                    {isObj && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div
                          className={`p-2.5 rounded-xl border ${
                            acertou
                              ? 'bg-emerald-500/10 border-emerald-500/20'
                              : 'bg-rose-500/10 border-rose-500/20'
                          }`}
                        >
                          <p className="text-[10px] uppercase font-bold text-slate-300">
                            Sua Resposta:
                          </p>
                          <p className="font-semibold text-white mt-0.5">
                            {respUser ? (
                              <>
                                <strong className={acertou ? 'text-emerald-300' : 'text-rose-300'}>
                                  Opção {respUser}:
                                </strong>{' '}
                                {opcaoUser ? opcaoUser.texto : ''}
                              </>
                            ) : (
                              <span className="italic text-slate-400">(Não respondeu)</span>
                            )}
                          </p>
                        </div>

                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-[10px] uppercase font-bold text-emerald-300">
                            Alternativa Correta:
                          </p>
                          <p className="font-semibold text-white mt-0.5">
                            <strong className="text-emerald-300">
                              Opção {p.resposta_correta}:
                            </strong>{' '}
                            {opcaoCorreta ? opcaoCorreta.texto : ''}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bloco Dissertativa: Resposta do Aluno vs Resposta Esperada da IA */}
                    {!isObj && (
                      <div className="space-y-2 pt-1">
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                          <p className="text-[10px] uppercase font-bold text-[#00C4A7] flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Sua Resposta Escrita:
                          </p>
                          <p className="text-white mt-1 whitespace-pre-wrap leading-relaxed">
                            {respUser || (
                              <span className="italic text-slate-400">
                                (Nenhum texto informado pelo participante)
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                          <p className="text-[10px] uppercase font-bold text-purple-300 flex items-center gap-1">
                            <Lightbulb className="w-3 h-3 text-amber-400" /> Resposta Modelo /
                            Pontos Esperados pela IA:
                          </p>
                          <p className="text-purple-100 mt-1 whitespace-pre-wrap leading-relaxed italic">
                            {p.resposta_correta ||
                              p.explicacao ||
                              'A resposta deve demonstrar síntese reflexiva e aplicação dos conceitos fundamentais abordados.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ÁREA EXPANDIDA COM TODAS AS ALTERNATIVAS E EXPLICAÇÃO */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-white/10 space-y-3 animate-fade-in">
                        {isObj && p.opcoes && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                              Todas as alternativas:
                            </p>
                            <div className="grid grid-cols-1 gap-1.5">
                              {p.opcoes.map((op) => {
                                const isCorreta = op.label === p.resposta_correta
                                const isMarcada = op.label === respUser
                                let opBg = 'bg-white/5 border-white/10 text-slate-300'

                                if (isCorreta) {
                                  opBg =
                                    'bg-emerald-500/20 border-emerald-500/50 text-white font-semibold'
                                } else if (isMarcada && !isCorreta) {
                                  opBg =
                                    'bg-rose-500/20 border-rose-500/40 text-white font-semibold'
                                }

                                return (
                                  <div
                                    key={op.label}
                                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-xs ${opBg}`}
                                  >
                                    <span
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                        isCorreta
                                          ? 'bg-emerald-500 text-white'
                                          : isMarcada
                                            ? 'bg-rose-500 text-white'
                                            : 'bg-white/10 text-slate-400'
                                      }`}
                                    >
                                      {op.label}
                                    </span>
                                    <span className="flex-1">{op.texto}</span>
                                    {isCorreta && (
                                      <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1 shrink-0">
                                        <Check className="w-3 h-3" /> Gabarito
                                      </span>
                                    )}
                                    {isMarcada && !isCorreta && (
                                      <span className="text-[10px] font-bold text-rose-300 flex items-center gap-1 shrink-0">
                                        <XCircle className="w-3 h-3" /> Sua escolha
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Explicação Pedagógica Completa */}
                        {p.explicacao && (
                          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-slate-200 space-y-1">
                            <p className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                              Por que esta é a resposta correta?
                            </p>
                            <p className="text-xs text-slate-300 leading-relaxed italic">
                              {p.explicacao}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
export default RelatorioIndividual
