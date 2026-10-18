import { create } from 'zustand'
import type { Kategori } from '../lib/types'

const KUNCI = 'fathia-stok:toko'

/**
 * Pilihan toko disimpan di perangkat, bukan di akun. HP yang dipakai di toko
 * gamis anak akan selalu terbuka sebagai toko gamis anak, sampai ada yang
 * keluar dan memilih toko lain saat login.
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

interface TokoState {
  /** id yang tersimpan di perangkat; dipakai untuk mencocokkan ke daftar */
  tokoId: string | null
  /** kategori lengkap hasil pencocokan; null berarti belum dipilih */
  toko: Kategori | null
  /** dipilih orang di layar login */
  pilihToko: (k: Kategori) => void
  /** dipasang App setelah daftar kategori termuat, tanpa menulis ulang */
  pasangToko: (k: Kategori | null) => void
  lupakanToko: () => void
}

export const useToko = create<TokoState>((set) => ({
  tokoId: baca(),
  toko: null,

  pilihToko: (k) => {
    tulis(k.id)
    set({ tokoId: k.id, toko: k })
  },

  pasangToko: (k) => set({ toko: k }),

  lupakanToko: () => {
    tulis(null)
    set({ tokoId: null, toko: null })
  },
}))
