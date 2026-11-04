import type { Tempat } from '../lib/types'
import { labelTempat } from '../lib/types'

/**
 * Langkah kedua login: toko mana. Dipisah dari form email/sandi karena daftar
 * tempat baru bisa dibaca setelah terautentikasi.
 *
 * Yang dipilih di sini sebuah TOKO, bukan kategori. Sejak satu kategori bisa
 * punya dua toko yang berbagi gudang, kategori tidak lagi menunjuk ke satu rak
 * — dan salah pilih berarti stok toko sebelah yang berkurang.
 *
 * Pilihannya hanya muncul saat login betul-betul baru. Muat ulang halaman
 * tidak menanyakannya lagi — pilihan tersimpan di perangkat.
 */
export default function PilihToko({
  tempat,
  email,
  onPilih,
  onKeluar,
}: {
  tempat: Tempat[]
  email: string | undefined
  onPilih: (t: Tempat) => void
  onKeluar: () => void
}) {
  // Gudang tidak ikut: tidak ada yang berjualan dari gudang, dan gudangnya
  // selalu ikut terbawa oleh toko yang dipilih.
  const toko = tempat.filter((t) => t.jenis === 'toko')

  const jumlahTokoSekategori = (kategoriId: string) =>
    toko.filter((t) => t.kategori_id === kategoriId).length

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-700 text-lg font-bold text-white">
            FK
          </div>
          <h1 className="text-xl font-semibold">Toko mana?</h1>
          <p className="mt-1 text-sm text-stone-500">
            Semua halaman akan menampilkan toko ini saja.
          </p>
        </div>

        <div className="space-y-2">
          {toko.map((t) => (
            <button
              key={t.id}
              onClick={() => onPilih(t)}
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-4 text-left font-semibold shadow-sm ring-1 ring-stone-200 transition hover:bg-pink-50 hover:ring-pink-300"
            >
              <span className="min-w-0 flex-1 truncate">
                {labelTempat(t, jumlahTokoSekategori(t.kategori_id))}
              </span>
              <span className="shrink-0 text-stone-300">›</span>
            </button>
          ))}
        </div>

        {toko.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
            Belum ada toko di database.
          </p>
        )}

        <p className="mt-6 text-center text-xs text-stone-400">
          Masuk sebagai {email ?? '—'} ·{' '}
          <button onClick={onKeluar} className="underline underline-offset-2">
            keluar
          </button>
        </p>
      </div>
    </div>
  )
}
