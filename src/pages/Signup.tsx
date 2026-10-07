import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Zap, ArrowRight, Loader2, Info } from 'lucide-react'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!name || !email || !password) {
      setErrorMessage('Todos os campos são obrigatórios.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    setIsLoading(true)
    try {
      // 1. Criar usuário no PocketBase
      await pb.collection('users').create({
        name,
        email,
        password,
        passwordConfirm: password,
      })

      // 2. Disparar email de verificação
      try {
        await pb.collection('users').requestVerification(email)
      } catch (emailErr) {
        console.warn('Não foi possível enviar o email de verificação imediatamente:', emailErr)
      }

      toast({
        title: 'Conta criada com sucesso!',
        description: 'Verifique seu e-mail para ativar sua conta por completo.',
      })

      navigate(`/verify-email?email=${encodeURIComponent(email)}`)
    } catch (err: unknown) {
      console.error('Erro no cadastro:', err)
      const data = (err as { data?: { data?: Record<string, { message: string }> } })?.data?.data
      if (data?.email) {
        setErrorMessage('Este e-mail já está em uso por outra conta.')
      } else {
        const msg =
          (err as { message?: string })?.message || 'Erro ao criar conta. Tente novamente.'
        setErrorMessage(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC] px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-[#1A1D2E]/5 border border-[#E5E8F0] p-8">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center shadow-md shadow-[#6C4DF6]/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#1A1D2E]">
            Quiz - <span className="text-[#6C4DF6]">Zara 2026</span>
          </span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[#1A1D2E] tracking-tight">
            Criar nova conta
          </h1>
          <p className="text-sm text-[#5A6172] mt-1">
            Gere quizzes interativos a partir dos seus arquivos em poucos segundos.
          </p>
        </div>

        {/* Aviso de verificação de email */}
        <div className="mb-5 p-3.5 rounded-xl bg-[#6C4DF6]/5 border border-[#6C4DF6]/20 text-xs text-[#5A6172] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#6C4DF6] shrink-0 mt-0.5" />
          <span>
            A verificação por e-mail é necessária para a ativação completa do acesso às ferramentas
            de estudo.
          </span>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-2 animate-fade-in">
            <span className="font-semibold text-xs mt-0.5 bg-red-100 px-1.5 py-0.5 rounded">
              Atenção
            </span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="text-xs font-semibold uppercase tracking-wider text-[#5A6172]"
            >
              Nome completo
            </Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="Ex.: Danilo Rodrigues"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-11 rounded-xl bg-[#FDFDFF] border-[#D1D5DB] focus-visible:ring-[#6C4DF6]"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-wider text-[#5A6172]"
            >
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu.email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 rounded-xl bg-[#FDFDFF] border-[#D1D5DB] focus-visible:ring-[#6C4DF6]"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-[#5A6172]"
            >
              Senha (mínimo 8 caracteres)
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="h-11 rounded-xl bg-[#FDFDFF] border-[#D1D5DB] focus-visible:ring-[#6C4DF6]"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-md shadow-[#6C4DF6]/25 transition-all transform active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  Criar conta
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-[#5A6172]">
          Já possui uma conta?{' '}
          <Link to="/login" className="font-semibold text-[#6C4DF6] hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  )
}
