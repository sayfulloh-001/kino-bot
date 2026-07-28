import sys
import asyncio
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from aiogram import Bot, Dispatcher, Router, types, F
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    ReplyKeyboardMarkup,
    KeyboardButton,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo
)
from aiogram.client.default import DefaultBotProperties
from dotenv import load_dotenv
import aiosqlite

# Load env variables
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_ID_RAW = os.getenv("ADMIN_ID", "")
ADMIN_IDS = [int(x.strip()) for x in ADMIN_ID_RAW.split(",") if x.strip().isdigit()]
DB_PATH = os.getenv("DB_PATH", "bot.db")
WEB_APP_URL = os.getenv("RENDER_EXTERNAL_URL", os.getenv("WEB_APP_URL", ""))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

router = Router()

# ==========================================
# DATABASE LOGIC
# ==========================================

async def init_db():
    """Initializes the database and creates user table."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT,
                full_name TEXT
            )
        """)
        await db.commit()

async def add_user(user_id, username, full_name):
    """Registers user if not exists."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT OR IGNORE INTO users (id, username, full_name)
            VALUES (?, ?, ?)
        """, (user_id, username, full_name))
        await db.commit()

# ==========================================
# WEB SERVER FOR HEALTH CHECK (RENDER DEPLOYMENT)
# ==========================================

class WebAppServer(BaseHTTPRequestHandler):
    """Serve game assets and the frontend for the 3D runner game."""
    def do_GET(self):
        # Clean path and prevent traversal
        clean_path = self.path.split('?')[0]
        if clean_path == "/" or clean_path == "/index.html":
            file_path = "static/index.html"
        else:
            normalized_path = os.path.normpath(clean_path.lstrip("/"))
            if normalized_path.startswith("..") or os.path.isabs(normalized_path):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"Forbidden")
                return
            file_path = os.path.join("static", normalized_path)

        if os.path.exists(file_path) and os.path.isfile(file_path):
            ext = os.path.splitext(file_path)[1].lower()
            content_types = {
                ".html": "text/html; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".js": "application/javascript; charset=utf-8",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".mp3": "audio/mpeg",
                ".wav": "audio/wav"
            }
            content_type = content_types.get(ext, "application/octet-stream")

            self.send_response(200)
            self.send_header("Content-Type", content_type)
            # Enable CORS for Telegram Web Apps
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            with open(file_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"File Not Found")

def run_web_server():
    """Runs the internal HTTP server on port 8000 to keep Render alive and serve static assets."""
    port = 8000
    try:
        server = HTTPServer(("0.0.0.0", port), WebAppServer)
        logger.info(f"Web server started successfully on port {port}")
        server.serve_forever()
    except Exception as e:
        logger.error(f"Failed to start web server: {e}")

# ==========================================
# GENERAL HANDLERS (USER)
# ==========================================

@router.message(CommandStart())
async def start_handler(message: types.Message):
    await add_user(message.from_user.id, message.from_user.username, message.from_user.full_name)
    
    inline_keyboard = None
    if WEB_APP_URL:
        inline_keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="🎮 O'yinni o'ynash (3D Runner)",
                        web_app=WebAppInfo(url=WEB_APP_URL)
                    )
                ]
            ]
        )
        
    # Send welcome text and force Telegram to close/remove any active bottom reply keyboards
    await message.answer(
        f"Salom, <b>{message.from_user.full_name}</b>! 👋\n\n"
        f"Mine PUBG Runner 3D o'yinimizga xush kelibsiz!\n\n"
        f"Boshlash uchun pastdagi tugmani bosing yoki chat menyusidagi Play tugmasidan foydalaning.\n\n"
        f"Savollar va takliflar uchun admin: @sayfulloh_ai",
        reply_markup=types.ReplyKeyboardRemove()
    )
    
    if inline_keyboard:
        await message.answer(
            "O'yinni boshlash uchun o'ynash tugmasini bosing:",
            reply_markup=inline_keyboard
        )

@router.message(Command("help"))
async def help_handler(message: types.Message):
    await message.answer(
        "🎮 <b>Mine PUBG Runner 3D</b>\n\n"
        "Ushbu o'yin Minecraft va PUBG dunyolarining ajoyib uyg'unligidir. "
        "Siz voxel uslubidagi Steve personajini boshqarasiz. "
        "Yo'lingizda uchraydigan to'siqlar va PUBG AirDrop qutilarini qo'lingizdagi avtomat qurol yordamida otib buzing!\n\n"
        "<b>Boshqaruv:</b>\n"
        "• 📱 Mobil qurilmada: Chapga/O'ngga swipe qilish orqali harakatlaning. Sakrash uchun yuqoriga, yotish uchun pastga swipe qiling. Otish uchun ekranga bosing.\n"
        "• 💻 Kompyuterda: Yo'nalish tugmalari (chap/o'ng/tepa/pastki) yoki A/S/D/W orqali boshqaring. Otish uchun sichqonchani bosing.\n\n"
        "Savollar bo'lsa, admin: @sayfulloh_ai ga yozishingiz mumkin. Omad! 🚀",
        reply_markup=types.ReplyKeyboardRemove()
    )

@router.message()
async def fallback_handler(message: types.Message):
    # Auto close active keyboards for any arbitrary text message and provide the play button
    inline_keyboard = None
    if WEB_APP_URL:
        inline_keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="🎮 O'yinni o'ynash (3D Runner)",
                        web_app=WebAppInfo(url=WEB_APP_URL)
                    )
                ]
            ]
        )
    await message.answer(
        "O'yinni boshlash uchun pastdagi tugmani bosing:",
        reply_markup=inline_keyboard
    )
    # Also send a dummy remove keyboard command to clean up if needed
    await message.answer(
        "Tugmalar yopildi.",
        reply_markup=types.ReplyKeyboardRemove()
    )

# ==========================================
# ADMIN HANDLERS
# ==========================================

@router.message(Command("admin"))
async def admin_handler(message: types.Message):
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("⚠️ Kechirasiz, siz administrator emassiz.")
        return
    
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT COUNT(*) FROM users") as cursor:
            count = (await cursor.fetchone())[0]
            
    await message.answer(
        f"👑 <b>Admin paneliga xush kelibsiz!</b>\n\n"
        f"👥 Jami ro'yxatdan o'tgan foydalanuvchilar: <b>{count} ta</b>\n"
    )

# ==========================================
# MAIN INITIALIZATION
# ==========================================

async def set_menu_button(bot: Bot):
    """Resets the bottom-left Menu Button in chat to default."""
    try:
        from aiogram.types import MenuButtonDefault
        await bot.set_chat_menu_button(
            menu_button=MenuButtonDefault()
        )
        logger.info("Chat Menu Button reset to default.")
    except Exception as e:
        logger.error(f"Failed to reset Chat Menu Button: {e}")

async def main() -> None:
    logger.info("Initializing Telegram Game Bot...")

    # Run the web health check server in background thread for Render
    threading.Thread(target=run_web_server, daemon=True).start()

    # Initialize DB
    await init_db()

    if not BOT_TOKEN:
        logger.critical("BOT_TOKEN is missing! Please set BOT_TOKEN in .env or Environment Variables.")
        return

    # Set up Bot and Dispatcher
    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp.include_router(router)

    # Set the menu button for the Web App
    await set_menu_button(bot)

    logger.info("Bot successfully started polling!")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"Error during bot execution: {e}")
    finally:
        await bot.session.close()
        logger.info("Bot stopped.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Bot manually interrupted.")
