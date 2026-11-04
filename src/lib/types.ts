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

export type JenisTempat = 'toko' | 'gudang'

/**
 * Satu tempat fisik: sebuah toko, atau gudang milik kategorinya.
 *
 * Dulu "toko" dan "gudang" cuma dua kolom angka di tiap ukuran. Bentuk itu
 * muat tepat dua tempat dan tidak bisa lebih — padahal gamis dewasa punya dua
 * toko yang berbagi satu gudang. Sekarang tempat jadi barisnya sendiri, jadi
 * satu kategori boleh punya berapa pun toko.
 */
export interface Tempat {
  id: string
  kategori_id: string
  nama: string
  jenis: JenisTempat
  urutan: number
  aktif: boolean
  kategori?: Kategori | null
}

/** Stok satu ukuran di satu tempat. */
export interface StokBaris {
  lokasi_id: string
  jumlah: number
  dihitung_at: string | null
}

export interface Varian {
  id: string
  produk_id: string
  ukuran: string
  urutan: number
  harga_grosir: number
  updated_at: string
  /** Satu baris per tempat milik kategorinya. */
  stok: StokBaris[]
}

/**
 * Stok sebuah ukuran di sebuah tempat.
 *
 * Mengembalikan `undefined`, bukan nol, kalau barisnya tidak ada — karena
 * "tidak dijual di sini" dan "dijual di sini tapi habis" adalah dua hal
 * berbeda, dan menyamakannya akan membuat barang yang tidak pernah dijual di
 * sebuah toko ikut muncul sebagai barang kosong di sana.
 */
export function stokDi(v: Varian, lokasiId: string | null | undefined): StokBaris | undefined {
  if (!lokasiId) return undefined
  return v.stok?.find((s) => s.lokasi_id === lokasiId)
}

/** Nol kalau tidak dijual di tempat itu — untuk hitung-hitungan ringkas. */
export const jumlahDi = (v: Varian, lokasiId: string | null | undefined) =>
  stokDi(v, lokasiId)?.jumlah ?? 0

/**
 * Nama toko sebagaimana ditulis di layar.
 *
 * Kategori yang cuma punya satu toko tidak perlu embel-embel: "Gamis Anak
 * Perempuan" sudah menunjuk ke satu tempat. Yang punya dua baru butuh
 * pembeda, dan di situ nama tokonya ikut disebut.
 */
export function labelTempat(t: Tempat, tokoSekategori: number): string {
  const kat = t.kategori?.nama ?? ''
  if (t.jenis === 'gudang') return kat ? `Gudang ${kat}` : 'Gudang'
  return tokoSekategori > 1 && t.nama ? `${kat} — ${t.nama}` : kat || t.nama
}

/** Tempat kerja satu sesi: toko yang dipilih, plus gudang kategorinya. */
export interface Sesi {
  toko: Tempat
  gudang: Tempat | null
  kategori: Kategori
  /** Berapa toko yang dimiliki kategori ini — menentukan cara menamainya. */
  tokoSekategori: number
}

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
  jumlah: number | null
  dari_lokasi_id: string | null
  ke_lokasi_id: string | null
  dari_setelah: number | null
  ke_setelah: number | null
  catatan: string | null
  oleh: string | null
  created_at: string
  /** Nama tempatnya, ikut terbawa supaya riwayat terbaca tanpa menebak id. */
  dari?: { nama: string } | null
  ke?: { nama: string } | null
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
  lokasi_id: string | null
  /** Nama toko asal nota; ikut tersimpan sejak satu kategori bisa punya dua. */
  lokasi?: { nama: string } | null
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
  jumlah: number | null
  dari: string | null
  ke: string | null
  dari_setelah: number | null
  ke_setelah: number | null
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
