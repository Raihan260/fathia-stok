import { create } from 'zustand'

/**
 * Catatan kecil tentang isian yang belum tersimpan, supaya bagian lain
 * aplikasi tahu ada yang akan hilang sebelum membuangnya.
 *
 * Gunanya cuma satu: berpindah toko mengosongkan keranjang Jual, keranjang
 * Ambil, dan draf Opname. Kehilangan daftar sembilan baris tanpa pemberitahuan
 * adalah hal yang baru disadari setelah terlambat — dan di toko, mengulang
 * memasukkannya berarti pembeli yang menunggu.
 *
 * Yang disimpan kalimat jadi, bukan angka, supaya tiap halaman yang paling
 * tahu isinya sendiri yang menyusun kalimatnya.
 */
interface DrafState {
  isi: Record<string, string>
  /** `pesan` null berarti halaman itu tidak punya isian tertunda lagi. */
  setDraf: (kunci: string, pesan: string | null) => void
}

export const useDraf = create<DrafState>((set) => ({
  isi: {},
  setDraf: (kunci, pesan) =>
    set((s) => {
      if (s.isi[kunci] === (pesan ?? undefined)) return s
      const isi = { ...s.isi }
      if (pesan) isi[kunci] = pesan
      else delete isi[kunci]
      return { isi }
    }),
}))
