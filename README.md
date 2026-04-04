# 🤖 BOT WADOR SERVICE (PPOB & XL TEMBAK)

## 📝 Description
**Bot Wador Service** adalah asisten WhatsApp otomatis yang dirancang khusus untuk memudahkan transaksi **XL Tembak** dan **PPOB** secara real-time. Bot ini terintegrasi langsung dengan API **KMSP Store** untuk layanan XL Tembak (V2 & OTP) dan **Sidompul** untuk pengecekan kuota yang akurat. 

Sistem ini memungkinkan pengguna untuk melakukan pembelian paket data, mengecek stok paket Akrab Global secara otomatis, serta mengelola saldo user melalui database lokal yang aman. Dilengkapi dengan fitur manajemen grup seperti broadcast (JPM), Tag All, dan sistem blokir grup otomatis untuk menghindari spam berlebihan. Dibangun menggunakan Node.js dengan library Baileys terbaru, bot ini berjalan stabil sebagai **systemd service** di VPS Ubuntu/Debian untuk memastikan operasional 24/7 tanpa henti. 

---

## 🚀 Cara Install (Otomatis)
Jalankan perintah ini di VPS (Ubuntu/Debian) kamu:
```bash
wget -O install.sh https://raw.githubusercontent.com/Pemulaajiw/botwador/main/install.sh && chmod +x install.sh && ./install.sh

## ⚙️ Cara Update / Edit Data Bot
Jika ingin mengganti **API Key, Nomor Owner, atau Markup Harga**, ikuti langkah ini:

### 1. Edit Konfigurasi
Masuk ke folder bot dan edit file `config.json`:
```bash
nano /root/botwador/config.json
```
> *Gunakan tombol panah untuk navigasi. Simpan dengan cara tekan: **CTRL + O**, lalu **Enter**, lalu **CTRL + X**.*

### 2. Restart Bot
Wajib jalankan perintah ini agar perubahan data terbaca oleh sistem bot:
```bash
systemctl restart botwador
```

---

## 🛠️ Perintah Management (Systemd)
Gunakan perintah ini untuk mengelola bot di VPS kamu:

| Perintah | Fungsi |
| :--- | :--- |
| `systemctl start botwador` | Menjalankan Bot |
| `systemctl stop botwador` | Mematikan Bot |
| `systemctl restart botwador` | Restart Bot (Wajib setelah edit config) |
| `systemctl status botwador` | Cek status bot (Aktif/Error) |
| `journalctl -u botwador -f` | Cek Log / Pairing Code secara real-time |

---

## 📝 List Command Utama
* **List Paket:** `.listpaket` (Sudah mendukung sistem halaman/slide).
* **Cek Stok:** `.cekstok` (Update stok Akrab Global secara real-time).
* **Cek Kuota:** `.cekkouta` (Cek sisa kuota via Sidompul).
* **Login XL:** `.loginxl` & `.verifxl` (Untuk fitur tembak paket OTP).
* **Management:** `.tagall`, `.jpm`, `.blokgb` (Khusus Owner/Admin).

---

## ⚠️ Catatan Penting
* **Pairing Code:** Jika sesi habis atau pertama kali install, cek kode pairing melalui log: `journalctl -u botwador -f`.
* **Database:** Jangan hapus folder `./database/` kecuali ingin reset saldo dan seluruh riwayat transaksi user.
* **Markup:** Harga jual otomatis ditambahkan dari harga pusat berdasarkan nilai `markup` yang kamu atur di `config.json`.

---
*Developed for PT FANTUNNEL STORE* 
```
