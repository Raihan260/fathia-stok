import Keranjang from '../components/Keranjang'
import { catatMutasiBanyak } from '../lib/api'

/**
 * Memindahkan barang dari gudang ke toko. Biasanya lintas model sekaligus,
 * jadi bentuknya sama dengan halaman Jual.
 *
 * Harga tidak ditampilkan dan tidak ada nota: ini perpindahan di dalam usaha
 * sendiri, tidak ada uang yang berganti tangan.
 */
export default function Ambil() {
  return (
    <Keranjang
      judul="Ambil dari gudang"
      sumber="gudang"
      tampilkanHarga={false}
      labelSimpan="Pindahkan ke toko"
      petunjuk="Angka yang tampil adalah stok gudang. Isi berapa yang diambil per ukuran, tambahkan ke daftar, lalu simpan sekali di akhir."
      onSimpan={async (baris) => {
        const n = await catatMutasiBanyak('pindah_ke_toko', baris)
        return `${n} baris dipindahkan ke toko.`
      }}
    />
  )
}
