import type { StatusStok } from '../lib/types'

/**
 * Warna status. Semua tampilan status mengambil dari sini — ganti di satu
 * tempat ini kalau mau palet lain.
 */
export const GAYA_STATUS: Record<StatusStok, { label: string; chip: string; aktif: string }> = {
  ada: {
    label: 'Ada',
    chip: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    aktif: 'bg-emerald-600 text-white ring-emerald-600',
  },
  menipis: {
    label: 'Menipis',
    chip: 'bg-amber-100 text-amber-900 ring-amber-200',
    aktif: 'bg-amber-500 text-white ring-amber-500',
  },
  habis: {
    label: 'Habis',
    chip: 'bg-rose-100 text-rose-800 ring-rose-200',
    aktif: 'bg-rose-600 text-white ring-rose-600',
  },
}

export function StatusChip({ status, prefix }: { status: StatusStok; prefix?: string }) {
  const g = GAYA_STATUS[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${g.chip}`}>
      {prefix ? `${prefix} ${g.label}` : g.label}
    </span>
  )
}

/** Titik warna — dibaca sekilas tanpa perlu membaca angkanya. */
export function TitikStatus({ status }: { status: StatusStok }) {
  const warna =
    status === 'ada' ? 'bg-emerald-500' : status === 'menipis' ? 'bg-amber-500' : 'bg-rose-500'
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${warna}`} />
}

export function Spinner({ teks = 'Memuat…' }: { teks?: string }) {
  return <p className="py-8 text-center text-sm text-stone-400">{teks}</p>
}

export function Kosong({ teks }: { teks: string }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white/50 px-4 py-10 text-center text-sm text-stone-500">
      {teks}
    </div>
  )
}

export function Galat({ pesan }: { pesan: string }) {
  return (
    <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
      {pesan}
    </div>
  )
}
