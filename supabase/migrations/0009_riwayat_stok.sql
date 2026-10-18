-- Riwayat perubahan stok untuk admin.
--
-- Membatasi siapa yang boleh mengubah stok ternyata bukan jawabannya:
-- mengunci "Kurangi" tanpa mengunci "Hitung ulang" tidak mengamankan apa pun,
-- karena menghitung ulang ke angka lebih rendah memberi hasil yang sama. Dan
-- mengunci ketiganya merusak pekerjaannya — yang memegang barang di gudang
-- memang karyawan.
--
-- Jadi pengawasan, bukan pembatasan. Data siapa-mengubah-apa sudah tercatat
-- sejak awal; yang belum ada cuma cara melihatnya.
--
-- Lewat fungsi, bukan query biasa, karena baris ini perlu menyebut email
-- pelakunya — dan `auth.users` tidak bisa dibaca dari sisi aplikasi.
create or replace function public.riwayat_stok(
  p_kategori_id uuid,
  p_jenis       text[] default null,   -- null = semua jenis
  p_batas       int    default 100,
  p_lewati      int    default 0
)
returns table (
  id             uuid,
  created_at     timestamptz,
  jenis          text,
  kode           text,
  nama           text,
  ukuran         text,
  delta_toko     int,
  delta_gudang   int,
  toko_setelah   int,
  gudang_setelah int,
  catatan        text,
  oleh           text,
  nota           text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Ini alat pengawasan pemilik, dan satu-satunya tempat email orang lain
  -- ikut terlihat. Riwayat per ukuran di halaman Cari tetap terbuka untuk
  -- semua, tanpa menyebut nama.
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh melihat riwayat perubahan stok'
      using errcode = '42501';
  end if;

  return query
  select m.id,
         m.created_at,
         m.jenis,
         p.kode,
         p.nama,
         v.ukuran,
         m.delta_toko,
         m.delta_gudang,
         m.toko_setelah,
         m.gudang_setelah,
         m.catatan,
         coalesce(u.email::text, '—'),
         t.nomor
  from public.mutasi m
  join public.varian v on v.id = m.varian_id
  join public.produk p on p.id = v.produk_id
  left join auth.users u on u.id = m.oleh
  left join public.transaksi t on t.id = m.transaksi_id
  where p.kategori_id = p_kategori_id
    and (p_jenis is null or m.jenis = any (p_jenis))
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_batas, 100), 300))
  offset greatest(0, coalesce(p_lewati, 0));
end;
$$;

revoke all on function public.riwayat_stok(uuid, text[], int, int) from public, anon;
grant execute on function public.riwayat_stok(uuid, text[], int, int) to authenticated;
