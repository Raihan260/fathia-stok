import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Navigasi from './components/Navigasi'
import { useAuth } from './store/auth'
import { buatSesi, useToko } from './store/toko'
import { konfigurasiHilang } from './lib/supabase'
import { ambilTempat, pesanGalat } from './lib/api'
import type { Tempat } from './lib/types'
import { labelTempat } from './lib/types'
import Login from './pages/Login'
import PilihToko from './pages/PilihToko'
import Cari from './pages/Cari'
import Jual from './pages/Jual'
import Ambil from './pages/Ambil'
import Nota, { NotaDetail } from './pages/Nota'
import RiwayatStok from './pages/RiwayatStok'
import Kelola from './pages/Kelola'
import Opname from './pages/Opname'
import { Galat, Spinner } from './components/ui'

export default function App() {
  const { session, role, siap, pasangListener, muatRole, keluar } = useAuth()
  const { tokoId, sesi, pilihToko, pasangSesi, lupakanToko } = useToko()

  const [tempat, setTempat] = useState<Tempat[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => pasangListener(), [pasangListener])

  useEffect(() => {
    void muatRole()
  }, [session?.user.id, muatRole])

  // Daftar tempat hanya bisa dibaca setelah login (RLS), jadi dimuat di sini.
  useEffect(() => {
    if (!session) {
      setTempat(null)
      return
    }
    ambilTempat()
      .then((t) => {
        setTempat(t)
        setGalat(null)
      })
      .catch((e) => setGalat(pesanGalat(e)))
  }, [session?.user.id])

  // Cocokkan id yang tersimpan di perangkat dengan daftar yang baru dimuat.
  // Kalau tokonya sudah tidak ada, pilihan lama dibuang.
  useEffect(() => {
    if (!tempat) return
    pasangSesi(buatSesi(tempat.find((t) => t.id === tokoId) ?? null, tempat))
  }, [tempat, tokoId, pasangSesi])

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

  if (!tempat) return <Spinner teks="Memuat toko…" />

  // Belum memilih toko — tidak ada halaman kerja yang boleh terbuka dulu.
  if (!sesi) {
    return (
      <PilihToko
        tempat={tempat}
        email={session.user.email}
        onPilih={(t) => pilihToko(t, tempat)}
        onKeluar={() => void keluarPenuh()}
      />
    )
  }

  const admin = role === 'admin'
  const namaToko = labelTempat(sesi.toko, sesi.tokoSekategori)

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
            <span className="truncate text-sm font-semibold">{namaToko}</span>
            <span className="ml-auto shrink-0 text-xs text-stone-400">
              {admin ? 'Admin' : 'Staf'}
            </span>
          </div>
        </header>

        <main className="px-4 py-3">
          <Routes>
            <Route path="/" element={<Cari />} />
            <Route path="/jual" element={<Jual />} />
            <Route path="/ambil" element={<Ambil />} />
            <Route path="/nota" element={<Nota />} />
            <Route path="/nota/:id" element={<NotaDetail />} />
            <Route path="/opname" element={<Opname />} />
            <Route
              path="/kelola"
              element={admin ? <Kelola /> : <Navigate to="/" replace />}
            />
            <Route
              path="/riwayat"
              element={admin ? <RiwayatStok /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <Navigasi
          admin={admin}
          namaToko={namaToko}
          onKeluar={() => void keluarPenuh()}
        />
      </div>
    </BrowserRouter>
  )
}

