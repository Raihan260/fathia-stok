-- Jembatan kedua: baris riwayat dari fungsi lama ikut terisi bentuk barunya.
--
-- Jembatan di 0012 menjaga ANGKA stok tetap sama di dua tempat. Tapi fungsi
-- lama juga menulis baris mutasi, dan baris itu lahir tanpa dari/ke/jumlah —
-- jadi akan tampil kosong di halaman riwayat yang baru.
--
-- Pemetaannya sama persis dengan yang dipakai saat memindahkan 597 baris lama
-- di 0011, jadi baris yang lahir malam ini terbaca sama seperti baris bulan
-- lalu.
--
-- SEMENTARA, seperti 0012: dibuang bersama fungsi lamanya.
create or replace function public.jembatan_mutasi_ke_lokasi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_toko   uuid;
  v_gudang uuid;
begin
  -- Baris dari fungsi baru selalu mengisi jumlah, jadi tidak ikut tersentuh.
  if new.jumlah is not null then
    return new;
  end if;

  select l.id into v_toko
    from public.lokasi l
    join public.produk p on p.kategori_id = l.kategori_id
    join public.varian v on v.produk_id = p.id
   where v.id = new.varian_id and l.jenis = 'toko'
   order by l.urutan, l.created_at
   limit 1;

  select l.id into v_gudang
    from public.lokasi l
    join public.produk p on p.kategori_id = l.kategori_id
    join public.varian v on v.produk_id = p.id
   where v.id = new.varian_id and l.jenis = 'gudang'
   limit 1;

  new.dari_lokasi_id := case
    when new.delta_toko   > 0 and new.delta_gudang < 0 then v_gudang
    when new.delta_toko   < 0                          then v_toko
    when new.delta_gudang < 0                          then v_gudang
  end;

  new.ke_lokasi_id := case
    when new.delta_toko   > 0 then v_toko
    when new.delta_gudang > 0 then v_gudang
  end;

  new.jumlah := greatest(abs(coalesce(new.delta_toko, 0)),
                         abs(coalesce(new.delta_gudang, 0)));

  new.dari_setelah := case
    when new.dari_lokasi_id = v_toko   then new.toko_setelah
    when new.dari_lokasi_id = v_gudang then new.gudang_setelah
  end;

  new.ke_setelah := case
    when new.ke_lokasi_id = v_toko   then new.toko_setelah
    when new.ke_lokasi_id = v_gudang then new.gudang_setelah
  end;

  return new;
end;
$$;

revoke all on function public.jembatan_mutasi_ke_lokasi() from public, anon, authenticated;

create trigger a_jembatan_mutasi_ke_lokasi
  before insert on mutasi
  for each row execute function public.jembatan_mutasi_ke_lokasi();
