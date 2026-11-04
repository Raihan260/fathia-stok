-- Penjualan, riwayat pengawasan, dan pengaturan toko mana yang menjual apa.

-- --------------------------------------------------------------- penjualan
--
-- Bedanya dengan yang lama cuma satu hal yang menentukan: penjualan sekarang
-- keluar dari sebuah TOKO, bukan dari sebuah kategori. Dengan dua toko dalam
-- satu kategori, "kategori" tidak lagi cukup untuk tahu stok mana yang
-- berkurang.
--
-- Penomoran nota tetap per kategori per hari, bukan per toko. Kalau tiap toko
-- punya deret sendiri, dua nota berbeda bisa sama-sama bernomor 041124-003 di
-- hari yang sama — dan nomor nota yang kembar adalah persoalan yang baru
-- terasa justru saat sedang dibutuhkan.
create or replace function public.catat_penjualan_toko(
  p_lokasi_id uuid,
  p_baris     jsonb,                  -- [{"varian_id":"uuid","jumlah":3}, …]
  p_pembeli   text default null,
  p_catatan   text default null
)
returns jsonb                         -- {id, nomor, tanggal, total, baris}
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid          uuid := (select auth.uid());
  tgl          date := (now() at time zone 'Asia/Jakarta')::date;
  kat          uuid;
  jenis_lok    text;
  urut         int;
  trx          public.transaksi;
  b            jsonb;
  vid          uuid;
  n            int;
  sisa         int;
  pr           public.produk;
  v            public.varian;
  jml          int := 0;
  jumlah_total int := 0;
begin
  if uid is null then
    raise exception 'Harus login dulu' using errcode = '42501';
  end if;
  if jsonb_typeof(p_baris) <> 'array' or jsonb_array_length(p_baris) = 0 then
    raise exception 'Daftarnya kosong' using errcode = '22023';
  end if;

  select kategori_id, jenis into kat, jenis_lok
    from public.lokasi where id = p_lokasi_id;
  if kat is null then
    raise exception 'Toko tidak ditemukan' using errcode = 'P0002';
  end if;
  if jenis_lok <> 'toko' then
    raise exception 'Penjualan hanya bisa dari toko, bukan gudang' using errcode = '22023';
  end if;

  -- Kunci penomoran untuk kategori dan tanggal ini sampai transaksi selesai,
  -- supaya dua orang yang menyimpan bersamaan tidak dapat nomor kembar —
  -- termasuk dua orang di dua toko berbeda.
  perform pg_advisory_xact_lock(hashtext(kat::text || tgl::text));

  select coalesce(max(t.urut), 0) + 1 into urut
    from public.transaksi t
   where t.kategori_id = kat and t.tanggal = tgl;

  insert into public.transaksi
    (kategori_id, lokasi_id, nomor, tanggal, urut, pembeli, catatan, oleh)
  values (
    kat,
    p_lokasi_id,
    to_char(tgl, 'DDMMYY') || '-' || lpad(urut::text, 3, '0'),
    tgl,
    urut,
    nullif(btrim(coalesce(p_pembeli, '')), ''),
    nullif(btrim(coalesce(p_catatan, '')), ''),
    uid
  )
  returning * into trx;

  for b in select * from jsonb_array_elements(p_baris)
  loop
    vid := (b ->> 'varian_id')::uuid;
    n   := (b ->> 'jumlah')::int;

    if n is null or n <= 0 then
      raise exception 'Jumlah harus lebih dari nol' using errcode = '23514';
    end if;

    select * into v from public.varian where id = vid;
    if not found then
      raise exception 'Ukuran tidak ditemukan' using errcode = 'P0002';
    end if;
    select * into pr from public.produk where id = v.produk_id;
    if pr.kategori_id <> kat then
      raise exception 'Produk % bukan milik toko ini', pr.kode using errcode = '22023';
    end if;

    select jumlah into sisa from public.stok
     where varian_id = vid and lokasi_id = p_lokasi_id for update;
    if sisa is null then
      raise exception 'Produk % ukuran % tidak dijual di toko ini', pr.kode, v.ukuran
        using errcode = 'P0002';
    end if;
    if sisa - n < 0 then
      raise exception 'Stok % ukuran % tercatat % pcs, kurang dari % pcs. Hitung ulang dulu.',
        pr.kode, v.ukuran, sisa, n using errcode = '23514';
    end if;

    update public.stok set jumlah = jumlah - n
     where varian_id = vid and lokasi_id = p_lokasi_id
    returning jumlah into sisa;

    insert into public.mutasi
      (varian_id, jenis, dari_lokasi_id, ke_lokasi_id, jumlah,
       dari_setelah, ke_setelah, catatan, oleh, transaksi_id)
    values
      (vid, 'jual', p_lokasi_id, null, n, sisa, null, trx.catatan, uid, trx.id);

    -- Isi nota disalin, bukan dirujuk: harga yang berubah bulan depan tidak
    -- boleh mengubah nota yang sudah dicetak bulan ini.
    insert into public.transaksi_item
      (transaksi_id, varian_id, kode, nama, ukuran, harga, jumlah, subtotal)
    values
      (trx.id, vid, pr.kode, pr.nama, v.ukuran, v.harga_grosir, n, v.harga_grosir * n);

    jumlah_total := jumlah_total + v.harga_grosir * n;
    jml := jml + 1;
  end loop;

  update public.transaksi set total = jumlah_total where id = trx.id;

  return jsonb_build_object(
    'id', trx.id, 'nomor', trx.nomor, 'tanggal', trx.tanggal,
    'total', jumlah_total, 'baris', jml
  );
