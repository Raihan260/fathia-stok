import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  session: Session | null
  siap: boolean
  masuk: (email: string, sandi: string) => Promise<void>
  keluar: () => Promise<void>
  pasangListener: () => () => void
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  siap: false,

  masuk: async (email, sandi) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: sandi })
    if (error) throw error
  },

  keluar: async () => {
    await supabase.auth.signOut()
    set({ session: null })
  },

  pasangListener: () => {
    supabase.auth.getSession().then(({ data }) => set({ session: data.session, siap: true }))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, siap: true })
    })
    return () => data.subscription.unsubscribe()
  },
}))
