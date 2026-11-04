-- Stok pindah dari dua kolom jadi baris per tempat.
--
-- Sebelum ini stok hidup sebagai dua angka yang menempel di tiap ukuran:
-- `jumlah_toko` dan `jumlah_gudang`. Dua kolom berarti dua tempat, selamanya.
-- Begitu satu kategori punya dua toko dengan satu gudang bersama — gamis
-- dewasa — bentuk itu tidak bisa menampungnya, dan tidak ada tambalan yang
-- membuat dua kolom jadi tiga.
--
-- Yang berubah bukan jumlah kolomnya, melainkan cara menyimpannya: satu baris
-- stok untuk tiap pasangan (ukuran, tempat). Dengan begitu satu kategori boleh
-- punya berapa pun toko dengan satu gudang bersama, tanpa perubahan struktur
-- lagi di kemudian hari.
--
-- Migrasi ini SENGAJA hanya menambah. Kolom `jumlah_toko`, `jumlah_gudang`,
-- `toko_dihitung_at`, dan `gudang_dihitung_at` tidak disentuh dan tidak
-- dihapus. Selama masa peralihan keduanya hidup berdampingan, jadi kalau ada
-- yang meleset, angka aslinya masih ada di tempatnya semula.

-- ------------------------------------------------------------------ lokasi
create table lokasi (
  id          uuid primary key default gen_random_uuid(),
  kategori_id uuid not null references kategori(id) on delete restrict,
  -- Nama pendek saja ('Toko', 'Toko 1', 'Gudang'). Label yang tampil di
  -- aplikasi digabung dengan nama kategorinya, supaya mengganti nama kategori
  -- tidak menyisakan nama lama yang tertinggal di sini.
  nama        text not null,
  jenis       text not null check (jenis in ('toko', 'gudang')),
  urutan      int  not null default 0,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index lokasi_nama_unik on lokasi (kategori_id, nama);

-- Satu kategori tepat satu gudang. Inti dari seluruh perubahan ini adalah
-- gudang yang dipakai bersama; dua gudang dalam satu kategori akan
-- mengembalikan persoalan yang sama dalam bentuk lain.
create unique index lokasi_satu_gudang on lokasi (kategori_id) where jenis = 'gudang';

alter table lokasi enable row level security;

create policy "lokasi: semua yang login bisa baca"
  on lokasi for select to authenticated using (true);

create policy "lokasi: admin bisa tulis"
  on lokasi for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Tiap kategori yang sudah ada dapat satu toko dan satu gudang, persis
-- mencerminkan keadaan sekarang. Toko kedua gamis dewasa ditambahkan belakangan
-- lewat langkah tersendiri, bukan di sini.
insert into lokasi (kategori_id, nama, jenis, urutan)
select id, 'Toko', 'toko', 1 from kategori;

insert into lokasi (kategori_id, nama, jenis, urutan)
select id, 'Gudang', 'gudang', 9 from kategori;

-- -------------------------------------------------------------------- stok
create table stok (
  varian_id   uuid not null references varian(id) on delete cascade,
  lokasi_id   uuid not null references lokasi(id) on delete restrict,
  jumlah      int  not null default 0 check (jumlah >= 0),
  dihitung_at timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (varian_id, lokasi_id)
);

-- Dipakai tiap kali satu toko membuka daftarnya: semua stok di satu lokasi.
create index stok_lokasi on stok (lokasi_id);

alter table stok enable row level security;

-- Hanya baca. Semua perubahan angka lewat fungsi (security definer) supaya
-- tetap terkunci, tidak bisa minus, dan selalu meninggalkan catatan mutasi —
-- sama seperti aturan yang berlaku untuk kolom lamanya.
create policy "stok: semua yang login bisa baca"
  on stok for select to authenticated using (true);

create trigger stok_updated_at
  before update on stok
  for each row execute function public.set_updated_at();

-- Salin angka yang ada. Tidak ada yang dihitung ulang atau ditebak: nilainya
-- diambil apa adanya, termasuk kapan terakhir dihitung fisik.
insert into stok (varian_id, lokasi_id, jumlah, dihitung_at)
select v.id, l.id, v.jumlah_toko, v.toko_dihitung_at
  from varian v
  join produk p on p.id = v.produk_id
  join lokasi l on l.kategori_id = p.kategori_id and l.jenis = 'toko';

insert into stok (varian_id, lokasi_id, jumlah, dihitung_at)
select v.id, l.id, v.jumlah_gudang, v.gudang_dihitung_at
  from varian v
  join produk p on p.id = v.produk_id
  join lokasi l on l.kategori_id = p.kategori_id and l.jenis = 'gudang';
