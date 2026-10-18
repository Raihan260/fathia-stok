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

/** Terjemahkan galat database jadi kalimat yang berguna buat orang di toko. */
export function pesanGalat(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/hanya admin/i.test(m)) return 'Hanya admin yang boleh mengubah harga atau ukuran.'
  if (/row-level security/i.test(m)) return 'Akun ini tidak punya izin untuk perubahan itu.'
  if (/duplicate key|already exists/i.test(m)) return 'Kode produk itu sudah dipakai produk lain.'
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

/** Pencarian utama: ketik kode hangtag atau sebagian nama. */
export async function cariProduk(q: string): Promise<Produk[]> {
  const kueri = bersihkan(q)
  if (kueri.length < 1) return []

  const { data, error } = await supabase
    .from('produk')
    .select(PILIH_PRODUK)
    .eq('aktif', true)
    .or(`kode.ilike.%${kueri}%,nama.ilike.%${kueri}%`)
    .order('kode')
    .order('urutan', { referencedTable: 'varian' })
    .limit(30)

  if (error) throw error
  return (data ?? []) as unknown as Produk[]
}

export async function produkPerKategori(kategoriId: string): Promise<Produk[]> {
  const { data, error } = await supabase
    .from('produk')
    .select(PILIH_PRODUK)
    .eq('kategori_id', kategoriId)
    .eq('aktif', true)
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

export async function hapusProduk(id: string): Promise<void> {
  // Soft delete: riwayat tetap ada, varian tidak ikut hilang.
  const { error } = await supabase.from('produk').update({ aktif: false }).eq('id', id)
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
