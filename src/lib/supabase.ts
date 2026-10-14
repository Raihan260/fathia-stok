import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const konfigurasiHilang = !url || !key

if (konfigurasiHilang) {
  // Jangan crash ke layar putih — App.tsx menampilkan banner peringatan.
  console.error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi. Salin .env.example jadi .env.',
  )
}

export const supabase = createClient(url ?? 'http://localhost', key ?? 'anon', {
  auth: { persistSession: true, autoRefreshToken: true },
})
