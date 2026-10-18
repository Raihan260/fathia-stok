export type StatusStok = 'ada' | 'menipis' | 'habis'

/** admin: semua. staf: hanya boleh mengubah status stok. */
export type Role = 'admin' | 'staf'

export const SEMUA_STATUS: StatusStok[] = ['ada', 'menipis', 'habis']

export interface Kategori {
  id: string
  slug: string
  nama: string
  preset_ukuran: string[]
  urutan: number
}

export interface Varian {
  id: string
  produk_id: string
  ukuran: string
  urutan: number
  harga_grosir: number
  stok_toko: StatusStok
  stok_gudang: StatusStok
  updated_at: string
}

export interface Produk {
  id: string
  kode: string
  nama: string
  kategori_id: string
  catatan: string | null
  aktif: boolean
  kategori?: Kategori | null
  varian: Varian[]
}

export const rupiah = (n: number) => 'Rp' + new Intl.NumberFormat('id-ID').format(n)

/**
 * Urutan ukuran. Angka diurutkan sebagai angka, huruf pakai urutan baku
 * konveksi (S < M < L < XL ...). Dipakai saat menyimpan varian baru supaya
 * tampilannya tidak jadi alfabetis (yang bikin "10" muncul sebelum "2").
 */
const URUTAN_HURUF = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'ALL SIZE']

export function urutanUkuran(ukuran: string): number {
  const bersih = ukuran.trim().toUpperCase()
  const angka = Number(bersih.replace(/[^\d.]/g, ''))
  if (bersih !== '' && /^\d/.test(bersih) && !Number.isNaN(angka)) return angka
  const idx = URUTAN_HURUF.indexOf(bersih)
  return idx === -1 ? 900 : 1000 + idx
}
