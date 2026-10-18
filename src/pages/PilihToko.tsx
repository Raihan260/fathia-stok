import type { Kategori } from '../lib/types'

/**
 * Langkah kedua login: toko mana. Dipisah dari form email/sandi karena daftar
 * kategori baru bisa dibaca setelah terautentikasi.
 *
 * Pilihannya hanya muncul saat login betul-betul baru. Muat ulang halaman
 * tidak menanyakannya lagi — pilihan tersimpan di perangkat.
 */
export default function PilihToko({
  kategori,
  email,
  onPilih,
  onKeluar,
}: {
  kategori: Kategori[]
  email: string | undefined
  onPilih: (k: Kategori) => void
  onKeluar: () => void
}) {
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
          {kategori.map((k) => (
            <button
              key={k.id}
              onClick={() => onPilih(k)}
              className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-4 text-left font-semibold shadow-sm ring-1 ring-stone-200 transition hover:bg-pink-50 hover:ring-pink-300"
            >
              {k.nama}
              <span className="text-stone-300">›</span>
            </button>
          ))}
        </div>

        {kategori.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
            Belum ada kategori toko di database.
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
