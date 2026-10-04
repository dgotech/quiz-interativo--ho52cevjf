import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { quizService } from '@/services/quizService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Camera,
  Check,
  Lock,
  Mail,
  AlertTriangle,
  Loader2,
  FileQuestion,
  Trophy,
} from 'lucide-react'

export default function Profile() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estados de Nome
  const [name, setName] = useState(user?.name || '')
  const [savingName, setSavingName] = useState(false)

  // Estados de Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Estatísticas do usuário
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    quizzesConcluidos: 0,
    mediaAcertos: 0,
  })

  // Modal Alterar E-mail
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [confirmNewEmail, setConfirmNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')

  // Formulário Alterar Senha
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Modal Excluir Conta (Danger Zone)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  useEffect(() => {
    if (user?.name) {
      setName(user.name)
    }
  }, [user])

  useEffect(() => {
    quizService.getEstatisticas().then(setStats).catch(console.error)
  }, [])

  const avatarUrl = user ? quizService.getAvatarUrl(user) : null
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  // 1. Salvar Nome
  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !name.trim()) return

    setSavingName(true)
    try {
      await pb.collection('users').update(user.id, { name: name.trim() })
      await refreshUser()
      toast({
        title: 'Nome atualizado!',
        description: 'Seu nome foi alterado com sucesso.',
      })
    } catch (err) {
      console.error('Erro ao atualizar nome:', err)
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a alteração de nome.',
        variant: 'destructive',
      })
    } finally {
      setSavingName(false)
    }
  }

  // 2. Upload de Avatar
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files || !e.target.files[0]) return
    const file = e.target.files[0]

    const formData = new FormData()
    formData.append('avatar', file)

    setUploadingAvatar(true)
    try {
      await pb.collection('users').update(user.id, formData)
      await refreshUser()
      toast({
        title: 'Foto de perfil atualizada!',
      })
    } catch (err) {
      console.error('Erro ao atualizar avatar:', err)
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar a foto.',
        variant: 'destructive',
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  // 3. Alterar E-mail
  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')

    if (!newEmail || !confirmNewEmail) {
      setEmailError('Preencha os dois campos de e-mail.')
      return
    }

    if (newEmail !== confirmNewEmail) {
      setEmailError('Os novos e-mails digitados não coincidem.')
      return
    }

    setSavingEmail(true)
    try {
      await pb.collection('users').requestEmailChange(newEmail)
      setShowEmailModal(false)
      toast({
        title: 'Verifique seu novo e-mail',
        description: `Enviamos uma confirmação para ${newEmail}. Você será desconectado para segurança.`,
      })
      logout()
      navigate('/login')
    } catch (err: unknown) {
      console.error('Erro ao requisitar mudança de e-mail:', err)
      const msg =
        (err as { message?: string })?.message || 'Falha ao solicitar alteração de e-mail.'
      setEmailError(msg)
    } finally {
      setSavingEmail(false)
    }
  }

  // 4. Alterar Senha
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Todos os campos são obrigatórios.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('A nova senha e confirmação não coincidem.')
      return
    }

    if (!user) return

    setSavingPassword(true)
    try {
      await pb.collection('users').update(user.id, {
        oldPassword,
        password: newPassword,
        passwordConfirm: confirmNewPassword,
      })

      setOldPassword('')
      setNewPassword('')
      setConfirmNewPassword('')

      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Sua credencial de acesso foi atualizada.',
      })
    } catch (err: unknown) {
      console.error('Erro ao mudar senha:', err)
      const msg = (err as { message?: string })?.message || 'Senha atual incorreta ou inválida.'
      setPasswordError(msg)
    } finally {
      setSavingPassword(false)
    }
  }

  // 5. Excluir Conta (Danger Zone)
  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmationText !== 'EXCLUIR') return

    setIsDeletingAccount(true)
    try {
      await pb.collection('users').delete(user.id)
      toast({
        title: 'Conta excluída',
        description: 'Sua conta e todos os dados foram apagados permanentemente.',
      })
      logout()
      navigate('/login')
    } catch (err) {
      console.error('Erro ao excluir conta:', err)
      toast({
        title: 'Erro ao excluir conta',
        description: 'Não foi possível completar a exclusão.',
        variant: 'destructive',
      })
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-16">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1A1D2E] tracking-tight">
          Meu Perfil
        </h1>
        <p className="text-sm text-[#5A6172] mt-0.5">
          Gerencie suas informações pessoais, segurança e acompanhe suas estatísticas de
          aprendizado.
        </p>
      </div>

      {/* Estatísticas do Usuário */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E8F0] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#6C4DF6] flex items-center justify-center shrink-0">
            <FileQuestion className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-[#1A1D2E]">{stats.totalQuizzes}</span>
            <p className="text-xs text-[#5A6172]">Quizzes criados no total</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E8F0] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-[#1A1D2E]">{stats.mediaAcertos}%</span>
            <p className="text-xs text-[#5A6172]">Aproveitamento médio geral</p>
          </div>
        </div>
      </div>

      {/* Card Dados Pessoais (Avatar & Nome & E-mail) */}
      <div className="bg-white rounded-3xl border border-[#E5E8F0] p-6 sm:p-8 shadow-sm space-y-6">
        <h2 className="text-lg font-bold text-[#1A1D2E] border-b border-[#E5E8F0] pb-3">
          Dados Pessoais
        </h2>

        {/* Foto de Perfil */}
        <div className="flex items-center gap-6">
          <div
            className="relative group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              className="hidden"
            />
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.name || 'Avatar'}
                className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-[#6C4DF6]/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#6C4DF6] to-[#00C4A7] flex items-center justify-center font-bold text-2xl text-white shadow-md">
                {initials}
              </div>
            )}

            {/* Ícone de câmera sobreposto */}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>

            {uploadingAvatar && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-sm text-[#1A1D2E]">Foto de perfil</h3>
            <p className="text-xs text-[#5A6172] mt-0.5">
              Clique sobre o avatar para escolher uma nova imagem JPG ou PNG.
            </p>
          </div>
        </div>

        {/* Formulário de Nome */}
        <form onSubmit={handleSaveName} className="space-y-3 pt-2">
          <Label
            htmlFor="name"
            className="text-xs font-semibold uppercase tracking-wider text-[#5A6172]"
          >
            Nome Completo
          </Label>
          <div className="flex gap-3">
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl bg-[#FDFDFF] border-[#D1D5DB]"
            />
            <Button
              type="submit"
              disabled={savingName || name === user?.name}
              className="h-11 px-5 rounded-xl font-semibold bg-[#6C4DF6] text-white hover:bg-[#5A3DDE]"
            >
              {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar alterações'}
            </Button>
          </div>
        </form>

        {/* E-mail (Apenas Leitura + Botão Alterar) */}
        <div className="pt-2 space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-[#5A6172]">
            Endereço de E-mail
          </Label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center h-11 px-3.5 rounded-xl bg-slate-50 border border-[#D1D5DB] text-sm text-[#1A1D2E] font-medium">
              <Mail className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <span className="truncate">{user?.email}</span>
            </div>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setNewEmail('')
                setConfirmNewEmail('')
                setEmailError('')
                setShowEmailModal(true)
              }}
              className="h-11 rounded-xl border-[#6C4DF6] text-[#6C4DF6] hover:bg-[#6C4DF6]/10 font-semibold text-xs"
            >
              Alterar e-mail
            </Button>
          </div>
        </div>
      </div>

      {/* Card Alterar Senha */}
      <div className="bg-white rounded-3xl border border-[#E5E8F0] p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-[#E5E8F0] pb-3">
          <Lock className="w-5 h-5 text-[#6C4DF6]" />
          <h2 className="text-lg font-bold text-[#1A1D2E]">Segurança da Conta</h2>
        </div>

        {passwordError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">
            {passwordError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="oldPassword"
              className="text-xs font-semibold uppercase tracking-wider text-[#5A6172]"
            >
              Senha atual
            </Label>
            <Input
              id="oldPassword"
              type="password"
              placeholder="••••••••"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="h-11 rounded-xl bg-[#FDFDFF] border-[#D1D5DB]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="newPassword"
                className="text-xs font-semibold uppercase tracking-wider text-[#5A6172]"
              >
                Nova senha (mínimo 8 caracteres)
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11 rounded-xl bg-[#FDFDFF] border-[#D1D5DB]"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="confirmNewPassword"
                className="text-xs font-semibold uppercase tracking-wider text-[#5A6172]"
              >
                Confirmar nova senha
              </Label>
              <Input
                id="confirmNewPassword"
                type="password"
                placeholder="••••••••"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="h-11 rounded-xl bg-[#FDFDFF] border-[#D1D5DB]"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={savingPassword}
              className="h-11 px-6 rounded-xl font-semibold bg-[#1A1D2E] text-white hover:bg-slate-800"
            >
              {savingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                'Alterar senha'
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Danger Zone: Excluir Conta */}
      <div className="rounded-3xl border border-red-200 bg-red-50/50 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-bold text-red-700">Zona de Perigo</h2>
        </div>

        <p className="text-xs text-red-600 leading-relaxed">
          Ao excluir sua conta, todos os seus quizzes, perguntas, materiais e pontuações serão
          apagados permanentemente. Esta ação não pode ser desfeita.
        </p>

        <Button
          variant="destructive"
          onClick={() => {
            setDeleteConfirmationText('')
            setShowDeleteModal(true)
          }}
          className="rounded-xl font-semibold bg-[#E74C3C] hover:bg-red-700 text-white text-xs h-10 px-5"
        >
          Excluir minha conta
        </Button>
      </div>

      {/* Modal Alterar E-mail */}
      <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1A1D2E]">
              Alterar endereço de e-mail
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5A6172]">
              Seu e-mail atual é <strong>{user?.email}</strong>. Enviamos uma mensagem de
              confirmação para o novo endereço.
            </DialogDescription>
          </DialogHeader>

          {emailError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">
              {emailError}
            </div>
          )}

          <form onSubmit={handleRequestEmailChange} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="newEmail" className="text-xs font-semibold uppercase text-[#5A6172]">
                Novo e-mail
              </Label>
              <Input
                id="newEmail"
                type="email"
                placeholder="novo.email@exemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="confirmNewEmail"
                className="text-xs font-semibold uppercase text-[#5A6172]"
              >
                Confirmar novo e-mail
              </Label>
              <Input
                id="confirmNewEmail"
                type="email"
                placeholder="novo.email@exemplo.com"
                value={confirmNewEmail}
                onChange={(e) => setConfirmNewEmail(e.target.value)}
                required
                className="h-10 rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEmailModal(false)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingEmail}
                className="rounded-xl font-semibold bg-[#6C4DF6] text-white hover:bg-[#5A3DDE]"
              >
                {savingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Confirmar alteração'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão de Conta */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Excluir conta definitivamente?
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5A6172] pt-2">
              Para confirmar que você compreende a perda permanente de todos os seus quizzes e
              dados, digite <strong className="text-red-600">EXCLUIR</strong> no campo abaixo:
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Input
              type="text"
              placeholder="Digite EXCLUIR"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="h-11 rounded-xl text-center font-bold tracking-wider"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmationText !== 'EXCLUIR' || isDeletingAccount}
              className="rounded-xl bg-[#E74C3C] font-semibold text-white"
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir permanentemente'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
