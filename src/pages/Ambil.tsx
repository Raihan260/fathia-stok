import Keranjang from '../components/Keranjang'

/**
 * Memindahkan barang dari gudang ke toko. Biasanya lintas model sekaligus,
 * jadi bentuknya sama dengan halaman Jual.
 *
 * Harga tidak ditampilkan: ini perpindahan di dalam usaha sendiri, tidak ada
 * uang yang berganti tangan, dan angka rupiah di sini cuma mengaburkan.
 */
export default function Ambil() {
  return (
    <Keranjang
      judul="Ambil dari gudang"
      jenis="pindah_ke_toko"
      sumber="gudang"
      tampilkanHarga={false}
      labelSimpan="Pindahkan ke toko"
      petunjuk="Angka yang tampil adalah stok gudang. Isi berapa yang diambil per ukuran, tambahkan ke daftar, lalu simpan sekali di akhir."
    />
  )
}
