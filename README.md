# 🎬 Telegram Kino Bot (Aiogram 3.x + SQLite)

Zamonaviy, professional va to'liq optimallashtirilgan Telegram Kino Bot. Bot **Python 3.13**, **Aiogram 3.x**, **aiosqlite** va **python-dotenv** texnologiyalarida yaratilgan.

---

## 🚀 Texnologiyalar

- **Python 3.13** (yoki Python 3.9+)
- **Aiogram 3.x** - Telegram Bot Framework (Async/Await)
- **SQLite (aiosqlite)** - Asinxron ma'lumotlar bazasi
- **python-dotenv** - `.env` faylidan sozlamalarni dinamik o'qish
- **aiofiles** - Asinxron fayllar bilan ishlash
- **logging** - Professional tizim loglari

---

## 📁 Loyiha Tuzilmasi

```
kino bot/
│
├── bot/
│   ├── database/
│   │   ├── __init__.py
│   │   ├── database.py       # Async SQLite bazasi va so'rovlar
│   │   └── models.py         # Dataclass modellar
│   │
│   ├── filters/
│   │   ├── __init__.py
│   │   └── admin_filter.py   # Admin huquqini tekshirish filtri
│   │
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── start.py          # /start va kanal obunasini tekshirish
│   │   ├── admin.py          # Admin panel, Kino qo'shish (FSM), Reklama
│   │   ├── movie.py          # Kino kodi orqali qidirish va video yuborish
│   │   └── user.py           # Kategoriyalar, Yangi kinolar, Top, Yordam
│   │
│   ├── keyboards/
│   │   ├── __init__.py
│   │   ├── reply.py          # Asosiy va admin reply tugmalari
│   │   └── inline.py         # Kanallar va kategoriyalar inline tugmalari
│   │
│   ├── middlewares/
│   │   ├── __init__.py
│   │   └── check_sub.py      # Majburiy kanallarga obunani tekshirish middleware
│   │
│   ├── states/
│   │   ├── __init__.py
│   │   └── movie_states.py   # FSM ketma-ketlik holatlari
│   │
│   ├── utils/
│   │   ├── __init__.py
│   │   └── helpers.py        # Obunani tekshirish va matn formatlash
│   │
│   └── config.py             # .env faylini dynamically o'qish
│
├── main.py                   # Botni ishga tushiruvchi asosiy fayl
├── .env                      # Konfiguratsiya fayli (Token, Admin, Kanallar)
├── .env.example              # Konfiguratsiya andozasi
├── requirements.txt          # Kutubxonalar ro'yxati
└── README.md                 # Qo'llanma
```

---

## ⚙️ O'rnatish va Sozlash

### 1️⃣ Repozitoriyani yuklab olish va papkaga o'tish

```bash
cd "kino bot"
```

### 2️⃣ Virtual muhit yaratish (Tavsiya etiladi)

**Linux / macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows:**
```cmd
python -m venv venv
venv\Scripts\activate
```

### 3️⃣ Kerakli kutubxonalarni o'rnatish

```bash
pip install -r requirements.txt
```

### 4️⃣ `.env` Faylini Yaratish va Sozlash

Loyiha ildiz papkasida `.env` faylini yarating yoki `.env.example` dan nusxa oling:

```env
BOT_TOKEN=7890123456:AAExampleTokenHere...
ADMIN_ID=123456789,987654321
REQUIRED_CHANNELS=@sayfulloh_pro,@kino_tv,@moviesuz
DB_PATH=bot.db
```

#### 📌 Sozlamalar Izohi:
- **`BOT_TOKEN`**: @BotFather dan olingan bot tokeni.
- **`ADMIN_ID`**: Admin(lar)ning Telegram IDsi (vergul bilan ajratib yozish mumkin).
- **`REQUIRED_CHANNELS`**: Majburiy obuna kanallari (vergul bilan ajratilgan: `@kanal1,@kanal2`). **Bot barcha kanallarda administrator bo'lishi shart!**
- **💡 Eslatma:** Kanallarni qo'shish yoki o'chirish uchun faqat `.env` faylini o'zgartirish yetarli, kodga tegish shart emas!

---

## 🚀 Botni Ishga Tushirish

### Local Kompyuterda (Windows / Linux / macOS)

```bash
python main.py
```

---

## 🌐 Serverlarga Joylashtirish (Deployment Guide)

### 🐧 1. Linux VPS (Ubuntu / Debian / CentOS) Serverga Joylashtirish

