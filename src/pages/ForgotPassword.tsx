import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Zap, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    try {
      // Por segurança, PocketBase não vaza se o email existe
      await pb.collection('users').requestPasswordReset(email)
    } catch (err) {
      console.warn('Erro ao requisitar reset:', err)
    } finally {
      setIsLoading(false)
      setIsSubmitted(true)
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

        {isSubmitted ? (
          <div className="text-center py-4 space-y-4 animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-[#00C4A7] mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#1A1D2E]">Link enviado!</h2>
            <p className="text-sm text-[#5A6172] leading-relaxed">
              Se houver uma conta vinculada a{' '}
              <span className="font-semibold text-[#1A1D2E]">{email}</span>, enviamos um link para
              você redefinir sua senha. Verifique sua caixa de entrada e spam.
            </p>
            <div className="pt-4">
              <Link to="/login">
                <Button variant="outline" className="w-full h-11 rounded-xl">
                  Voltar para o login
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-[#1A1D2E] tracking-tight">
                Recuperar senha
              </h1>
              <p className="text-sm text-[#5A6172] mt-1">
                Informe o seu e-mail cadastrado e enviaremos um link de recuperação.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold uppercase tracking-wider text-[#5A6172]"
                >
                  E-mail cadastrado
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-[#FDFDFF] border-[#D1D5DB] focus-visible:ring-[#6C4DF6]"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-md shadow-[#6C4DF6]/25 transition-all"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando link...
                    </>
                  ) : (
                    'Enviar link de recuperação'
                  )}
                </Button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <Link
                to="/login"
                className="inline-flex items-center text-sm font-semibold text-[#6C4DF6] hover:underline"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Voltar para o login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
