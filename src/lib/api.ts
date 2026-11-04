import { supabase } from './supabase'
import type {
  BarisRiwayat,
  JenisMutasi,
  Kategori,
  Mutasi,
  Produk,
  Role,
  Tempat,
  Transaksi,
  Varian,
} from './types'
import { bandingkanUkuran, stokDi, urutanUkuran } from './types'

// Stok ikut terbawa sebagai baris per tempat. Semua tempat milik kategorinya
// ikut, bukan cuma toko yang sedang dibuka: halaman Cari menampilkan stok toko
// dan gudang berdampingan, dan gudangnya dipakai bersama antar toko.
const PILIH_PRODUK =
  '*, kategori:kategori_id(*), varian(*, stok(lokasi_id, jumlah, dihitung_at))'

/**
 * Role user yang sedang login. Kalau gagal dibaca, anggap 'staf' — izin paling
 * sempit, supaya kegagalan jaringan tidak pernah membuka akses admin.
 */
export async function ambilRole(userId: string): Promise<Role> {
  const { data } = await supabase
    .from('profil')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  return data?.role === 'admin' ? 'admin' : 'staf'
}

/** Terjemahkan galat database jadi kalimat yang berguna buat orang di toko. */
export function pesanGalat(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/hanya admin/i.test(m)) return 'Hanya admin yang boleh mengubah harga atau ukuran.'
  if (/row-level security/i.test(m)) return 'Akun ini tidak punya izin untuk perubahan itu.'
  // Kode unik berlaku juga untuk produk yang diarsipkan, dan produk arsip
  // tidak kelihatan di daftar — tanpa petunjuk ini orang akan bingung.
  if (/duplicate key|already exists/i.test(m))
    return 'Kode itu sudah dipakai produk lain. Cek juga arsip — kode produk yang diarsipkan tetap terpakai.'
  if (/failed to fetch|networkerror/i.test(m)) return 'Tidak tersambung. Cek koneksi, lalu coba lagi.'
  return m
}

/** Karakter yang merusak sintaks filter `.or()` PostgREST. */
const bersihkan = (q: string) => q.replace(/[,()%\\]/g, ' ').trim()

export async function ambilKategori(): Promise<Kategori[]> {
  const { data, error } = await supabase.from('kategori').select('*').order('urutan')
  if (error) throw error
  return data ?? []
}

/**
 * Semua tempat: toko-toko dan gudang tiap kategori.
 *
 * Dipakai layar pemilihan toko saat login, dan halaman Opname untuk memilih
 * tempat mana yang sedang dihitung. Perlu login untuk membacanya, jadi
 * pemilihan toko memang jadi langkah kedua sesudah masuk, bukan sebelum.
 */
export async function ambilTempat(): Promise<Tempat[]> {
  const { data, error } = await supabase
    .from('lokasi')
    .select('*, kategori:kategori_id(*)')
    .eq('aktif', true)
    .order('urutan')
    .order('nama')
  if (error) throw error
  return (data ?? []) as unknown as Tempat[]
}

/**
 * Pencarian utama: ketik kode hangtag atau sebagian nama.
 *
 * `kategoriId` wajib. Tiap toko fisik hanya menjual satu kategori, jadi
 * pencarian yang menjangkau kategori lain cuma membuka peluang salah input
 * barang toko sebelah tanpa si pemakai merasa berpindah ke mana-mana.
 */
/**
 * Mengurutkan ukuran di sisi aplikasi, bukan mengandalkan kolom `urutan`.
 *
 * Kolom `urutan` diisi sekali saat varian disimpan, jadi memperbaiki rumus
 * urutannya tidak membetulkan baris yang sudah lama ada — nilainya tetap yang
 * lama. Dihitung di sini, perbaikan rumus langsung berlaku untuk semua produk
 * yang sudah pernah dimasukkan, tanpa perlu menyentuh satu baris pun di
 * database.
 */
function urutkanVarian(produk: Produk[]): Produk[] {
  for (const p of produk) {
    p.varian?.sort((a, b) => bandingkanUkuran(a.ukuran, b.ukuran))
  }
  return produk
}

/**
 * Menyaring ke produk yang memang dijual di toko ini.
 *
 * Sebagian model cuma ada di salah satu toko. Yang menyatakannya bukan kolom
 * tersendiri melainkan ada-tidaknya baris stok di toko itu — "tidak dijual di
 * sini" dan "dijual di sini tapi kosong" dua hal berbeda, dan perbedaan itu
 * persis tergambar oleh ada atau tidaknya barisnya.
 *
 * Tanpa `tokoId` tidak ada yang disaring: halaman Kelola memang perlu melihat
 * seluruh produk kategorinya, termasuk yang belum dijual di mana-mana.
 */
