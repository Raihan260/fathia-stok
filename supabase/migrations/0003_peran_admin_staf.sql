-- Pemisahan peran: admin vs staf.
--
--   admin → bisa semua (produk, ukuran, harga, status stok)
--   staf  → hanya boleh mengubah stok_toko dan stok_gudang
--
-- Catatan desain: RLS Postgres bekerja per BARIS, bukan per kolom. Jadi
-- larangan "staf tidak boleh ubah harga" tidak bisa ditulis sebagai policy —
-- ditegakkan lewat trigger `jaga_kolom_varian` di bawah.

-- ------------------------------------------------------------------ profil
create table profil (
  id         uuid primary key references auth.users(id) on delete cascade,
  nama       text,
  role       text not null default 'staf' check (role in ('admin', 'staf')),
  created_at timestamptz not null default now()
);

alter table profil enable row level security;

-- Sengaja hanya SELECT baris sendiri. Role diubah lewat SQL/dashboard saja,
-- bukan dari aplikasi — supaya staf tidak bisa menaikkan perannya sendiri.
-- Policy ini juga TIDAK memanggil is_admin(), supaya tidak rekursif.
create policy "profil: lihat baris sendiri"
  on profil for select to authenticated
  using (id = (select auth.uid()));

-- Setiap user baru otomatis dapat profil dengan role 'staf'.
create or replace function public.buat_profil_user_baru()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profil (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.buat_profil_user_baru() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.buat_profil_user_baru();

-- Backfill user yang sudah ada; pemilik sistem jadi admin.
insert into profil (id, role)
select id, 'admin' from auth.users
on conflict (id) do nothing;

-- -------------------------------------------------------------- is_admin()
-- SECURITY INVOKER, bukan DEFINER: fungsinya cuma membaca baris profil milik
-- pemanggil sendiri, yang memang sudah diizinkan policy di atas. Pakai DEFINER
-- di sini akan memunculkan peringatan security advisor tanpa manfaat.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profil p where p.id = (select auth.uid())),
    false
  );
$$;

-- ------------------------------------------------------------- policy baru
drop policy "kategori: authenticated full access" on kategori;
drop policy "produk: authenticated full access"   on produk;
drop policy "varian: authenticated full access"   on varian;

-- Semua yang login boleh MEMBACA. Inti aplikasi ini memang membaca.
create policy "kategori: semua yang login bisa baca"
  on kategori for select to authenticated using (true);
create policy "produk: semua yang login bisa baca"
  on produk for select to authenticated using (true);
create policy "varian: semua yang login bisa baca"
  on varian for select to authenticated using (true);

-- Menulis kategori & produk: admin saja.
create policy "kategori: admin bisa tulis"
  on kategori for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "produk: admin bisa tulis"
  on produk for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Varian: menambah dan menghapus ukuran hanya admin.
create policy "varian: admin bisa tambah"
  on varian for insert to authenticated
  with check (public.is_admin());

create policy "varian: admin bisa hapus"
  on varian for delete to authenticated
  using (public.is_admin());

-- UPDATE terbuka untuk semua yang login; kolom mana yang boleh berubah
-- dibatasi oleh trigger di bawah.
create policy "varian: semua yang login bisa ubah status"
  on varian for update to authenticated
  using (true) with check (true);

-- ----------------------------------------------------- penjaga kolom varian
create or replace function public.jaga_kolom_varian()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.produk_id    is distinct from old.produk_id
  or new.ukuran       is distinct from old.ukuran
  or new.urutan       is distinct from old.urutan
  or new.harga_grosir is distinct from old.harga_grosir then
    raise exception 'Hanya admin yang boleh mengubah harga atau ukuran'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.jaga_kolom_varian() from public, anon, authenticated;

-- Nama diawali 'a_' supaya jalan sebelum trigger updated_at.
create trigger a_jaga_kolom_varian
  before update on varian
  for each row execute function public.jaga_kolom_varian();
