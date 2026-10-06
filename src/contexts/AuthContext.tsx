import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { UserRecord } from '@/types/quiz'

interface AuthContextType {
  user: UserRecord | null
  loading: boolean
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserRecord | null>(() => {
    return (pb.authStore.model as unknown as UserRecord) || null
  })
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      if (pb.authStore.isValid && pb.authStore.model) {
        const authData = await pb.collection('users').authRefresh()
        setUser((authData.record as unknown as UserRecord) || null)
      } else {
        setUser(null)
      }
    } catch (err: unknown) {
      const status =
        (err as { status?: number })?.status ||
        (err as { response?: { status?: number } })?.response?.status
      // Apenas deslogar e limpar authStore se o backend respondeu explicitamente 401/403
      if (status === 401 || status === 403) {
        setUser(null)
        pb.authStore.clear()
      } else {
        // Falha transitória de rede ou 5xx: manter o usuário já carregado do authStore local
        console.warn(
          'Não foi possível atualizar os dados do usuário no momento (erro de rede/temporário):',
          err,
        )
      }
    }
  }

  useEffect(() => {
    const unsub = pb.authStore.onChange((token, model) => {
      setUser((model as unknown as UserRecord) || null)
    })

    // Validar token no boot
    if (pb.authStore.isValid) {
      refreshUser().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }

    return () => {
      unsub()
    }
  }, [])

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
