import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { quizService } from '@/services/quizService'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  X,
  Loader2,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react'

export default function NewQuiz() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState<string>(
    'Lendo e interpretando seu arquivo...',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  // Limpar requisição pendente se o componente desmontar
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null)
    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext !== 'pptx' && ext !== 'xlsx') {
      const err =
        'Formato não suportado. Por favor, envie apenas arquivos PowerPoint (.pptx) ou Excel (.xlsx).'
      setErrorMessage(err)
      toast({
        title: 'Formato inválido',
        description: err,
        variant: 'destructive',
      })
      return
    }

    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      const err = 'O arquivo excede o limite máximo permitido de 100MB.'
      setErrorMessage(err)
      toast({
        title: 'Arquivo muito grande',
        description: err,
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setErrorMessage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    else return (bytes / 1048576).toFixed(1) + ' MB'
  }

  const handleProcessFile = async () => {
    if (!selectedFile) return

    // 1. Verificação prévia da sessão local antes de começar
    if (!pb.authStore.isValid || !pb.authStore.token) {
      toast({
        title: 'Sessão expirada',
        description: 'Sua sessão expirou. Faça login novamente e tente enviar o arquivo.',
        variant: 'destructive',
      })
      navigate('/login', {
        state: {
          from: location,
          sessionExpiredMessage: 'Sua sessão expirou. Faça login novamente para gerar o quiz.',
        },
        replace: true,
      })
      return
    }

    setIsProcessing(true)
    setErrorMessage(null)
    setProcessingStep('Enviando e validando seu documento...')

    const isLargeFile = (selectedFile.size || 0) > 10 * 1024 * 1024
    if (isLargeFile) {
      setProcessingStep(
        'Processando arquivo pesado (~' +
          formatFileSize(selectedFile.size) +
          ')... Extraindo slides e textos com segurança.',
      )
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const result = await quizService.criarQuizEProcessar(
        selectedFile,
        (phaseText) => {
          setProcessingStep(phaseText)
        },
        abortController.signal,
      )

      toast({
        title: '🎉 Quiz gerado com sucesso!',
        description: result.truncated
          ? `Criadas ${result.total_perguntas} perguntas para "${result.nome_quiz}". O documento era longo, então priorizamos o conteúdo principal.`
          : `Criadas ${result.total_perguntas} perguntas incríveis para "${result.nome_quiz}".`,
      })

      navigate(`/quiz/${result.quiz_id}`)
    } catch (err: unknown) {
      setIsProcessing(false)

      const errObj = err as { message?: string; code?: string }
      const errCode = errObj?.code
      const msg = errObj?.message || 'Falha ao processar o arquivo. Tente novamente.'

      console.error('Erro ao processar arquivo:', err)

      // Se a sessão expirou durante a tentativa
      if (errCode === 'SESSION_EXPIRED') {
        toast({
          title: 'Sessão expirada',
          description: 'Sua sessão expirou. Faça login novamente para continuar.',
          variant: 'destructive',
        })
        navigate('/login', {
          state: {
            from: location,
            sessionExpiredMessage: 'Sua sessão expirou. Faça login novamente e envie seu arquivo.',
          },
          replace: true,
        })
        return
      }

      setErrorMessage(msg)

      let toastTitle = 'Ops! Não foi possível processar'
      if (errCode === 'NETWORK_ERROR') {
        toastTitle = 'Instabilidade na transferência'
      } else if (errCode === 'TIMEOUT') {
        toastTitle = 'Processamento demorado'
      } else if (errCode === 'FILE_TOO_LARGE') {
        toastTitle = 'Arquivo muito grande'
      } else if (errCode === 'DOCUMENT_UNREADABLE') {
        toastTitle = 'Documento sem texto legível'
      }

      toast({
        title: toastTitle,
        description: msg,
        variant: 'destructive',
      })
    } finally {
      abortControllerRef.current = null
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 animate-fade-in space-y-6">
      {/* Overlay de Carregamento em Tela Cheia durante Processamento */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-[#1A1D2E]/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] flex items-center justify-center shadow-2xl shadow-[#6C4DF6]/40 mb-6 animate-bounce">
            <Sparkles className="w-10 h-10 text-white animate-spin" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            QuizDoc AI está trabalhando
          </h2>

          <p className="text-slate-300 text-sm sm:text-base max-w-md animate-pulse">
            {processingStep}
          </p>

          <div className="mt-8 flex items-center gap-2 text-xs text-slate-400 bg-white/10 px-4 py-2 rounded-full border border-white/10">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00C4A7]" />
            <span>Processando slides, tabelas e estruturando gabarito...</span>
          </div>
        </div>
      )}

      {/* Header da Página */}
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1D2E] tracking-tight">
          Criar novo quiz
        </h1>
        <p className="text-sm sm:text-base text-[#5A6172] mt-1">
          Envie um arquivo PPT ou Excel para gerar perguntas automaticamente.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-xs uppercase tracking-wider text-red-700">Atenção</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Dropzone Container */}
      <div className="bg-white rounded-3xl border border-[#E5E8F0] p-6 sm:p-8 shadow-sm space-y-6">
        {!selectedFile ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
              dragActive
                ? 'border-[#6C4DF6] bg-[#6C4DF6]/5 scale-[0.99]'
                : 'border-[#D1D5DB] hover:border-[#6C4DF6] hover:bg-[#F7F8FC]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pptx,.xlsx,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-[#6C4DF6]/10 text-[#6C4DF6] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-8 h-8" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[#1A1D2E]">
              Arraste seu arquivo aqui ou clique para selecionar
            </h3>
            <p className="text-xs sm:text-sm text-[#5A6172] mt-1.5 max-w-sm">
              Suporta apresentações PowerPoint (
              <span className="font-semibold text-[#1A1D2E]">.pptx</span>) ou planilhas Excel (
              <span className="font-semibold text-[#1A1D2E]">.xlsx</span>).
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-semibold border border-orange-200">
                <FileText className="w-3.5 h-3.5" />
                PowerPoint (.pptx)
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold border border-emerald-200">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel (.xlsx)
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-[#5A6172] text-xs font-medium">
                Máx: 100MB
              </span>
            </div>
          </div>
        ) : (
          /* Card do Arquivo Selecionado */
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-[#F7F8FC] border border-[#E5E8F0] flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm ${
                    selectedFile.name.endsWith('.pptx')
                      ? 'bg-gradient-to-br from-orange-400 to-rose-500'
                      : 'bg-gradient-to-br from-emerald-400 to-teal-600'
                  }`}
                >
                  {selectedFile.name.endsWith('.pptx') ? (
                    <FileText className="w-6 h-6" />
                  ) : (
                    <FileSpreadsheet className="w-6 h-6" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#1A1D2E] truncate">{selectedFile.name}</p>
                  <div className="flex items-center gap-2 text-xs text-[#5A6172] mt-0.5">
                    <span className="font-semibold uppercase tracking-wider text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
                      {selectedFile.name.split('.').pop()}
                    </span>
                    <span>•</span>
                    <span>{formatFileSize(selectedFile.size)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleRemoveFile}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Remover arquivo"
                aria-label="Remover arquivo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <Button
                onClick={handleProcessFile}
                disabled={isProcessing}
                className="w-full sm:flex-1 h-12 rounded-2xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-lg shadow-[#6C4DF6]/25 transition-all"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Processar arquivo
              </Button>

              <Button
                variant="outline"
                onClick={handleRemoveFile}
                className="w-full sm:w-auto h-12 rounded-2xl border-[#D1D5DB] text-[#5A6172]"
              >
                Escolher outro
              </Button>
            </div>
          </div>
        )}

        {/* Informação sobre salvamento */}
        <div className="pt-4 border-t border-[#E5E8F0] flex items-center gap-2 text-xs text-[#5A6172]">
          <Info className="w-4 h-4 text-[#6C4DF6] shrink-0" />
          <span>
            Seu quiz é salvo automaticamente e poderá ser acessado a qualquer momento em{' '}
            <strong>"Meus Quizzes"</strong>.
          </span>
        </div>
      </div>

      {/* Dicas de Conteúdo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#5A6172]">
        <div className="p-4 rounded-2xl bg-white border border-[#E5E8F0]">
          <h4 className="font-bold text-[#1A1D2E] mb-1 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-[#00C4A7]" />
            Apresentações (.pptx)
          </h4>
          <p>
            Ideais para conceitos teóricos, processos, históricos e resumos de palestras ou
            treinamentos corporativos.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E5E8F0]">
          <h4 className="font-bold text-[#1A1D2E] mb-1 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-[#00C4A7]" />
            Planilhas (.xlsx)
          </h4>
          <p>
            Perfeitas para dados numéricos, tabelas financeiras, listas de inventário e cruzamento
            de indicadores.
          </p>
        </div>
      </div>
    </div>
  )
}
