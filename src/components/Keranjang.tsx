import { useEffect, useRef, useState } from 'react'
import { cariProduk, catatMutasiBanyak, pesanGalat, produkPerKategori } from '../lib/api'
import { useToko } from '../store/toko'
import type { Lokasi, Produk, Varian } from '../lib/types'
import { pcs, rupiah, statusDari } from '../lib/types'
import { Galat, Kosong, Spinner, TitikStatus } from '../components/ui'

/**
 * Alur borongan yang dipakai halaman Jual dan Ambil dari gudang.
 *
 * Keduanya lintas model: satu pembeli reseller mengambil beberapa model, dan
 * mengisi ulang rak dari gudang juga sekaligus banyak model. Jadi bentuknya
 * daftar belanja — kumpulkan dulu semua baris, simpan sekali di akhir —
 * bukan satu-satu lewat halaman Cari.
 */
export interface BarisKeranjang {
  varianId: string
  kode: string
  nama: string
  ukuran: string
  harga: number
  jumlah: number
}

export default function Keranjang({
  judul,
  jenis,
  sumber,
  tampilkanHarga,
  labelSimpan,
  petunjuk,
}: {
  judul: string
  jenis: 'jual' | 'pindah_ke_toko'
  /** Stok mana yang berkurang — yang ditampilkan dan dijadikan patokan. */
  sumber: Lokasi
  tampilkanHarga: boolean
  labelSimpan: string
  petunjuk: string
}) {
  const toko = useToko((s) => s.toko)
  const [q, setQ] = useState('')
  const [hasil, setHasil] = useState<Produk[]>([])
  const [buka, setBuka] = useState<string | null>(null)
  const [keranjang, setKeranjang] = useState<BarisKeranjang[]>([])
  const [sibuk, setSibuk] = useState(false)
  const [menyimpan, setMenyimpan] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [kabar, setKabar] = useState<string | null>(null)
  const kotak = useRef<HTMLInputElement>(null)

  useEffect(() => {
    kotak.current?.focus()
  }, [])

  useEffect(() => {
    if (!toko) return
    const kosong = q.trim() === ''
    setSibuk(true)
    async function muat() {
      try {
        setHasil(kosong ? await produkPerKategori(toko!.id) : await cariProduk(q, toko!.id))
        setGalat(null)
      } catch (e) {
        setGalat(pesanGalat(e))
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

  const kolom = sumber === 'toko' ? 'jumlah_toko' : 'jumlah_gudang'

  /** Sisa yang masih boleh diambil: stok tercatat dikurangi yang sudah di daftar. */
  function sisa(v: Varian) {
    const sudah = keranjang
      .filter((b) => b.varianId === v.id)
      .reduce((t, b) => t + b.jumlah, 0)
    return v[kolom] - sudah
  }

  function tambahBaris(p: Produk, isian: Record<string, string>) {
    const baru: BarisKeranjang[] = []
    for (const v of p.varian) {
      const n = Number(isian[v.id] ?? '')
      if (!n) continue
      baru.push({
        varianId: v.id,
        kode: p.kode,
        nama: p.nama,
        ukuran: v.ukuran,
        harga: v.harga_grosir,
        jumlah: n,
      })
    }
    if (baru.length === 0) return

    // Baris untuk ukuran yang sama digabung, bukan ditumpuk: daftar yang
    // memuat "uk 4 × 3" dua kali membingungkan saat dicek ulang.
    setKeranjang((lama) => {
      const gabung = [...lama]
      for (const b of baru) {
        const i = gabung.findIndex((x) => x.varianId === b.varianId)
        if (i === -1) gabung.push(b)
        else gabung[i] = { ...gabung[i], jumlah: gabung[i].jumlah + b.jumlah }
      }
      return gabung
    })
    setBuka(null)
    setKabar(null)
  }

  async function simpan() {
    if (keranjang.length === 0) return
    setMenyimpan(true)
    setGalat(null)
    try {
      await catatMutasiBanyak(
        jenis,
        keranjang.map((b) => ({ varian_id: b.varianId, jumlah: b.jumlah })),
      )
      setKabar(`${keranjang.length} baris tersimpan.`)
      setKeranjang([])
      setQ('')
      // Muat ulang supaya stok di layar ikut turun.
      if (toko) setHasil(await produkPerKategori(toko.id))
    } catch (e) {
      setGalat(pesanGalat(e))
    } finally {
      setMenyimpan(false)
    }
  }

  const totalPcs = keranjang.reduce((t, b) => t + b.jumlah, 0)
  const totalHarga = keranjang.reduce((t, b) => t + b.jumlah * b.harga, 0)

  return (
    <div className="space-y-4 pb-40">
      <h1 className="text-lg font-semibold">{judul}</h1>

      <input
        ref={kotak}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        inputMode="search"
        placeholder="Cari kode atau nama produk…"
        className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-pink-600"
      />

      {galat && <Galat pesan={galat} />}
      {kabar && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {kabar}
        </p>
      )}

      {sibuk && hasil.length === 0 ? (
        <Spinner />
      ) : hasil.length === 0 ? (
        <Kosong teks={q.trim() ? `Tidak ada yang cocok dengan "${q}".` : 'Belum ada produk.'} />
      ) : (
        <ul className="space-y-2">
          {hasil.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200">
              <button
                onClick={() => setBuka(buka === p.id ? null : p.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50"
              >
                <span className="shrink-0 rounded bg-stone-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                  {p.kode}
                </span>
                <span className="flex-1 truncate text-sm font-medium">{p.nama}</span>
                <span className="shrink-0 text-xs text-stone-400">
                  {buka === p.id ? 'tutup' : 'pilih ukuran'}
                </span>
              </button>
              {buka === p.id && (
                <FormUkuran
                  produk={p}
                  kolom={kolom}
                  batas={p.kategori?.batas_menipis ?? 24}
                  sisa={sisa}
                  tampilkanHarga={tampilkanHarga}
                  onTambah={(isian) => tambahBaris(p, isian)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Daftar melayang di atas menu bawah supaya selalu terlihat tanpa scroll. */}
      {keranjang.length > 0 && (
        <div className="fixed inset-x-0 bottom-14 z-10 border-t border-stone-200 bg-white/97 backdrop-blur">
          <div className="mx-auto max-w-2xl px-4 py-3">
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {keranjang.map((b) => (
                <li key={b.varianId} className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{b.kode}</span>
                  <span className="text-stone-500">uk {b.ukuran}</span>
                  <span className="font-semibold tabular-nums">× {b.jumlah}</span>
                  {tampilkanHarga && (
                    <span className="tabular-nums text-stone-500">
                      {rupiah(b.jumlah * b.harga)}
                    </span>
                  )}
                  <button
                    onClick={() =>
                      setKeranjang((l) => l.filter((x) => x.varianId !== b.varianId))
                    }
                    className="ml-auto px-1 text-stone-400 hover:text-rose-600"
                    aria-label={`Hapus ${b.kode} ukuran ${b.ukuran}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-2 flex items-center gap-3 border-t border-stone-200 pt-2">
              <span className="flex-1 text-xs text-stone-500">
                {keranjang.length} baris · {pcs(totalPcs)}
                {tampilkanHarga && (
                  <span className="block text-base font-bold tabular-nums text-stone-900">
                    {rupiah(totalHarga)}
                  </span>
                )}
              </span>
              <button
                onClick={() => setKeranjang([])}
                className="px-2 text-xs text-stone-400 hover:text-stone-600"
              >
                Kosongkan
              </button>
              <button
                onClick={() => void simpan()}
                disabled={menyimpan}
                className="rounded-lg bg-pink-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pink-800 disabled:opacity-50"
              >
                {menyimpan ? 'Menyimpan…' : labelSimpan}
              </button>
            </div>
          </div>
        </div>
      )}

      {keranjang.length === 0 && <p className="text-xs text-stone-400">{petunjuk}</p>}
    </div>
  )
}

function FormUkuran({
  produk,
  kolom,
  batas,
  sisa,
  tampilkanHarga,
  onTambah,
}: {
  produk: Produk
  kolom: 'jumlah_toko' | 'jumlah_gudang'
  batas: number
  sisa: (v: Varian) => number
  tampilkanHarga: boolean
  onTambah: (isian: Record<string, string>) => void
}) {
  const [isian, setIsian] = useState<Record<string, string>>({})
  const adaIsi = Object.values(isian).some((v) => v.trim() !== '' && Number(v) > 0)

  return (
    <div className="space-y-2 border-t border-stone-100 bg-stone-50 px-4 py-3">
      <ul className="space-y-2">
        {produk.varian.map((v) => {
          const tersisa = sisa(v)
          const diminta = Number(isian[v.id] ?? '') || 0
          const lebih = diminta > tersisa
          return (
            <li key={v.id} className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-sm font-semibold text-stone-700">
                {v.ukuran}
              </span>
              <span className="flex flex-1 items-center gap-1.5 text-xs">
                <TitikStatus status={statusDari(v[kolom], batas)} />
                <span className="tabular-nums text-stone-600">{pcs(tersisa)}</span>
                {tampilkanHarga && (
                  <span className="text-stone-400">· {rupiah(v.harga_grosir)}</span>
                )}
              </span>
              <input
                value={isian[v.id] ?? ''}
                onChange={(e) =>
                  setIsian({ ...isian, [v.id]: e.target.value.replace(/\D/g, '') })
                }
                inputMode="numeric"
                placeholder="—"
                aria-label={`Jumlah ukuran ${v.ukuran}`}
                className={`w-20 rounded-lg border px-2 py-2 text-center font-semibold tabular-nums outline-none ${
                  lebih
                    ? 'border-rose-400 bg-rose-50 text-rose-700'
                    : 'border-stone-300 focus:border-pink-600'
                }`}
              />
            </li>
          )
        })}
      </ul>

      <button
        onClick={() => {
          onTambah(isian)
          setIsian({})
        }}
        disabled={!adaIsi}
        className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-30"
      >
        Tambah ke daftar
      </button>
    </div>
  )
}
