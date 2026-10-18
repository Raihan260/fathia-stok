import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

/**
 * Menu bawah: empat sasaran saja, sesuai seberapa sering dipakai.
 *
 * Sebelumnya enam tombol berjejer — Cari, Jual, Ambil, Opname, Kelola, Keluar.
 * Dua masalah di situ. "Keluar" bukan tujuan melainkan aksi, tapi dapat porsi
 * yang sama dengan halaman yang dibuka puluhan kali sehari. Dan yang dipakai
 * seminggu sekali (Opname, Kelola) makan lebar yang sama dengan yang dipakai
 * terus-menerus. Enam sasaran di layar 375px berarti ~62px per tombol, di
 * bawah ukuran nyaman untuk jempol.
 *
 * Sekarang tiga pekerjaan harian jadi tab, sisanya masuk panel "Lainnya".
 */

const IKON_UKURAN = 'h-5 w-5'

function IkonCari() {
  return (
    <svg className={IKON_UKURAN} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function IkonJual() {
  return (
    <svg className={IKON_UKURAN} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16l-1.2 11a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8Z" />
      <path d="M9 7V5.5a3 3 0 0 1 6 0V7" />
    </svg>
  )
}

function IkonAmbil() {
  return (
    <svg className={IKON_UKURAN} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h18v12H3z" />
      <path d="M3 8l2-4h14l2 4" />
      <path d="M12 11v6" />
      <path d="m9 14 3 3 3-3" />
    </svg>
  )
}

function IkonLainnya() {
  return (
    <svg className={IKON_UKURAN} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

export default function Navigasi({
  admin,
  namaToko,
  onKeluar,
}: {
  admin: boolean
  namaToko: string
  onKeluar: () => void
}) {
  const [buka, setBuka] = useState(false)
  const lokasi = useLocation()
  const navigate = useNavigate()

  // Panel menutup sendiri setiap pindah halaman, supaya tidak menghalangi
  // halaman yang baru dibuka.
  useEffect(() => setBuka(false), [lokasi.pathname])

  // Halaman yang ada di dalam panel: tabnya ikut menyala supaya jelas posisi
  // sekarang di mana, walaupun bukan salah satu dari tiga tab utama.
  const diLainnya = ['/nota', '/opname', '/kelola'].some((p) =>
    lokasi.pathname.startsWith(p),
  )

  return (
    <>
      {buka && (
        <>
          <button
            aria-label="Tutup menu"
            onClick={() => setBuka(false)}
            className="fixed inset-0 z-30 bg-stone-900/20"
          />
          <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
            <div className="mx-auto max-w-2xl px-4 pb-[env(safe-area-inset-bottom)] pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />

              <nav className="space-y-1">
                <BarisPanel
                  label="Riwayat nota"
                  ket="Penjualan yang sudah tercatat"
                  onClick={() => navigate('/nota')}
                />
                <BarisPanel
                  label="Hitung fisik"
                  ket="Hitung ulang, tambah, atau kurangi stok"
                  onClick={() => navigate('/opname')}
                />
                {admin && (
                  <BarisPanel
                    label="Kelola produk"
                    ket="Tambah, ubah, dan arsip produk"
                    onClick={() => navigate('/kelola')}
                  />
                )}
              </nav>

              <div className="mt-3 flex items-center gap-3 border-t border-stone-200 pt-3">
                <span className="flex-1 truncate text-xs text-stone-500">
                  {namaToko} · {admin ? 'Admin' : 'Staf'}
                </span>
                <button
                  onClick={() => {
                    if (confirm('Keluar dari akun ini?')) onKeluar()
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-rose-700"
                >
                  Keluar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl pb-[env(safe-area-inset-bottom)]">
          <Tab ke="/" label="Cari" ikon={<IkonCari />} />
          <Tab ke="/jual" label="Jual" ikon={<IkonJual />} />
          <Tab ke="/ambil" label="Ambil" ikon={<IkonAmbil />} />
          <button
            onClick={() => setBuka((b) => !b)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
              buka || diLainnya ? 'text-pink-700' : 'text-stone-400'
            }`}
          >
            <IkonLainnya />
            Lainnya
          </button>
        </div>
      </nav>
    </>
  )
}

function Tab({ ke, label, ikon }: { ke: string; label: string; ikon: React.ReactNode }) {
  return (
    <NavLink
      to={ke}
      end={ke === '/'}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
          isActive ? 'text-pink-700' : 'text-stone-400'
        }`
      }
    >
      {ikon}
      {label}
    </NavLink>
  )
}

function BarisPanel({
  label,
  ket,
  onClick,
}: {
  label: string
  ket: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-stone-50"
    >
      <span className="flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-stone-500">{ket}</span>
      </span>
      <span className="text-stone-300">›</span>
    </button>
  )
}
