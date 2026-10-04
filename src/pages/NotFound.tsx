import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { HelpCircle, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F7F8FC] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-[#6C4DF6]/10 text-[#6C4DF6] flex items-center justify-center mb-6">
        <HelpCircle className="w-10 h-10" />
      </div>

      <h1 className="text-4xl font-black text-[#1A1D2E] tracking-tight">404</h1>
      <h2 className="text-xl font-bold text-[#1A1D2E] mt-2">Página não encontrada</h2>
      <p className="text-sm text-[#5A6172] max-w-sm mt-1 mb-6">
        O link que você tentou acessar não existe ou foi movido.
      </p>

      <Link to="/">
        <Button className="h-11 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-[#6C4DF6] to-[#00C4A7]">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Início
        </Button>
      </Link>
    </div>
  )
}
