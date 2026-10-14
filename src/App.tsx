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
  const { session, siap, pasangListener, keluar } = useAuth()

  useEffect(() => pasangListener(), [pasangListener])

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

  return (
    <BrowserRouter>
      <div className="mx-auto min-h-screen max-w-2xl pb-24">
        <main className="px-4 py-3">
          <Routes>
            <Route path="/" element={<Cari />} />
            <Route path="/kelola" element={<Kelola />} />
            <Route path="/opname" element={<Opname />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <nav className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl pb-[env(safe-area-inset-bottom)]">
            <Tab ke="/" label="Cari" />
            <Tab ke="/kelola" label="Kelola" />
            <Tab ke="/opname" label="Opname" />
            <button
              onClick={() => void keluar()}
              className="flex-1 py-3 text-xs font-medium text-stone-400 hover:text-stone-600"
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