1. **Serverni yangilang va Python / git o'rnating:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install python3 python3-pip python3-venv git systemd -y
   ```

2. **Loyiha fayllarini serverga yuklang va Virtualenv yaratib kutubxonalarni o'rnating:**
   ```bash
   cd /var/www/
   git clone <REPO_URL> kino_bot
   cd kino_bot
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **`.env` faylini yarating:**
   ```bash
   nano .env
   ```
   *(Ma'lumotlarni kiriting va Ctrl+O -> Enter -> Ctrl+X bosing)*

4. **Systemd Servis yaratish (Background-da to'xtovsiz ishlashi uchun):**
   ```bash
   sudo nano /etc/systemd/system/kinobot.service
   ```

   Quyidagi matnni joylang (yo'llarni moslang):
   ```ini
   [Unit]
   Description=Telegram Kino Bot Service
   After=network.target

   [Service]
   User=root
   WorkingDirectory=/var/www/kino_bot
   ExecStart=/var/www/kino_bot/venv/bin/python main.py
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

5. **Servisni ishga tushirish:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable kinobot
   sudo systemctl start kinobot
   sudo systemctl status kinobot
   ```

---

### 💻 2. Windows Serverda Ishga Tushirish

1. Windows PowerShelldan foydalanib loyiha papkasiga o'ting.
2. `python main.py` orqali ishga tushiring.
3. Bot background rejimida ishlashi uchun **NSSM (Non-Sucking Service Manager)** orqali Windows Service sifatida o'rnatishingiz mumkin:
   ```cmd
   nssm install KinoBot "C:\path\to\kino bot\venv\Scripts\python.exe" "C:\path\to\kino bot\main.py"
   nssm start KinoBot
   ```

---

### ☁️ 3. Render.com Platformasiga Joylashtirish

1. Render.com ga kirib **Background Worker** hosil qiling.
2. Repozitoriyangizni ulang.
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `python main.py`
5. **Environment Variables** bo'limida `.env` qiymatlarini kiriting:
   - `BOT_TOKEN`
   - `ADMIN_ID`
   - `REQUIRED_CHANNELS`
   - `DB_PATH`

---

### 🚂 4. Railway.app Platformasiga Joylashtirish

1. Railway.app platformasida yangi loyiha hosil qiling.
2. GitHub repozitoriyangizni ulang.
3. Variables bo'limiga `.env`dagi o'zgaruvchilarni (`BOT_TOKEN`, `ADMIN_ID`, `REQUIRED_CHANNELS`) qo'shing.
4. Deployment avtomatik amalga oshiriladi.

---

## 📱 Bot Menyulari va Admin Funktsiyalari

### 👤 Foydalanuvchilar Menyusi:
- **`🎬 Kino qidirish`** - Kino kodi yuborilganda SQLite bazasidan qidiradi, ma'lumot va videoni yuboradi, ko'rilganlar sonini (`views`) oshiradi.
- **`📂 Kategoriyalar`** - Janrlar bo'yicha saralangan kinolar ro'yxati.
- **`🆕 Yangi kinolar`** - So'nggi qo'shilgan 10 ta kino.
- **`🔥 Top kinolar`** - Eng ko'p ko'rilgan kinolar reytingi.
- **`📞 Yordam`** - Qo'llanma va ko'rsatmalar.

### 👑 Admin Panel (`/admin`):
- **`➕ Kino qo'shish`** - 10 bosqichli FSM wizard:
  1. Video yuborish
  2. Kino nomi
  3. Unique Kino kodi (Agar mavjud bo'lsa ogohlantiradi)
  4. Yili
  5. Janri
  6. Davlati
  7. Davomiyligi
  8. Tavsifi
  9. Poster (Ixtiyoriy/Skip)
  10. Tasdiqlash va Saqlash
- **`🗑 Kino o'chirish`** - Kodi bo'yicha kinoni o'chirish.
- **`📊 Statistika`** - Jami foydalanuvchilar, bugungi qo'shilganlar, jami kinolar va ko'rishlar soni.
- **`📢 Reklama`** - Barcha foydalanuvchilarga Matn, Rasm, Video, GIF, Sticker yoki Document tarqatish.
- **`⚙ Sozlamalar`** - Dynamic `.env` ko'rsatmalari.

---

## 📄 Litsenziya

Ushbu loyiha ochiq va professional kod asosida yaratilgan. Istalgancha kengaytirishingiz mumkin!
