import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import type { Profile } from '../types'

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadUser() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!mounted) return
        setUser(authUser)

        if (authUser) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single()

          if (mounted) {
            if (profileError) {
              console.error('Error loading profile:', profileError)
            } else {
              setProfile(profileData)
            }
          }
        }
      } catch (err) {
        if (mounted) setError(getErrorMessage(err))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadUser()

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return
          void event
          setUser(session?.user ?? null)
        if (session?.user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          if (mounted) setProfile(profileData ?? null)
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const hasPermission = (permission: string): boolean => {
    if (!profile?.role?.permissions) return false
    return (profile.role as any).permissions?.includes(permission) ?? false
  }

  return { user, profile, loading, error, signOut, hasPermission }
}

function getErrorMessage(err: any): string {
  if (err?.message) return err.message
  return 'حدث خطأ'
}