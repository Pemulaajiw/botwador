import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import axios from 'axios';

// --- KONFIGURASI UTAMA ---
// Pastikan file config.json ada (hasil dari install.sh)
if (!fs.existsSync('./config.json')) {
    console.error("File config.json tidak ditemukan! Jalankan install.sh dulu.");
    process.exit(1);
}

const externalConfig = JSON.parse(fs.readFileSync('./config.json'));

const config = {
    // Diambil otomatis dari hasil input install.sh kamu
    phoneNumber: externalConfig.phoneNumber,
    ownerNumber: externalConfig.ownerNumber,
    ownerName: externalConfig.ownerName,
    apiKeyKMSP: externalConfig.apiKeyKMSP, 
    apiKeyPayment: externalConfig.apiKeyPayment,
    markup: parseInt(externalConfig.markup) || 3000,
    sidompulAuth: externalConfig.sidompulAuth || "Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw",
    sidompulKey: externalConfig.sidompulKey || "60ef29aa-a648-4668-90ae-20951ef90c55",
    
    // Settingan Folder & Database
    sessionName: "session",
    blockedGroupsFile: "./database/blocked_groups.json",
    xlSessionsFile: "./database/xl_sessions.json",
    userBalanceFile: "./database/user_balance.json", 
    historyFile: "./database/history.json",           
};

// --- DATABASE HANDLER ---
if (!fs.existsSync('./database')) fs.mkdirSync('./database');
const loadDB = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
const saveDB = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
const loadObjDB = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};

let blockedGroups = loadDB(config.blockedGroupsFile);
let xlSessions = loadObjDB(config.xlSessionsFile);
let userBalance = loadObjDB(config.userBalanceFile);
let historyTrx = loadDB(config.historyFile);
let pendingOrders = {};
let pendingLogin = {};
let pairingRequested = false;
let isConnecting = false;

// --- HELPER FUNCTION ---
const formatRupiah = (n) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
const saveBalance = () => saveDB(config.userBalanceFile, userBalance);
const saveHistory = () => saveDB(config.historyFile, historyTrx);
const saveXLSessions = () => saveDB(config.xlSessionsFile, xlSessions);
const saveBlockedGroups = () => saveDB(config.blockedGroupsFile, blockedGroups);
// ... (Lanjut ke fungsi startBot dan logika case menu kamu)

