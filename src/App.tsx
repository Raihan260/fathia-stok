import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from './store/auth'
import { useToko } from './store/toko'
import { konfigurasiHilang } from './lib/supabase'
import { ambilKategori, pesanGalat } from './lib/api'
import type { Kategori } from './lib/types'
import Login from './pages/Login'
import PilihToko from './pages/PilihToko'
import Cari from './pages/Cari'
import Kelola from './pages/Kelola'
import Opname from './pages/Opname'
import { Galat, Spinner } from './components/ui'

export default function App() {
  const { session, role, siap, pasangListener, muatRole, keluar } = useAuth()
  const { tokoId, toko, pilihToko, pasangToko, lupakanToko } = useToko()

  const [kategori, setKategori] = useState<Kategori[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => pasangListener(), [pasangListener])

  useEffect(() => {
    void muatRole()
  }, [session?.user.id, muatRole])

  // Daftar kategori hanya bisa dibaca setelah login (RLS), jadi dimuat di sini.
  useEffect(() => {
    if (!session) {
      setKategori(null)
      return
    }
    ambilKategori()
      .then((k) => {
        setKategori(k)
        setGalat(null)
      })
      .catch((e) => setGalat(pesanGalat(e)))
  }, [session?.user.id])

  // Cocokkan id yang tersimpan di perangkat dengan daftar yang baru dimuat.
  // Kalau kategorinya sudah tidak ada, pilihan lama dibuang.
  useEffect(() => {
    if (!kategori) return
    pasangToko(kategori.find((k) => k.id === tokoId) ?? null)
  }, [kategori, tokoId, pasangToko])

  async function keluarPenuh() {
    lupakanToko()
    await keluar()
  }

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
  if (!role) return <Spinner teks="Menyiapkan…" />

  if (galat) {
    return (
      <div className="p-5">
        <Galat pesan={galat} />
      </div>
    )
  }

  if (!kategori) return <Spinner teks="Memuat toko…" />

  // Belum memilih toko — tidak ada halaman kerja yang boleh terbuka dulu.
  if (!toko) {
    return (
      <PilihToko
        kategori={kategori}
        email={session.user.email}
        onPilih={pilihToko}
        onKeluar={() => void keluarPenuh()}
      />
    )
  }

  const admin = role === 'admin'

  return (
    <BrowserRouter>
      <div className="mx-auto min-h-screen max-w-2xl pb-24">
        {/*
          Nama toko tetap terlihat di mana pun halamannya. Ini pengaman
          utamanya: salah toko jadi kelihatan sebelum sempat salah input.
        */}
        <header className="sticky top-0 z-20 h-11 border-b border-stone-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-full max-w-2xl items-center gap-2 px-4">
            <span className="h-2 w-2 shrink-0 rounded-full bg-pink-600" />
            <span className="truncate text-sm font-semibold">{toko.nama}</span>
            <span className="ml-auto shrink-0 text-xs text-stone-400">
              {admin ? 'Admin' : 'Staf'}
            </span>
          </div>
        </header>

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
                if (confirm('Keluar dari akun ini?')) void keluarPenuh()
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
