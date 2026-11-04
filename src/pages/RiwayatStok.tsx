import { useEffect, useState } from 'react'
import { pesanGalat, riwayatPerubahan } from '../lib/api'
import { useToko } from '../store/toko'
import type { BarisRiwayat, JenisMutasi } from '../lib/types'
import { LABEL_MUTASI, jamSingkat, tanggalPanjang } from '../lib/types'
import { Galat, Kosong, Spinner } from '../components/ui'

/**
 * Alat pengawasan pemilik.
 *
 * Membatasi siapa yang boleh mengubah stok bukan jawabannya: mengunci
 * "Kurangi" tanpa mengunci "Hitung ulang" tidak mengamankan apa pun, karena
 * menghitung ulang ke angka lebih rendah memberi hasil yang sama. Mengunci
 * ketiganya merusak pekerjaannya, karena yang memegang barang di gudang
 * memang karyawan. Jadi: biarkan mereka bekerja, tapi buat jejaknya terlihat.
 *
 * Bawaannya menampilkan penyesuaian manual saja — itu yang perlu diperiksa.
 * Penjualan dan pemindahan gudang punya alur dan notanya sendiri.
 */
type Saringan = 'penyesuaian' | 'semua'

const JENIS_SARINGAN: Record<Saringan, JenisMutasi[] | null> = {
  penyesuaian: ['koreksi', 'hitung_ulang'],
  semua: null,
}

export default function RiwayatStok() {
  const sesi = useToko((s) => s.sesi)
  const [saringan, setSaringan] = useState<Saringan>('penyesuaian')
  const [baris, setBaris] = useState<BarisRiwayat[]>([])
  const [sibuk, setSibuk] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)

  useEffect(() => {
    if (!sesi) return
    setSibuk(true)
    riwayatPerubahan(sesi.kategori.id, JENIS_SARINGAN[saringan])
      .then((d) => {
        setBaris(d)
        setGalat(null)
      })
      .catch((e) => setGalat(pesanGalat(e)))
      .finally(() => setSibuk(false))
  }, [sesi?.kategori.id, saringan])

  // Dikelompokkan per tanggal supaya pola "setiap Sabtu turun" atau sejenisnya
  // kelihatan tanpa perlu membaca tiap baris.
  const perTanggal = new Map<string, BarisRiwayat[]>()
  for (const b of baris) {
    const k = b.created_at.slice(0, 10)
    perTanggal.set(k, [...(perTanggal.get(k) ?? []), b])
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Riwayat perubahan stok</h1>

      <div className="flex overflow-hidden rounded-lg ring-1 ring-stone-300">
        {(
          [
            ['penyesuaian', 'Penyesuaian'],
            ['semua', 'Semua pergerakan'],
          ] as const
        ).map(([nilai, label]) => (
          <button
            key={nilai}
            onClick={() => setSaringan(nilai)}
            className={`flex-1 py-2 text-sm font-semibold ${
              saringan === nilai ? 'bg-stone-900 text-white' : 'bg-white text-stone-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="rounded-lg bg-stone-100 px-4 py-2.5 text-xs leading-relaxed text-stone-600">
        {saringan === 'penyesuaian'
          ? 'Hitung ulang dan koreksi — perubahan stok yang tidak berasal dari penjualan atau pemindahan gudang. Yang perlu dicurigai bukan satu baris, tapi polanya: hitung ulang yang selalu menurun, atau koreksi minus berulang di ukuran yang sama.'
          : 'Semua pergerakan stok, termasuk penjualan dan pemindahan dari gudang ke toko.'}
      </p>

      {galat && <Galat pesan={galat} />}
      {sibuk ? (
        <Spinner />
      ) : baris.length === 0 ? (
        <Kosong teks="Belum ada perubahan tercatat." />
      ) : (
        <div className="space-y-5">
          {[...perTanggal.entries()].map(([tanggal, isi]) => (
            <section key={tanggal} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                {tanggalPanjang(tanggal)}
              </h2>
              <ul className="space-y-2">
                {isi.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-stone-200"
                  >
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-stone-700">
                        {b.kode}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-stone-700">
                        uk {b.ukuran}
                      </span>
                      <span className="flex-1 truncate text-xs text-stone-400">{b.nama}</span>
                    </div>

                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-sm font-medium">{LABEL_MUTASI[b.jenis]}</span>
                      {b.nota && (
                        <span className="font-mono text-[11px] text-stone-400">{b.nota}</span>
                      )}
                      <span className="ml-auto text-right text-sm font-bold tabular-nums">
                        <Perpindahan baris={b} />
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] text-stone-400">
                      {b.oleh} · {jamSingkat(b.created_at)}
                      {b.catatan && ` · ${b.catatan}`}
                    </p>
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

/**
 * Satu kejadian dibaca sebagai perpindahan, bukan dua selisih terpisah.
 *
 * Bentuk lamanya — "toko +12, gudang −12" — memaksa pembacanya merangkai
 * sendiri bahwa itu satu barang yang sama berpindah tempat. Dengan dua toko
 * dalam satu kategori, bentuk itu juga tidak lagi cukup: "toko" yang mana.
 */
function Perpindahan({ baris }: { baris: BarisRiwayat }) {
  const { jumlah, dari, ke, dari_setelah, ke_setelah } = baris
  if (jumlah == null) return <span className="text-stone-400">—</span>

  return (
    <span className="block">
      <span className="text-stone-900">{jumlah}</span>
      <span className="block text-[10px] font-normal text-stone-400">
        {dari ? (
          <>
            {dari}
            {dari_setelah != null && ` (${dari_setelah})`}
          </>
        ) : (
          'masuk'
        )}
        {' → '}
        {ke ? (
          <>
            {ke}
            {ke_setelah != null && ` (${ke_setelah})`}
          </>
        ) : (
          'keluar'
        )}
      </span>
    </span>
  )
}
