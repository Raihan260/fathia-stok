-- Menyimpan banyak baris pergerakan dalam SATU transaksi.
--
-- Alasannya: satu pembeli reseller biasanya mengambil beberapa model sekaligus,
-- dan mengambil barang dari gudang ke toko juga lintas model. Kalau tiap baris
-- disimpan terpisah lalu baris kelima ditolak karena stok tercatat kurang,
-- empat baris pertama terlanjur masuk dan pesanannya jadi setengah tercatat —
-- susah dibereskan dan angkanya terlanjur salah.
--
-- Fungsi PL/pgSQL berjalan dalam satu transaksi: kalau ada satu saja yang
-- gagal, semuanya batal.

create or replace function public.catat_mutasi_banyak(
  p_jenis   text,
  p_baris   jsonb,          -- [{"varian_id":"uuid","jumlah":5}, …]
  p_catatan text default null
)
returns int                 -- jumlah baris yang tersimpan
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  b       jsonb;
  vid     uuid;
  n       int;
  d_tok   int;
  d_gud   int;
  v       public.varian;
  jml     int := 0;
begin
  if uid is null then
    raise exception 'Harus login dulu' using errcode = '42501';
  end if;

  -- Sengaja dibatasi: hitung_ulang punya fungsinya sendiri karena ia menyetel
  -- angka mutlak sekaligus menandai kapan terakhir dihitung fisik.
  if p_jenis not in ('jual', 'pindah_ke_toko', 'barang_masuk') then
    raise exception 'Jenis % tidak bisa disimpan borongan', p_jenis using errcode = '22023';
  end if;

  if jsonb_typeof(p_baris) <> 'array' or jsonb_array_length(p_baris) = 0 then
    raise exception 'Daftarnya kosong' using errcode = '22023';
  end if;

  for b in select * from jsonb_array_elements(p_baris)
  loop
    vid := (b ->> 'varian_id')::uuid;
    n   := (b ->> 'jumlah')::int;

    if n is null or n <= 0 then
      raise exception 'Jumlah harus lebih dari nol' using errcode = '23514';
    end if;

    if p_jenis = 'jual' then
      d_tok := -n; d_gud := 0;
    elsif p_jenis = 'pindah_ke_toko' then
      d_tok := n;  d_gud := -n;
    else -- barang_masuk
      d_tok := 0;  d_gud := n;
    end if;

    select * into v from public.varian where id = vid for update;
    if not found then
      raise exception 'Ukuran tidak ditemukan' using errcode = 'P0002';
    end if;

    -- Pesan galat menyebut kode dan ukuran: di daftar berisi belasan baris,
    -- "stok kurang" saja tidak memberitahu baris mana yang bermasalah.
    if v.jumlah_toko + d_tok < 0 then
      raise exception 'Stok toko % ukuran % tercatat % pcs, kurang dari % pcs. Hitung ulang dulu.',
        (select kode from public.produk where id = v.produk_id), v.ukuran, v.jumlah_toko, n
        using errcode = '23514';
    end if;
    if v.jumlah_gudang + d_gud < 0 then
      raise exception 'Stok gudang % ukuran % tercatat % pcs, kurang dari % pcs. Hitung ulang dulu.',
        (select kode from public.produk where id = v.produk_id), v.ukuran, v.jumlah_gudang, n
        using errcode = '23514';
    end if;

    update public.varian
       set jumlah_toko   = jumlah_toko   + d_tok,
           jumlah_gudang = jumlah_gudang + d_gud
     where id = vid
    returning * into v;

    insert into public.mutasi
      (varian_id, jenis, delta_toko, delta_gudang, toko_setelah, gudang_setelah, catatan, oleh)
    values
      (vid, p_jenis, d_tok, d_gud, v.jumlah_toko, v.jumlah_gudang, p_catatan, uid);

    jml := jml + 1;
  end loop;

  return jml;
end;
$$;

revoke all on function public.catat_mutasi_banyak(text, jsonb, text) from public, anon;
grant execute on function public.catat_mutasi_banyak(text, jsonb, text) to authenticated;
