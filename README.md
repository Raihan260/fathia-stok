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

## Satu sesi = satu toko

Tiap kategori punya toko fisik sendiri di lokasi berbeda. Toko dipilih sekali
saat login, lalu seluruh aplikasi terkunci ke toko itu: tidak ada chip kategori
di halaman mana pun, dan **pencarian hanya menjangkau kategori toko itu**.
Pencarian lintas kategori adalah sumber salah input yang paling berbahaya —
bisa terjadi tanpa si pemakai merasa berpindah ke mana-mana.

Nama toko ditampilkan tetap di header supaya salah toko ketahuan sebelum
sempat salah input. Produk baru otomatis masuk kategori toko yang aktif.

Pilihan toko disimpan di perangkat (`localStorage`), jadi HP yang dipakai di
toko gamis anak akan selalu terbuka sebagai toko itu. Muat ulang halaman tidak
menanyakan lagi; untuk ganti toko harus keluar lalu login lagi.

Ini mencegah **kekeliruan**, bukan penyalahgunaan: pembatasannya di aplikasi,
bukan di database. Kalau suatu saat perlu ditegakkan — misalnya karyawan toko
A benar-benar tidak boleh menyentuh data toko B lewat cara apa pun — tambahkan
kolom `kategori_id` di `profil` dan ikat policy RLS ke situ.

## Peran: admin dan staf

| | admin | staf |
|---|---|---|
| Lihat harga & stok | ya | ya |
| Ubah status stok | ya | ya |
| Tambah/ubah/hapus produk & ukuran | ya | tidak |
| Ubah harga | ya | tidak |

RLS Postgres bekerja per baris, bukan per kolom, jadi aturan "staf hanya boleh
mengubah kolom status" tidak bisa ditulis sebagai policy. Policy `update` pada
`varian` dibuat terbuka, lalu trigger `jaga_kolom_varian` menolak perubahan
`harga_grosir`, `ukuran`, `urutan`, dan `produk_id` oleh non-admin. Karena di
level database, batasan ini tetap berlaku walau API dipanggil langsung tanpa
lewat aplikasi.

Tabel `profil` sengaja hanya punya policy SELECT, supaya staf tidak bisa
menaikkan perannya sendiri. Konsekuensinya, role hanya bisa diubah lewat SQL
atau dashboard Supabase:

```sql
update profil set role = 'admin'
where id = (select id from auth.users where email = 'orang@contoh.com');
```

User baru otomatis dapat role `staf`. Buat akunnya di Authentication → Users.

## Halaman

Pembagiannya bukan menurut situasi, tapi menurut jenis tindakan: **Cari
mencatat kejadian, Opname membetulkan catatan.** Hitung ulang sempat ada di
kedua halaman dan hasilnya cuma dua tempat mengerjakan hal yang sama.

| Halaman | Isi |
|---|---|
| Cari | Search, lalu harga + jumlah per ukuran. Tap ukuran untuk mencatat kejadian: Terjual, Ambil dari gudang, Barang masuk. Plus riwayat 5 pergerakan terakhir. |
| Opname | Membetulkan catatan terhadap hitungan fisik. Semua ukuran satu toko sekaligus, ada kotak penyaring kalau cuma satu produk yang perlu dibetulkan. |
| Kelola | Tambah/ubah produk dan ukuran, plus arsip. Admin saja. |

**Arsip** menandai `produk.aktif = false`, bukan menghapus barisnya: tabel
`mutasi` terhubung ke `varian` dengan `on delete cascade`, jadi hapus betulan
ikut menghapus seluruh riwayat penjualan produk itu. Produk arsip hilang dari
Cari dan Opname, bisa dilihat dan dipulihkan lewat "Lihat arsip" di Kelola.

Kolom `kode` unik di seluruh tabel, termasuk produk yang diarsipkan — jadi kode
produk arsip tetap tidak bisa dipakai produk baru. Pesan galatnya menyebut itu,
karena kalau tidak, penolakannya membingungkan: produknya tidak kelihatan di
mana pun.

Satu perkecualian pada pembagian itu: kalau pencatatan di Cari ditolak karena
stok tercatat kurang, tombol hitung ulang muncul di situ juga — hanya pada saat
itu, karena di situlah koreksi memang sedang dibutuhkan. Di luar itu alur Cari
tetap tiga tombol.

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

Penting: Vite menanamkan nilai `VITE_*` ke dalam bundle **saat build**, bukan
dibaca saat halaman dibuka. Dua akibatnya:

- Kalau env var belum di-set waktu build jalan, `konfigurasiHilang` jadi
  konstanta `true` dan minifier membuang seluruh aplikasi — yang ter-deploy
  cuma banner peringatan. Set env var dulu, baru deploy.
- Mengubah env var tidak berpengaruh sampai site di-build ulang.

Konsekuensinya untuk pengembangan: `npm run build` tanpa `.env` tidak benar-benar
mengompilasi aplikasinya. Untuk memeriksa build secara utuh tanpa kredensial
asli, isi env var dengan nilai palsu:

```bash
VITE_SUPABASE_URL=https://dummy.supabase.co \
VITE_SUPABASE_ANON_KEY=sb_publishable_dummy npm run build
```
Rencana subdomain: `stok.fathiakids.com`.
