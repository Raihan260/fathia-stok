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
  /** Diisi saat dipakai sebagai layar ganti toko, bukan langkah login. */
  onBatal,
  tokoAktifId,
  peringatan = [],
}: {
  tempat: Tempat[]
  email: string | undefined
  onPilih: (t: Tempat) => void
  onKeluar: () => void
  onBatal?: () => void
  tokoAktifId?: string | null
  /** Isian yang akan hilang kalau pindah toko. Kosong berarti tidak ada. */
  peringatan?: string[]
}) {
  // Gudang tidak ikut: tidak ada yang berjualan dari gudang, dan gudangnya
  // selalu ikut terbawa oleh toko yang dipilih.
  const toko = tempat.filter((t) => t.jenis === 'toko')

  /*
   * Dikelompokkan per kategori, karena satu kategori = satu gudang.
   *
   * Sebagai daftar rata, Cideng dan Metro tampil persis seperti toko lain yang
   * punya gudang sendiri-sendiri — padahal keduanya mengambil dari gudang yang
   * sama, dan itu justru hal yang paling perlu diingat saat memilih. Yang
   * menyatakannya di sini bukan label tambahan melainkan bentuknya: toko yang
   * berbagi gudang duduk dalam satu kotak.
   */
  const kelompok: { id: string; nama: string; toko: typeof tempat }[] = []
  for (const t of toko) {
    const ada = kelompok.find((g) => g.id === t.kategori_id)
    if (ada) ada.toko.push(t)
    else kelompok.push({ id: t.kategori_id, nama: t.kategori?.nama ?? '', toko: [t] })
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-700 text-lg font-bold text-white">
            FK
          </div>
          <h1 className="text-xl font-semibold">{onBatal ? 'Ganti toko' : 'Toko mana?'}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {onBatal
              ? 'Akunmu tetap masuk — tidak perlu ketik sandi lagi.'
              : 'Semua halaman akan menampilkan toko ini saja.'}
          </p>
        </div>

        {/*
          Isian yang belum tersimpan disebutkan SEBELUM memilih, bukan sesudah.
          Daftar sembilan baris yang hilang diam-diam baru disadari setelah
          terlambat — dan di toko itu berarti mengulang mengetik sementara
          pembelinya menunggu.
        */}
        {peringatan.length > 0 && (
          <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
            <p className="font-semibold">Pindah toko akan membuang isian ini:</p>
            <ul className="mt-1 list-inside list-disc">
              {peringatan.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-1.5">Memilih toko yang sekarang tidak membuang apa pun.</p>
          </div>
        )}

        <div className="space-y-2">
          {kelompok.map((g) =>
            // Kategori bertoko tunggal tetap satu tombol polos. Memberinya
            // kotak berjudul hanya memperberat tampilan untuk keterangan yang
            // tidak menerangkan apa-apa.
            g.toko.length === 1 ? (
              <Tombol
                key={g.toko[0].id}
                nama={labelTempat(g.toko[0], 1)}
                aktif={g.toko[0].id === tokoAktifId}
                onClick={() => onPilih(g.toko[0])}
              />
            ) : (
              <section
                key={g.id}
                className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200"
              >
                <header className="border-b border-stone-100 bg-stone-50 px-4 py-2.5">
                  <p className="text-sm font-semibold">{g.nama}</p>
                  {/* Dua kalimat sekaligus, karena dua-duanya mudah salah
                      diduga: gudangnya satu, tapi stok tokonya tidak. */}
                  <p className="mt-0.5 text-[11px] leading-snug text-stone-500">
                    {g.toko.length} toko, gudangnya satu dan dipakai bersama.
                    Stok tiap toko tetap terpisah.
                  </p>
                </header>
                <ul className="divide-y divide-stone-100">
                  {g.toko.map((t) => (
                    <li key={t.id}>
                      <Tombol
                        nama={t.nama}
                        aktif={t.id === tokoAktifId}
                        dalamKelompok
                        onClick={() => onPilih(t)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>

        {onBatal && (
          <button
            onClick={onBatal}
            className="mt-4 w-full rounded-xl border border-stone-300 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            Batal
          </button>
        )}

        {toko.length === 0 && (
          <p className="rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
            Belum ada toko di database.
          </p>
        )}

        <p className="mt-6 text-center text-xs text-stone-400">
          Masuk sebagai {email ?? '—'} ·{' '}
          <button onClick={onKeluar} className="underline underline-offset-2">
            keluar akun
          </button>
        </p>
      </div>
    </div>
  )
}

/**
 * Satu pilihan toko. Dua tampilan dari bentuk yang sama: berdiri sendiri
 * sebagai kartu, atau jadi baris di dalam kelompok toko yang berbagi gudang.
 */
function Tombol({
  nama,
  aktif,
  dalamKelompok = false,
  onClick,
}: {
  nama: string
  aktif: boolean
  dalamKelompok?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 px-4 text-left font-semibold transition ${
        dalamKelompok
          ? `py-3.5 ${aktif ? 'bg-pink-50' : 'hover:bg-pink-50'}`
          : `rounded-xl py-4 shadow-sm ring-1 ${
              aktif
                ? 'bg-pink-50 ring-pink-300'
                : 'bg-white ring-stone-200 hover:bg-pink-50 hover:ring-pink-300'
            }`
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{nama}</span>
      {aktif ? (
        <span className="shrink-0 text-xs font-medium text-pink-700">sedang dibuka</span>
      ) : (
        <span className="shrink-0 text-stone-300">›</span>
      )}
    </button>
  )
}
