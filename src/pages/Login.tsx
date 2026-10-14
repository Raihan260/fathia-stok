import { useState } from 'react'
import { useAuth } from '../store/auth'
import { Galat } from '../components/ui'

export default function Login() {
  const masuk = useAuth((s) => s.masuk)
  const [email, setEmail] = useState('')
  const [sandi, setSandi] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    setGalat(null)
    setSibuk(true)
    try {
      await masuk(email, sandi)
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal masuk. Cek email dan sandi.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={kirim} className="w-full max-w-sm space-y-4">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-700 text-lg font-bold text-white">
            FK
          </div>
          <h1 className="text-xl font-semibold">Fathia Stok</h1>
          <p className="mt-1 text-sm text-stone-500">Cek harga &amp; status stok</p>
        </div>

        {galat && <Galat pesan={galat} />}

        <input
          type="email"
          required
          autoComplete="username"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-4 py-3 outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-100"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Kata sandi"
          value={sandi}
          onChange={(e) => setSandi(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-4 py-3 outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-100"
        />
        <button
          type="submit"
          disabled={sibuk}
          className="w-full rounded-lg bg-pink-700 py-3 font-semibold text-white transition hover:bg-pink-800 disabled:opacity-60"
        >
          {sibuk ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}
