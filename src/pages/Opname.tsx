import { useEffect, useState } from 'react'
import { hitungUlang, pesanGalat, produkPerKategori } from '../lib/api'
import { useToko } from '../store/toko'
import type { Lokasi, Produk } from '../lib/types'
import { pcs, statusDari, umurHitung } from '../lib/types'
import { Galat, Kosong, Spinner, TitikStatus } from '../components/ui'

/**
 * Satu-satunya tempat membetulkan catatan terhadap hitungan fisik. Halaman
 * Cari hanya mencatat kejadian (terjual, pindah, masuk); koreksi ada di sini
 * supaya tidak ada dua tempat mengerjakan hal yang sama.
 *
 * Semua ukuran satu toko tampil sekaligus. Angka diisi dulu semuanya sambil
 * menghitung barang, baru disimpan sekali di akhir — menyimpan per baris
 * berarti menunggu jaringan di tengah hitungan.
 *
 * Kotak pencarian untuk saat yang perlu dibetulkan cuma satu produk, supaya
 * tidak perlu scroll satu toko penuh.
 */
export default function Opname() {
  const toko = useToko((s) => s.toko)
  const [daftar, setDaftar] = useState<Produk[]>([])
  const [q, setQ] = useState('')
  const [lokasi, setLokasi] = useState<Lokasi>('gudang')
  const [draf, setDraf] = useState<Record<string, string>>({})
  const [sibuk, setSibuk] = useState(true)
  const [menyimpan, setMenyimpan] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [kabar, setKabar] = useState<string | null>(null)

  function muat() {
    if (!toko) return
    setSibuk(true)
    setDraf({})
    setKabar(null)
    produkPerKategori(toko.id)
      .then((d) => {
        setDaftar(d)
        setGalat(null)
      })
      .catch((e) => setGalat(pesanGalat(e)))
      .finally(() => setSibuk(false))
  }

  useEffect(() => {
    muat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toko?.id])

  // Ganti lokasi mengosongkan draf: angka toko tidak boleh tersimpan ke gudang.
  useEffect(() => {
    setDraf({})
    setKabar(null)
  }, [lokasi])

  const kolom = lokasi === 'toko' ? 'jumlah_toko' : 'jumlah_gudang'
  const terisi = Object.entries(draf).filter(([, v]) => v.trim() !== '')

  // Disaring di sisi aplikasi, bukan query ulang: satu toko sudah termuat
  // semua, dan angka yang sudah diketik tidak ikut hilang saat menyaring.
  const kueri = q.trim().toLowerCase()
  const tampil = kueri
    ? daftar.filter(
        (p) =>
          p.kode.toLowerCase().includes(kueri) || p.nama.toLowerCase().includes(kueri),
      )
    : daftar

  async function simpanSemua() {
    if (terisi.length === 0) {
      setGalat('Belum ada angka yang diisi.')
      return
    }
    setMenyimpan(true)
    setGalat(null)
    let berhasil = 0
    try {
      for (const [varianId, nilai] of terisi) {
        await hitungUlang(varianId, lokasi, Number(nilai))
        berhasil += 1
      }
      setKabar(`${berhasil} ukuran tersimpan.`)
      setDraf({})
      muat()
    } catch (e) {
      setGalat(`${pesanGalat(e)} (${berhasil} ukuran sempat tersimpan)`)
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <div className="space-y-4 pb-16">
      <h1 className="text-lg font-semibold">Hitung fisik</h1>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Saring: kode atau nama produk…"
        className="w-full rounded-lg border border-stone-300 px-4 py-2.5 outline-none focus:border-pink-600"
      />

      <div className="flex overflow-hidden rounded-lg ring-1 ring-stone-300">
        {(
          [
            ['gudang', 'Gudang'],
            ['toko', 'Toko'],
          ] as const
        ).map(([nilai, label]) => (
          <button
            key={nilai}
            onClick={() => setLokasi(nilai)}
            className={`flex-1 py-2 text-sm font-semibold ${
              lokasi === nilai ? 'bg-stone-900 text-white' : 'bg-white text-stone-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {galat && <Galat pesan={galat} />}
      {kabar && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {kabar}
        </p>
      )}

      {sibuk ? (
        <Spinner />
      ) : daftar.length === 0 ? (
        <Kosong teks={`Belum ada produk di ${toko?.nama ?? 'toko ini'}.`} />
      ) : tampil.length === 0 ? (
        <Kosong teks={`Tidak ada produk yang cocok dengan "${q}".`} />
      ) : (
        <div className="space-y-3">
          {tampil.map((p) => {
            const batas = p.kategori?.batas_menipis ?? 24
            return (
              <article key={p.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded bg-stone-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                    {p.kode}
                  </span>
                  <span className="truncate text-sm font-medium">{p.nama}</span>
                </div>
                <ul className="space-y-2">
                  {p.varian.map((v) => {
                    const sekarang = v[kolom]
                    const umur = umurHitung(
                      lokasi === 'toko' ? v.toko_dihitung_at : v.gudang_dihitung_at,
                    )
                    return (
                      <li key={v.id} className="flex items-center gap-3">
                        <span className="w-10 shrink-0 text-sm font-semibold text-stone-700">
                          {v.ukuran}
                        </span>
                        <span className="flex flex-1 items-center gap-1.5 text-xs">
                          <TitikStatus status={statusDari(sekarang, batas)} />
                          <span className="tabular-nums text-stone-600">{pcs(sekarang)}</span>
                          <span className={umur.basi ? 'text-amber-700' : 'text-stone-400'}>
                            · {umur.teks}
                          </span>
                        </span>
                        <input
                          value={draf[v.id] ?? ''}
                          onChange={(e) =>
                            setDraf({ ...draf, [v.id]: e.target.value.replace(/\D/g, '') })
                          }
                          inputMode="numeric"
                          placeholder="—"
                          aria-label={`Hasil hitung ukuran ${v.ukuran}`}
                          className="w-20 rounded-lg border border-stone-300 px-2 py-2 text-center font-semibold tabular-nums outline-none focus:border-pink-600"
                        />
                      </li>
                    )
                  })}
                </ul>
              </article>
            )
          })}
        </div>
      )}

      {daftar.length > 0 && (
        <div className="fixed inset-x-0 bottom-14 z-10 border-t border-stone-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <span className="flex-1 text-xs text-stone-500">
              {terisi.length === 0 ? 'Isi angka hasil hitung' : `${terisi.length} ukuran siap`}
            </span>
            <button
              onClick={() => void simpanSemua()}
              disabled={menyimpan || terisi.length === 0}
              className="rounded-lg bg-pink-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pink-800 disabled:opacity-40"
            >
              {menyimpan ? 'Menyimpan…' : 'Simpan hitungan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