end;
$$;

revoke all on function public.catat_penjualan_toko(uuid, jsonb, text, text) from public, anon;
grant execute on function public.catat_penjualan_toko(uuid, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------- riwayat
--
-- Alat pengawasan pemilik: siapa mengubah apa, di tempat mana. Tetap admin
-- saja, karena ini satu-satunya tempat email orang lain ikut terlihat.
create or replace function public.riwayat_perubahan(
  p_kategori_id uuid,
  p_jenis       text[] default null,   -- null = semua jenis
  p_lokasi_id   uuid   default null,   -- null = semua tempat
  p_batas       int    default 100,
  p_lewati      int    default 0
)
returns table (
  id           uuid,
  created_at   timestamptz,
  jenis        text,
  kode         text,
  nama         text,
  ukuran       text,
  jumlah       int,
  dari         text,
  ke           text,
  dari_setelah int,
  ke_setelah   int,
  catatan      text,
  oleh         text,
  nota         text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
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
         m.jumlah,
         ld.nama,
         lk.nama,
         m.dari_setelah,
         m.ke_setelah,
         m.catatan,
         coalesce(u.email::text, '—'),
         t.nomor
    from public.mutasi m
    join public.varian v on v.id = m.varian_id
    join public.produk p on p.id = v.produk_id
    left join public.lokasi ld on ld.id = m.dari_lokasi_id
    left join public.lokasi lk on lk.id = m.ke_lokasi_id
    left join auth.users u on u.id = m.oleh
    left join public.transaksi t on t.id = m.transaksi_id
   where p.kategori_id = p_kategori_id
     and (p_jenis is null or m.jenis = any (p_jenis))
     and (p_lokasi_id is null
          or m.dari_lokasi_id = p_lokasi_id
          or m.ke_lokasi_id = p_lokasi_id)
   order by m.created_at desc
   limit greatest(1, least(coalesce(p_batas, 100), 300))
  offset greatest(0, coalesce(p_lewati, 0));
end;
$$;

revoke all on function public.riwayat_perubahan(uuid, text[], uuid, int, int) from public, anon;
grant execute on function public.riwayat_perubahan(uuid, text[], uuid, int, int) to authenticated;

-- ------------------------------------------------ toko mana yang menjual apa
--
-- "Sebagian model sama, sebagian beda" diwujudkan lewat ada-tidaknya baris
-- stok: sebuah produk dijual di sebuah toko kalau ukuran-ukurannya punya
-- baris stok di situ. Tidak perlu tabel keanggotaan tersendiri — stok nol dan
-- "tidak dijual di sini" memang dua hal berbeda, dan perbedaan itu persis
-- tergambar oleh ada atau tidaknya barisnya.
--
-- Gudang selalu ikut, tidak bisa dilepas: barangnya satu gudang bersama.
create or replace function public.atur_toko_produk(
  p_produk_id uuid,
  p_toko_ids  uuid[]
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  kat     uuid;
  nyangkut text;
  jml     int;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh mengatur toko sebuah produk'
      using errcode = '42501';
  end if;

  select kategori_id into kat from public.produk where id = p_produk_id;
  if kat is null then
    raise exception 'Produk tidak ditemukan' using errcode = 'P0002';
  end if;

  -- Melepas toko yang stoknya masih ada sama saja menghilangkan barang yang
  -- betul-betul ada di rak. Ditolak, dengan menyebut yang mana.
  select string_agg(distinct l.nama || ' (' || s.jumlah || ' pcs)', ', ')
    into nyangkut
    from public.stok s
    join public.lokasi l on l.id = s.lokasi_id
    join public.varian v on v.id = s.varian_id
   where v.produk_id = p_produk_id
     and l.jenis = 'toko'
     and s.jumlah > 0
     and not (l.id = any (coalesce(p_toko_ids, '{}')));

  if nyangkut is not null then
    raise exception 'Stoknya masih ada di %. Kosongkan dulu sebelum dilepas.', nyangkut
      using errcode = '23514';
  end if;

  delete from public.stok s
   using public.lokasi l, public.varian v
   where s.lokasi_id = l.id
     and s.varian_id = v.id
     and v.produk_id = p_produk_id
     and l.jenis = 'toko'
     and not (l.id = any (coalesce(p_toko_ids, '{}')));

  insert into public.stok (varian_id, lokasi_id, jumlah)
  select v.id, l.id
    from public.varian v
    cross join public.lokasi l
   where v.produk_id = p_produk_id
     and l.kategori_id = kat
     and (l.jenis = 'gudang' or l.id = any (coalesce(p_toko_ids, '{}')))
  on conflict (varian_id, lokasi_id) do nothing;

  select count(*) into jml
    from public.stok s
    join public.varian v on v.id = s.varian_id
    join public.lokasi l on l.id = s.lokasi_id
   where v.produk_id = p_produk_id and l.jenis = 'toko';

  return jml;
end;
$$;

revoke all on function public.atur_toko_produk(uuid, uuid[]) from public, anon;
grant execute on function public.atur_toko_produk(uuid, uuid[]) to authenticated;
