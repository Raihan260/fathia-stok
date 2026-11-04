-- Fungsi pergerakan stok, ditulis ulang untuk bekerja per lokasi.
--
-- Nama fungsinya baru, bukan menimpa yang lama. Dua alasan. Pertama, aplikasi
-- yang sedang dipakai di toko masih memanggil fungsi lama; menimpanya berarti
-- mematikan aplikasi yang sedang jalan sebelum penggantinya siap. Kedua,
-- mengganti daftar parameter lewat `create or replace` tidak menimpa apa pun —
-- ia membuat fungsi kembar dengan nama sama, dan pemanggilnya jadi tidak bisa
-- dipastikan yang mana. Itu pernah terjadi di project ini.
--
-- Fungsi lama dibuang nanti, lewat langkah tersendiri, setelah versi baru
-- terbukti jalan.

-- Kolom lama dilonggarkan supaya boleh kosong. Baris mutasi yang baru tidak
-- bisa mengisinya dengan jujur: "berapa stok toko setelahnya" tidak punya satu
-- jawaban kalau kategorinya punya dua toko. Diisi angka yang keliru jauh lebih
-- buruk daripada dibiarkan kosong. Baris lama tidak disentuh dan tetap berisi.
alter table mutasi alter column delta_toko     drop not null;
alter table mutasi alter column delta_gudang   drop not null;
alter table mutasi alter column toko_setelah   drop not null;
alter table mutasi alter column gudang_setelah drop not null;

-- Sisa stok di kedua sisi sesudah perpindahan, menggantikan toko_setelah dan
-- gudang_setelah yang hanya muat dua tempat.
alter table mutasi
  add column dari_setelah int,
  add column ke_setelah   int;

-- ------------------------------------------- lokasi baru dapat baris stoknya
--
-- Kembaran dari trigger untuk ukuran baru. Tanpa ini, menambah toko kedua
-- menghasilkan toko tanpa satu pun baris stok — dan produknya tidak akan
-- muncul di sana sama sekali.
create or replace function public.stok_untuk_lokasi_baru()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stok (varian_id, lokasi_id)
  select v.id, new.id
    from public.varian v
    join public.produk p on p.id = v.produk_id
   where p.kategori_id = new.kategori_id
  on conflict (varian_id, lokasi_id) do nothing;
  return new;
end;
$$;

revoke all on function public.stok_untuk_lokasi_baru() from public, anon, authenticated;

create trigger z_stok_untuk_lokasi_baru
  after insert on lokasi
  for each row execute function public.stok_untuk_lokasi_baru();

