import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Zap, CheckCircle2, AlertCircle, Mail, Loader2 } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const initialEmail = searchParams.get('email') || ''

  const [resendEmail, setResendEmail] = useState(initialEmail)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isError, setIsError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isResending, setIsResending] = useState(false)

  const { toast } = useToast()

  useEffect(() => {
    if (token) {
      setIsVerifying(true)
      pb.collection('users')
        .confirmVerification(token)
        .then(() => {
          setIsSuccess(true)
          toast({
            title: 'E-mail verificado com sucesso!',
            description: 'Sua conta está totalmente ativada. Faça login para continuar.',
          })
        })
        .catch((err) => {
          console.error('Erro na verificação:', err)
          setIsError(true)
          setErrorMessage(err?.message || 'Token de verificação expirado ou inválido.')
        })
        .finally(() => {
          setIsVerifying(false)
        })
    }
  }, [token, toast])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resendEmail) return

    setIsResending(true)
    try {
      await pb.collection('users').requestVerification(resendEmail)
      toast({
        title: 'E-mail reenviado!',
        description: `Enviamos um novo link de confirmação para ${resendEmail}.`,
      })
    } catch (err: unknown) {
      console.error('Erro ao reenviar:', err)
      toast({
        title: 'Aviso',
        description: 'Se o e-mail estiver cadastrado e pendente, o link foi enviado.',
      })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC] px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-[#1A1D2E]/5 border border-[#E5E8F0] p-8 text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center shadow-md shadow-[#6C4DF6]/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#1A1D2E]">
            QuizDoc <span className="text-[#6C4DF6]">AI</span>
          </span>
        </div>

        {/* Estado 1: Verificando token */}
        {isVerifying && (
          <div className="py-8 space-y-4">
            <Loader2 className="w-10 h-10 text-[#6C4DF6] animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-[#1A1D2E]">Validando seu e-mail...</h2>
            <p className="text-sm text-[#5A6172]">Por favor, aguarde alguns instantes.</p>
          </div>
        )}

        {/* Estado 2: Sucesso */}
        {!isVerifying && isSuccess && (
          <div className="py-6 space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#00C4A7] mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#1A1D2E]">E-mail Confirmado!</h2>
            <p className="text-sm text-[#5A6172]">
              Sua conta foi ativada com sucesso. Agora você pode entrar e começar a transformar seus
              documentos em quizzes.
            </p>
            <div className="pt-4">
              <Link to="/login">
                <Button className="w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] to-[#00C4A7]">
                  Ir para Login
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Estado 3: Erro no token */}
        {!isVerifying && isError && (
          <div className="py-6 space-y-4 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-500 mx-auto flex items-center justify-center">
              <AlertCircle className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#1A1D2E]">Falha na Verificação</h2>
            <p className="text-sm text-red-600 font-medium">
              {errorMessage || 'O link de verificação expirou ou já foi utilizado.'}
            </p>
          </div>
        )}

        {/* Estado 4: Tela informativa de instrução / Reenvio */}
        {!isVerifying && !isSuccess && (
          <div className="space-y-6">
            {!isError && (
              <>
                <div className="w-16 h-16 rounded-2xl bg-[#6C4DF6]/10 text-[#6C4DF6] mx-auto flex items-center justify-center">
                  <Mail className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-[#1A1D2E]">
                    Verifique sua caixa de entrada
                  </h2>
                  <p className="text-sm text-[#5A6172] mt-2 leading-relaxed">
                    Enviamos um link de confirmação para o seu e-mail. Clique no link recebido para
                    validar e ativar sua conta.
                  </p>
                </div>
              </>
            )}

            <div className="p-4 rounded-xl bg-[#F7F8FC] border border-[#E5E8F0] text-left">
              <p className="text-xs font-semibold text-[#1A1D2E] mb-2 uppercase tracking-wider">
                Não recebeu o e-mail?
              </p>
              <form onSubmit={handleResend} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="resendEmail" className="text-[11px] text-[#5A6172]">
                    Confirme seu e-mail para reenviar
                  </Label>
                  <Input
                    id="resendEmail"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    required
                    className="h-9 text-xs bg-white"
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isResending}
                  className="w-full h-9 text-xs font-semibold border-[#6C4DF6] text-[#6C4DF6] hover:bg-[#6C4DF6]/10"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Reenviando...
                    </>
                  ) : (
                    'Reenviar link de verificação'
                  )}
                </Button>
              </form>
            </div>

            <div className="pt-2">
              <Link to="/login" className="text-xs font-semibold text-[#6C4DF6] hover:underline">
                Voltar para o Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
