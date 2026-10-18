import Keranjang from '../components/Keranjang'

/**
 * Mencatat penjualan. Satu pembeli reseller biasanya mengambil beberapa model
 * sekaligus, jadi bentuknya daftar belanja, bukan satu-satu.
 *
 * Harga ditampilkan di sini karena di saat inilah kamu perlu tahu totalnya —
 * sebelum ini tidak ada apa pun di sistem yang menjumlahkan satu pesanan.
 */
export default function Jual() {
  return (
    <Keranjang
      judul="Jual"
      jenis="jual"
      sumber="toko"
      tampilkanHarga
      labelSimpan="Simpan penjualan"
      petunjuk="Pilih produk, isi jumlah per ukuran, lalu tambahkan ke daftar. Ulangi untuk model lain, baru simpan sekali di akhir."
    />
  )
}
