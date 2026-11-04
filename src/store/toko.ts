import { create } from 'zustand'
import type { Sesi, Tempat } from '../lib/types'

const KUNCI = 'fathia-stok:toko'

/**
 * Pilihan toko disimpan di perangkat, bukan di akun. HP yang dipakai di toko
 * gamis anak akan selalu terbuka sebagai toko gamis anak, sampai ada yang
 * keluar dan memilih toko lain saat login.
 *
 * Yang disimpan sekarang id TOKO, bukan id kategori. Sejak gamis dewasa punya
 * dua toko, kategori tidak lagi cukup untuk tahu rak mana yang sedang dipegang
 * — dan salah toko berarti stok toko sebelah yang berkurang.
 *
 * localStorage bisa gagal (mode privat, penyimpanan diblokir), jadi semua
 * akses dibungkus try/catch — kalau gagal, aplikasi tetap jalan, cuma pilihan
 * tokonya ditanya lagi tiap kali.
 */
function baca(): string | null {
  try {
    return localStorage.getItem(KUNCI)
  } catch {
    return null
  }
}

function tulis(id: string | null) {
  try {
    if (id) localStorage.setItem(KUNCI, id)
    else localStorage.removeItem(KUNCI)
  } catch {
    /* diabaikan — bukan kegagalan yang fatal */
  }
}

/**
 * Merangkai satu sesi kerja dari sebuah toko: gudang kategorinya ikut terbawa,
 * karena hampir setiap halaman butuh keduanya berdampingan — dan gudang itulah
 * yang dipakai bersama dengan toko sebelah.
 */
export function buatSesi(toko: Tempat | null, semua: Tempat[]): Sesi | null {
  if (!toko || toko.jenis !== 'toko' || !toko.kategori) return null
  return {
    toko,
    gudang: semua.find((t) => t.kategori_id === toko.kategori_id && t.jenis === 'gudang') ?? null,
    kategori: toko.kategori,
    tokoSekategori: semua.filter((t) => t.kategori_id === toko.kategori_id && t.jenis === 'toko')
      .length,
  }
}

interface TokoState {
  /** id toko yang tersimpan di perangkat; dipakai untuk mencocokkan ke daftar */
  tokoId: string | null
  /** sesi lengkap hasil pencocokan; null berarti belum dipilih */
  sesi: Sesi | null
  /** dipilih orang di layar login */
  pilihToko: (toko: Tempat, semua: Tempat[]) => void
  /** dipasang App setelah daftar tempat termuat, tanpa menulis ulang */
  pasangSesi: (s: Sesi | null) => void
  lupakanToko: () => void
}

export const useToko = create<TokoState>((set) => ({
  tokoId: baca(),
  sesi: null,

  pilihToko: (toko, semua) => {
    tulis(toko.id)
    set({ tokoId: toko.id, sesi: buatSesi(toko, semua) })
  },

  pasangSesi: (s) => set({ sesi: s }),

  lupakanToko: () => {
    tulis(null)
    set({ tokoId: null, sesi: null })
  },
}))
