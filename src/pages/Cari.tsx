import { useEffect, useRef, useState } from 'react'
import { ambilMutasi, cariProduk, catatMutasi, hitungUlang, pesanGalat } from '../lib/api'
import { useToko } from '../store/toko'
import type { Mutasi, Produk, Varian } from '../lib/types'
import { LABEL_MUTASI, pcs, rupiah, statusDari, umurHitung } from '../lib/types'
import { Galat, Kosong, Spinner, TitikStatus } from '../components/ui'

/**
 * Halaman utama — 90% pemakaian ada di sini.
 * Target: 2 detik dari buka aplikasi sampai dapat jawaban harga dan jumlah.
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
    if (q.trim() === '' || !toko) {
      setHasil([])
      setGalat(null)
      return
    }
    setSibuk(true)
    const t = setTimeout(async () => {
      try {
        setHasil(await cariProduk(q, toko.id))
        setGalat(null)
      } catch (err) {
        setGalat(pesanGalat(err))
      } finally {
        setSibuk(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, toko?.id])

  /** Pasang varian hasil RPC ke daftar di layar. */
  function gantiVarian(baru: Varian) {
    setHasil((lama) =>
      lama.map((p) => ({
        ...p,
        varian: p.varian.map((v) => (v.id === baru.id ? { ...v, ...baru } : v)),
      })),
    )
  }

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
      {sibuk && hasil.length === 0 && <Spinner teks="Mencari…" />}
      {!sibuk && q.trim() !== '' && hasil.length === 0 && !galat && (
        <Kosong teks={`Tidak ada produk yang cocok dengan "${q}".`} />
      )}
      {q.trim() === '' && <Kosong teks="Ketik kode dari hangtag, atau sebagian nama produk." />}

      <div className="space-y-4">
        {hasil.map((p) => (
          <KartuProduk key={p.id} produk={p} onVarianBerubah={gantiVarian} />
        ))}
      </div>
    </div>
  )
}

function KartuProduk({
  produk,
  onVarianBerubah,
}: {
  produk: Produk
  onVarianBerubah: (v: Varian) => void
}) {
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
              <span className="flex-1">
                <span className="block text-lg font-bold leading-tight tabular-nums">
                  {rupiah(v.harga_grosir)}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <Jumlah label="Toko" jumlah={v.jumlah_toko} batas={batas} />
                <Jumlah label="Gudang" jumlah={v.jumlah_gudang} batas={batas} />
              </span>
            </button>

            {buka === v.id && (
              <PanelAksi varian={v} batas={batas} onBerubah={onVarianBerubah} />
            )}
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

type Aksi = 'jual' | 'pindah_ke_toko' | 'barang_masuk' | 'hitung_toko' | 'hitung_gudang'

const JUDUL_AKSI: Record<Aksi, string> = {
  jual: 'Terjual berapa pcs?',
  pindah_ke_toko: 'Ambil dari gudang berapa pcs?',
  barang_masuk: 'Barang masuk gudang berapa pcs?',
  hitung_toko: 'Hasil hitung fisik di toko berapa pcs?',
  hitung_gudang: 'Hasil hitung fisik di gudang berapa pcs?',
}

function PanelAksi({
  varian,
  batas,
  onBerubah,
}: {
  varian: Varian
  batas: number
  onBerubah: (v: Varian) => void
}) {
  const [aksi, setAksi] = useState<Aksi | null>(null)
  const [nilai, setNilai] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [riwayat, setRiwayat] = useState<Mutasi[] | null>(null)

  const umurToko = umurHitung(varian.toko_dihitung_at)
  const umurGudang = umurHitung(varian.gudang_dihitung_at)

  async function simpan() {
    const n = Number(nilai)
    if (!Number.isFinite(n) || n < 0 || nilai.trim() === '') {
      setGalat('Isi jumlahnya dulu.')
      return
    }
    if (aksi !== 'hitung_toko' && aksi !== 'hitung_gudang' && n === 0) {
      setGalat('Jumlahnya tidak boleh nol.')
      return
    }
    setSibuk(true)
    setGalat(null)
    try {
      let baru: Varian
      if (aksi === 'jual') {
        baru = await catatMutasi({ varianId: varian.id, jenis: 'jual', deltaToko: -n })
      } else if (aksi === 'pindah_ke_toko') {
        baru = await catatMutasi({
          varianId: varian.id,
          jenis: 'pindah_ke_toko',
          deltaGudang: -n,
          deltaToko: n,
        })
      } else if (aksi === 'barang_masuk') {
        baru = await catatMutasi({
          varianId: varian.id,
          jenis: 'barang_masuk',
          deltaGudang: n,
        })
      } else {
        baru = await hitungUlang(varian.id, aksi === 'hitung_toko' ? 'toko' : 'gudang', n)
      }
      onBerubah(baru)
      setAksi(null)
      setNilai('')
      setRiwayat(null)
    } catch (err) {
      setGalat(pesanGalat(err))
    } finally {
      setSibuk(false)
    }
  }

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

      {aksi === null ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <TombolAksi label="Terjual" onClick={() => setAksi('jual')} utama />
            <TombolAksi label="Ambil dari gudang" onClick={() => setAksi('pindah_ke_toko')} />
            <TombolAksi label="Barang masuk" onClick={() => setAksi('barang_masuk')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TombolAksi label="Hitung toko" onClick={() => setAksi('hitung_toko')} />
            <TombolAksi label="Hitung gudang" onClick={() => setAksi('hitung_gudang')} />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-stone-600">{JUDUL_AKSI[aksi]}</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={nilai}
              onChange={(e) => setNilai(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && void simpan()}
              inputMode="numeric"
              placeholder="0"
              className="w-24 rounded-lg border border-stone-300 px-3 py-2.5 text-lg font-semibold tabular-nums outline-none focus:border-pink-600"
            />
            <button
              onClick={() => void simpan()}
              disabled={sibuk}
              className="flex-1 rounded-lg bg-pink-700 py-2.5 text-sm font-semibold text-white hover:bg-pink-800 disabled:opacity-60"
            >
              {sibuk ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button
              onClick={() => {
                setAksi(null)
                setNilai('')
                setGalat(null)
              }}
              className="px-3 text-sm text-stone-500"
            >
              Batal
            </button>
          </div>
        </div>
      )}

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
                {m.delta_gudang !== 0 &&
                  `gudang ${m.delta_gudang > 0 ? '+' : ''}${m.delta_gudang}`}
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

function TombolAksi({
  label,
  onClick,
  utama,
}: {
  label: string
  onClick: () => void
  utama?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2 py-2.5 text-xs font-semibold leading-tight transition ${
        utama
          ? 'bg-stone-900 text-white hover:bg-stone-800'
          : 'bg-white text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100'
      }`}
    >
      {label}
    </button>
  )
}
