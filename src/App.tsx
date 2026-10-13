/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from '@/components/ProtectedRoute'
import Layout from './components/Layout'

// Páginas Públicas de Autenticação
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import ConfirmEmailChange from './pages/ConfirmEmailChange'

// Páginas Autenticadas
import Index from './pages/Index'
import Quizzes from './pages/Quizzes'
import NewQuiz from './pages/NewQuiz'
import QuizView from './pages/QuizView'
import QuizPlay from './pages/QuizPlay'
import PublicQuizPlay from './pages/PublicQuizPlay'
import CompeticaoHost from './pages/CompeticaoHost'
import CompeticaoPlayer from './pages/CompeticaoPlayer'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rotas Públicas */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <Signup />
              </PublicOnlyRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />

          {/* Rota Pública do Quiz Compartilhável por Link (Sem necessidade de login) */}
          <Route path="/p/:token" element={<PublicQuizPlay />} />

          {/* Rota Pública do Jogador no Modo Competição (estilo Mentimeter) */}
          <Route path="/competir/:codigo" element={<CompeticaoPlayer />} />

          {/* Rota do Host / Projetor do Modo Competição */}
          <Route
            path="/competicao/:id/host"
            element={
              <ProtectedRoute>
                <CompeticaoHost />
              </ProtectedRoute>
            }
          />

          {/* Rota Especial do Jogo (Ocupa toda a tela, sem sidebar) */}
          <Route
            path="/quiz/:id/play"
            element={
              <ProtectedRoute>
                <QuizPlay />
              </ProtectedRoute>
            }
          />

          {/* Rotas Protegidas com Layout Global (Sidebar Desktop + Topbar Mobile) */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Index />} />
            <Route path="/quizzes" element={<Quizzes />} />
            <Route path="/new" element={<NewQuiz />} />
            <Route path="/quiz/:id" element={<QuizView />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Rota 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
