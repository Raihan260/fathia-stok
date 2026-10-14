import { useEffect, useState } from 'react'
import { ambilKategori, produkPerKategori, setStatus } from '../lib/api'
import type { Kategori, Produk, StatusStok } from '../lib/types'
import { Galat, Kosong, Spinner, StatusToggle } from '../components/ui'

/**
 * Layar untuk stok opname rutin — semua ukuran satu kategori tampil sekaligus,
 * tinggal tap. Dipakai berdiri di gudang, jadi mode gudang jadi default.
 */
export default function Opname() {
  const [kategori, setKategori] = useState<Kategori[]>([])
  const [pilih, setPilih] = useState('')
  const [daftar, setDaftar] = useState<Produk[]>([])
  const [mode, setMode] = useState<'stok_gudang' | 'stok_toko'>('stok_gudang')
  const [sibuk, setSibuk] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    ambilKategori()
      .then((k) => {
        setKategori(k)
        setPilih(k[0]?.id ?? '')
      })
      .catch((e) => setGalat(e.message))
  }, [])

  useEffect(() => {
    if (!pilih) return
    setSibuk(true)
    produkPerKategori(pilih)
      .then((d) => {
        setDaftar(d)
        setGalat(null)
      })
      .catch((e) => setGalat(e.message))
      .finally(() => setSibuk(false))
  }, [pilih])

  async function ubah(varianId: string, nilai: StatusStok) {
    setDaftar((lama) =>
      lama.map((p) => ({
        ...p,
        varian: p.varian.map((v) => (v.id === varianId ? { ...v, [mode]: nilai } : v)),
      })),
    )
    try {
      await setStatus(varianId, mode, nilai)
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan perubahan.')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Stok opname</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {kategori.map((k) => (
          <button
            key={k.id}
            onClick={() => setPilih(k.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
              k.id === pilih
                ? 'bg-pink-700 text-white ring-pink-700'
                : 'bg-white text-stone-600 ring-stone-300'
            }`}
          >
            {k.nama}
          </button>
        ))}
      </div>

      <div className="flex overflow-hidden rounded-lg ring-1 ring-stone-300">
        {(
          [
            ['stok_gudang', 'Gudang'],
            ['stok_toko', 'Toko'],
          ] as const
        ).map(([nilai, label]) => (
          <button
            key={nilai}
            onClick={() => setMode(nilai)}
            className={`flex-1 py-2 text-sm font-semibold ${
              mode === nilai ? 'bg-stone-900 text-white' : 'bg-white text-stone-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {galat && <Galat pesan={galat} />}
      {sibuk ? (
        <Spinner />
      ) : daftar.length === 0 ? (
        <Kosong teks="Belum ada produk di kategori ini." />
      ) : (
        <div className="space-y-3">
          {daftar.map((p) => (
            <article key={p.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded bg-stone-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                  {p.kode}
                </span>
                <span className="truncate text-sm font-medium">{p.nama}</span>
              </div>
              <ul className="space-y-2">
                {p.varian.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-stone-700">{v.ukuran}</span>
                    <StatusToggle nilai={v[mode]} onPilih={(s) => ubah(v.id, s)} />
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
