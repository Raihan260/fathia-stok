-- Riwayat ikut pindah ke bentuk per lokasi.
--
-- Tabel mutasi menyimpan perubahan sebagai dua kolom selisih, `delta_toko` dan
-- `delta_gudang`. Bentuk itu punya batas yang sama dengan stok: dua kolom, dua
-- tempat. Tapi kalau diperhatikan, setiap kejadian di sini sebenarnya satu
-- perpindahan sejumlah barang DARI suatu tempat KE suatu tempat, dan salah satu
-- sisinya boleh kosong:
--
--   jual            toko    -> (keluar)
--   ambil dari gudang  gudang -> toko
--   barang masuk    (masuk) -> gudang
--   koreksi tambah  (masuk) -> tempat itu
--   koreksi kurang  tempat itu -> (keluar)
--
-- Bentuk itu muat berapa pun tempat, dan yang penting: tetap SATU baris per
-- kejadian, jadi 597 catatan yang ada tetap 597 — riwayatnya tidak terpecah
-- dan tidak terputus.
--
-- Seperti migrasi sebelumnya, ini hanya menambah. Perintah update di bawah
-- hanya mengisi kolom yang baru dibuat (yang isinya masih kosong);
-- `delta_toko` dan `delta_gudang` tidak disentuh sama sekali dan tetap ada
-- sebagai pembanding.
--
-- PENTING: harus dijalankan SEBELUM toko kedua gamis dewasa ditambahkan.
-- Pemetaan di bawah berpijak pada keadaan satu toko per kategori — yang memang
-- keadaan saat baris-baris lama itu dicatat.

alter table mutasi
  add column dari_lokasi_id uuid references lokasi(id),
  add column ke_lokasi_id   uuid references lokasi(id),
  add column jumlah         int;

update mutasi m
   set dari_lokasi_id = x.dari,
       ke_lokasi_id   = x.ke,
       jumlah         = x.jml
  from (
    select m2.id,
           case
             when m2.delta_toko   > 0 and m2.delta_gudang < 0 then lg.id  -- gudang -> toko
             when m2.delta_toko   < 0                         then lt.id  -- keluar dari toko
             when m2.delta_gudang < 0                         then lg.id  -- keluar dari gudang
           end as dari,
           case
             when m2.delta_toko   > 0 then lt.id
             when m2.delta_gudang > 0 then lg.id
           end as ke,
           -- Kedua sisi perpindahan selalu sebesar yang sama, jadi yang
           -- terbesar di antara keduanya adalah jumlah yang berpindah.
           greatest(abs(m2.delta_toko), abs(m2.delta_gudang)) as jml
      from mutasi m2
      join varian v  on v.id = m2.varian_id
      join produk p  on p.id = v.produk_id
      join lokasi lt on lt.kategori_id = p.kategori_id and lt.jenis = 'toko'
      join lokasi lg on lg.kategori_id = p.kategori_id and lg.jenis = 'gudang'
  ) x
 where m.id = x.id;

-- Nota: dari toko yang mana.
--
-- Selama ini tidak perlu ditanyakan karena satu kategori berarti satu toko.
-- Begitu gamis dewasa punya dua, pertanyaan itu jadi nyata — dan jawabannya
-- harus ikut tersimpan di notanya, bukan disimpulkan belakangan.
alter table transaksi add column lokasi_id uuid references lokasi(id);

update transaksi t
   set lokasi_id = l.id
  from lokasi l
 where l.kategori_id = t.kategori_id
   and l.jenis = 'toko';
