import sys
import asyncio
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from aiogram import Bot, Dispatcher, Router, types
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart
from aiogram.types import MenuButtonWebApp, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.client.default import DefaultBotProperties
from dotenv import load_dotenv

# Load env variables
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
# Render sets RENDER_EXTERNAL_URL automatically. Fallback to custom WEB_APP_URL.
WEB_APP_URL = os.getenv("RENDER_EXTERNAL_URL", os.getenv("WEB_APP_URL", ""))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

router = Router()


class WebAppServer(BaseHTTPRequestHandler):
    """Serve the Tic Tac Toe game frontend to Telegram Web App requests."""
    def do_GET(self):
        if self.path == "/" or self.path == "/index.html":
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            # Disable caching so changes apply immediately
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.end_headers()
            try:
                with open("static/index.html", "rb") as f:
                    self.wfile.write(f.read())
            except Exception as e:
                self.wfile.write(f"Error reading file: {e}".encode("utf-8"))
        else:
            self.send_response(404)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not Found")

    def log_message(self, format, *args):
        # Silence HTTP request logs
        return


def run_web_server():
    """Runs a basic HTTP server to host the game frontend."""
    port = int(os.getenv("PORT", 8000))
    try:
        server = HTTPServer(("0.0.0.0", port), WebAppServer)
        logger.info(f"Web server started successfully on port {port}")
        server.serve_forever()
    except Exception as e:
        logger.error(f"Failed to start web server: {e}")


@router.message(CommandStart())
async def start_handler(message: types.Message):
    if not WEB_APP_URL:
        await message.answer(
            "⚠️ Web App URL sozlanmagan! Iltimos, serverga `RENDER_EXTERNAL_URL` yoki `WEB_APP_URL` muhit o'zgaruvchisini qo'shing."
        )
        return

    # Inline button to open game
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎮 O'yinni o'ynash",
                    web_app=WebAppInfo(url=WEB_APP_URL)
                )
            ]
        ]
    )

    await message.answer(
        f"Salom, <b>{message.from_user.full_name}</b>! 👋\n\n"
        f"Tic Tac Toe (X-O) o'yinimizga xush kelibsiz! Boshlash uchun pastdagi tugmani bosing yoki chat menyusidagi <b>Play</b> tugmasidan foydalaning.",
        reply_markup=keyboard
    )


async def set_menu_button(bot: Bot):
    """Sets the bottom-left Menu Button in chat to open the Web App."""
    if WEB_APP_URL:
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="Play",
                    web_app=WebAppInfo(url=WEB_APP_URL)
                )
            )
            logger.info(f"Chat Menu Button configured with Web App URL: {WEB_APP_URL}")
        except Exception as e:
            logger.error(f"Failed to set Chat Menu Button: {e}")
    else:
        logger.warning("WEB_APP_URL is empty. Chat Menu Button not configured.")


async def main() -> None:
    logger.info("Initializing Tic Tac Toe Bot...")

    # Run game server in a separate background thread
    threading.Thread(target=run_web_server, daemon=True).start()

    if not BOT_TOKEN:
        logger.critical("BOT_TOKEN is missing! Please edit .env file.")
        return

    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp.include_router(router)

    # Automatically set 'Play' menu button
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
