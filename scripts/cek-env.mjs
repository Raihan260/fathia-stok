/*
 * Penjaga build.
 *
 * Vite menempelkan nilai VITE_* langsung ke dalam berkas hasil build. Kalau
 * nilainya kosong saat build berjalan, kode yang memakainya dianggap tidak
 * terpakai dan ikut dibuang — hasilnya berkas yang "sukses" dibangun tapi
 * isinya cuma layar peringatan, tanpa satu pun pesan error di log.
 *
 * Itu bukan kemungkinan teoretis: sudah pernah terjadi di sini. Build pertama
 * lewat GitHub berhasil, Netlify melaporkan "ready", dan yang tersaji di toko
 * adalah layar "Konfigurasi Supabase belum diisi".
 *
 * Jadi build sengaja dibuat gagal di sini kalau nilainya belum lengkap. Lebih
 * baik berhenti sekarang daripada menimpa situs yang sedang dipakai.
 */
import { loadEnv } from 'vite'

const WAJIB = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

// loadEnv membaca berkas .env (untuk build di komputer sendiri) sekaligus
// process.env (untuk build di Netlify), jadi satu pemeriksaan cukup.
const env = loadEnv('production', process.cwd(), 'VITE_')

const kosong = WAJIB.filter((k) => !env[k] || env[k].trim() === '')

if (kosong.length > 0) {
  console.error('')
  console.error('  BUILD DIHENTIKAN — konfigurasi belum lengkap.')
  console.error('')
  console.error('  Nilai yang belum ada: ' + kosong.join(', '))
  console.error('')
  console.error('  Di komputer sendiri : salin .env.example jadi .env, lalu isi nilainya.')
  console.error('  Di Netlify          : nilainya ada di netlify.toml -> [build.environment].')
  console.error('')
  process.exit(1)
}

console.log('Konfigurasi lengkap (' + WAJIB.join(', ') + ') — build dilanjutkan.')
