import Keranjang from '../components/Keranjang'
import { catatPergerakan } from '../lib/api'
import { useToko } from '../store/toko'

/**
 * Memindahkan barang dari gudang ke toko. Biasanya lintas model sekaligus,
 * jadi bentuknya sama dengan halaman Jual.
 *
 * Harga tidak ditampilkan dan tidak ada nota: ini perpindahan di dalam usaha
 * sendiri, tidak ada uang yang berganti tangan.
 */
export default function Ambil() {
  const sesi = useToko((s) => s.sesi)

  return (
    <Keranjang
      judul="Ambil dari gudang"
      sumberId={sesi?.gudang?.id ?? null}
      tampilkanHarga={false}
      labelSimpan="Pindahkan ke toko"
      petunjuk="Angka yang tampil adalah stok gudang. Isi berapa yang diambil per ukuran, tambahkan ke daftar, lalu simpan sekali di akhir."
      onSimpan={async (baris) => {
        if (!sesi?.gudang) throw new Error('Gudang kategori ini belum ada')
        // Gudangnya dipakai bersama dua toko gamis dewasa, jadi tujuannya
        // harus disebut: yang bertambah adalah toko yang sedang dibuka.
        const n = await catatPergerakan('pindah_ke_toko', baris, {
          dari: sesi.gudang.id,
          ke: sesi.toko.id,
        })
        return `${n} baris dipindahkan ke toko.`
      }}
    />
  )
}