function hanyaDijualDi(produk: Produk[], tokoId?: string | null): Produk[] {
  if (!tokoId) return produk
  return produk.filter((p) => p.varian?.some((v) => stokDi(v, tokoId)))
}

export async function cariProduk(
  q: string,
  kategoriId: string,
  tokoId?: string | null,
): Promise<Produk[]> {
  const kueri = bersihkan(q)
  if (kueri.length < 1) return []

  const { data, error } = await supabase
    .from('produk')
    .select(PILIH_PRODUK)
    .eq('aktif', true)
    .eq('kategori_id', kategoriId)
    .or(`kode.ilike.%${kueri}%,nama.ilike.%${kueri}%`)
    .order('kode')
    .limit(30)

  if (error) throw error
  return hanyaDijualDi(urutkanVarian((data ?? []) as unknown as Produk[]), tokoId)
}

/**
 * `aktif` memilih mana yang diambil: true = produk berjalan (dipakai semua
 * halaman kerja), false = isi arsip (hanya halaman Kelola).
 */
export async function produkPerKategori(
  kategoriId: string,
  aktif = true,
  tokoId?: string | null,
): Promise<Produk[]> {
  const { data, error } = await supabase
    .from('produk')
    .select(PILIH_PRODUK)
    .eq('kategori_id', kategoriId)
    .eq('aktif', aktif)
    .order('kode')

  if (error) throw error
  return hanyaDijualDi(urutkanVarian((data ?? []) as unknown as Produk[]), tokoId)
}

/**
 * Semua pergerakan stok lewat sini, bukan update langsung ke tabel: fungsinya
 * mengunci baris, menolak hasil minus, dan menulis catatan mutasi dalam satu
 * transaksi — jadi angka dan riwayatnya tidak pernah berbeda.
 *
 * Bentuknya satu untuk semua, karena semua pergerakan memang satu bentuk:
 * sejumlah barang berpindah dari suatu tempat ke suatu tempat, dan salah satu
 * sisinya boleh kosong. Terjual berarti keluar dari toko tanpa tujuan; barang
 * masuk berarti tiba di gudang tanpa asal.
 *
 * Seluruh daftar tersimpan sekaligus atau tidak sama sekali: pesanan yang
 * masuk separuh lebih berbahaya daripada yang gagal, karena yang separuh tidak
 * kelihatan.
 */
export async function catatPergerakan(
  jenis: Exclude<JenisMutasi, 'hitung_ulang'>,
  baris: { varian_id: string; jumlah: number }[],
  arah: { dari?: string | null; ke?: string | null },
  catatan?: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc('catat_pergerakan', {
    p_jenis: jenis,
    p_baris: baris,
    p_dari: arah.dari ?? null,
    p_ke: arah.ke ?? null,
    p_catatan: catatan ?? null,
  })
  if (error) throw error
  return data as number
}

/** Set angka pasti hasil hitung fisik; menandai kapan terakhir dihitung. */
export async function hitungFisik(
  varianId: string,
  lokasiId: string,
  jumlah: number,
  catatan?: string | null,
): Promise<number> {
  const { data, error } = await supabase.rpc('hitung_fisik', {
    p_varian_id: varianId,
    p_lokasi_id: lokasiId,
    p_jumlah: jumlah,
    p_catatan: catatan ?? null,
  })
  if (error) throw error
  return data as number
}

/**
 * Mencatat satu penjualan beserta notanya dalam satu transaksi: stok turun,
 * mutasi tercatat, nota dan baris-barisnya terbentuk — semua atau tidak sama
 * sekali. Harga disalin ke notanya di sisi database, bukan dikirim dari sini,
 * supaya nota tidak bisa berisi harga yang dikarang.
 *
 * Yang dikirim adalah toko, bukan kategori: dengan dua toko dalam satu
 * kategori, kategori tidak lagi cukup untuk tahu stok mana yang berkurang.
 */
export async function catatPenjualanToko(
  tokoId: string,
  baris: { varian_id: string; jumlah: number }[],
  pembeli?: string | null,
  catatan?: string | null,
): Promise<{ id: string; nomor: string; tanggal: string; total: number; baris: number }> {
  const { data, error } = await supabase.rpc('catat_penjualan_toko', {
    p_lokasi_id: tokoId,
    p_baris: baris,
    p_pembeli: pembeli ?? null,
    p_catatan: catatan ?? null,
  })
  if (error) throw error
  return data as { id: string; nomor: string; tanggal: string; total: number; baris: number }
}

/**
 * Menentukan toko mana saja yang menjual sebuah produk. Menambah toko akan
 * membuat baris stoknya (mulai dari nol); melepas toko ditolak kalau stoknya
 * di situ masih ada, karena melepasnya sama saja menghilangkan barang yang
 * betul-betul ada di rak.
 */
