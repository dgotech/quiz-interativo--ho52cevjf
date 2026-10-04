import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { quizService } from '@/services/quizService'
import { Home, FileQuestion, PlusCircle, User, LogOut, Menu, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { label: 'Início', path: '/', icon: Home },
    { label: 'Meus Quizzes', path: '/quizzes', icon: FileQuestion },
    { label: 'Novo Quiz', path: '/new', icon: PlusCircle },
    { label: 'Perfil', path: '/profile', icon: User },
  ]

  const avatarUrl = user ? quizService.getAvatarUrl(user) : null
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  const closeDrawer = () => setMobileDrawerOpen(false)

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex flex-col lg:flex-row">
      {/* Topbar Mobile (visível apenas < 1024px) */}
      <header className="lg:hidden sticky top-0 z-40 bg-[#1A1D2E] text-white h-16 px-4 flex items-center justify-between border-b border-white/10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">
            QuizDoc <span className="text-[#00C4A7]">AI</span>
          </span>
        </div>

        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile Drawer (Overlay + Painel Lateral) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop blur/overlay */}
          <div
            className="fixed inset-0 bg-[#1A1D2E]/70 backdrop-blur-sm transition-opacity"
            onClick={closeDrawer}
          />

          <div className="relative w-72 max-w-full bg-[#1A1D2E] text-white flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {/* Header Drawer */}
            <div className="h-16 px-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-base tracking-tight">
                  QuizDoc <span className="text-[#00C4A7]">AI</span>
                </span>
              </div>
              <button
                onClick={closeDrawer}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Links Mobile */}
            <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={closeDrawer}
                    className={cn(
                      'flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all',
                      isActive
                        ? 'bg-[#6C4DF6] text-white shadow-md shadow-[#6C4DF6]/30'
                        : 'text-slate-300 hover:text-white hover:bg-white/5',
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>

            {/* Rodapé Drawer Mobile */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user?.name || 'Avatar'}
                    className="w-10 h-10 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center font-bold text-sm text-white">
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user?.name || 'Usuário'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  closeDrawer()
                  handleLogout()
                }}
                className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs font-semibold h-9 rounded-lg"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair da conta
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Desktop (Fixa 256px de largura) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-[#1A1D2E] text-white h-screen sticky top-0 border-r border-white/10 z-30">
        {/* Logotipo Topo */}
        <div className="h-20 px-6 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center shadow-lg shadow-[#6C4DF6]/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight block">
              QuizDoc <span className="text-[#00C4A7]">AI</span>
            </span>
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Estudo Inteligente
            </span>
          </div>
        </div>

        {/* Menu Principal */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all relative',
                  isActive
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-white/5',
                )}
              >
                {/* Indicador lateral da barra quando ativo */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-gradient-to-b from-[#6C4DF6] to-[#00C4A7] rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    'w-5 h-5 transition-transform duration-200',
                    isActive ? 'text-[#00C4A7]' : 'text-slate-400',
                  )}
                />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Rodapé Sidebar com Avatar e Botão Sair */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl bg-white/5 border border-white/5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.name || 'Avatar'}
                className="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center font-bold text-sm text-white shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'Usuário'}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Encerrar sessão</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal (Desktop: à direita da sidebar; Mobile: abaixo da topbar) */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
