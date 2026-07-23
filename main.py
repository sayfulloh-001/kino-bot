import sys
import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.client.default import DefaultBotProperties

from bot.config import BOT_TOKEN, DB_PATH
from bot.database.database import Database
from bot.middlewares.check_sub import CheckSubscriptionMiddleware
from bot.handlers import start_router, admin_router, user_router, movie_router

import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

# Configure logging
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


class DummyServer(BaseHTTPRequestHandler):
    """Simple HTTP server to respond to Render's port checks."""
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        self.wfile.write(b"Bot is running successfully!")

    def log_message(self, format, *args):
        # Silence HTTP request logging to keep logs clean
        return


def run_dummy_server():
    """Binds HTTP server to Render's dynamic PORT."""
    port = int(os.getenv("PORT", 8000))
    try:
        server = HTTPServer(("0.0.0.0", port), DummyServer)
        logger.info(f"Dummy port listener started successfully on port {port}")
        server.serve_forever()
    except Exception as e:
        logger.error(f"Failed to start dummy port listener: {e}")


async def main() -> None:
    """Entry point for Telegram Kino Bot."""
    logger.info("Initializing Telegram Kino Bot...")

    # Start dummy port listener for Render Web Service compatibility
    threading.Thread(target=run_dummy_server, daemon=True).start()

    if not BOT_TOKEN or BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        logger.critical(
            "BOT_TOKEN is missing or default! Please edit .env file and set valid BOT_TOKEN."
        )
        return

    # Initialize async SQLite database
    db = Database(db_path=DB_PATH)
    await db.init_db()

    # Create Bot and Dispatcher instances
    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher(storage=MemoryStorage())

    # Inject database into workflow data for handlers and middlewares
    dp["db"] = db

    # Attach mandatory channel subscription middleware
    check_sub_middleware = CheckSubscriptionMiddleware()
    dp.message.outer_middleware(check_sub_middleware)
    dp.callback_query.outer_middleware(check_sub_middleware)

    # Register handlers routers
    dp.include_router(start_router)
    dp.include_router(admin_router)
    dp.include_router(user_router)
    dp.include_router(movie_router)

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