async function startBot() {
    if (isConnecting) return;
    isConnecting = true;

    const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // WAJIB! BIAR SESSION KESIMPAN
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting') {
            console.log('[~] Menghubungkan...');
            return;
        }

        if (connection === 'open') {
            console.log('[+] Bot Online 🚀');
            isConnecting = false;
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;

            console.log(`[!] Disconnect: ${reason}`);

            isConnecting = false;

            if (shouldReconnect) {
                console.log('[~] Reconnecting 5 detik...');
                setTimeout(() => startBot(), 5000);
            } else {
                console.log('[!] Harus login ulang!');
            }
        }

        // PAIRING CODE FIX
        if (!state.creds.registered && !pairingRequested) {
            pairingRequested = true;

            setTimeout(async () => {
                try {
                    let phone = config.phoneNumber.replace(/[^0-9]/g, '');
                    const code = await sock.requestPairingCode(phone);

                    console.log('\n=== PAIRING CODE ===');
                    console.log(code);
                    console.log('====================\n');

                } catch (err) {
                    console.log('Gagal pairing:', err);
                    pairingRequested = false;
                }
            }, 8000);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
    try {
        const msg = m.messages[0];
        if (!msg || !msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? msg.key.participant : from;

        const pushname = msg.pushName || "User";

        const content =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            '';

        const isOwner = sender.split('@')[0] === config.ownerNumber;

        if (!content.startsWith('.')) return;

        const args = content.trim().split(' ');
        const command = args.shift().slice(1).toLowerCase();
        const q = args.join(' ');
        const isUserBusy = (sender) => {
        return pendingOrders[sender] ? true : false;
};

                switch (command) {
                    case 'menu':
                        const myBal = userBalance[sender] || 0;
                        const myTrx = historyTrx.filter(x => x.sender === sender).length;
                        const nomorUser = sender.split('@')[0];

                        const header = `Halo @${nomorUser} 👋\n` +
                                       `Nomor: ${nomorUser}\n` +
                                       `Saldo: ${formatRupiah(myBal)}\n` +
                                       `Total Trx: ${myTrx}\n` +
                                       `Bot Udp & Vpn Admin: https://t.me/nznxajivpn_bot?start=start \n` +
                                       `▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n`;

                        const menuText = `
🤖 *BOT PPOB & XL*

*🔥 Fitur Baru*
• .cekkouta <nomor> (Cek Kuota V2)

*🔍 Pencarian & Informasi*
• .carikuota <nama> <min-max>
• .listpaket (Daftar semua paket)

*💳 Transaksi QRIS (Direct)*
• .beli <kode> <nomor> (Via Payment Gateway)
• .cekbayar (Cek Status Otomatis)
• .batal (Cancel Pesanan)

*💰 Saldo & Member*
• .saldo
• .isisaldo (Topup Otomatis)
• .beliv2 <kode> <nomor> (Via Saldo)
• .riwayat
• .cekstatus

*🔐 Akun XL*
• .loginxl / .verifxl
• .myquota / .mylocation / .stop

*👑 Owner Menu*
• .addsaldo <nomor> <jumlah>
• .delsaldo <nomor> <jumlah>
• .editsaldo <nomor> <jumlah>
• .listuser (Cek user saldo)
• .totaltrx (Statistik bot)
• .dor (Tembak langsung)
• .ceksaldo (Saldo Pusat)
• .jpm / .tagall / .blokgb
• .owner

*🛠️ Utility*
• .cekstok
• .ping
`;
                        if (fs.existsSync('./logo.jpg')) {
                            await sock.sendMessage(from, { image: fs.readFileSync('./logo.jpg'), caption: header + menuText, mentions: [sender] }, { quoted: msg });
                        } else {
                            await sock.sendMessage(from, { text: header + menuText, mentions: [sender] }, { quoted: msg });
                        }
                        break;

                    // ====================================================
                    // FITUR TRANSAKSI (PAYMENT BARU)
                    // ====================================================

                    case 'beli': // Direct QRIS
                        if (!args[0] || !args[1]) return sock.sendMessage(from, { text: 'Contoh: .beli XL10GB 0878xxxx' }, { quoted: msg });
                        if (pendingOrders[sender]) return sock.sendMessage(from, { text: '⚠️ Ada transaksi pending. Ketik .batal atau selesaikan dulu.' }, { quoted: msg });
                        if (isUserBusy(sender)) {
                        return sock.sendMessage(from, {
                        text: '⚠️ Selesaikan transaksi sebelumnya dulu!'
                     }, { quoted: msg });
                        }

                        try {
                            // 1. Cek Produk di KMSP
                            const resList = await axios.get(`https://golang-openapi-packagelist-xltembakservice.kmsp-store.com/v1?api_key=${config.apiKeyKMSP}`);
                            const produk = resList.data.data.find(p => p.package_code === args[0]);
                            if (!produk) return sock.sendMessage(from, { text: 'Produk tidak ditemukan.' }, { quoted: msg });

                            // 2. Hitung Harga (Harga Pusat + Markup)
                            // API Payment akan menambah fee sendiri di total_amount, jadi kita request amount = harga jual kita
                            const hargaJual = produk.package_harga_int + config.markup;

                            // 3. Request QRIS ke API Payment Baru
                            const resDeposit = await axios.get(`https://my-payment.autsc.my.id/api/deposit`, {
                                params: {
                                    amount: hargaJual,
                                    apikey: config.apiKeyPayment // 
                                }
                            });

                            if (resDeposit.data.status === 'success') {
                                const dataPay = resDeposit.data.data;
                                
                                // 4. Simpan Data Order
                                pendingOrders[sender] = {
                                    type: 'buy_direct',
                                    transaction_id: dataPay.transaction_id, // ID Transaksi Payment 
                                    nominal_bayar: dataPay.total_amount,    // Total yang harus dibayar user
                                    package_code: produk.package_code,
                                    phone: args[1].replace(/[^0-9]/g, ''),
                                    price_server: produk.package_harga_int,
                                    name: produk.package_name
                                };

                                // 5. Kirim QRIS
                                await sock.sendMessage(from, { 
                                    image: { url: dataPay.qris_url }, 
                                    caption: `*TAGIHAN PEMBAYARAN* 🧾\n\n` +
                                             `📦 Produk: ${produk.package_name}\n` +
                                             `📱 Tujuan: ${args[1]}\n\n` +
                                             `💰 *Total Bayar: Rp ${dataPay.total_amount}*\n` +
                                             `_(Sudah termasuk biaya admin)_ \n\n` +
                                             `⏳ Expired: ${dataPay.expired_minutes} Menit\n\n` +
                                             `Silakan scan QRIS di atas. Jika sudah berhasil, *Reply pesan ini* dan ketik *.cekbayar*`
                                }, { quoted: msg });
                            } else {
                                await sock.sendMessage(from, { text: 'Gagal membuat tagihan QRIS.' }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); await sock.sendMessage(from, { text: 'Terjadi kesalahan sistem.' }, { quoted: msg }); }
                        break;

                    case 'isisaldo': // Topup Saldo
                        if (!args[0]) return sock.sendMessage(from, { text: 'Contoh: .isisaldo 50000' }, { quoted: msg });
                        if (pendingOrders[sender]) return sock.sendMessage(from, { text: 'Selesaikan/batalkan transaksi sebelumnya dulu.' }, { quoted: msg });
                        if (isUserBusy(sender)) {
                        return sock.sendMessage(from, {
                        text: '⚠️ Selesaikan transaksi sebelumnya dulu!'
                    }, { quoted: msg });
                        }                        

                        const nominalTopup = parseInt(args[0]);
                        if (isNaN(nominalTopup) || nominalTopup < 1000) return sock.sendMessage(from, { text: 'Minimal topup 1000.' }, { quoted: msg });

                        try {
                            const resDeposit = await axios.get(`https://my-payment.autsc.my.id/api/deposit`, {
                                params: {
                                    amount: nominalTopup,
                                    apikey: config.apiKeyPayment
                                }
                            });
                            
                            if (resDeposit.data.status === 'success') {
                                const dataPay = resDeposit.data.data;

                                pendingOrders[sender] = {
                                    type: 'topup',
                                    transaction_id: dataPay.transaction_id,
                                    amount_added: nominalTopup, // Saldo yang masuk sesuai input awal
                                    nominal_bayar: dataPay.total_amount
                                };

                                await sock.sendMessage(from, { 
                                    image: { url: dataPay.qris_url },
                                    caption: `*TOPUP SALDO* 💰\n\n` +
                                             `Nominal Masuk: ${formatRupiah(nominalTopup)}\n` +
                                             `*Total Transfer: Rp ${dataPay.total_amount}*\n\n` +
                                             `⏳ Expired: ${dataPay.expired_minutes} Menit\n` +
                                             `Reply pesan ini ketik *.cekbayar* jika sudah transfer.`
                                }, { quoted: msg });
                            }
                        } catch (e) { console.error(e); }
                        break;

                    case 'cekbayar': // Cek Status API Baru
                        if (!pendingOrders[sender]) return sock.sendMessage(from, { text: '❌ Tidak ada transaksi pending.' }, { quoted: msg });
                        
                        await sock.sendMessage(from, { text: '🔍 Mengecek status pembayaran...' }, { quoted: msg });
                        const order = pendingOrders[sender];

                        try {
                            // Hit API Cek Status 
                            const resStatus = await axios.get(`https://my-payment.autsc.my.id/api/status/payment`, {
                                params: {
                                    transaction_id: order.transaction_id,
                                    apikey: config.apiKeyPayment
                                }
                            });

                            // Logic Cek Status
                            if (resStatus.data.paid === true) {
                                // --- PEMBAYARAN SUKSES ---
                                
                                if (order.type === 'buy_direct') {
                                    await sock.sendMessage(from, { text: '✅ Pembayaran DITERIMA! Memproses order...' }, { quoted: msg });
                                    // Eksekusi Tembak Paket
                                    try {
                                        const buy = await axios.get(`https://golang-openapi-packagepurchase-xltembakservice.kmsp-store.com/v1`, {
                                            params: { api_key: config.apiKeyKMSP, package_code: order.package_code, phone: order.phone, price_or_fee: order.price_server }
                                        });
                                        if (buy.data.status) {
                                            historyTrx.push({ date: new Date(), sender: sender, ...order, trx_id: buy.data.data.trx_id, status: 'sukses' });
                                            saveHistory();
                                            delete pendingOrders[sender];
                                            await sock.sendMessage(from, { text: `✅ *TRANSAKSI SUKSES!* 🚀\n\nPaket sedang dikirim ke ${order.phone}.\nTrx ID: ${buy.data.data.trx_id}` }, { quoted: msg });
                                        } else {
                                            // Gagal Tembak (Saldo Payment sudah masuk ke Admin, tapi paket gagal)
                                            await sock.sendMessage(from, { text: `⚠️ Pembayaran sukses, tapi gagal tembak paket: ${buy.data.message}. Hubungi Admin untuk refund manual.` }, { quoted: msg });
                                        }
                                    } catch (e) { console.error(e); }

                                } else if (order.type === 'topup') {
                                    // Eksekusi Tambah Saldo
                                    if (!userBalance[sender]) userBalance[sender] = 0;
                                    userBalance[sender] += order.amount_added;
                                    saveBalance();
                                    delete pendingOrders[sender];
                                    await sock.sendMessage(from, { text: `✅ *Topup Berhasil!*\n\nSaldo Masuk: ${formatRupiah(order.amount_added)}\nTotal Saldo: ${formatRupiah(userBalance[sender])}` }, { quoted: msg });
                                }

                            } else {
                                await sock.sendMessage(from, { text: '❌ Pembayaran BELUM terdeteksi. Silakan coba beberapa saat lagi jika sudah transfer.' }, { quoted: msg });
                            }
                        } catch (e) {
                            console.error(e);
                            await sock.sendMessage(from, { text: 'Gagal mengecek status pembayaran.' }, { quoted: msg });
                        }
                        break;

                    case 'batal':
                    case 'cancel':
                        if (!pendingOrders[sender]) return sock.sendMessage(from, { text: 'Tidak ada transaksi.' }, { quoted: msg });
                        delete pendingOrders[sender];
                        await sock.sendMessage(from, { text: '✅ Pesanan dibatalkan.' }, { quoted: msg });
                        break;

                    // ====================================================
                    // FITUR OWNER (ADD/DEL/EDIT/LIST)
                    // ====================================================

                    case 'addsaldo':
                        if (!isOwner) return sock.sendMessage(from, { text: 'Akses ditolak.' }, { quoted: msg });
                        if (!args[0] || !args[1]) return sock.sendMessage(from, { text: 'Contoh: .addsaldo 628xx 50000' }, { quoted: msg });
                        let targetAdd = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                        let amountAdd = parseInt(args[1]);
                        if (!userBalance[targetAdd]) userBalance[targetAdd] = 0;
                        userBalance[targetAdd] += amountAdd;
                        saveBalance();
                        await sock.sendMessage(from, { text: `✅ Saldo ditambah.\nUser: ${args[0]}\nTotal: ${formatRupiah(userBalance[targetAdd])}` }, { quoted: msg });
                        break;

                    case 'delsaldo':
                        if (!isOwner) return sock.sendMessage(from, { text: 'Akses ditolak.' }, { quoted: msg });
                        if (!args[0] || !args[1]) return sock.sendMessage(from, { text: 'Contoh: .delsaldo 628xx 10000' }, { quoted: msg });
                        let targetDel = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                        let amountDel = parseInt(args[1]);
                        if (!userBalance[targetDel]) userBalance[targetDel] = 0;
                        userBalance[targetDel] -= amountDel;
                        if (userBalance[targetDel] < 0) userBalance[targetDel] = 0;
                        saveBalance();
                        await sock.sendMessage(from, { text: `✅ Saldo dikurangi.\nSisa: ${formatRupiah(userBalance[targetDel])}` }, { quoted: msg });
                        break;

                    case 'editsaldo':
                        if (!isOwner) return sock.sendMessage(from, { text: 'Akses ditolak.' }, { quoted: msg });
                        if (!args[0] || !args[1]) return sock.sendMessage(from, { text: 'Contoh: .editsaldo 628xx 100000' }, { quoted: msg });
                        let targetEdit = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                        let amountEdit = parseInt(args[1]);
                        userBalance[targetEdit] = amountEdit;
                        saveBalance();
                        await sock.sendMessage(from, { text: `✅ Saldo diubah menjadi: ${formatRupiah(amountEdit)}` }, { quoted: msg });
                        break;

                    case 'listuser':
                        if (!isOwner) return;
                        let users = Object.keys(userBalance);
                        let textList = `📋 *LIST USER (SALDO > 0)*\n\n`;
                        let count = 0;
                        users.forEach(u => {
                            if (userBalance[u] > 0) { count++; textList += `${count}. @${u.split('@')[0]}\n   💰 ${formatRupiah(userBalance[u])}\n`; }
                        });
                        if (count === 0) textList += "Kosong.";
                        await sock.sendMessage(from, { text: textList, mentions: users }, { quoted: msg });
                        break;

                    case 'totaltrx':
                        if (!isOwner) return;
                        let sukses = historyTrx.filter(x => x.status === 'sukses');
                        let omzet = sukses.reduce((acc, curr) => acc + (curr.nominal_bayar || curr.price || 0), 0);
                        let statText = `📊 *STATISTIK BOT*\n\n✅ Trx Sukses: ${sukses.length}\n💰 Est. Omzet: ${formatRupiah(omzet)}\n👥 User: ${Object.keys(userBalance).length}`;
                        await sock.sendMessage(from, { text: statText }, { quoted: msg });
                        break;

                    case 'owner':
                        await sock.sendMessage(from, { contacts: { displayName: config.ownerName, contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${config.ownerName}\nTEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:${config.ownerNumber}\nEND:VCARD` }] } }, { quoted: msg });
                        break;

                    // ====================================================
                    // FITUR UTAMA LAINNYA
                    // ====================================================

                    case 'beliv2': // Beli Pakai Saldo
                        if (!args[0] || !args[1]) return sock.sendMessage(from, { text: 'Contoh: .beliv2 XL10GB 0878xxxx' }, { quoted: msg });
                        const userBal = userBalance[sender] || 0;
                        if (userBal < 1000) return sock.sendMessage(from, { text: `Saldo kurang (${formatRupiah(userBal)}).` }, { quoted: msg });
                        try {
                             const resList = await axios.get(`https://golang-openapi-packagelist-xltembakservice.kmsp-store.com/v1?api_key=${config.apiKeyKMSP}`);
                             const produk = resList.data.data.find(p => p.package_code === args[0]);
                             if (!produk) return sock.sendMessage(from, { text: 'Produk tidak ditemukan.' }, { quoted: msg });
                             const hargaFix = produk.package_harga_int + config.markup;
                             if (userBal < hargaFix) return sock.sendMessage(from, { text: `Saldo tidak cukup.\nHarga: ${formatRupiah(hargaFix)}` }, { quoted: msg });
                             userBalance[sender] -= hargaFix; saveBalance();
                             const buy = await axios.get(`https://golang-openapi-packagepurchase-xltembakservice.kmsp-store.com/v1`, { params: { api_key: config.apiKeyKMSP, package_code: produk.package_code, phone: args[1].replace(/[^0-9]/g, ''), price_or_fee: produk.package_harga_int } });
                            if (buy.data.status) {
                                historyTrx.push({ date: new Date(), sender, item: produk.package_name, price: hargaFix, trx_id: buy.data.data.trx_id, status: 'sukses' });
                                saveHistory(); await sock.sendMessage(from, { text: `✅ *Sukses!*\nSisa Saldo: ${formatRupiah(userBalance[sender])}\nTrx ID: ${buy.data.data.trx_id}` }, { quoted: msg });
                            } else { userBalance[sender] += hargaFix; saveBalance(); await sock.sendMessage(from, { text: `❌ Gagal: ${buy.data.message}. Saldo refund.` }, { quoted: msg }); }
                        } catch (e) { }
                        break;

                    case 'cekkouta':
                        if (!args[0]) return sock.sendMessage(from, { text: 'Masukkan nomor HP.' }, { quoted: msg });
                        await sock.sendMessage(from, { text: '🔍 Cek kuota...' }, { quoted: msg });
                        let nomorCek = args[0].replace(/[^0-9]/g, ''); if (nomorCek.startsWith('08')) nomorCek = '62' + nomorCek.slice(1);
                        try {
                            const resV2 = await axios.get(`https://apigw.kmsp-store.com/sidompul/v4/cek_kuota`, { params: { msisdn: nomorCek, isJSON: 'true' }, headers: { "Authorization": config.sidompulAuth, "X-API-Key": config.sidompulKey, "X-App-Version": "4.0.0" } });
                            if (resV2.data && resV2.data.status) {
                                const data = resV2.data.data;
                                if (data.hasil) { await sock.sendMessage(from, { text: data.hasil.replace(/<br>/g, "\n").replace(/📃 RESULT:/g, "📊 *HASIL CEK KUOTA*").replace(/===========================/g, "\n────────────────") }, { quoted: msg }); }
                                else { let t = `📊 *INFO KUOTA*\n`; if (Array.isArray(data)) { data.forEach(p => { t += `📦 ${p.name}\n   Sisa: ${p.remaining}\n   Exp: ${p.expired}\n\n`; }); await sock.sendMessage(from, { text: t }, { quoted: msg }); } }
                            } else { await sock.sendMessage(from, { text: `❌ Gagal: ${resV2.data.message}` }, { quoted: msg }); }
                        } catch (e) { await sock.sendMessage(from, { text: 'Error system.' }, { quoted: msg }); }
                        break;

                    case 'carikuota':
                        if (!args[0]) return sock.sendMessage(from, { text: '.carikuota <nama> <min-max>' }, { quoted: msg });
                        await sock.sendMessage(from, { text: '🔍 Mencari...' }, { quoted: msg });
                        try {
                            const res = await axios.get(`https://golang-openapi-packagelist-xltembakservice.kmsp-store.com/v1?api_key=${config.apiKeyKMSP}`);
                            let filterName = "", minPrice = 0, maxPrice = 99999999;
                            args.forEach(arg => { if (arg.includes('-') && /\d+-\d+/.test(arg)) { const parts = arg.split('-'); minPrice = parseInt(parts[0]); maxPrice = parseInt(parts[1]); } else { filterName += arg + " "; } });
                            filterName = filterName.trim().toLowerCase();
                            const results = res.data.data.filter(p => { const price = p.package_harga_int; const matchName = filterName ? p.package_name.toLowerCase().includes(filterName) : true; const matchPrice = price >= minPrice && price <= maxPrice; return matchName && matchPrice && p.no_need_login; });
                            if (results.length === 0) return sock.sendMessage(from, { text: '❌ Tidak ditemukan.' }, { quoted: msg });
                            let text = `*HASIL PENCARIAN* 🔎\n\n`;
                            results.slice(0, 15).forEach(p => { const finalPrice = p.package_harga_int + config.markup; text += `📦 *${p.package_name}*\n   Kode: ${p.package_code}\n   Harga: ${formatRupiah(finalPrice)}\n\n`; });
                            await sock.sendMessage(from, { text: text }, { quoted: msg });
                        } catch (e) { }
                        break;

                    case 'saldo': await sock.sendMessage(from, { text: `💰 *INFO SALDO*\nSisa Saldo: ${formatRupiah(userBalance[sender] || 0)}` }, { quoted: msg }); break;
                    case 'riwayat':
                        const userHist = historyTrx.filter(x => x.sender === sender).slice(-10).reverse();
                        let histText = `📜 *RIWAYAT TRANSAKSI*\n\n`; userHist.forEach(h => { histText += `📅 ${new Date(h.date).toLocaleDateString()}\n📦 ${h.item || h.name}\n✅ ${h.status}\n\n`; });
                        await sock.sendMessage(from, { text: histText }, { quoted: msg }); break;
                    case 'cekstatus':
                        if (!args[0]) return sock.sendMessage(from, { text: 'Masukan Trx ID.' }, { quoted: msg });
                        try { const resSt = await axios.get(`https://golang-openapi-checktransaction-xltembakservice.kmsp-store.com/v1`, { params: { api_key: config.apiKeyKMSP, trx_id: args[0] } });
                        if (resSt.data.status) { const d = resSt.data.data; await sock.sendMessage(from, { text: `📊 *STATUS TRX*\nProduk: ${d.name}\nStatus: *${d.status === 1 ? "SUKSES" : d.status === 2 ? "PENDING" : "GAGAL"}*\nPesan: ${d.rc_message}` }, { quoted: msg }); } } catch (e) { } break;
                    case 'dor':
                        if (!isOwner) return;
                        if (!args[0] || !args[1]) return sock.sendMessage(from, { text: '.dor <kode> <nomor>' }, { quoted: msg });
                        try { const resPusat = await axios.get(`https://golang-openapi-packagelist-xltembakservice.kmsp-store.com/v1?api_key=${config.apiKeyKMSP}`); const brg = resPusat.data.data.find(p => p.package_code === args[0]); if (!brg) return sock.sendMessage(from, { text: 'Barang ga ada.' }, { quoted: msg }); const shot = await axios.get(`https://golang-openapi-packagepurchase-xltembakservice.kmsp-store.com/v1`, { params: { api_key: config.apiKeyKMSP, package_code: args[0], phone: args[1].replace(/[^0-9]/g, ''), price_or_fee: brg.package_harga_int } }); await sock.sendMessage(from, { text: `DOR! 🔫\nStatus: ${shot.data.message}` }, { quoted: msg }); } catch (e) { } break;
                    case 'loginxl':
                        if (!q) return sock.sendMessage(from, { text: 'Contoh: .loginxl 62878xxxx' }, { quoted: msg }); let pn = q.replace(/[^0-9]/g, ''); if (pn.startsWith('0')) pn = '62' + pn.slice(1);
                        try { const resOtp = await axios.get(`https://golang-openapi-reqotp-xltembakservice.kmsp-store.com/v1`, { params: { api_key: config.apiKeyKMSP, phone: pn, method: 'OTP' } }); if (resOtp.data.status) { pendingLogin[sender] = { auth_id: resOtp.data.data.auth_id, phone: pn }; await sock.sendMessage(from, { text: `✅ OTP Terkirim!` }, { quoted: msg }); } else { await sock.sendMessage(from, { text: `❌ ${resOtp.data.message}` }, { quoted: msg }); } } catch (e) { } break;
                    case 'verifxl':
                        if (!q || !pendingLogin[sender]) return sock.sendMessage(from, { text: 'Request OTP dulu!' }, { quoted: msg });
                        try { const resLogin = await axios.get(`https://golang-openapi-login-xltembakservice.kmsp-store.com/v1`, { params: { api_key: config.apiKeyKMSP, phone: pendingLogin[sender].phone, method: 'OTP', auth_id: pendingLogin[sender].auth_id, otp: q.trim() } }); if (resLogin.data.status) { xlSessions[sender] = { phone: pendingLogin[sender].phone, access_token: resLogin.data.data.access_token }; saveXLSessions(); delete pendingLogin[sender]; await sock.sendMessage(from, { text: `✅ Login Sukses!` }, { quoted: msg }); } else { await sock.sendMessage(from, { text: `❌ ${resLogin.data.message}` }, { quoted: msg }); } } catch (e) { } break;
                    case 'myquota':
                        if (!xlSessions[sender]) return sock.sendMessage(from, { text: 'Login dulu: .loginxl' }, { quoted: msg });
                        try { const resQ = await axios.get(`https://golang-openapi-quotadetails-xltembakservice.kmsp-store.com/v1`, { params: { api_key: config.apiKeyKMSP, access_token: xlSessions[sender].access_token } }); if (resQ.data.status) { let t = `📊 *INFO PAKET (Login)*\n`; resQ.data.data.quotas.forEach((pkt, i) => { t += `*${i + 1}. ${pkt.name}*\nExp: ${pkt.expired_at}\n\n`; }); await sock.sendMessage(from, { text: t }, { quoted: msg }); } else { if (resQ.data.message.includes("Unauthorized")) { delete xlSessions[sender]; saveXLSessions(); } await sock.sendMessage(from, { text: `❌ Sesi habis.` }, { quoted: msg }); } } catch (e) { } break;
                    case 'mylocation':
                        if (!xlSessions[sender]) return sock.sendMessage(from, { text: 'Login dulu.' }, { quoted: msg }); try { const resLoc = await axios.get(`https://golang-openapi-subscriberlocation-xltembakservice.kmsp-store.com/v1`, { params: { api_key: config.apiKeyKMSP, access_token: xlSessions[sender].access_token } }); if (resLoc.data.status) await sock.sendMessage(from, { text: `📍 Lokasi: ${resLoc.data.data.location}` }, { quoted: msg }); } catch (e) {} break;
                    case 'stop':
                        if (!xlSessions[sender]) return sock.sendMessage(from, { text: 'Login dulu!' }, { quoted: msg }); if (!q) return sock.sendMessage(from, { text: 'Contoh: .stop 1' }, { quoted: msg }); try { const idx = parseInt(q) - 1; const resQ = await axios.get(`https://golang-openapi-quotadetails-xltembakservice.kmsp-store.com/v1`, { params: { api_key: config.apiKeyKMSP, access_token: xlSessions[sender].access_token } }); if (resQ.data.status && resQ.data.data.quotas[idx]) { const resUnreg = await axios.get(`https://golang-openapi-unregpackage-xltembakservice.kmsp-store.com/v1`, { params: { api_key: config.apiKeyKMSP, access_token: xlSessions[sender].access_token, encrypted_package_code: resQ.data.data.quotas[idx].encrypted_package_code } }); await sock.sendMessage(from, { text: resUnreg.data.status ? `✅ Sukses stop paket.` : `❌ Gagal.` }, { quoted: msg }); } } catch (e) {} break;
                    case 'listpaket':
    await sock.sendMessage(from, { text: '🔍 Sedang mengambil data paket...' }, { quoted: msg });
    try {
        const resPaket = await axios.get(`https://golang-openapi-packagelist-xltembakservice.kmsp-store.com/v1`, { params: { api_key: config.apiKeyKMSP } });
        
        if (resPaket.data.status) {
            const allPackages = resPaket.data.data;
            
            // --- SETTING PAGINATION ---
            const limit = 10; // Jumlah paket per halaman
            const totalPage = Math.ceil(allPackages.length / limit);
            let page = parseInt(args[0]) || 1;
            
            if (page > totalPage) page = totalPage;
            if (page < 1) page = 1;
            
            const offset = (page - 1) * limit;
            const currentPackages = allPackages.slice(offset, offset + limit);

            let text = `📂 *DAFTAR PAKET (Hal: ${page}/${totalPage})*\n`;
            text += `__________________________\n\n`;

            currentPackages.forEach((p, i) => {
                const hargaJual = p.package_harga_int + config.markup;
                const isOTP = !p.no_need_login; // false artinya butuh login/OTP

                text += `*${offset + i + 1}. ${p.package_name}*\n`;
                text += `ID: \`${p.package_code}\`\n`;
                text += `Harga: *${formatRupiah(hargaJual)}*\n`;

                if (isOTP) {
                    text += `⚠️ *Wajib Login (OTP)*\n`;
                    text += `💰 *Butuh Pulsa Utama:* ±${formatRupiah(p.package_harga_int)}\n`;
                } else {
                    text += `✅ *Direct (Tanpa Login)*\n`;
                }

                // Deskripsi Paket (Jika ada dari API)
                if (p.package_deskripsi) {
                    text += `📝 _${p.package_deskripsi}_\n`;
                }
                text += `\n`;
            });

            text += `__________________________\n`;
            text += `*Cara Beli:* .beli <kode> <nomor>\n`;
            
            // Navigasi Halaman
            if (page < totalPage) {
                text += `\n*Lanjut ke halaman berikutnya?*\nKetik: \`.listpaket ${page + 1}\``;
            }
            if (page > 1) {
                text += `\n*Kembali ke halaman sebelumnya?*\nKetik: \`.listpaket ${page - 1}\``;
            }

            await sock.sendMessage(from, { text: text }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: '❌ Gagal memuat data dari pusat.' }, { quoted: msg });
        }
    } catch (e) {
        console.error(e);
        await sock.sendMessage(from, { text: '❌ Terjadi kesalahan koneksi ke API.' }, { quoted: msg });
    }
    break;
                    case 'cekstok':
    await sock.sendMessage(from, { text: '📊 Mengecek stok Akrab di pusat...' }, { quoted: msg });
    try {
        const resStok = await axios.get(`https://golang-openapi-checkpackagestockakrabglobal-xltembakservice.kmsp-store.com/v1`, { 
            params: { api_key: config.apiKeyKMSP } 
        });

        if (resStok.data.status) {
            const allStok = resStok.data.data;

            // --- Logika Pagination ---
            const limit = 10; 
            const totalPage = Math.ceil(allStok.length / limit);
            let page = parseInt(args[0]) || 1;

            if (page > totalPage) page = totalPage;
            if (page < 1) page = 1;

            const offset = (page - 1) * limit;
            const currentStok = allStok.slice(offset, offset + limit);

            let t = `📦 *STOK AKRAB GLOBAL (Hal: ${page}/${totalPage})*\n`;
            t += `__________________________\n\n`;

            currentStok.forEach((s, i) => {
                // Kasih indikator warna biar gampang liat yang limit/habis
                let status = s.stok > 10 ? '✅' : (s.stok > 0 ? '⚠️' : '❌');
                t += `${status} *${s.name}*\n`;
                t += `╰ Stock: *${s.stok}*\n\n`;
            });

            t += `__________________________\n`;
            if (page < totalPage) t += `\n*Lanjut:* \`.cekstok ${page + 1}\``;
            if (page > 1) t += `\n*Kembali:* \`.cekstok ${page - 1}\``;

            await sock.sendMessage(from, { text: t }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: '❌ Gagal mengambil data stok.' }, { quoted: msg });
        }
    } catch (e) {
        console.error(e);
        await sock.sendMessage(from, { text: '❌ Error koneksi saat cek stok.' }, { quoted: msg });
    }
    break;

case 'ceksaldo':
    if (!isOwner) return;
    try {
        const resBal = await axios.get(`https://golang-openapi-panelaccountbalance-xltembakservice.kmsp-store.com/v1`, { 
            params: { api_key: config.apiKeyKMSP } 
        });
        if (resBal.data.status) {
            const saldo = resBal.data.data.balance;
            let msgSaldo = `💳 *SALDO PUSAT (KMSP)*\n\n`;
            msgSaldo += `• Total: *${formatRupiah(saldo)}*\n`;
            msgSaldo += `• Status: ${saldo < 50000 ? '🔴 Segera Topup!' : '🟢 Aman'}\n\n`;
            msgSaldo += `_Update otomatis dari sistem._`;
            
            await sock.sendMessage(from, { text: msgSaldo }, { quoted: msg });
        }
    } catch (e) {
        console.error(e);
    }
    break;
                    case 'tagall': if (!isGroup) return; const groupMetadata = await sock.groupMetadata(from); const participants = groupMetadata.participants; let textTag = `*TAG ALL*\n${q}\n\n`; let mentions = []; participants.forEach(mem => { textTag += `@${mem.id.split('@')[0]}\n`; mentions.push(mem.id); }); await sock.sendMessage(from, { text: textTag, mentions: mentions }, { quoted: msg }); break;
                    case 'jpm': if (!isOwner) return; const allGroups = await sock.groupFetchAllParticipating(); const groupIds = Object.keys(allGroups); await sock.sendMessage(from, { text: `Mengirim ke ${groupIds.length} grup...` }, { quoted: msg }); for (let id of groupIds) { if (blockedGroups.includes(id)) continue; try { await sock.sendMessage(id, { text: q }); await new Promise(r => setTimeout(r, 1500)); } catch (e) {} } await sock.sendMessage(from, { text: 'Selesai.' }, { quoted: msg }); break;
                    case 'blokgb': if (!isGroup) return; if (!blockedGroups.includes(from)) { blockedGroups.push(from); saveBlockedGroups(); } await sock.sendMessage(from, { text: 'Grup diblokir dari JPM.' }, { quoted: msg }); break;
                    case 'ping': await sock.sendMessage(from, { text: 'Pong!' }, { quoted: msg }); break;
                }
            }
        } catch (err) { console.log("Error:", err); }
    });
}

startBot();
