import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { FileText, Sparkles, Zap, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!email || !password) {
      setErrorMessage('Por favor, preencha o e-mail e a senha.')
      return
    }

    setIsLoading(true)
    try {
      await pb.collection('users').authWithPassword(email, password)
      toast({
        title: 'Bem-vindo de volta!',
        description: 'Login realizado com sucesso.',
      })
      navigate(from, { replace: true })
    } catch (err: unknown) {
      console.error('Erro no login:', err)
      const msg = (err as { message?: string })?.message || 'E-mail ou senha incorretos.'
      setErrorMessage(
        msg.includes('Failed to authenticate')
          ? 'E-mail ou senha inválidos. Verifique suas credenciais.'
          : msg,
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-[#F7F8FC]">
      {/* Formulário à Esquerda */}
      <div className="lg:col-span-5 flex flex-col justify-center px-6 py-12 sm:px-12 xl:px-16 bg-white">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center shadow-md shadow-[#6C4DF6]/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#1A1D2E]">
              QuizDoc <span className="text-[#6C4DF6]">AI</span>
            </span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-[#1A1D2E] tracking-tight">
              Acesse sua conta
            </h1>
            <p className="text-sm text-[#5A6172] mt-1">
              Entre com suas credenciais para gerenciar seus quizzes e testes.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-start gap-2 animate-fade-in">
              <span className="font-semibold text-xs mt-0.5 bg-red-100 px-1.5 py-0.5 rounded">
                Atenção
              </span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-[#5A6172]"
                >
                  Senha
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-[#6C4DF6] hover:text-[#5A3DDE] transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
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
                disabled={isLoading}
                className="w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] via-[#8E6FFF] to-[#00C4A7] hover:opacity-95 shadow-md shadow-[#6C4DF6]/25 transition-all transform active:scale-[0.99]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Dica de acesso padrão para testes */}
          <div className="mt-6 p-3 rounded-xl bg-[#F7F8FC] border border-[#E5E8F0] text-xs text-[#5A6172]">
            <p className="font-semibold text-[#1A1D2E] mb-1">Conta de demonstração:</p>
            <p className="font-mono text-[11px] text-[#6C4DF6]">dgorodrigues@hotmail.com</p>
            <p className="font-mono text-[11px]">
              Senha: <span className="font-bold text-[#1A1D2E]">Skip@Pass</span>
            </p>
          </div>

          <p className="mt-8 text-center text-sm text-[#5A6172]">
            Ainda não tem conta?{' '}
            <Link to="/signup" className="font-semibold text-[#6C4DF6] hover:underline">
              Criar conta gratuita
            </Link>
          </p>
        </div>
      </div>

      {/* Painel Ilustrativo à Direita (Desktop) */}
      <div className="hidden lg:flex lg:col-span-7 bg-gradient-to-br from-[#1A1D2E] via-[#2A1F52] to-[#143B39] text-white p-12 items-center justify-center relative overflow-hidden">
        {/* Círculos decorativos de fundo */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#6C4DF6]/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#00C4A7]/20 blur-3xl" />

        <div className="relative z-10 max-w-lg space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium text-emerald-300">
            <Sparkles className="w-3.5 h-3.5" />
            Quiz automatizado por Inteligência Artificial
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
            Transforme seus documentos em{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8E6FFF] to-[#00C4A7]">
              conhecimento interativo
            </span>
            .
          </h2>

          <p className="text-slate-300 text-base leading-relaxed">
            Faça upload de suas apresentações do PowerPoint (.pptx) ou planilhas do Excel (.xlsx). A
            IA lê, estrutura dados e gera perguntas de múltipla escolha e dissertativas
            instantaneamente.
          </p>

          {/* Cards ilustrativos simulando o app */}
          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-3 transform -rotate-1 hover:rotate-0 transition-transform">
              <div className="w-10 h-10 rounded-xl bg-purple-500/30 flex items-center justify-center text-purple-300">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-white">apresentacao_vendas_2025.pptx</p>
                <p className="text-[11px] text-slate-400">
                  10 perguntas de múltipla escolha + 3 abertas geradas
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-[#00C4A7]" />
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center gap-3 transform rotate-1 hover:rotate-0 transition-transform">
              <div className="w-10 h-10 rounded-xl bg-teal-500/30 flex items-center justify-center text-teal-300">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-white">orcamento_financeiro_q1.xlsx</p>
                <p className="text-[11px] text-slate-400">
                  Feedback pedagógico imediato com pontuação em tempo real
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-[#00C4A7]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
