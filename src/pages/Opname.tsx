import { useEffect, useState } from 'react'
import {
  catatMutasi,
  catatMutasiBanyak,
  hitungUlang,
  pesanGalat,
  produkPerKategori,
} from '../lib/api'
import { useToko } from '../store/toko'
import type { Lokasi, Produk } from '../lib/types'
import { pcs, statusDari, umurHitung } from '../lib/types'
import { Galat, Kosong, Spinner, TitikStatus } from '../components/ui'

/**
 * Membetulkan catatan terhadap hitungan fisik, sekaligus jalur masuknya barang
 * baru ke gudang.
 *
 * Semua ukuran satu toko tampil sekaligus. Angka diisi dulu semuanya sambil
 * menghitung barang, baru disimpan sekali di akhir — menyimpan per baris
 * berarti menunggu jaringan di tengah hitungan.
 */
type Mode = 'hitung' | 'tambah'

export default function Opname() {
  const toko = useToko((s) => s.toko)
  const [daftar, setDaftar] = useState<Produk[]>([])
  const [q, setQ] = useState('')
  const [lokasi, setLokasi] = useState<Lokasi>('gudang')
  /**
   * Angka yang sama berarti dua hal berbeda tergantung mode, jadi modenya
   * dipilih sebelum mengetik, bukan diketik sebagai tanda "+": keypad angka
   * di HP tidak punya tombol plus sama sekali.
   */
  const [mode, setMode] = useState<Mode>('hitung')
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

  // Ganti lokasi atau mode mengosongkan draf. Angka toko tidak boleh tersimpan
  // ke gudang, dan "120" berarti hal yang sangat berbeda di tiap mode.
  useEffect(() => {
    setDraf({})
    setKabar(null)
  }, [lokasi, mode])

  const kolom = lokasi === 'toko' ? 'jumlah_toko' : 'jumlah_gudang'
  // Nol sah saat menghitung (barangnya memang habis), tapi tidak berarti
  // apa-apa saat menambah.
  const terisi = Object.entries(draf).filter(
    ([, v]) => v.trim() !== '' && (mode === 'hitung' || Number(v) > 0),
  )

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

    // Bedanya bukan cuma aritmatika:
    //
    //   hitung — angka mutlak hasil menghitung barang, DAN menandai kapan
    //            terakhir dihitung, karena barangnya memang baru dihitung.
    //   tambah — barang bertambah tanpa dihitung ulang. Tanggal hitung sengaja
    //            TIDAK direset: menambah stok tidak membuat angka lama jadi
    //            lebih bisa dipercaya.
    let berhasil = 0
    try {
      if (mode === 'tambah') {
        if (lokasi === 'gudang') {
          // Barang baru dari produksi: satu transaksi, semua atau tidak sama
          // sekali, dan tercatat sebagai barang masuk — bukan koreksi.
          await catatMutasiBanyak(
            'barang_masuk',
            terisi.map(([varianId, v]) => ({ varian_id: varianId, jumlah: Number(v) })),
          )
        } else {
          // Di toko tidak ada "barang masuk" — barang sampai ke rak lewat
          // gudang. Kelebihan di sini artinya catatannya yang meleset.
          for (const [varianId, v] of terisi) {
            await catatMutasi({ varianId, jenis: 'koreksi', deltaToko: Number(v) })
          }
        }
        berhasil = terisi.length
      } else {
        for (const [varianId, nilai] of terisi) {
          await hitungUlang(varianId, lokasi, Number(nilai))
          berhasil += 1
        }
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
      <h1 className="text-lg font-semibold">
        {mode === 'hitung' ? 'Hitung fisik' : 'Tambah stok'}
      </h1>

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

      {/*
        Modenya dipilih di sini, bukan diketik sebagai "+": keypad angka di HP
        tidak punya tombol plus. Warnanya sengaja beda jauh supaya salah mode
        kelihatan sebelum angkanya terlanjur masuk.
      */}
      <div className="flex overflow-hidden rounded-lg ring-1 ring-stone-300">
        {(
          [
            ['hitung', 'Hitung ulang'],
            ['tambah', 'Tambah'],
          ] as const
        ).map(([nilai, label]) => (
          <button
            key={nilai}
            onClick={() => setMode(nilai)}
            className={`flex-1 py-2 text-sm font-semibold ${
              mode === nilai
                ? nilai === 'tambah'
                  ? 'bg-sky-600 text-white'
                  : 'bg-pink-700 text-white'
                : 'bg-white text-stone-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p
        className={`rounded-lg px-4 py-2.5 text-xs leading-relaxed ${
          mode === 'tambah' ? 'bg-sky-50 text-sky-900' : 'bg-stone-100 text-stone-600'
        }`}
      >
        {mode === 'hitung' ? (
          <>
            Isi <strong>jumlah sebenarnya</strong> hasil menghitung barang. Angka
            lama diganti, dan tanggal hitungnya diperbarui.
          </>
        ) : (
          <>
            Isi <strong>berapa yang bertambah</strong>, bukan jumlah akhirnya.
            Angkanya ditambahkan ke yang tercatat, dan tanggal hitung sengaja
            tidak berubah — menambah stok tidak membuat hitungan lama jadi lebih
            bisa dipercaya.
          </>
        )}
      </p>

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
                        {/* Di mode tambah, hasil akhirnya ditampilkan supaya
                            jelas angka yang diketik itu tambahan, bukan total. */}
                        {mode === 'tambah' && Number(draf[v.id] ?? '') > 0 && (
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-sky-700">
                            → {sekarang + Number(draf[v.id])}
                          </span>
                        )}
                        <input
                          value={draf[v.id] ?? ''}
                          onChange={(e) =>
                            setDraf({ ...draf, [v.id]: e.target.value.replace(/\D/g, '') })
                          }
                          inputMode="numeric"
                          placeholder={mode === 'tambah' ? '+' : '—'}
                          aria-label={
                            mode === 'tambah'
                              ? `Tambahan ukuran ${v.ukuran}`
                              : `Hasil hitung ukuran ${v.ukuran}`
                          }
                          className={`w-20 shrink-0 rounded-lg border px-2 py-2 text-center font-semibold tabular-nums outline-none ${
                            mode === 'tambah'
                              ? 'border-sky-400 bg-sky-50 text-sky-900 focus:border-sky-600'
                              : 'border-stone-300 focus:border-pink-600'
                          }`}
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
              {terisi.length === 0
                ? mode === 'hitung'
                  ? 'Isi jumlah sebenarnya'
                  : 'Isi berapa yang bertambah'
                : `${terisi.length} ukuran siap · ${lokasi}`}
            </span>
            <button
              onClick={() => void simpanSemua()}
              disabled={menyimpan || terisi.length === 0}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 ${
                mode === 'tambah'
                  ? 'bg-sky-600 hover:bg-sky-700'
                  : 'bg-pink-700 hover:bg-pink-800'
              }`}
            >
              {menyimpan
                ? 'Menyimpan…'
                : mode === 'hitung'
                  ? 'Simpan hitungan'
                  : 'Tambahkan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
