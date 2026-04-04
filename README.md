# 🤖 BOT WADOR SERVICE (PPOB & XL TEMBAK)

## 📝 Description
**Bot Wador Service** adalah asisten WhatsApp otomatis yang dirancang khusus untuk memudahkan transaksi **XL Tembak** dan **PPOB** secara real-time. Bot ini terintegrasi langsung dengan API **KMSP Store** untuk layanan XL Tembak (V2 & OTP) dan **Sidompul** untuk pengecekan kuota yang akurat. 

Sistem ini memungkinkan pengguna untuk melakukan pembelian paket data, mengecek stok paket Akrab Global secara otomatis, serta mengelola saldo user melalui database lokal yang aman. Dilengkapi dengan fitur manajemen grup seperti broadcast (JPM), Tag All, dan sistem blokir grup otomatis untuk menghindari spam berlebihan. Dibangun menggunakan Node.js dengan library Baileys terbaru, bot ini berjalan stabil sebagai **systemd service** di VPS Ubuntu/Debian untuk memastikan operasional 24/7 tanpa henti. 🗿

---

## 🚀 Cara Install (Otomatis)
Jalankan perintah ini di VPS (Ubuntu/Debian) kamu:
```bash
wget -O install.sh https://raw.githubusercontent.com/Pemulaajiw/botwador/main/install.sh && chmod +x install.sh && ./install.sh
