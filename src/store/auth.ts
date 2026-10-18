import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ambilRole } from '../lib/api'
import type { Role } from '../lib/types'

interface AuthState {
  session: Session | null
  /** null = belum diketahui. Jangan render menu admin selama masih null. */
  role: Role | null
  siap: boolean
  masuk: (email: string, sandi: string) => Promise<void>
  keluar: () => Promise<void>
  muatRole: () => Promise<void>
  pasangListener: () => () => void
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  role: null,
  siap: false,

  masuk: async (email, sandi) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: sandi })
    if (error) throw error
  },

  keluar: async () => {
    await supabase.auth.signOut()
    set({ session: null, role: null })
  },

  /**
   * Dipanggil dari App lewat useEffect, bukan dari dalam onAuthStateChange:
   * memanggil supabase di dalam callback itu bisa membuat klien saling tunggu.
   */
  muatRole: async () => {
    const uid = get().session?.user.id
    if (!uid) {
      set({ role: null })
      return
    }
    set({ role: await ambilRole(uid) })
  },

  pasangListener: () => {
    supabase.auth.getSession().then(({ data }) => set({ session: data.session, siap: true }))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Role hanya dikosongkan kalau usernya memang berganti. Token yang
      // di-refresh otomatis tiap jam tidak boleh memicu spinner.
      const gantiUser = get().session?.user.id !== session?.user.id
      set({ session, siap: true, ...(gantiUser ? { role: null } : {}) })
    })
    return () => data.subscription.unsubscribe()
  },
}))
