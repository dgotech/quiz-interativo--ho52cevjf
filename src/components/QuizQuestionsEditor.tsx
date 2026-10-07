import { useState } from 'react'
import type {
  PerguntaRecord,
  OpcaoQuiz,
  TipoPergunta,
  QuizRecord,
  TentativaRecord,
} from '@/types/quiz'
import { quizService } from '@/services/quizService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useToast } from '@/hooks/use-toast'
import {
  ArrowUp,
  ArrowDown,
  Edit3,
  Trash2,
  Plus,
  CheckCircle2,
  Check,
  Loader2,
  Sparkles,
  HelpCircle,
  FileQuestion,
  Lightbulb,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react'

interface QuizQuestionsEditorProps {
  quizId: string
  perguntas: PerguntaRecord[]
  onRefresh: () => Promise<void>
  quiz?: QuizRecord | null
  tentativas?: TentativaRecord[]
  onRegenerateClick?: () => void
  onExportExcelClick?: () => void
  isOwner?: boolean
}

const DEFAULT_OPTIONS: OpcaoQuiz[] = [
  { label: 'A', texto: '' },
  { label: 'B', texto: '' },
  { label: 'C', texto: '' },
  { label: 'D', texto: '' },
]

export function QuizQuestionsEditor({
  quizId,
  perguntas,
  onRefresh,
  onRegenerateClick,
  onExportExcelClick,
  isOwner = true,
}: QuizQuestionsEditorProps) {
  const { toast } = useToast()

  // Estado para modal de edição / criação
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPergunta, setEditingPergunta] = useState<PerguntaRecord | null>(null)
  const [enunciado, setEnunciado] = useState('')
  const [tipo, setTipo] = useState<TipoPergunta>('multipla_escolha')
  const [opcoes, setOpcoes] = useState<OpcaoQuiz[]>(DEFAULT_OPTIONS)
  const [respostaCorreta, setRespostaCorreta] = useState<string>('A')
  const [explicacao, setExplicacao] = useState('')
  const [saving, setSaving] = useState(false)

  // Estado para exclusão
  const [perguntaToDelete, setPerguntaToDelete] = useState<PerguntaRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Reordenação em lote / carregamento
  const [reordering, setReordering] = useState(false)

  // Abrir modal para nova pergunta
  const handleOpenCreate = () => {
    setEditingPergunta(null)
    setEnunciado('')
    setTipo('multipla_escolha')
    setOpcoes([
      { label: 'A', texto: '' },
      { label: 'B', texto: '' },
      { label: 'C', texto: '' },
      { label: 'D', texto: '' },
    ])
    setRespostaCorreta('A')
    setExplicacao('')
    setModalOpen(true)
  }

  // Abrir modal para editar pergunta existente
  const handleOpenEdit = (p: PerguntaRecord) => {
    setEditingPergunta(p)
    setEnunciado(p.enunciado || '')
    setTipo(p.tipo || 'multipla_escolha')

    if (p.tipo === 'multipla_escolha' && p.opcoes && p.opcoes.length > 0) {
      // Garante as opções A, B, C, D
      const existingLabels = ['A', 'B', 'C', 'D'] as const
      const mapped: OpcaoQuiz[] = existingLabels.map((lbl) => {
        const found = p.opcoes?.find((o) => o.label === lbl)
        return found ? { ...found } : { label: lbl, texto: '' }
      })
      setOpcoes(mapped)
    } else {
      setOpcoes([
        { label: 'A', texto: '' },
        { label: 'B', texto: '' },
        { label: 'C', texto: '' },
        { label: 'D', texto: '' },
      ])
    }

    setRespostaCorreta(p.resposta_correta || 'A')
    setExplicacao(p.explicacao || '')
    setModalOpen(true)
  }

  // Atualizar texto de uma alternativa
  const handleOptionTextChange = (label: 'A' | 'B' | 'C' | 'D', texto: string) => {
    setOpcoes((prev) => prev.map((op) => (op.label === label ? { ...op, texto } : op)))
  }

  // Salvar pergunta (criar ou editar)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enunciado.trim()) {
      toast({
        title: 'Enunciado obrigatório',
        description: 'Por favor, informe a pergunta antes de salvar.',
        variant: 'destructive',
      })
      return
    }

    if (tipo === 'multipla_escolha') {
      const emptyOp = opcoes.find((o) => !o.texto.trim())
      if (emptyOp) {
        toast({
          title: 'Preencha todas as alternativas',
          description: `A alternativa (${emptyOp.label}) está em branco.`,
          variant: 'destructive',
        })
        return
      }
      if (!respostaCorreta) {
        toast({
          title: 'Gabarito necessário',
          description: 'Selecione qual alternativa é a correta.',
          variant: 'destructive',
        })
        return
      }
    }

    setSaving(true)
    try {
      if (editingPergunta) {
        // Atualizar
        await quizService.atualizarPergunta(editingPergunta.id, {
          enunciado: enunciado.trim(),
          tipo,
          opcoes: tipo === 'multipla_escolha' ? opcoes : null,
          resposta_correta: tipo === 'multipla_escolha' ? respostaCorreta : respostaCorreta.trim(),
          explicacao: explicacao.trim() || undefined,
        })
        toast({
          title: 'Pergunta atualizada!',
          description: 'As alterações foram salvas com sucesso.',
        })
      } else {
        // Criar no final da lista
        const maxOrdem = perguntas.reduce((max, p) => Math.max(max, p.ordem || 0), 0)
        await quizService.criarPergunta({
          quiz_id: quizId,
          enunciado: enunciado.trim(),
          tipo,
          opcoes: tipo === 'multipla_escolha' ? opcoes : null,
          resposta_correta: tipo === 'multipla_escolha' ? respostaCorreta : respostaCorreta.trim(),
          explicacao: explicacao.trim() || undefined,
          ordem: maxOrdem + 1,
        })
        toast({
          title: 'Pergunta criada!',
          description: 'A nova pergunta foi adicionada ao quiz.',
        })
      }
      setModalOpen(false)
      await onRefresh()
    } catch (err) {
      console.error('Erro ao salvar pergunta:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a pergunta. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Excluir pergunta
  const handleConfirmDelete = async () => {
    if (!perguntaToDelete) return
    setDeleting(true)
    try {
      await quizService.excluirPergunta(perguntaToDelete.id)
      toast({
        title: 'Pergunta excluída',
        description: 'A pergunta foi removida do quiz.',
      })
      setPerguntaToDelete(null)
      await onRefresh()
    } catch (err) {
      console.error('Erro ao excluir pergunta:', err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a pergunta.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  // Mover pergunta para cima ou para baixo
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= perguntas.length) return

    setReordering(true)
    try {
      // Clonar array e trocar posições
      const reordered = [...perguntas]
      const temp = reordered[index]
      reordered[index] = reordered[targetIndex]
      reordered[targetIndex] = temp

      // Atribuir nova ordem sequencial (1, 2, 3...)
      const updates = reordered.map((item, idx) => ({
        id: item.id,
        ordem: idx + 1,
      }))

      await quizService.reordenarPerguntas(updates)
      await onRefresh()
      toast({
        title: 'Ordem atualizada!',
        description: `Pergunta movida para a posição ${targetIndex + 1}.`,
      })
    } catch (err) {
      console.error('Erro ao reordenar perguntas:', err)
      toast({
        title: 'Erro ao reordenar',
        description: 'Não foi possível alterar a ordem das perguntas.',
        variant: 'destructive',
      })
    } finally {
      setReordering(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra de Ações Superior do Editor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-purple-50 via-white to-teal-50 border border-[#E5E8F0]">
        <div>
          <h3 className="text-base font-extrabold text-[#1A1D2E] flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#6C4DF6]" />
            Editor & Revisor de Perguntas
          </h3>
          <p className="text-xs text-[#5A6172] mt-0.5">
            Revise o gabarito, edite alternativas ou reorganize a sequência do quiz.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onExportExcelClick && isOwner && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExportExcelClick}
              className="rounded-xl border-emerald-300 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 font-semibold text-xs h-9 px-3.5"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
              Exportar para Excel
            </Button>
          )}

          {onRegenerateClick && isOwner && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRegenerateClick}
              className="rounded-xl border-[#6C4DF6]/30 bg-purple-50/60 text-[#6C4DF6] hover:bg-[#6C4DF6]/15 font-semibold text-xs h-9 px-3.5"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refazer perguntas com IA
            </Button>
          )}

          <Button
            onClick={handleOpenCreate}
            size="sm"
            className="rounded-xl font-bold bg-[#6C4DF6] text-white hover:bg-[#5839E6] shadow-sm text-xs h-9 px-4"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar Pergunta
          </Button>
        </div>
      </div>

      {/* Lista de Perguntas */}
      {perguntas.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#F7F8FC] border border-dashed border-[#D1D5DB] space-y-3">
          <FileQuestion className="w-10 h-10 text-slate-400 mx-auto opacity-60" />
          <h4 className="font-bold text-[#1A1D2E]">Nenhuma pergunta no quiz</h4>
          <p className="text-xs text-[#5A6172] max-w-sm mx-auto">
            Todas as perguntas foram removidas ou este quiz não possui itens. Adicione sua primeira
            pergunta!
          </p>
          <Button
            onClick={handleOpenCreate}
            size="sm"
            className="rounded-xl bg-[#6C4DF6] text-white text-xs mt-2"
          >
            <Plus className="w-4 h-4 mr-1" />
            Adicionar Pergunta Agora
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {perguntas.map((p, index) => {
            const isFirst = index === 0
            const isLast = index === perguntas.length - 1
            const isObj = p.tipo === 'multipla_escolha'

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-[#E5E8F0] p-5 shadow-sm hover:border-[#6C4DF6]/40 transition-all space-y-4 group"
              >
                {/* Linha de topo: Posição, tipo, controles de reordenação e ações */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0F2F7] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#6C4DF6]/10 text-[#6C4DF6] font-extrabold text-xs flex items-center justify-center">
                      #{index + 1}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[11px] font-semibold bg-slate-100 text-[#5A6172] border-0"
                    >
                      {isObj ? 'Múltipla Escolha' : 'Aberta / Dissertativa'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Botões de Mover Ordem */}
                    <div className="flex items-center bg-slate-100/80 rounded-xl p-0.5 mr-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isFirst || reordering}
                        onClick={() => handleMove(index, 'up')}
                        title="Mover para cima"
                        className="h-7 w-7 p-0 rounded-lg text-[#5A6172] hover:text-[#1A1D2E] hover:bg-white disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isLast || reordering}
                        onClick={() => handleMove(index, 'down')}
                        title="Mover para baixo"
                        className="h-7 w-7 p-0 rounded-lg text-[#5A6172] hover:text-[#1A1D2E] hover:bg-white disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Editar */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(p)}
                      className="h-8 px-3 rounded-xl text-xs font-semibold border-[#E5E8F0] text-[#1A1D2E] hover:bg-[#6C4DF6]/10 hover:text-[#6C4DF6] hover:border-[#6C4DF6]"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                      Editar
                    </Button>

                    {/* Excluir */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPerguntaToDelete(p)}
                      className="h-8 px-2.5 rounded-xl text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Enunciado */}
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-[#1A1D2E] leading-snug">
                    {p.enunciado}
                  </h4>
                </div>

                {/* Alternativas (se múltipla escolha) */}
                {isObj && p.opcoes && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {p.opcoes.map((opcao) => {
                      const isCorrect = p.resposta_correta === opcao.label
                      return (
                        <div
                          key={opcao.label}
                          className={`p-3 rounded-xl border text-xs flex items-center gap-3 transition-colors ${
                            isCorrect
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                              : 'bg-[#F9FAFC] border-[#E5E8F0] text-[#5A6172]'
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-200 text-[#5A6172]'
                            }`}
                          >
                            {opcao.label}
                          </span>
                          <span className="flex-1">{opcao.texto}</span>
                          {isCorrect && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 shrink-0 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" /> Correta
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Resposta esperada para pergunta aberta */}
                {!isObj && p.resposta_correta && (
                  <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-100 text-xs text-purple-950">
                    <span className="font-bold">Resposta esperada: </span>
                    <span>{p.resposta_correta}</span>
                  </div>
                )}

                {/* Explicação pedagógica */}
                {p.explicacao && (
                  <div className="flex items-start gap-2 pt-2 border-t border-[#F0F2F7] text-xs text-[#5A6172]">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="italic">
                      <strong>Explicação pedagógica:</strong> {p.explicacao}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Dialog de Edição / Criação de Pergunta */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-[#1A1D2E] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#6C4DF6]" />
              {editingPergunta ? 'Editar Pergunta' : 'Nova Pergunta do Quiz'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5A6172]">
              Ajuste o enunciado, as opções de resposta e marque qual é a alternativa correta.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5 pt-2">
            {/* Tipo de Pergunta */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#5A6172]">
                Tipo de Pergunta
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTipo('multipla_escolha')}
                  className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                    tipo === 'multipla_escolha'
                      ? 'bg-[#6C4DF6]/10 border-[#6C4DF6] text-[#6C4DF6] shadow-sm'
                      : 'bg-[#F9FAFC] border-[#E5E8F0] text-[#5A6172] hover:bg-slate-100'
                  }`}
                >
                  Múltipla Escolha (4 opções)
                </button>
                <button
                  type="button"
                  onClick={() => setTipo('aberta')}
                  className={`p-3 rounded-xl border text-xs font-bold text-center transition-all ${
                    tipo === 'aberta'
                      ? 'bg-[#6C4DF6]/10 border-[#6C4DF6] text-[#6C4DF6] shadow-sm'
                      : 'bg-[#F9FAFC] border-[#E5E8F0] text-[#5A6172] hover:bg-slate-100'
                  }`}
                >
                  Aberta / Dissertativa
                </button>
              </div>
            </div>

            {/* Enunciado */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#5A6172]">
                Enunciado da Pergunta *
              </label>
              <Textarea
                value={enunciado}
                onChange={(e) => setEnunciado(e.target.value)}
                placeholder="Ex.: Qual é o prazo de entrega estipulado na apresentação?"
                rows={3}
                required
                className="rounded-xl border-[#E5E8F0] focus-visible:ring-[#6C4DF6] text-sm"
              />
            </div>

            {/* Opções de Múltipla Escolha */}
            {tipo === 'multipla_escolha' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#5A6172]">
                    Alternativas (clique no círculo para definir a correta)
                  </label>
                  <span className="text-[11px] text-[#00C4A7] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Correta: Opção {respostaCorreta}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {opcoes.map((op) => {
                    const isCorrect = respostaCorreta === op.label
                    return (
                      <div
                        key={op.label}
                        className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
                          isCorrect
                            ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                            : 'bg-white border-[#E5E8F0]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setRespostaCorreta(op.label)}
                          title={`Marcar opção ${op.label} como correta`}
                          className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                            isCorrect
                              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-200'
                              : 'bg-slate-100 text-[#5A6172] hover:bg-slate-200'
                          }`}
                        >
                          {op.label}
                        </button>

                        <Input
                          type="text"
                          value={op.texto}
                          onChange={(e) => handleOptionTextChange(op.label, e.target.value)}
                          placeholder={`Texto da alternativa ${op.label}...`}
                          className="rounded-lg border-[#E5E8F0] text-xs h-9 bg-white"
                          required
                        />

                        <button
                          type="button"
                          onClick={() => setRespostaCorreta(op.label)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 transition-colors ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {isCorrect ? '✓ Gabarito' : 'Marcar correta'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Resposta esperada para pergunta aberta */}
            {tipo === 'aberta' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#5A6172] flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[#6C4DF6]" />
                  Gabarito ou Resposta Esperada (opcional)
                </label>
                <Textarea
                  value={respostaCorreta}
                  onChange={(e) => setRespostaCorreta(e.target.value)}
                  placeholder="Texto ou palavras-chave esperadas na resposta do aluno..."
                  rows={2}
                  className="rounded-xl border-[#E5E8F0] focus-visible:ring-[#6C4DF6] text-xs"
                />
              </div>
            )}

            {/* Explicação pedagógica */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#5A6172] flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                Explicação / Justificativa Pedagógica (exibida após responder)
              </label>
              <Textarea
                value={explicacao}
                onChange={(e) => setExplicacao(e.target.value)}
                placeholder="Ex.: O envio deve ser feito com antecedência para cumprir os requisitos legais do eSocial."
                rows={2}
                className="rounded-xl border-[#E5E8F0] focus-visible:ring-[#6C4DF6] text-xs"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-[#E5E8F0] gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-xl text-xs h-10"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl font-bold bg-[#6C4DF6] text-white hover:bg-[#5839E6] text-xs h-10 px-5"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Pergunta'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={!!perguntaToDelete}
        onOpenChange={(open) => !open && setPerguntaToDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-[#1A1D2E]">
              Excluir esta pergunta?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#5A6172]">
              Esta ação removerá a pergunta do quiz permanentemente. O enunciado:
              <br />
              <strong className="text-[#1A1D2E] block mt-2 p-2 bg-slate-50 rounded-lg">
                &ldquo;{perguntaToDelete?.enunciado}&rdquo;
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="rounded-xl text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Sim, excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
