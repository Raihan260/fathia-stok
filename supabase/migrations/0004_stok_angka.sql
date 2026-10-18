-- Stok berubah dari status (ada/menipis/habis) menjadi jumlah pcs.
--
-- Alasan perubahan: Fathia Kids jualan grosir. Reseller bertanya "ada 30 pcs
-- ukuran 5?" — status "ada" tidak menjawab itu. Pola grosir juga membuat
-- pencatatan angka realistis: transaksinya sedikit tapi besar, beda dengan
-- ritel yang puluhan transaksi kecil per hari.
--
-- Status tidak hilang, hanya jadi turunan: dihitung dari jumlah terhadap
-- `kategori.batas_menipis`, dan dihitung di aplikasi, bukan disimpan.

-- ---------------------------------------------------------- ambang menipis
-- Disimpan per kategori supaya bisa beda-beda nanti tanpa migrasi baru.
alter table kategori add column batas_menipis int not null default 24;

comment on column kategori.batas_menipis is
  'Jumlah pcs; di bawah atau sama dengan ini dianggap menipis. Default 24 = 2 lusin.';

-- ------------------------------------------------------------ kolom jumlah
alter table varian add column jumlah_toko   int not null default 0 check (jumlah_toko   >= 0);
alter table varian add column jumlah_gudang int not null default 0 check (jumlah_gudang >= 0);

-- Kapan terakhir dihitung fisik. NULL = belum pernah. Dipakai aplikasi untuk
-- menampilkan angka yang sudah lama tidak diverifikasi sebagai meragukan —
-- angka yang salah berbahaya justru karena terlihat pasti.
alter table varian add column toko_dihitung_at   timestamptz;
alter table varian add column gudang_dihitung_at timestamptz;

-- Pindahkan status lama jadi angka perkiraan. Nilainya cuma tebakan awal;
-- angka yang benar datang dari opname pertama.
update varian set
  jumlah_toko = case stok_toko
    when 'habis' then 0 when 'menipis' then 12 else 48 end,
  jumlah_gudang = case stok_gudang
    when 'habis' then 0 when 'menipis' then 12 else 48 end;

alter table varian drop column stok_toko;
alter table varian drop column stok_gudang;

