import React, { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Zap, Loader2, ShieldCheck } from 'lucide-react'

export default function ConfirmEmailChange() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!token) {
      setErrorMessage('Token de confirmação não fornecido.')
      return
    }

    if (!password) {
      setErrorMessage('Por favor, informe sua senha atual para confirmar a alteração.')
      return
    }

    setIsLoading(true)
    try {
      await pb.collection('users').confirmEmailChange(token, password)
      // Desloga o usuário para garantir login com o novo email
      pb.authStore.clear()

      toast({
        title: 'E-mail alterado com sucesso!',
        description: 'Faça login com seu novo endereço de e-mail.',
      })

      navigate('/login')
    } catch (err: unknown) {
      console.error('Erro na confirmação de alteração de email:', err)
      const msg = (err as { message?: string })?.message || 'Token inválido ou senha incorreta.'
      setErrorMessage(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC] px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-[#1A1D2E]/5 border border-[#E5E8F0] p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center shadow-md shadow-[#6C4DF6]/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#1A1D2E]">
            QuizDoc <span className="text-[#6C4DF6]">AI</span>
          </span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[#1A1D2E] tracking-tight">
            Confirmar novo e-mail
          </h1>
          <p className="text-sm text-[#5A6172] mt-1">
            Por segurança, insira sua senha atual para efetivar a troca do seu endereço de e-mail.
          </p>
        </div>

        {!token && (
          <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            Nenhum token encontrado na URL. Verifique se clicou no link completo enviado por e-mail.
          </div>
        )}

        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-2">
            <span className="font-semibold text-xs mt-0.5 bg-red-100 px-1.5 py-0.5 rounded">
              Atenção
            </span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-[#5A6172]"
            >
              Senha atual da sua conta
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 rounded-xl bg-[#FDFDFF] border-[#D1D5DB] focus-visible:ring-[#6C4DF6]"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading || !token}
              className="w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-md shadow-[#6C4DF6]/25 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Confirmar novo e-mail
                </>
              )}
            </Button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-[#5A6172]">
          Deseja cancelar?{' '}
          <Link to="/" className="font-semibold text-[#6C4DF6] hover:underline">
            Voltar ao Início
          </Link>
        </p>
      </div>
    </div>
  )
}