-- ------------------------------------------------------------- pergerakan
--
-- Satu fungsi untuk semua perpindahan, karena semuanya memang satu bentuk:
-- sejumlah barang berpindah DARI suatu tempat KE suatu tempat, dan salah satu
-- sisinya boleh kosong.
--
--   jual               dari = toko,   ke = kosong
--   ambil dari gudang  dari = gudang, ke = toko
--   barang masuk       dari = kosong, ke = gudang
--   koreksi tambah     dari = kosong, ke = tempat itu
--   koreksi kurang     dari = tempat itu, ke = kosong
--
-- Seluruh daftar disimpan dalam satu transaksi: kalau satu baris gagal,
-- tidak ada satu pun yang tersimpan. Pesanan yang masuk separuh lebih
-- berbahaya daripada pesanan yang gagal, karena yang separuh tidak kelihatan.
create or replace function public.catat_pergerakan(
  p_jenis   text,
  p_baris   jsonb,                 -- [{"varian_id":"uuid","jumlah":5}, …]
  p_dari    uuid default null,
  p_ke      uuid default null,
  p_catatan text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := (select auth.uid());
  b        jsonb;
  vid      uuid;
  n        int;
  kat      uuid;
  kat_ke   uuid;
  sisa_d   int;
  sisa_k   int;
  kode     text;
  uk       text;
  jml      int := 0;
begin
  if uid is null then
    raise exception 'Harus login dulu' using errcode = '42501';
  end if;

  if p_jenis not in ('jual', 'pindah_ke_toko', 'barang_masuk', 'koreksi') then
    raise exception 'Jenis % tidak bisa disimpan borongan', p_jenis using errcode = '22023';
  end if;

  if p_dari is null and p_ke is null then
    raise exception 'Harus menyebut tempat asal atau tujuan' using errcode = '22023';
  end if;
  if p_dari = p_ke then
    raise exception 'Tempat asal dan tujuan tidak boleh sama' using errcode = '22023';
  end if;

  select kategori_id into kat from public.lokasi where id = coalesce(p_dari, p_ke);
  if kat is null then
    raise exception 'Tempat tidak ditemukan' using errcode = 'P0002';
  end if;

  -- Barang tidak boleh berpindah antar kategori: itu bukan perpindahan,
  -- melainkan dua kesalahan input yang saling menutupi.
  if p_dari is not null and p_ke is not null then
    select kategori_id into kat_ke from public.lokasi where id = p_ke;
    if kat_ke is distinct from kat then
      raise exception 'Tempat asal dan tujuan beda kategori' using errcode = '22023';
    end if;
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

    select p.kode, v.ukuran into kode, uk
      from public.varian v join public.produk p on p.id = v.produk_id
     where v.id = vid and p.kategori_id = kat;
    if kode is null then
      raise exception 'Ukuran tidak ditemukan di kategori ini' using errcode = 'P0002';
    end if;

    if p_dari is not null then
      -- Dikunci sampai transaksi selesai, supaya dua orang yang menjual
      -- barang sama di saat bersamaan tidak saling menimpa hasil hitungan.
      select jumlah into sisa_d from public.stok
       where varian_id = vid and lokasi_id = p_dari for update;
      if sisa_d is null then
        raise exception 'Ukuran % % belum punya catatan stok di tempat itu', kode, uk
          using errcode = 'P0002';
      end if;
      if sisa_d - n < 0 then
        raise exception 'Stok % ukuran % tercatat % pcs, kurang dari % pcs. Hitung ulang dulu.',
          kode, uk, sisa_d, n using errcode = '23514';
      end if;
      update public.stok set jumlah = jumlah - n
       where varian_id = vid and lokasi_id = p_dari
      returning jumlah into sisa_d;
    else
      sisa_d := null;
    end if;

    if p_ke is not null then
      select jumlah into sisa_k from public.stok
       where varian_id = vid and lokasi_id = p_ke for update;
      if sisa_k is null then
        raise exception 'Ukuran % % belum dijual di tempat tujuan', kode, uk
          using errcode = 'P0002';
      end if;
      update public.stok set jumlah = jumlah + n
       where varian_id = vid and lokasi_id = p_ke
      returning jumlah into sisa_k;
    else
      sisa_k := null;
    end if;

    insert into public.mutasi
      (varian_id, jenis, dari_lokasi_id, ke_lokasi_id, jumlah,
       dari_setelah, ke_setelah, catatan, oleh)
    values
      (vid, p_jenis, p_dari, p_ke, n, sisa_d, sisa_k, p_catatan, uid);

    jml := jml + 1;
  end loop;

  return jml;
end;
$$;

revoke all on function public.catat_pergerakan(text, jsonb, uuid, uuid, text) from public, anon;
grant execute on function public.catat_pergerakan(text, jsonb, uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------ hitung fisik
--
-- Menyetel angka pasti hasil hitungan di tangan, sekalian menandai kapan
-- dihitung — itu yang membedakannya dari koreksi, dan itu pula yang membuat
-- halaman Cari bisa bilang "dihitung 9 hari lalu".
create or replace function public.hitung_fisik(
  p_varian_id uuid,
  p_lokasi_id uuid,
  p_jumlah    int,
  p_catatan   text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := (select auth.uid());
  lama   int;
  selisih int;
begin
  if uid is null then
    raise exception 'Harus login dulu' using errcode = '42501';
  end if;
  if p_jumlah < 0 then
    raise exception 'Jumlah tidak boleh minus' using errcode = '23514';
  end if;

  select jumlah into lama from public.stok
   where varian_id = p_varian_id and lokasi_id = p_lokasi_id for update;
  if lama is null then
    raise exception 'Ukuran itu tidak punya catatan stok di tempat ini' using errcode = 'P0002';
  end if;

  selisih := p_jumlah - lama;

  update public.stok
     set jumlah = p_jumlah, dihitung_at = now()
   where varian_id = p_varian_id and lokasi_id = p_lokasi_id;

  -- Arah dicatat sesuai selisihnya, supaya riwayatnya terbaca sama seperti
  -- pergerakan lain: naik berarti masuk, turun berarti keluar.
  insert into public.mutasi
    (varian_id, jenis, dari_lokasi_id, ke_lokasi_id, jumlah,
     dari_setelah, ke_setelah, catatan, oleh)
  values
    (p_varian_id, 'hitung_ulang',
     case when selisih < 0 then p_lokasi_id end,
     case when selisih > 0 then p_lokasi_id end,
     abs(selisih),
     case when selisih < 0 then p_jumlah end,
     case when selisih > 0 then p_jumlah end,
     p_catatan, uid);

  return p_jumlah;
end;
$$;

revoke all on function public.hitung_fisik(uuid, uuid, int, text) from public, anon;
grant execute on function public.hitung_fisik(uuid, uuid, int, text) to authenticated;