export async function aturTokoProduk(produkId: string, tokoIds: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('atur_toko_produk', {
    p_produk_id: produkId,
    p_toko_ids: tokoIds,
  })
  if (error) throw error
  return data as number
}

/**
 * Nota satu kategori. Sengaja TIDAK disaring per toko: pemilik yang membuka
 * dari toko mana pun tetap ingin melihat seluruh penjualan kategorinya, dan
 * tiap barisnya sudah menyebut dari toko mana ia keluar.
 */
export async function ambilTransaksi(kategoriId: string, batas = 100): Promise<Transaksi[]> {
  const { data, error } = await supabase
    .from('transaksi')
    .select('*, lokasi:lokasi_id(nama)')
    .eq('kategori_id', kategoriId)
    .order('created_at', { ascending: false })
    .limit(batas)
  if (error) throw error
  return (data ?? []) as unknown as Transaksi[]
}

export async function ambilTransaksiSatu(id: string): Promise<Transaksi | null> {
  const { data, error } = await supabase
    .from('transaksi')
    .select('*, lokasi:lokasi_id(nama), transaksi_item(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as Transaksi | null) ?? null
}

/**
 * Nama pembeli yang pernah dipakai, untuk saran saat mengetik. Gunanya bukan
 * kerapian: tanpa ini "Bu Ani", "bu ani", dan "Ani" jadi tiga orang berbeda,
 * dan data pembelinya tidak berguna sejak awal.
 */
export async function ambilNamaPembeli(kategoriId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('transaksi')
    .select('pembeli')
    .eq('kategori_id', kategoriId)
    .not('pembeli', 'is', null)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error
  const unik = new Set<string>()
  for (const r of data ?? []) if (r.pembeli) unik.add(r.pembeli as string)
  return [...unik]
}

/**
 * Riwayat perubahan stok untuk admin. Lewat RPC, bukan query biasa, karena
 * barisnya perlu menyebut email pelakunya dan `auth.users` tidak terbaca dari
 * sisi aplikasi. Fungsinya menolak pemanggil yang bukan admin.
 */
export async function riwayatPerubahan(
  kategoriId: string,
  jenis: JenisMutasi[] | null,
  lokasiId?: string | null,
  batas = 100,
): Promise<BarisRiwayat[]> {
  const { data, error } = await supabase.rpc('riwayat_perubahan', {
    p_kategori_id: kategoriId,
    p_jenis: jenis,
    p_lokasi_id: lokasiId ?? null,
    p_batas: batas,
    p_lewati: 0,
  })
  if (error) throw error
  return (data ?? []) as BarisRiwayat[]
}

export async function ambilMutasi(varianId: string, batas = 5): Promise<Mutasi[]> {
  const { data, error } = await supabase
    .from('mutasi')
    .select('*, dari:dari_lokasi_id(nama), ke:ke_lokasi_id(nama)')
    .eq('varian_id', varianId)
    .order('created_at', { ascending: false })
    .limit(batas)
  if (error) throw error
  return (data ?? []) as unknown as Mutasi[]
}

export async function simpanProduk(p: {
  id?: string
  kode: string
  nama: string
  kategori_id: string
  catatan: string | null
}): Promise<string> {
  const isi = { ...p, kode: p.kode.trim().toUpperCase(), nama: p.nama.trim() }
  const { data, error } = await supabase.from('produk').upsert(isi).select('id').single()
  if (error) throw error
  return data.id as string
}

/**
 * Mengarsipkan, bukan menghapus. Tabel mutasi terhubung ke varian dengan
 * `on delete cascade`, jadi hapus betulan ikut menghapus seluruh riwayat
 * penjualan produk itu. Diarsipkan: hilang dari halaman kerja, datanya utuh.
 */
export async function arsipkanProduk(id: string, arsip = true): Promise<void> {
  const { error } = await supabase.from('produk').update({ aktif: !arsip }).eq('id', id)
  if (error) throw error
}

export async function simpanVarian(v: {
  id?: string
  produk_id: string
  ukuran: string
  harga_grosir: number
}): Promise<Varian> {
  const ukuran = v.ukuran.trim()
  const { data, error } = await supabase
    .from('varian')
    .upsert({ ...v, ukuran, urutan: urutanUkuran(ukuran) }, { onConflict: 'produk_id,ukuran' })
    .select('*')
    .single()
  if (error) throw error
  return data as Varian
}

export async function hapusVarian(id: string): Promise<void> {
  const { error } = await supabase.from('varian').delete().eq('id', id)
  if (error) throw error
}
