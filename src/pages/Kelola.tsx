import { useEffect, useState } from 'react'
import {
  ambilKategori,
  cariProduk,
  hapusProduk,
  hapusVarian,
  pesanGalat,
  produkPerKategori,
  simpanProduk,
  simpanVarian,
} from '../lib/api'
import type { Kategori, Produk } from '../lib/types'
import { rupiah } from '../lib/types'
import { Galat, Kosong, Spinner } from '../components/ui'

/** CRUD produk & ukuran. Jarang dipakai, jadi sengaja tidak dibuat ringkas. */
export default function Kelola() {
  const [kategori, setKategori] = useState<Kategori[]>([])
  const [pilihKategori, setPilihKategori] = useState<string>('')
  const [daftar, setDaftar] = useState<Produk[]>([])
  const [q, setQ] = useState('')
  const [sibuk, setSibuk] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [edit, setEdit] = useState<Produk | 'baru' | null>(null)

  useEffect(() => {
    ambilKategori()
      .then((k) => {
        setKategori(k)
        setPilihKategori(k[0]?.id ?? '')
      })
      .catch((e) => setGalat(e.message))
  }, [])

  async function muat() {
    if (!pilihKategori && q.trim() === '') return
    setSibuk(true)
    try {
      setDaftar(q.trim() ? await cariProduk(q) : await produkPerKategori(pilihKategori))
      setGalat(null)
    } catch (e) {
      setGalat(pesanGalat(e))
    } finally {
      setSibuk(false)
    }
  }

  useEffect(() => {
    void muat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilihKategori, q])

  if (edit) {
    return (
      <FormProduk
        produk={edit === 'baru' ? null : edit}
        kategori={kategori}
        kategoriAwal={pilihKategori}
        onSelesai={() => {
          setEdit(null)
          void muat()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Kelola produk</h1>
        <button
          onClick={() => setEdit('baru')}
          className="rounded-lg bg-pink-700 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-800"
        >
          + Produk
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Cari kode atau nama…"
        className="w-full rounded-lg border border-stone-300 px-4 py-2.5 outline-none focus:border-pink-600"
      />

      {q.trim() === '' && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {kategori.map((k) => (
            <button
              key={k.id}
              onClick={() => setPilihKategori(k.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
                k.id === pilihKategori
                  ? 'bg-pink-700 text-white ring-pink-700'
                  : 'bg-white text-stone-600 ring-stone-300'
              }`}
            >
              {k.nama}
            </button>
          ))}
        </div>
      )}

      {galat && <Galat pesan={galat} />}
      {sibuk ? (
        <Spinner />
      ) : daftar.length === 0 ? (
        <Kosong teks="Belum ada produk di kategori ini." />
      ) : (
        <ul className="space-y-2">
          {daftar.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setEdit(p)}
                className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-stone-200 hover:bg-stone-50"
              >
                <span className="rounded bg-stone-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                  {p.kode}
                </span>
                <span className="flex-1 truncate text-sm font-medium">{p.nama}</span>
                <span className="text-xs text-stone-400">{p.varian.length} ukuran</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Baris ukuran di form. `id` kosong berarti baris baru yang belum tersimpan. */
interface BarisVarian {
  id?: string
  ukuran: string
  harga: string
}

function FormProduk({
  produk,
  kategori,
  kategoriAwal,
  onSelesai,
}: {
  produk: Produk | null
  kategori: Kategori[]
  kategoriAwal: string
  onSelesai: () => void
}) {
  const [kode, setKode] = useState(produk?.kode ?? '')
  const [nama, setNama] = useState(produk?.nama ?? '')
  const [katId, setKatId] = useState(produk?.kategori_id ?? kategoriAwal)
  const [catatan, setCatatan] = useState(produk?.catatan ?? '')
  const [varian, setVarian] = useState<BarisVarian[]>(
    produk?.varian.map((v) => ({ id: v.id, ukuran: v.ukuran, harga: String(v.harga_grosir) })) ?? [],
  )
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  /** Isi otomatis dari preset ukuran kategori — harga diisi belakangan. */
  function pakaiPreset() {
    const preset = kategori.find((k) => k.id === katId)?.preset_ukuran ?? []
    const sudahAda = new Set(varian.map((v) => v.ukuran))
    setVarian([
      ...varian,
      ...preset.filter((u) => !sudahAda.has(u)).map((u) => ({ ukuran: u, harga: '0' })),
    ])
  }

  async function simpan() {
    if (!kode.trim() || !nama.trim()) {
      setGalat('Kode dan nama wajib diisi.')
      return
    }
    setSibuk(true)
    setGalat(null)
    try {
      const produkId = await simpanProduk({
        id: produk?.id,
        kode,
        nama,
        kategori_id: katId,
        catatan: catatan.trim() || null,
      })
      for (const v of varian) {
        if (!v.ukuran.trim()) continue
        await simpanVarian({
          id: v.id,
          produk_id: produkId,
          ukuran: v.ukuran,
          harga_grosir: Number(v.harga.replace(/\D/g, '')) || 0,
        })
      }
      onSelesai()
    } catch (e) {
      setGalat(pesanGalat(e))
      setSibuk(false)
    }
  }

  const input =
    'w-full rounded-lg border border-stone-300 px-3 py-2.5 outline-none focus:border-pink-600'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{produk ? 'Ubah produk' : 'Produk baru'}</h1>
        <button onClick={onSelesai} className="text-sm text-stone-500">
          Batal
        </button>
      </div>

      {galat && <Galat pesan={galat} />}

      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <label className="block">
          <span className="text-xs font-medium text-stone-500">Kode hangtag</span>
          <input
            value={kode}
            onChange={(e) => setKode(e.target.value.toUpperCase())}
            placeholder="DNM-014"
            className={`${input} font-mono`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-500">Nama produk</span>
          <input value={nama} onChange={(e) => setNama(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-500">Kategori</span>
          <select value={katId} onChange={(e) => setKatId(e.target.value)} className={input}>
            {kategori.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-stone-500">Catatan (opsional)</span>
          <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className={input} />
        </label>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Ukuran &amp; harga grosir</h2>
          <button onClick={pakaiPreset} className="text-sm font-medium text-pink-700">
            Isi dari preset
          </button>
        </div>

        <ul className="space-y-2">
          {varian.map((v, i) => (
            <li key={v.id ?? `baru-${i}`} className="flex items-center gap-2">
              <input
                value={v.ukuran}
                onChange={(e) =>
                  setVarian(varian.map((x, j) => (j === i ? { ...x, ukuran: e.target.value } : x)))
                }
                placeholder="Ukuran"
                className="w-24 rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-pink-600"
              />
              <input
                value={v.harga}
                onChange={(e) =>
                  setVarian(
                    varian.map((x, j) =>
                      j === i ? { ...x, harga: e.target.value.replace(/\D/g, '') } : x,
                    ),
                  )
                }
                inputMode="numeric"
                placeholder="Harga"
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 tabular-nums outline-none focus:border-pink-600"
              />
              <button
                onClick={async () => {
                  if (v.id) await hapusVarian(v.id)
                  setVarian(varian.filter((_, j) => j !== i))
                }}
                className="px-2 text-stone-400 hover:text-rose-600"
                aria-label="Hapus ukuran"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={() => setVarian([...varian, { ukuran: '', harga: '0' }])}
          className="mt-3 w-full rounded-lg border border-dashed border-stone-300 py-2 text-sm text-stone-500 hover:bg-stone-50"
        >
          + Tambah ukuran
        </button>

        {varian.length > 0 && (
          <p className="mt-3 text-xs text-stone-400">
            Contoh harga tersimpan: {rupiah(Number(varian[0].harga) || 0)}
          </p>
        )}
      </div>

      <button
        onClick={simpan}
        disabled={sibuk}
        className="w-full rounded-lg bg-pink-700 py-3 font-semibold text-white hover:bg-pink-800 disabled:opacity-60"
      >
        {sibuk ? 'Menyimpan…' : 'Simpan'}
      </button>

      {produk && (
        <button
          onClick={async () => {
            if (!confirm(`Arsipkan produk ${produk.kode}?`)) return
            await hapusProduk(produk.id)
            onSelesai()
          }}
          className="w-full py-2 text-sm text-stone-500 hover:text-rose-700"
        >
          Arsipkan produk ini
        </button>
      )}
    </div>
  )
}