-- ------------------------------------------------------------------ mutasi
-- Catatan setiap pergerakan stok: siapa, kapan, berubah berapa, jadi berapa.
-- Gunanya tiga: menelusuri kalau angka terasa aneh, jejak siapa mengubah apa
-- (karyawan punya akun sendiri), dan nanti jadi bahan melihat ukuran mana
-- yang paling laku.
create table mutasi (
  id             uuid primary key default gen_random_uuid(),
  varian_id      uuid not null references varian(id) on delete cascade,
  jenis          text not null check (jenis in
                   ('jual', 'barang_masuk', 'pindah_ke_toko', 'hitung_ulang', 'koreksi')),
  delta_toko     int  not null default 0,
  delta_gudang   int  not null default 0,
  toko_setelah   int  not null,
  gudang_setelah int  not null,
  catatan        text,
  oleh           uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index mutasi_varian_idx on mutasi (varian_id, created_at desc);
create index mutasi_waktu_idx  on mutasi (created_at desc);

alter table mutasi enable row level security;

-- Boleh dibaca semua yang login. Tidak ada policy INSERT: baris mutasi hanya
-- lahir dari fungsi di bawah, supaya log tidak bisa dikarang langsung.
create policy "mutasi: semua yang login bisa baca"
  on mutasi for select to authenticated using (true);

-- ------------------------------------------------------- fungsi pergerakan
-- SECURITY DEFINER supaya bisa menulis ke `mutasi` tanpa membuka policy
-- INSERT untuk user. Izinnya diperiksa manual di dalam.
create or replace function public.catat_mutasi(
  p_varian_id    uuid,
  p_jenis        text,
  p_delta_toko   int  default 0,
  p_delta_gudang int  default 0,
  p_catatan      text default null
)
returns public.varian
language plpgsql
security definer
set search_path = ''
as $$
declare
  v   public.varian;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Harus login dulu' using errcode = '42501';
  end if;

  if p_jenis = 'hitung_ulang' then
    raise exception 'Pakai fungsi hitung_ulang() untuk itu' using errcode = '22023';
  end if;

  -- Kunci barisnya supaya dua orang yang menjual barang sama di saat
  -- bersamaan tidak saling menimpa hasil hitungan.
  select * into v from public.varian where id = p_varian_id for update;
  if not found then
    raise exception 'Ukuran tidak ditemukan' using errcode = 'P0002';
  end if;

  -- Stok minus tidak berarti apa-apa; itu tanda hitungan sebelumnya salah.
  if v.jumlah_toko + p_delta_toko < 0 then
    raise exception 'Stok toko tercatat % pcs, kurang dari % pcs yang diminta. Hitung ulang dulu.',
      v.jumlah_toko, abs(p_delta_toko) using errcode = '23514';
  end if;
  if v.jumlah_gudang + p_delta_gudang < 0 then
    raise exception 'Stok gudang tercatat % pcs, kurang dari % pcs yang diminta. Hitung ulang dulu.',
      v.jumlah_gudang, abs(p_delta_gudang) using errcode = '23514';
  end if;

  update public.varian
     set jumlah_toko   = jumlah_toko   + p_delta_toko,
         jumlah_gudang = jumlah_gudang + p_delta_gudang
   where id = p_varian_id
  returning * into v;

  insert into public.mutasi
    (varian_id, jenis, delta_toko, delta_gudang, toko_setelah, gudang_setelah, catatan, oleh)
  values
    (p_varian_id, p_jenis, p_delta_toko, p_delta_gudang,
     v.jumlah_toko, v.jumlah_gudang, p_catatan, uid);

  return v;
end;
$$;

-- Set angka pasti hasil hitung fisik, sekalian menandai kapan dihitung.
create or replace function public.hitung_ulang(
  p_varian_id uuid,
  p_lokasi    text,            -- 'toko' | 'gudang'
  p_jumlah    int,
  p_catatan   text default null
)
returns public.varian
language plpgsql
security definer
set search_path = ''
as $$
declare
  v     public.varian;
  uid   uuid := (select auth.uid());
  d_tok int := 0;
  d_gud int := 0;
begin
  if uid is null then
    raise exception 'Harus login dulu' using errcode = '42501';
  end if;
  if p_lokasi not in ('toko', 'gudang') then
    raise exception 'Lokasi harus toko atau gudang' using errcode = '22023';
  end if;
  if p_jumlah < 0 then
    raise exception 'Jumlah tidak boleh minus' using errcode = '23514';
  end if;

  select * into v from public.varian where id = p_varian_id for update;
  if not found then
    raise exception 'Ukuran tidak ditemukan' using errcode = 'P0002';
  end if;

  if p_lokasi = 'toko' then
    d_tok := p_jumlah - v.jumlah_toko;
    update public.varian
       set jumlah_toko = p_jumlah, toko_dihitung_at = now()
     where id = p_varian_id returning * into v;
  else
    d_gud := p_jumlah - v.jumlah_gudang;
    update public.varian
       set jumlah_gudang = p_jumlah, gudang_dihitung_at = now()
     where id = p_varian_id returning * into v;
  end if;

  insert into public.mutasi
    (varian_id, jenis, delta_toko, delta_gudang, toko_setelah, gudang_setelah, catatan, oleh)
  values
    (p_varian_id, 'hitung_ulang', d_tok, d_gud,
     v.jumlah_toko, v.jumlah_gudang, p_catatan, uid);

  return v;
end;
$$;

revoke all on function public.catat_mutasi(uuid, text, int, int, text) from public, anon;
revoke all on function public.hitung_ulang(uuid, text, int, text)      from public, anon;
grant execute on function public.catat_mutasi(uuid, text, int, int, text) to authenticated;
grant execute on function public.hitung_ulang(uuid, text, int, text)      to authenticated;
