-- Nota penjualan.
--
-- Sebelum ini, penjualan lima model tersimpan sebagai lima baris `mutasi` yang
-- tidak saling terhubung: keterangan bahwa kelimanya satu pesanan dari satu
-- orang dibuang saat disimpan, dan totalnya cuma lewat di layar.

create table transaksi (
  id          uuid primary key default gen_random_uuid(),
  kategori_id uuid not null references kategori(id) on delete restrict,
  nomor       text not null,                 -- contoh: 181026-003
  tanggal     date not null,                 -- tanggal lokal, dasar penomoran
  urut        int  not null,                 -- nomor urut hari itu di toko ini
  pembeli     text,                          -- boleh kosong
  catatan     text,
  total       int  not null default 0,
  oleh        uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (kategori_id, nomor)
);

create index transaksi_waktu_idx   on transaksi (kategori_id, created_at desc);
create index transaksi_pembeli_idx on transaksi (lower(pembeli));

-- Tiap baris MENYALIN kode, nama, ukuran, dan harga saat transaksi terjadi,
-- bukan sekadar menunjuk ke varian. Kalau hanya menunjuk, menaikkan harga
-- bulan depan ikut mengubah nota bulan lalu — padahal pembelinya tidak
-- membayar segitu. Nota yang berubah sendiri bukan nota.
--
-- varian_id disimpan hanya sebagai penghubung, dan boleh menjadi null kalau
-- produknya kelak benar-benar dihapus: notanya tetap utuh dan terbaca.
create table transaksi_item (
  id           uuid primary key default gen_random_uuid(),
  transaksi_id uuid not null references transaksi(id) on delete cascade,
  varian_id    uuid references varian(id) on delete set null,
  kode         text not null,
  nama         text not null,
  ukuran       text not null,
  harga        int  not null,
  jumlah       int  not null check (jumlah > 0),
  subtotal     int  not null
);

create index transaksi_item_idx on transaksi_item (transaksi_id);

-- Supaya satu baris mutasi bisa ditelusuri balik ke notanya.
alter table mutasi add column transaksi_id uuid references transaksi(id) on delete set null;

alter table transaksi      enable row level security;
alter table transaksi_item enable row level security;

create policy "transaksi: semua yang login bisa baca"
  on transaksi for select to authenticated using (true);
create policy "transaksi_item: semua yang login bisa baca"
  on transaksi_item for select to authenticated using (true);
-- Tidak ada policy tulis: nota hanya lahir dari fungsi di bawah, supaya
-- isinya tidak bisa dikarang lewat API.

create or replace function public.catat_penjualan(
  p_kategori_id uuid,
  p_baris       jsonb,                  -- [{"varian_id":"uuid","jumlah":3}, …]
  p_pembeli     text default null,
  p_catatan     text default null
)
returns jsonb                           -- {id, nomor, tanggal, total}
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := (select auth.uid());
  tgl      date := (now() at time zone 'Asia/Jakarta')::date;
  urut     int;
  trx      public.transaksi;
  b        jsonb;
  vid      uuid;
  n        int;
  v        public.varian;
  pr       public.produk;
  jml      int := 0;
  jumlah_total int := 0;
begin
  if uid is null then
    raise exception 'Harus login dulu' using errcode = '42501';
  end if;
  if jsonb_typeof(p_baris) <> 'array' or jsonb_array_length(p_baris) = 0 then
    raise exception 'Daftarnya kosong' using errcode = '22023';
  end if;

  -- Kunci penomoran untuk toko dan tanggal ini sampai transaksi selesai,
  -- supaya dua orang yang menyimpan bersamaan tidak dapat nomor kembar.
  perform pg_advisory_xact_lock(hashtext(p_kategori_id::text || tgl::text));

  -- max(urut)+1, bukan count(*)+1: kalau suatu saat ada nota yang terhapus,
  -- menghitung jumlah baris akan memakai ulang nomor yang sudah pernah ada.
  select coalesce(max(t.urut), 0) + 1 into urut
  from public.transaksi t
  where t.kategori_id = p_kategori_id and t.tanggal = tgl;

  insert into public.transaksi (kategori_id, nomor, tanggal, urut, pembeli, catatan, oleh)
  values (
    p_kategori_id,
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

    select * into v from public.varian where id = vid for update;
    if not found then
      raise exception 'Ukuran tidak ditemukan' using errcode = 'P0002';
    end if;

    select * into pr from public.produk where id = v.produk_id;

    if pr.kategori_id <> p_kategori_id then
      raise exception 'Produk % bukan milik toko ini', pr.kode using errcode = '22023';
    end if;

    if v.jumlah_toko - n < 0 then
      raise exception 'Stok toko % ukuran % tercatat % pcs, kurang dari % pcs. Hitung ulang dulu.',
        pr.kode, v.ukuran, v.jumlah_toko, n using errcode = '23514';
    end if;

    update public.varian
       set jumlah_toko = jumlah_toko - n
     where id = vid
    returning * into v;

    insert into public.mutasi
      (varian_id, jenis, delta_toko, delta_gudang, toko_setelah, gudang_setelah,
       catatan, oleh, transaksi_id)
    values
      (vid, 'jual', -n, 0, v.jumlah_toko, v.jumlah_gudang, trx.catatan, uid, trx.id);

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

revoke all on function public.catat_penjualan(uuid, jsonb, text, text) from public, anon;
grant execute on function public.catat_penjualan(uuid, jsonb, text, text) to authenticated;
