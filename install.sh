#!/bin/bash

# --- Warna ---
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m' # Tambahkan ini
RED='\033[0;31m'    # Tambahkan ini untuk error
NC='\033[0m' 

# --- Cek Root ---
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Silakan jalankan script ini sebagai ROOT (sudo su)${NC}"
  exit
fi

clear
echo -e "${BLUE}==========================================${NC}"
echo -e "${GREEN}    INSTALLER BOT WA WADOR (PT FANTUNNEL)  ${NC}"
echo -e "${BLUE}==========================================${NC}"

# --- Tanya Data ke User ---
read -p "Masukkan Nomor Bot (Contoh: 62878xxx): " BOT_NUM
read -p "Masukkan Nomor Owner (Contoh: 62878xxx): " OWNER_NUM
read -p "Masukkan Nama Owner: " OWNER_NAME
read -p "Masukkan API Key KMSP: " API_KMSP
read -p "Masukkan API Key Payment: " API_PAY
read -p "Masukkan Markup Harga: " MARKUP
read -p "Masukkan Sidompul Auth: " SID_AUTH
read -p "Masukkan Sidompul Key: " SID_KEY
echo -e "${BLUE}==========================================${NC}"

echo -e "${YELLOW}[1/6] Menginstall Node.js & Dependencies...${NC}"
apt update && apt install -y curl git wget build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo -e "${YELLOW}[2/6] Mengambil Source Code dari GitHub...${NC}"
cd /root
rm -rf botwador
git clone https://github.com/Pemulaajiw/botwador.git botwador
cd botwador

echo -e "${YELLOW}[3/6] Mengatur Konfigurasi Bot...${NC}"
cat <<EOF > ./config.json
{
  "phoneNumber": "$BOT_NUM",
  "ownerNumber": "$OWNER_NUM",
  "ownerName": "$OWNER_NAME",
  "apiKeyKMSP": "$API_KMSP",
  "apiKeyPayment": "$API_PAY",
  "markup": $MARKUP,
  "sidompulAuth": "$SID_AUTH",
  "sidompulKey": "$SID_KEY"
}
EOF

echo -e "${YELLOW}[4/6] Menginstall Module Node.js...${NC}"
npm install

echo -e "${YELLOW}[5/6] Membuat Background Service (Systemd)...${NC}"
cat <<EOF > /etc/systemd/system/botwador.service
[Unit]
Description=Bot WhatsApp PPOB & XL Tembak Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/botwador
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo -e "${YELLOW}[6/6] Menjalankan Bot...${NC}"
systemctl daemon-reload
systemctl enable botwador
systemctl start botwador

echo -e "${BLUE}------------------------------------------${NC}"
echo -e "${GREEN}INSTALASI SELESAI!${NC}"
echo -e "Bot sudah berjalan di background."
echo -e "Gunakan perintah berikut untuk melihat log & Scan QR/Pairing:"
echo -e "${YELLOW}journalctl -u botwador -f${NC}"
echo -e "${BLUE}------------------------------------------${NC}"
