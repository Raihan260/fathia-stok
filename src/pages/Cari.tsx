import { useEffect, useRef, useState } from 'react'
import { cariProduk, pesanGalat, setStatus } from '../lib/api'
import type { Produk, StatusStok, Varian } from '../lib/types'
import { rupiah } from '../lib/types'
import { Galat, Kosong, Spinner, StatusToggle } from '../components/ui'

type KolomStok = 'stok_toko' | 'stok_gudang'

/**
 * Halaman utama — 90% pemakaian ada di sini.
 * Target: 2 detik dari buka aplikasi sampai dapat jawaban harga.
 */
export default function Cari() {
  const [q, setQ] = useState('')
  const [hasil, setHasil] = useState<Produk[]>([])
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const kotak = useRef<HTMLInputElement>(null)

  useEffect(() => {
    kotak.current?.focus()
  }, [])

  // debounce supaya tidak query tiap ketukan huruf
  useEffect(() => {
    if (q.trim() === '') {
      setHasil([])
      setGalat(null)
      return
    }
    setSibuk(true)
    const t = setTimeout(async () => {
      try {
        setHasil(await cariProduk(q))
        setGalat(null)
      } catch (err) {
        setGalat(err instanceof Error ? err.message : 'Gagal mencari.')
      } finally {
        setSibuk(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  function perbaruiVarian(varianId: string, kolom: KolomStok, nilai: StatusStok) {
    setHasil((lama) =>
      lama.map((p) => ({
        ...p,
        varian: p.varian.map((v) => (v.id === varianId ? { ...v, [kolom]: nilai } : v)),
      })),
    )
  }

  /**
   * Ubah dulu di layar supaya terasa seketika, baru simpan. Kalau gagal —
   * misalnya staf mencoba sesuatu yang bukan haknya — kembalikan ke nilai
   * semula, jangan biarkan layar menampilkan status yang tidak tersimpan.
   */
  async function ubahStatus(v: Varian, kolom: KolomStok, nilai: StatusStok) {
    const sebelum = v[kolom]
    perbaruiVarian(v.id, kolom, nilai)
    try {
      await setStatus(v.id, kolom, nilai)
      setGalat(null)
    } catch (err) {
      perbaruiVarian(v.id, kolom, sebelum)
      setGalat(pesanGalat(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-4 bg-stone-50/95 px-4 pb-3 pt-2 backdrop-blur">
        <input
          ref={kotak}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          inputMode="search"
          placeholder="Ketik kode atau nama…"
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3.5 text-lg outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-100"
        />
      </div>

      {galat && <Galat pesan={galat} />}
      {sibuk && hasil.length === 0 && <Spinner teks="Mencari…" />}
      {!sibuk && q.trim() !== '' && hasil.length === 0 && !galat && (
        <Kosong teks={`Tidak ada produk yang cocok dengan "${q}".`} />
      )}
      {q.trim() === '' && (
        <Kosong teks="Ketik kode dari hangtag, atau sebagian nama produk." />
      )}

      <div className="space-y-4">
        {hasil.map((p) => (
          <KartuProduk key={p.id} produk={p} onUbah={ubahStatus} />
        ))}
      </div>
    </div>
  )
}

function KartuProduk({
  produk,
  onUbah,
}: {
  produk: Produk
  onUbah: (v: Varian, kolom: KolomStok, nilai: StatusStok) => void
}) {
  const [buka, setBuka] = useState<string | null>(null)

  return (
    <article className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
      <header className="border-b border-stone-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-stone-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
            {produk.kode}
          </span>
          <span className="text-xs text-stone-500">{produk.kategori?.nama}</span>
        </div>
        <h2 className="mt-1.5 font-semibold leading-tight">{produk.nama}</h2>
        {produk.catatan && <p className="mt-1 text-xs text-stone-500">{produk.catatan}</p>}
      </header>

      <ul className="divide-y divide-stone-100">
        {produk.varian.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => setBuka(buka === v.id ? null : v.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50"
            >
              <span className="w-14 shrink-0 text-sm font-semibold text-stone-700">{v.ukuran}</span>
              <span className="flex-1 text-lg font-bold tabular-nums">{rupiah(v.harga_grosir)}</span>
              <span className="flex flex-col items-end gap-1">
                <Titik label="Toko" status={v.stok_toko} />
                <Titik label="Gudang" status={v.stok_gudang} />
              </span>
            </button>

            {buka === v.id && (
              <div className="space-y-3 bg-stone-50 px-4 py-3">
                <BarisUbah
                  label="Stok toko"
                  nilai={v.stok_toko}
                  onPilih={(s) => onUbah(v, 'stok_toko', s)}
                />
                <BarisUbah
                  label="Stok gudang"
                  nilai={v.stok_gudang}
                  onPilih={(s) => onUbah(v, 'stok_gudang', s)}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </article>
  )
}

function Titik({ label, status }: { label: string; status: StatusStok }) {
  const warna =
    status === 'ada' ? 'bg-emerald-500' : status === 'menipis' ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-stone-500">
      {label}
      <span className={`h-2.5 w-2.5 rounded-full ${warna}`} />
    </span>
  )
}

function BarisUbah({
  label,
  nilai,
  onPilih,
}: {
  label: string
  nilai: StatusStok
  onPilih: (s: StatusStok) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-stone-600">{label}</span>
      <StatusToggle nilai={nilai} onPilih={onPilih} />
    </div>
  )
}
