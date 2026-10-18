import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ambilTransaksi, ambilTransaksiSatu, pesanGalat } from '../lib/api'
import { useToko } from '../store/toko'
import type { Transaksi } from '../lib/types'
import { jamSingkat, pcs, rupiah, tanggalPanjang } from '../lib/types'
import { Galat, Kosong, Spinner } from '../components/ui'

/** Daftar nota toko ini, terbaru dulu, dikelompokkan per tanggal. */
export default function Nota() {
  const toko = useToko((s) => s.toko)
  const [daftar, setDaftar] = useState<Transaksi[]>([])
  const [q, setQ] = useState('')
  const [sibuk, setSibuk] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (!toko) return
    setSibuk(true)
    ambilTransaksi(toko.id)
      .then((d) => {
        setDaftar(d)
        setGalat(null)
      })
      .catch((e) => setGalat(pesanGalat(e)))
      .finally(() => setSibuk(false))
  }, [toko?.id])

  const kueri = q.trim().toLowerCase()
  const tampil = kueri
    ? daftar.filter(
        (t) =>
          t.nomor.toLowerCase().includes(kueri) ||
          (t.pembeli ?? '').toLowerCase().includes(kueri),
      )
    : daftar

  // Dikelompokkan per tanggal supaya terbaca sebagai catatan harian, bukan
  // satu daftar panjang tanpa jeda.
  const perTanggal = new Map<string, Transaksi[]>()
  for (const t of tampil) {
    const k = t.tanggal
    perTanggal.set(k, [...(perTanggal.get(k) ?? []), t])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Riwayat nota</h1>
        <Link to="/jual" className="text-sm font-medium text-pink-700 hover:underline">
          ← Jual
        </Link>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Cari nomor nota atau nama pembeli…"
        className="w-full rounded-lg border border-stone-300 px-4 py-2.5 outline-none focus:border-pink-600"
      />

      {galat && <Galat pesan={galat} />}
      {sibuk ? (
        <Spinner />
      ) : tampil.length === 0 ? (
        <Kosong teks={kueri ? `Tidak ada nota yang cocok dengan "${q}".` : 'Belum ada nota.'} />
      ) : (
        <div className="space-y-5">
          {[...perTanggal.entries()].map(([tanggal, isi]) => (
            <section key={tanggal} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                {tanggalPanjang(tanggal)}
              </h2>
              <ul className="space-y-2">
                {isi.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/nota/${t.id}`}
                      className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50"
                    >
                      <span className="shrink-0 rounded bg-stone-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                        {t.nomor}
                      </span>
                      <span className="flex-1 truncate text-sm">
                        {t.pembeli ?? <span className="text-stone-400">tanpa nama</span>}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold tabular-nums">
                          {rupiah(t.total)}
                        </span>
                        <span className="block text-[11px] text-stone-400">
                          {jamSingkat(t.created_at)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/** Satu nota, lengkap dengan barisnya. */
export function NotaDetail() {
  const { id } = useParams<{ id: string }>()
  const [nota, setNota] = useState<Transaksi | null>(null)
  const [sibuk, setSibuk] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setSibuk(true)
    ambilTransaksiSatu(id)
      .then(setNota)
      .catch((e) => setGalat(pesanGalat(e)))
      .finally(() => setSibuk(false))
  }, [id])

  if (sibuk) return <Spinner />
  if (galat) return <Galat pesan={galat} />
  if (!nota) return <Kosong teks="Nota tidak ditemukan." />

  const item = nota.transaksi_item ?? []
  const totalPcs = item.reduce((t, b) => t + b.jumlah, 0)

  return (
    <div className="space-y-4">
      <Link to="/nota" className="text-sm font-medium text-pink-700 hover:underline">
        ← Riwayat nota
      </Link>

      <article className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
        <header className="border-b border-dashed border-stone-300 px-4 py-4 text-center">
          <p className="font-mono text-lg font-bold">{nota.nomor}</p>
          <p className="mt-1 text-xs text-stone-500">
            {tanggalPanjang(nota.tanggal)} · {jamSingkat(nota.created_at)}
          </p>
          <p className="mt-2 text-sm">
            {nota.pembeli ?? <span className="text-stone-400">Tanpa nama pembeli</span>}
          </p>
        </header>

        <ul className="divide-y divide-stone-100">
          {item.map((b) => (
            <li key={b.id} className="px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-stone-700">
                  {b.kode}
                </span>
                <span className="flex-1 truncate text-sm font-medium">{b.nama}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2 text-sm text-stone-600">
                <span>Ukuran {b.ukuran}</span>
                <span className="tabular-nums">
                  {b.jumlah} × {rupiah(b.harga)}
                </span>
                <span className="ml-auto font-semibold tabular-nums text-stone-900">
                  {rupiah(b.subtotal)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <footer className="border-t border-dashed border-stone-300 px-4 py-4">
          <div className="flex items-baseline gap-2">
            <span className="flex-1 text-sm text-stone-500">
              {item.length} baris · {pcs(totalPcs)}
            </span>
            <span className="text-xl font-bold tabular-nums">{rupiah(nota.total)}</span>
          </div>
          {nota.catatan && (
            <p className="mt-2 text-xs text-stone-500">Catatan: {nota.catatan}</p>
          )}
        </footer>
      </article>

      <p className="text-xs text-stone-400">
        Harga di nota ini adalah harga saat transaksi terjadi. Perubahan harga
        setelahnya tidak mengubah isi nota.
      </p>
    </div>
  )
}
