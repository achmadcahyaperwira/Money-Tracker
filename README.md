# Cay's Money Tracker

Aplikasi pencatat keuangan pribadi (PWA) yang bisa di-install di HP Android dan iPhone, dan tetap jalan tanpa internet.
Semua data tersimpan di HP sendiri: tanpa akun, tanpa server, tanpa pelacakan.

**Buka & install:** https://achmadcahyaperwira.github.io/Money-Tracker/

## Fitur

- Catat pemasukan dan pengeluaran (tombol **+**, ketik nominal, Simpan)
- Riwayat per tanggal, filter per bulan, pencarian, edit dan hapus
- Beranda: saldo, total bulan ini, grafik pengeluaran per kategori
- Kategori bisa ditambah, diubah, dihapus
- **Tabungan Impian:** isi harga barang/impian dan berapa yang bisa ditabung per bulan, aplikasi menghitung kira-kira berapa bulan lagi dan bulan apa uangnya cukup. Ada tombol **Setor** untuk mencatat tabungan yang masuk
- Mata uang default Rubel (format `1 250 000 ₽`), bisa diganti di Pengaturan
- Mode terang/gelap, ekspor & impor backup (JSON), ekspor CSV

## Cara install di HP

- **Android (Chrome):** buka alamat di atas → menu ⋮ → **Instal aplikasi**
- **iPhone (Safari):** buka alamat di atas → **Bagikan** (iOS 26: menu ••• lalu Bagikan) → **Tambah ke Layar Utama** → pastikan "Buka sebagai App Web" aktif → **Tambah**

Buka aplikasinya sekali saat online; setelah itu bisa dipakai offline.

## Penting: backup

Data hanya ada di HP tempat aplikasi di-install. Lakukan **Pengaturan → Ekspor backup (JSON)** secara rutin dan simpan filenya di tempat lain (Google Drive, email, dll.). Untuk memulihkan, gunakan **Impor backup**.

## Untuk pengembang

HTML, CSS, dan JavaScript murni tanpa build step. Setiap kali file aplikasi diubah, naikkan versi cache di baris `const CACHE` pada `sw.js` (mis. `v2` → `v3`) supaya HP mengambil versi terbaru.
