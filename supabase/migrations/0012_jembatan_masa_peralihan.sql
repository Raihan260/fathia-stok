-- Dua jembatan antara bentuk lama dan bentuk baru.
--
-- Selama tabel `stok` sudah ada tapi aplikasinya belum diganti, ada selang
-- waktu di mana aplikasi yang tayang masih menulis ke `varian.jumlah_toko` dan
-- `varian.jumlah_gudang`. Tanpa jembatan, tulisan itu tidak sampai ke `stok`,
-- dan dua angka yang seharusnya sama diam-diam berbeda. Perbedaan diam adalah
-- kegagalan terburuk untuk sistem yang gunanya justru supaya tidak perlu
-- mengingat-ingat.

-- -------------------------------------------- ukuran baru dapat baris stoknya
--
-- Ini permanen, bukan sementara. Setiap ukuran baru harus punya baris stok di
-- tiap tempat milik kategorinya, kalau tidak ukuran itu tidak akan muncul di
-- mana pun. Dibuat sebagai trigger, bukan diserahkan ke aplikasi, supaya tidak
-- bergantung pada satu jalur kode yang bisa terlewat.
create or replace function public.stok_untuk_varian_baru()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stok (varian_id, lokasi_id)
  select new.id, l.id
    from public.lokasi l
    join public.produk p on p.kategori_id = l.kategori_id
   where p.id = new.produk_id
  on conflict (varian_id, lokasi_id) do nothing;
  return new;
end;
$$;

revoke all on function public.stok_untuk_varian_baru() from public, anon, authenticated;

create trigger z_stok_untuk_varian_baru
  after insert on varian
  for each row execute function public.stok_untuk_varian_baru();

-- ------------------------------------------------ jembatan masa peralihan
--
-- SEMENTARA. Dibuang bersama kolom lamanya nanti, lewat langkah tersendiri
-- yang disetujui terpisah.
--
-- Selama masih ada, apa pun yang menulis ke kolom lama — termasuk aplikasi
-- versi lama yang masih terbuka di HP mana pun — otomatis ikut tercermin ke
-- tabel stok. Arahnya sengaja satu saja (lama -> baru): dua arah akan saling
-- memicu tanpa henti.
--
-- Batasnya diakui di depan: kalau satu kategori punya lebih dari satu toko,
-- jembatan ini hanya mengurus toko pertama, karena kolom lama memang tidak
-- punya tempat untuk toko kedua. Karena itu toko kedua gamis dewasa baru
-- ditambahkan setelah aplikasinya diganti.
create or replace function public.jembatan_varian_ke_stok()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_toko   uuid;
  v_gudang uuid;
begin
  select l.id into v_toko
    from public.lokasi l
    join public.produk p on p.kategori_id = l.kategori_id
   where p.id = new.produk_id and l.jenis = 'toko'
   order by l.urutan, l.created_at
   limit 1;

  select l.id into v_gudang
    from public.lokasi l
    join public.produk p on p.kategori_id = l.kategori_id
   where p.id = new.produk_id and l.jenis = 'gudang'
   limit 1;

  if v_toko is not null
     and (new.jumlah_toko is distinct from old.jumlah_toko
          or new.toko_dihitung_at is distinct from old.toko_dihitung_at) then
    insert into public.stok (varian_id, lokasi_id, jumlah, dihitung_at)
    values (new.id, v_toko, new.jumlah_toko, new.toko_dihitung_at)
    on conflict (varian_id, lokasi_id) do update
      set jumlah = excluded.jumlah, dihitung_at = excluded.dihitung_at;
  end if;

  if v_gudang is not null
     and (new.jumlah_gudang is distinct from old.jumlah_gudang
          or new.gudang_dihitung_at is distinct from old.gudang_dihitung_at) then
    insert into public.stok (varian_id, lokasi_id, jumlah, dihitung_at)
    values (new.id, v_gudang, new.jumlah_gudang, new.gudang_dihitung_at)
    on conflict (varian_id, lokasi_id) do update
      set jumlah = excluded.jumlah, dihitung_at = excluded.dihitung_at;
  end if;

  return new;
end;
$$;

revoke all on function public.jembatan_varian_ke_stok() from public, anon, authenticated;

create trigger z_jembatan_varian_ke_stok
  after update on varian
  for each row execute function public.jembatan_varian_ke_stok();
