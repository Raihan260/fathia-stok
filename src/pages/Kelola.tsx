import { useEffect, useState } from 'react'
import {
  arsipkanProduk,
  aturTokoProduk,
  cariProduk,
  hapusVarian,
  pesanGalat,
  produkPerKategori,
  simpanProduk,
  simpanVarian,
} from '../lib/api'
import { useToko } from '../store/toko'
import type { Produk, Sesi, Tempat } from '../lib/types'
import { rupiah, stokDi } from '../lib/types'
import { ambilTempat } from '../lib/api'
import { Galat, Kosong, Spinner } from '../components/ui'

/**
 * CRUD produk & ukuran, terbatas pada toko yang sedang aktif. Produk baru
 * otomatis masuk kategori toko itu — tidak ada pilihan kategori, supaya tidak
 * ada produk yang nyasar ke toko sebelah.
 */
export default function Kelola() {
  const sesi = useToko((s) => s.sesi)
  const [daftar, setDaftar] = useState<Produk[]>([])
  const [q, setQ] = useState('')
  /** Arsip tidak punya pencarian sendiri — isinya sedikit, cukup didaftar. */
  const [lihatArsip, setLihatArsip] = useState(false)
  const [sibuk, setSibuk] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [edit, setEdit] = useState<Produk | 'baru' | null>(null)

  async function muat() {
    if (!sesi) return
    const kat = sesi.kategori.id
    setSibuk(true)
    try {
      // Tanpa saringan toko: halaman ini memang mengurus seluruh produk
      // kategorinya, termasuk yang cuma dijual di toko sebelah — justru di
      // sinilah tempatnya mengatur toko mana yang menjual apa.
      if (lihatArsip) {
        setDaftar(await produkPerKategori(kat, false))
      } else {
        setDaftar(q.trim() ? await cariProduk(q, kat) : await produkPerKategori(kat))
      }
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
  }, [sesi?.kategori.id, q, lihatArsip])

  async function pulihkan(p: Produk) {
    if (!confirm(`Pulihkan ${p.kode} ke daftar produk?`)) return
    try {
      await arsipkanProduk(p.id, false)
      void muat()
    } catch (e) {
      setGalat(pesanGalat(e))
    }
  }

  if (edit && sesi) {
    return (
      <FormProduk
        produk={edit === 'baru' ? null : edit}
        sesi={sesi}
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
        <h1 className="text-lg font-semibold">
          {lihatArsip ? 'Arsip produk' : 'Kelola produk'}
        </h1>
        {!lihatArsip && (
          <button
            onClick={() => setEdit('baru')}
            className="rounded-lg bg-pink-700 px-3 py-2 text-sm font-semibold text-white hover:bg-pink-800"
          >
            + Produk
          </button>
        )}
      </div>

      {!lihatArsip && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Cari kode atau nama…"
          className="w-full rounded-lg border border-stone-300 px-4 py-2.5 outline-none focus:border-pink-600"
        />
      )}

      {lihatArsip && (
        <p className="rounded-lg bg-stone-100 px-4 py-2.5 text-xs text-stone-600">
          Produk di sini tidak muncul di halaman Cari dan Opname, tapi kode dan
          riwayat penjualannya tetap tersimpan — termasuk kodenya, yang tetap
          tidak bisa dipakai produk baru.
        </p>
      )}

      {galat && <Galat pesan={galat} />}
      {sibuk ? (
        <Spinner />
      ) : daftar.length === 0 ? (
        <Kosong
          teks={
            lihatArsip
              ? 'Arsip kosong.'
              : `Belum ada produk di ${sesi?.kategori.nama ?? 'toko ini'}.`
          }
        />
      ) : (
        <ul className="space-y-2">
          {daftar.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200"
            >
              <button
                onClick={() => !lihatArsip && setEdit(p)}
                disabled={lihatArsip}
                className="flex flex-1 items-center gap-3 overflow-hidden text-left disabled:cursor-default"
              >
                <span
                  className={`shrink-0 rounded px-2 py-0.5 font-mono text-xs font-bold text-white ${
                    lihatArsip ? 'bg-stone-400' : 'bg-stone-900'
                  }`}
                >
                  {p.kode}
                </span>
                <span
                  className={`flex-1 truncate text-sm font-medium ${
                    lihatArsip ? 'text-stone-500' : ''
                  }`}
                >
                  {p.nama}
                </span>
                {!lihatArsip && (
                  <span className="shrink-0 text-xs text-stone-400">
                    {p.varian.length} ukuran
                  </span>
                )}
              </button>
              {lihatArsip && (
                <button
                  onClick={() => void pulihkan(p)}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-pink-700 ring-1 ring-pink-300 hover:bg-pink-50"
                >
                  Pulihkan
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => {
          setLihatArsip(!lihatArsip)
          setQ('')
        }}
        className="w-full py-2 text-sm text-stone-500 underline-offset-2 hover:underline"
      >
        {lihatArsip ? '← Kembali ke daftar produk' : 'Lihat arsip'}
      </button>
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
  sesi,
  onSelesai,
}: {
  produk: Produk | null
  sesi: Sesi
  onSelesai: () => void
}) {
  const kategoriId = sesi.kategori.id
  const presetUkuran = sesi.kategori.preset_ukuran
  const [kode, setKode] = useState(produk?.kode ?? '')
  const [nama, setNama] = useState(produk?.nama ?? '')
  const [catatan, setCatatan] = useState(produk?.catatan ?? '')
  const [varian, setVarian] = useState<BarisVarian[]>(
    produk?.varian.map((v) => ({ id: v.id, ukuran: v.ukuran, harga: String(v.harga_grosir) })) ?? [],
  )
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  /*
   * Toko mana saja yang menjual produk ini.
   *
   * Sebagian model cuma ada di salah satu toko. Yang menyatakannya bukan kolom
   * tersendiri melainkan ada-tidaknya baris stok di toko itu — "tidak dijual di
   * sini" dan "dijual di sini tapi kosong" dua hal berbeda, dan menyamakannya
   * akan membuat barang yang tidak pernah dijual di sebuah toko ikut muncul di
   * sana sebagai barang kosong.
   */
  const [tokoSemua, setTokoSemua] = useState<Tempat[]>([])
  const [tokoDipilih, setTokoDipilih] = useState<string[]>([])

  useEffect(() => {
    ambilTempat()
      .then((semua) => {
        const toko = semua.filter((t) => t.jenis === 'toko' && t.kategori_id === kategoriId)
        setTokoSemua(toko)
        // Produk baru dianggap dijual di semua toko kategorinya — itu keadaan
        // yang paling sering, dan melepas satu lebih mudah daripada mencentang
        // semua.
        setTokoDipilih(
          produk
            ? toko.filter((t) => produk.varian.some((v) => stokDi(v, t.id))).map((t) => t.id)
            : toko.map((t) => t.id),
        )
      })
      .catch(() => setTokoSemua([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategoriId, produk?.id])

  /** Isi otomatis dari preset ukuran toko ini — harga diisi belakangan. */
  function pakaiPreset() {
    const sudahAda = new Set(varian.map((v) => v.ukuran))
    setVarian([
      ...varian,
      ...presetUkuran.filter((u) => !sudahAda.has(u)).map((u) => ({ ukuran: u, harga: '0' })),
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
        kategori_id: kategoriId,
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
      // Dijalankan setelah ukurannya tersimpan: baris stok lahir per ukuran,
      // jadi menentukan tokonya sebelum ukurannya ada tidak ada gunanya.
      if (tokoSemua.length > 0) await aturTokoProduk(produkId, tokoDipilih)

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
        {/* Kategori tidak bisa dipilih: selalu mengikuti toko yang aktif. */}
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

      {/* Hanya muncul kalau kategorinya memang punya lebih dari satu toko.
          Menanyakan "dijual di toko mana" saat tokonya cuma satu adalah
          pertanyaan yang jawabannya sudah pasti. */}
      {tokoSemua.length > 1 && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <h2 className="font-semibold">Dijual di toko</h2>
          <p className="mb-3 mt-1 text-xs text-stone-500">
            Yang tidak dicentang tidak akan muncul di halaman Cari, Jual, dan
            Ambil toko itu. Toko yang stoknya masih ada tidak bisa dilepas —
            melepasnya sama saja menghilangkan barang yang betul-betul ada di
            rak.
          </p>
          <ul className="space-y-1">
            {tokoSemua.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-stone-50">
                  <input
                    type="checkbox"
                    checked={tokoDipilih.includes(t.id)}
                    onChange={(e) =>
                      setTokoDipilih(
                        e.target.checked
                          ? [...tokoDipilih, t.id]
                          : tokoDipilih.filter((x) => x !== t.id),
                      )
                    }
                    className="h-5 w-5 shrink-0 accent-pink-700"
                  />
                  <span className="text-sm font-medium">{t.nama}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

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
            if (
              !confirm(
                `Arsipkan ${produk.kode}?\n\n` +
                  'Produk hilang dari halaman Cari dan Opname, tapi harga, stok, ' +
                  'dan riwayat penjualannya tetap tersimpan. Bisa dipulihkan ' +
                  'lewat "Lihat arsip".',
              )
            )
              return
            try {
              await arsipkanProduk(produk.id)
              onSelesai()
            } catch (e) {
              setGalat(pesanGalat(e))
            }
          }}
          className="w-full py-2 text-sm text-stone-500 hover:text-rose-700"
        >
          Arsipkan produk ini
        </button>
      )}
    </div>
  )
}
