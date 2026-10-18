import { useEffect, useRef, useState } from 'react'
import { ambilMutasi, cariProduk, pesanGalat, produkPerKategori } from '../lib/api'
import { useToko } from '../store/toko'
import type { Mutasi, Produk, Varian } from '../lib/types'
import { LABEL_MUTASI, pcs, rupiah, statusDari, umurHitung } from '../lib/types'
import { Galat, Kosong, Spinner, TitikStatus } from '../components/ui'

/**
 * Halaman melihat — dan hanya melihat. Harga, jumlah, umur hitungan, riwayat.
 *
 * Tidak ada tombol yang mengubah apa pun di sini. Mencatat kejadian ada di
 * halaman Jual dan Ambil (keduanya lintas model, jadi berbentuk daftar),
 * membetulkan catatan ada di Opname. Halaman ini menjawab pertanyaan yang
 * jadi alasan sistem ini dibuat: berapa harganya, dan masih ada berapa.
 */
export default function Cari() {
  const toko = useToko((s) => s.toko)
  const [q, setQ] = useState('')
  const [hasil, setHasil] = useState<Produk[]>([])
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const kotak = useRef<HTMLInputElement>(null)

  useEffect(() => {
    kotak.current?.focus()
  }, [])

  useEffect(() => {
    if (!toko) {
      setHasil([])
      return
    }
    const kosong = q.trim() === ''
    setSibuk(true)

    async function muat() {
      try {
        setHasil(kosong ? await produkPerKategori(toko!.id) : await cariProduk(q, toko!.id))
        setGalat(null)
      } catch (err) {
        setGalat(pesanGalat(err))
      } finally {
        setSibuk(false)
      }
    }

    if (kosong) {
      void muat()
      return
    }
    const t = setTimeout(() => void muat(), 250)
    return () => clearTimeout(t)
  }, [q, toko?.id])

  return (
    <div className="space-y-4">
      {/* top-11 = tepat di bawah header nama toko yang tingginya h-11 */}
      <div className="sticky top-11 z-10 -mx-4 bg-stone-50/95 px-4 pb-3 pt-2 backdrop-blur">
        <input
          ref={kotak}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          inputMode="search"
          placeholder={toko ? `Cari di ${toko.nama}…` : 'Ketik kode atau nama…'}
          className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3.5 text-lg outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-100"
        />
      </div>

      {galat && <Galat pesan={galat} />}
      {sibuk && hasil.length === 0 && (
        <Spinner teks={q.trim() === '' ? 'Memuat…' : 'Mencari…'} />
      )}
      {!sibuk && hasil.length === 0 && !galat && (
        <Kosong
          teks={
            q.trim() === ''
              ? `Belum ada produk di ${toko?.nama ?? 'toko ini'}.`
              : `Tidak ada produk yang cocok dengan "${q}".`
          }
        />
      )}

      {hasil.length > 0 && q.trim() === '' && (
        <p className="text-xs text-stone-400">{hasil.length} produk · ketik untuk menyaring</p>
      )}

      <div className="space-y-4">
        {hasil.map((p) => (
          <KartuProduk key={p.id} produk={p} />
        ))}
      </div>
    </div>
  )
}

function KartuProduk({ produk }: { produk: Produk }) {
  const [buka, setBuka] = useState<string | null>(null)
  const batas = produk.kategori?.batas_menipis ?? 24

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
              <span className="w-12 shrink-0 text-sm font-semibold text-stone-700">{v.ukuran}</span>
              <span className="flex-1 text-lg font-bold leading-tight tabular-nums">
                {rupiah(v.harga_grosir)}
              </span>
              <span className="flex flex-col items-end gap-1">
                <Jumlah label="Toko" jumlah={v.jumlah_toko} batas={batas} />
                <Jumlah label="Gudang" jumlah={v.jumlah_gudang} batas={batas} />
              </span>
            </button>

            {buka === v.id && <Rincian varian={v} batas={batas} />}
          </li>
        ))}
      </ul>
    </article>
  )
}

function Jumlah({ label, jumlah, batas }: { label: string; jumlah: number; batas: number }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-stone-500">
      {label}
      <span className="font-semibold tabular-nums text-stone-800">{jumlah}</span>
      <TitikStatus status={statusDari(jumlah, batas)} />
    </span>
  )
}

function Rincian({ varian, batas }: { varian: Varian; batas: number }) {
  const [riwayat, setRiwayat] = useState<Mutasi[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)

  const umurToko = umurHitung(varian.toko_dihitung_at)
  const umurGudang = umurHitung(varian.gudang_dihitung_at)

  return (
    <div className="space-y-3 bg-stone-50 px-4 py-3">
      <div className="space-y-1 text-xs">
        <BarisStok
          label="Toko"
          jumlah={varian.jumlah_toko}
          batas={batas}
          umur={umurToko.teks}
          basi={umurToko.basi}
        />
        <BarisStok
          label="Gudang"
          jumlah={varian.jumlah_gudang}
          batas={batas}
          umur={umurGudang.teks}
          basi={umurGudang.basi}
        />
      </div>

      {galat && <Galat pesan={galat} />}

      {riwayat === null ? (
        <button
          onClick={async () => {
            try {
              setRiwayat(await ambilMutasi(varian.id))
            } catch (err) {
              setGalat(pesanGalat(err))
            }
          }}
          className="text-xs font-medium text-stone-500 underline-offset-2 hover:underline"
        >
          Lihat riwayat
        </button>
      ) : riwayat.length === 0 ? (
        <p className="text-xs text-stone-400">Belum ada pergerakan tercatat.</p>
      ) : (
        <ul className="space-y-1 border-t border-stone-200 pt-2 text-xs text-stone-500">
          {riwayat.map((m) => (
            <li key={m.id} className="flex justify-between gap-2">
              <span>{LABEL_MUTASI[m.jenis]}</span>
              <span className="tabular-nums">
                {m.delta_toko !== 0 && `toko ${m.delta_toko > 0 ? '+' : ''}${m.delta_toko}`}
                {m.delta_toko !== 0 && m.delta_gudang !== 0 && ', '}
                {m.delta_gudang !== 0 && `gudang ${m.delta_gudang > 0 ? '+' : ''}${m.delta_gudang}`}
              </span>
              <span className="shrink-0 text-stone-400">
                {new Date(m.created_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BarisStok({
  label,
  jumlah,
  batas,
  umur,
  basi,
}: {
  label: string
  jumlah: number
  batas: number
  umur: string
  basi: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <TitikStatus status={statusDari(jumlah, batas)} />
      <span className="w-14 text-stone-500">{label}</span>
      <span className="font-semibold tabular-nums text-stone-900">{pcs(jumlah)}</span>
      <span className={basi ? 'text-amber-700' : 'text-stone-400'}>
        · {umur}
        {basi && ' ⚠'}
      </span>
    </div>
  )
}
