import { supabase } from './supabase'
import type { JenisMutasi, Kategori, Lokasi, Mutasi, Produk, Role, Varian } from './types'
import { urutanUkuran } from './types'

const PILIH_PRODUK = '*, kategori:kategori_id(*), varian(*)'

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

/**
 * Kalau penolakan datang karena stok tercatat kurang, kembalikan lokasinya.
 * Dipakai Cari untuk menawarkan hitung ulang tepat di saat dibutuhkan —
 * bukan sebagai tombol yang nganggur di alur normal.
 */
export function lokasiStokKurang(e: unknown): Lokasi | null {
  const m = e instanceof Error ? e.message : String(e)
  if (/stok toko tercatat/i.test(m)) return 'toko'
  if (/stok gudang tercatat/i.test(m)) return 'gudang'
  return null
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
 * Pencarian utama: ketik kode hangtag atau sebagian nama.
 *
 * `kategoriId` wajib. Tiap toko fisik hanya menjual satu kategori, jadi
 * pencarian yang menjangkau kategori lain cuma membuka peluang salah input
 * barang toko sebelah tanpa si pemakai merasa berpindah ke mana-mana.
 */
export async function cariProduk(q: string, kategoriId: string): Promise<Produk[]> {
  const kueri = bersihkan(q)
  if (kueri.length < 1) return []

  const { data, error } = await supabase
    .from('produk')
    .select(PILIH_PRODUK)
    .eq('aktif', true)
    .eq('kategori_id', kategoriId)
    .or(`kode.ilike.%${kueri}%,nama.ilike.%${kueri}%`)
    .order('kode')
    .order('urutan', { referencedTable: 'varian' })
    .limit(30)

  if (error) throw error
  return (data ?? []) as unknown as Produk[]
}

/**
 * `aktif` memilih mana yang diambil: true = produk berjalan (dipakai semua
 * halaman kerja), false = isi arsip (hanya halaman Kelola).
 */
export async function produkPerKategori(kategoriId: string, aktif = true): Promise<Produk[]> {
  const { data, error } = await supabase
    .from('produk')
    .select(PILIH_PRODUK)
    .eq('kategori_id', kategoriId)
    .eq('aktif', aktif)
    .order('kode')
    .order('urutan', { referencedTable: 'varian' })

  if (error) throw error
  return (data ?? []) as unknown as Produk[]
}

/**
 * Semua pergerakan stok lewat sini, bukan update langsung ke tabel: fungsinya
 * mengunci baris, menolak hasil minus, dan menulis catatan mutasi dalam satu
 * transaksi — jadi angka dan riwayatnya tidak pernah berbeda.
 */
export async function catatMutasi(arg: {
  varianId: string
  jenis: Exclude<JenisMutasi, 'hitung_ulang'>
  deltaToko?: number
  deltaGudang?: number
  catatan?: string | null
}): Promise<Varian> {
  const { data, error } = await supabase.rpc('catat_mutasi', {
    p_varian_id: arg.varianId,
    p_jenis: arg.jenis,
    p_delta_toko: arg.deltaToko ?? 0,
    p_delta_gudang: arg.deltaGudang ?? 0,
    p_catatan: arg.catatan ?? null,
  })
  if (error) throw error
  return data as Varian
}

/**
 * Simpan banyak baris sekaligus dalam satu transaksi. Dipakai halaman Jual
 * dan Ambil: satu pesanan reseller biasanya lintas model, dan pesanan yang
 * tersimpan separuh lebih merepotkan daripada yang gagal seluruhnya.
 */
export async function catatMutasiBanyak(
  jenis: 'jual' | 'pindah_ke_toko' | 'barang_masuk' | 'koreksi',
  baris: { varian_id: string; jumlah: number }[],
  opsi?: {
    catatan?: string | null
    /** Wajib untuk 'koreksi' — jenis itu tidak punya arah bawaan. */
    lokasi?: Lokasi
    /** 'koreksi' saja: true berarti mengurangi. */
    kurang?: boolean
  },
): Promise<number> {
  const { data, error } = await supabase.rpc('catat_mutasi_banyak', {
    p_jenis: jenis,
    p_baris: baris,
    p_catatan: opsi?.catatan ?? null,
    p_lokasi: opsi?.lokasi ?? null,
    p_kurang: opsi?.kurang ?? false,
  })
  if (error) throw error
  return data as number
}

/** Set angka pasti hasil hitung fisik; menandai kapan terakhir dihitung. */
export async function hitungUlang(
  varianId: string,
  lokasi: Lokasi,
  jumlah: number,
  catatan?: string | null,
): Promise<Varian> {
  const { data, error } = await supabase.rpc('hitung_ulang', {
    p_varian_id: varianId,
    p_lokasi: lokasi,
    p_jumlah: jumlah,
    p_catatan: catatan ?? null,
  })
  if (error) throw error
  return data as Varian
}

export async function ambilMutasi(varianId: string, batas = 5): Promise<Mutasi[]> {
  const { data, error } = await supabase
    .from('mutasi')
    .select('*')
    .eq('varian_id', varianId)
    .order('created_at', { ascending: false })
    .limit(batas)
  if (error) throw error
  return (data ?? []) as Mutasi[]
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
