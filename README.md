# Fathia Stok

Aplikasi internal untuk cek harga dan status stok Fathia Kids.
**Terpisah penuh dari Web_TIA** — repo sendiri, Supabase project sendiri,
site Netlify sendiri. Tidak ada koneksi apa pun ke katalog publik.

## Kenapa status, bukan jumlah

Stok disimpan sebagai `ada` / `menipis` / `habis`, bukan angka. Jumlah persis
hanya akurat kalau tiap barang keluar dicatat saat itu juga; sekali bolong,
angkanya salah dan lebih berbahaya daripada tidak ada data sama sekali karena
akan telanjur dipercaya. Status tiga level tetap menjawab pertanyaan yang
sebenarnya ("ini masih ada atau tidak") dan tahan kalau sesekali lupa update.

## Struktur data

- `kategori` — satu kategori = satu toko fisik, jadi lokasi barang otomatis
  ketahuan dari kategorinya. `preset_ukuran` dipakai untuk mengisi cepat saat
  menambah produk baru.
- `produk` — `kode` adalah yang dicetak di hangtag dan jadi pegangan utama saat
  mencari.
- `varian` — satu baris per ukuran. **Harga ada di sini**, karena harga beda per
  ukuran. Ukuran disimpan sebagai teks bebas (`1`, `5`, `S`, `XL`, `All size`)
  dengan kolom `urutan` supaya tampilannya urut benar, bukan alfabetis.

## Halaman

| Halaman | Isi |
|---|---|
| Cari | Kotak search, hasil berupa harga per ukuran + status. Tap ukuran untuk ganti status. |
| Kelola | Tambah/ubah produk dan ukuran. |
| Opname | Satu kategori per layar, semua ukuran sekaligus, untuk pengecekan rutin. |

## Setup

```bash
npm install
cp .env.example .env     # isi dengan kredensial project fathia-stok
npm run dev
```

Jalankan `supabase/migrations/0001_init.sql` di SQL Editor Supabase, lalu buat
akun admin manual di dashboard (Authentication → Users) dan matikan
"Allow new users to sign up".

## Aturan harga

Harga hidup di dua tempat: di sini dan di katalog Web_TIA. Supaya tidak pernah
bingung mana yang benar, aturannya satu arah: **ubah di sini dulu, katalog
menyusul.**

## Deploy

Netlify, build command `npm run build`, publish directory `dist`.
Set `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` di site settings.
Rencana subdomain: `stok.fathiakids.com`.
