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

/** Satu baris riwayat perubahan stok, sudah digabung dengan produk dan pelakunya. */
export interface BarisRiwayat {
  id: string
  created_at: string
  jenis: JenisMutasi
  kode: string
  nama: string
  ukuran: string
  delta_toko: number
  delta_gudang: number
  toko_setelah: number
  gudang_setelah: number
  catatan: string | null
  oleh: string
  nota: string | null
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
 * Urutan ukuran.
 *
 * Label ukuran di sini sering berupa *rentang*, bukan satu ukuran: satu produk
 * dijual sebagai "456", "SML", dan "XLXXL" — masing-masing satu kelompok yang
 * dijual bersama. Urutan yang benar menurut yang pakai: 456, lalu SML, lalu
 * XLXXL.
 *
 * Versi pertama fungsi ini hanya mengenal ukuran tunggal (S, M, L, XL), jadi
 * semua gabungan jatuh ke satu angka yang sama — 900. Nilai kembar berarti
 * database bebas memilih mana yang lebih dulu, dan urutannya bisa berubah
 * sendiri antar pembukaan halaman tanpa ada yang mengubah apa pun. Itu keluhan
 * yang membuat fungsi ini ditulis ulang.
 *
 * Sekarang labelnya dipecah dulu jadi ukuran-ukuran penyusunnya, lalu diurutkan
 * berdasarkan ukuran TERKECIL di dalamnya — karena itulah yang menentukan
 * rentang mana yang datang lebih dulu. Ukuran terbesar jadi pemisah kalau yang
 * terkecil sama: "SML" sebelum "SMLXL", keduanya mulai dari S.
 */
const URUTAN_HURUF = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

// Dicoba dari yang paling panjang supaya "XXL" tidak terbaca sebagai "XL" + "L",
// dan "XLXXL" terbaca "XL" + "XXL" bukan "XL" + "X" + "XL".
const HURUF_TERPANJANG_DULU = [...URUTAN_HURUF].sort((a, b) => b.length - a.length)

/** Memecah "XLXXL" jadi [4, 5] (indeks di URUTAN_HURUF). [] kalau tidak dikenali. */
function pecahHuruf(teks: string): number[] {
  const hasil: number[] = []
  let sisa = teks
  while (sisa.length > 0) {
    const cocok = HURUF_TERPANJANG_DULU.find((h) => sisa.startsWith(h))
    if (!cocok) return []
    hasil.push(URUTAN_HURUF.indexOf(cocok))
    sisa = sisa.slice(cocok.length)
  }
  return hasil
}

export function urutanUkuran(ukuran: string): number {
  const bersih = ukuran.trim().toUpperCase()
  if (bersih === '') return 1_999

  // Angka tetap diurutkan sebagai angka — itu sudah benar sejak awal, dan
  // mencegah "10" muncul sebelum "2". Angka selalu di atas huruf.
  const angka = Number(bersih.replace(/[^\d.]/g, ''))
  if (/^\d/.test(bersih) && !Number.isNaN(angka)) return angka

  if (bersih === 'ALL SIZE' || bersih === 'ALLSIZE') return 1_900

  const bagian = pecahHuruf(bersih.replace(/[\s-]/g, ''))
  if (bagian.length === 0) return 1_950 // tidak dikenali: ditaruh paling bawah

  const terkecil = Math.min(...bagian)
  const terbesar = Math.max(...bagian)
  return 1_000 + terkecil * 10 + terbesar
}

/**
 * Pembanding yang dipakai saat menampilkan.
 *
 * Ada pemisah kedua berupa teks labelnya sendiri. Gunanya bukan keindahan:
 * selama pemisahnya cuma satu angka, dua label yang tidak dikenali fungsi di
 * atas akan kembali bernilai sama dan kembali bisa bertukar tempat sendiri.
 * Dengan pembanding ini, urutan yang tampil selalu sama setiap kali dibuka,
 * apa pun label yang diketik.
 */
export function bandingkanUkuran(a: string, b: string): number {
  const beda = urutanUkuran(a) - urutanUkuran(b)
  return beda !== 0 ? beda : a.localeCompare(b, 'id')
}
