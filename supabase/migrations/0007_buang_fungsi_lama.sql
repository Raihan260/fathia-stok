-- Versi 3-argumen dari migrasi 0005 digantikan versi 5-argumen di 0006.
-- `create or replace` dengan tanda tangan berbeda membuat fungsi BARU, bukan
-- mengganti yang lama — jadi keduanya ada berdampingan, dan panggilan lewat
-- REST yang hanya mengirim tiga argumen jadi ambigu antara keduanya.
drop function if exists public.catat_mutasi_banyak(text, jsonb, text);
