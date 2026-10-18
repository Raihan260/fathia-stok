import { useEffect } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from './store/auth'
import { konfigurasiHilang } from './lib/supabase'
import Login from './pages/Login'
import Cari from './pages/Cari'
import Kelola from './pages/Kelola'
import Opname from './pages/Opname'
import { Spinner } from './components/ui'

export default function App() {
  const { session, role, siap, pasangListener, muatRole, keluar } = useAuth()

  useEffect(() => pasangListener(), [pasangListener])

  // Dipanggil di sini, bukan di dalam listener auth — lihat catatan di store.
  useEffect(() => {
    void muatRole()
  }, [session?.user.id, muatRole])

  if (konfigurasiHilang) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm rounded-xl bg-amber-50 p-5 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="mb-1 font-semibold">Konfigurasi Supabase belum diisi</p>
          <p>
            Salin <code className="font-mono">.env.example</code> menjadi{' '}
            <code className="font-mono">.env</code>, isi URL dan anon key project
            fathia-stok, lalu jalankan ulang.
          </p>
        </div>
      </div>
    )
  }

  if (!siap) return <Spinner />
  if (!session) return <Login />
  // Tunggu role diketahui supaya menu admin tidak sempat berkedip untuk staf.
  if (!role) return <Spinner teks="Menyiapkan…" />

  const admin = role === 'admin'

  return (
    <BrowserRouter>
      <div className="mx-auto min-h-screen max-w-2xl pb-24">
        <main className="px-4 py-3">
          <Routes>
            <Route path="/" element={<Cari />} />
            <Route path="/opname" element={<Opname />} />
            <Route
              path="/kelola"
              element={admin ? <Kelola /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <nav className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl pb-[env(safe-area-inset-bottom)]">
            <Tab ke="/" label="Cari" />
            <Tab ke="/opname" label="Opname" />
            {admin && <Tab ke="/kelola" label="Kelola" />}
            {/*
              Dipersempit dan dipisah garis supaya tidak lagi selebar tab —
              tombol keluar selebar tab terlalu gampang kepencet. Konfirmasi
              jadi pengaman keduanya.
            */}
            <button
              onClick={() => {
                if (confirm('Keluar dari akun ini?')) void keluar()
              }}
              className="w-16 shrink-0 border-l border-stone-200 py-3 text-xs font-medium text-stone-400 hover:text-stone-600"
            >
              Keluar
            </button>
          </div>
        </nav>
      </div>
    </BrowserRouter>
  )
}

function Tab({ ke, label }: { ke: string; label: string }) {
  return (
    <NavLink
      to={ke}
      end={ke === '/'}
      className={({ isActive }) =>
        `flex-1 py-3 text-center text-xs font-semibold ${
          isActive ? 'text-pink-700' : 'text-stone-400'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
