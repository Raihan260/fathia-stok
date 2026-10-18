export type StatusStok = 'ada' | 'menipis' | 'habis'

/** admin: semua, termasuk harga. staf: stok saja, tidak boleh menyentuh harga. */
export type Role = 'admin' | 'staf'

export interface Kategori {
  id: string
  slug: string
  nama: string
  preset_ukuran: string[]
  batas_menipis: number
  urutan: number
}

export interface Varian {
  id: string
  produk_id: string
  ukuran: string
  urutan: number
  harga_grosir: number
  jumlah_toko: number
  jumlah_gudang: number
  toko_dihitung_at: string | null
  gudang_dihitung_at: string | null
  updated_at: string
}

export type Lokasi = 'toko' | 'gudang'

export type JenisMutasi =
  | 'jual'
  | 'barang_masuk'
  | 'pindah_ke_toko'
  | 'hitung_ulang'
  | 'koreksi'

export interface Mutasi {
  id: string
  varian_id: string
  jenis: JenisMutasi
  delta_toko: number
  delta_gudang: number
  toko_setelah: number
  gudang_setelah: number
  catatan: string | null
  oleh: string | null
  created_at: string
}

/**
 * Baris nota menyimpan SALINAN kode, nama, ukuran, dan harga saat transaksi
 * terjadi — bukan menunjuk ke produk. Harga yang naik bulan depan tidak boleh
 * mengubah nota bulan lalu.
 */
export interface TransaksiItem {
  id: string
  kode: string
  nama: string
  ukuran: string
  harga: number
  jumlah: number
  subtotal: number
}

export interface Transaksi {
  id: string
  nomor: string
  tanggal: string
  pembeli: string | null
  catatan: string | null
  total: number
  created_at: string
  transaksi_item?: TransaksiItem[]
}

export const tanggalPanjang = (iso: string) =>
  new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export const jamSingkat = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

export const LABEL_MUTASI: Record<JenisMutasi, string> = {
  jual: 'Terjual',
  barang_masuk: 'Barang masuk',
  pindah_ke_toko: 'Gudang → toko',
  hitung_ulang: 'Hitung ulang',
  koreksi: 'Koreksi',
}

/** Status bukan lagi data tersimpan — diturunkan dari jumlah. */
export function statusDari(jumlah: number, batasMenipis: number): StatusStok {
  if (jumlah <= 0) return 'habis'
  if (jumlah <= batasMenipis) return 'menipis'
  return 'ada'
}

/** Setelah sekian hari tanpa hitung fisik, angkanya tidak lagi dipercaya. */
export const HARI_SEBELUM_BASI = 14

export interface UmurHitung {
  teks: string
  basi: boolean
}

export function umurHitung(iso: string | null): UmurHitung {
  if (!iso) return { teks: 'belum pernah dihitung', basi: true }
  const hari = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  const teks =
    hari <= 0 ? 'dihitung hari ini' : hari === 1 ? 'dihitung kemarin' : `dihitung ${hari} hari lalu`
  return { teks, basi: hari >= HARI_SEBELUM_BASI }
}

export const pcs = (n: number) => `${new Intl.NumberFormat('id-ID').format(n)} pcs`

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
