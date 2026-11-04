import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Keranjang from '../components/Keranjang'
import { ambilNamaPembeli, catatPenjualanToko } from '../lib/api'
import { useToko } from '../store/toko'
import { rupiah } from '../lib/types'

/**
 * Mencatat penjualan. Satu pembeli reseller biasanya mengambil beberapa model
 * sekaligus, jadi bentuknya daftar belanja, bukan satu-satu.
 *
 * Penyimpanannya lewat catat_penjualan(): selain menurunkan stok, ia membuat
 * nota dengan salinan harga saat itu. Lima baris penjualan yang tidak saling
 * terhubung tidak bisa menjawab "tadi Bu Ani ambil apa saja".
 */
export default function Jual() {
  const sesi = useToko((s) => s.sesi)
  const [saran, setSaran] = useState<string[]>([])

  useEffect(() => {
    if (!sesi) return
    ambilNamaPembeli(sesi.kategori.id)
      .then(setSaran)
      .catch(() => setSaran([])) // saran nama bukan hal penting; diamkan saja
  }, [sesi?.kategori.id])

  return (
    <Keranjang
      judul="Jual"
      sumberId={sesi?.toko.id ?? null}
      tampilkanHarga
      pakaiPembeli
      saranPembeli={saran}
      labelSimpan="Simpan penjualan"
      petunjuk="Pilih produk, isi jumlah per ukuran, lalu tambahkan ke daftar. Ulangi untuk model lain, baru simpan sekali di akhir."
      atas={
        <Link to="/nota" className="text-sm font-medium text-pink-700 hover:underline">
          Riwayat nota →
        </Link>
      }
      onSimpan={async (baris, pembeli) => {
        if (!sesi) throw new Error('Toko belum dipilih')
        // Penjualan keluar dari TOKO yang sedang dibuka, bukan dari kategori:
        // gamis dewasa punya dua toko, dan hanya satu di antaranya yang
        // stoknya boleh berkurang.
        const nota = await catatPenjualanToko(sesi.toko.id, baris, pembeli)
        // Nama baru langsung masuk saran, tanpa menunggu halaman dimuat ulang.
        if (pembeli && !saran.includes(pembeli)) setSaran([pembeli, ...saran])
        return `Nota ${nota.nomor} tersimpan · ${rupiah(nota.total)}`
      }}
    />
  )
}
