import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { api } from '../services/api'
import { supabase } from '../services/supabase'
import type { Profile } from '../types'

export const PERMISSIONS = [
  'receipt.create',
  'receipt.view',
  'delivery.create',
  'delivery.view',
  'stock.view',
  'resources.manage',
  'categories.manage',
  'users.manage',
  'reports.view',
  'audit.view',
  'movement.cancel',
  'settings.manage',
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'receipt.create': 'استلام الموارد',
  'receipt.view': 'عرض الاستلام',
  'delivery.create': 'تسليم الموارد',
  'delivery.view': 'عرض التسليم',
  'stock.view': 'عرض المخزون',
  'resources.manage': 'إدارة التصنيفات والموارد',
  'categories.manage': 'إدارة التصنيفات',
  'users.manage': 'إدارة المستخدمين والصلاحيات',
  'reports.view': 'التقارير',
  'audit.view': 'سجل التدقيق',
  'movement.cancel': 'تصحيح أو إلغاء الحركات',
  'settings.manage': 'إعدادات النظام',
}

export const ROLES = [
  { key: 'admin', label: 'مدير النظام' },
  { key: 'keeper', label: 'أمين المستودع' },
  { key: 'receiver', label: 'موظف استلام' },
  { key: 'deliverer', label: 'موظف تسليم' },
  { key: 'approver', label: 'معتمد العمليات' },
  { key: 'viewer', label: 'قراءة وتقارير فقط' },
] as const

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  can: (permission: PermissionKey | string) => boolean
  canAny: (...perms: PermissionKey[]) => boolean
}

const AuthContext = createContext<AuthState | undefined>(undefined)

const SPLASH_KEY = 'gov_wh_splash_seen'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      if (data.session?.user) {
        const res = await api.auth.me()
        setProfile(res.data)
      }
      setLoading(false)
    }
    init()

    const { data: sub } = api.auth.onAuthChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        const res = await api.auth.me()
        setProfile(res.data)
      } else {
        setProfile(null)
      }
    })
    return () => sub?.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    try {
      sessionStorage.setItem(SPLASH_KEY, '1')
    } catch {
      /* ignore */
    }
    await api.auth.logout()
    setSession(null)
    setProfile(null)
  }

  const permissions = (profile?.role?.permissions ?? []) as string[]
  const can = (permission: string) => {
    if (!permissions.length) return false
    if (permissions.includes('*')) return true
    return permissions.includes(permission)
  }
  const canAny = (...perms: string[]) => perms.some((p) => can(p))

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut, can, canAny }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function getSplashSeen(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_KEY) === '1'
  } catch {
    return false
  }
}

export function setSplashSeen(): void {
  try {
    sessionStorage.setItem(SPLASH_KEY, '1')
  } catch {
    /* ignore */
  }
}