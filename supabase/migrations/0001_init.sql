-- Fathia Stok — skema awal
-- Sistem internal: cek harga & status stok. Terpisah penuh dari Web_TIA.

create extension if not exists pgcrypto;

-- Status stok sengaja TIDAK memakai angka.
-- Angka hanya akurat kalau tiap barang keluar dicatat saat itu juga.
create type status_stok as enum ('ada', 'menipis', 'habis');

-- ---------------------------------------------------------------- kategori
-- Satu kategori = satu toko fisik, jadi lokasi barang otomatis ketahuan
-- dari kategorinya. Tidak perlu tabel lokasi terpisah.
create table kategori (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  nama          text not null,
  -- Ukuran default yang otomatis diisikan saat menambah produk baru di
  -- kategori ini. Bebas angka atau huruf, bisa diubah kapan saja.
  preset_ukuran text[] not null default '{}',
  urutan        int    not null default 0,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------------ produk
create table produk (
  id          uuid primary key default gen_random_uuid(),
  kode        text not null unique,          -- yang dicetak di hangtag
  nama        text not null,
  kategori_id uuid not null references kategori(id) on delete restrict,
  catatan     text,
  aktif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index produk_kategori_idx on produk (kategori_id);
create index produk_kode_idx     on produk (lower(kode));
create index produk_nama_idx     on produk (lower(nama));

-- ------------------------------------------------------------------ varian
-- Harga ada di sini, bukan di produk: harga beda per ukuran.
create table varian (
  id           uuid primary key default gen_random_uuid(),
  produk_id    uuid not null references produk(id) on delete cascade,
  ukuran       text not null,                 -- "1", "5", "S", "XL", "All size"
  urutan       int  not null default 0,       -- supaya S/M/L urut benar
  harga_grosir int  not null default 0,       -- rupiah, tanpa desimal
  stok_toko    status_stok not null default 'ada',
  stok_gudang  status_stok not null default 'ada',
  updated_at   timestamptz not null default now(),
  unique (produk_id, ukuran)
);

create index varian_produk_idx on varian (produk_id);

-- ------------------------------------------------------- updated_at otomatis
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger produk_updated_at
  before update on produk
  for each row execute function set_updated_at();

create trigger varian_updated_at
  before update on varian
  for each row execute function set_updated_at();

-- --------------------------------------------------------------------- RLS
-- Aplikasi internal: tidak ada akses publik sama sekali.
alter table kategori enable row level security;
alter table produk   enable row level security;
alter table varian   enable row level security;

create policy "kategori: authenticated full access"
  on kategori for all to authenticated
  using (true) with check (true);

create policy "produk: authenticated full access"
  on produk for all to authenticated
  using (true) with check (true);

create policy "varian: authenticated full access"
  on varian for all to authenticated
  using (true) with check (true);

-- ------------------------------------------------------------- data awal
insert into kategori (slug, nama, preset_ukuran, urutan) values
  ('denim-anak',   'Denim Anak Perempuan', array['1','2','3','4','5','6','7','8','9','10'], 1),
  ('gamis-anak',   'Gamis Anak Perempuan', array['1','2','3','4','5','6','7','8','9','10'], 2),
  ('gamis-dewasa', 'Gamis Dewasa',         array['S','M','L','XL','XXL'],                   3);
