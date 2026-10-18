-- catat_mutasi_banyak() belajar 'koreksi', supaya penambahan di toko dan
-- pengurangan di mana pun ikut atomik — sebelumnya pengurangan belum ada dan
-- penambahan di toko jalan satu-satu, bisa tersimpan separuh.
--
-- 'koreksi' tidak punya arah bawaan seperti 'jual' atau 'barang_masuk', jadi
-- lokasi dan arahnya disebut terpisah.
create or replace function public.catat_mutasi_banyak(
  p_jenis   text,
  p_baris   jsonb,                      -- [{"varian_id":"uuid","jumlah":5}, …]
  p_catatan text    default null,
  p_lokasi  text    default null,       -- wajib untuk 'koreksi'
  p_kurang  boolean default false       -- 'koreksi' saja: true = mengurangi
)
returns int
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

  -- hitung_ulang tetap punya fungsinya sendiri: ia menyetel angka mutlak
  -- sekaligus menandai kapan terakhir dihitung fisik.
  if p_jenis not in ('jual', 'pindah_ke_toko', 'barang_masuk', 'koreksi') then
    raise exception 'Jenis % tidak bisa disimpan borongan', p_jenis using errcode = '22023';
  end if;

  if p_jenis = 'koreksi' and (p_lokasi is null or p_lokasi not in ('toko', 'gudang')) then
    raise exception 'Koreksi harus menyebut lokasi toko atau gudang' using errcode = '22023';
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
    elsif p_jenis = 'barang_masuk' then
      d_tok := 0;  d_gud := n;
    else -- koreksi
      if p_lokasi = 'toko' then
        d_tok := case when p_kurang then -n else n end; d_gud := 0;
      else
        d_tok := 0; d_gud := case when p_kurang then -n else n end;
      end if;
    end if;

    select * into v from public.varian where id = vid for update;
    if not found then
      raise exception 'Ukuran tidak ditemukan' using errcode = 'P0002';
    end if;

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

revoke all on function public.catat_mutasi_banyak(text, jsonb, text, text, boolean)
  from public, anon;
grant execute on function public.catat_mutasi_banyak(text, jsonb, text, text, boolean)
  to authenticated;
