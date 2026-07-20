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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


async def main() -> None:
    """Entry point for Telegram Kino Bot."""
    logger.info("Initializing Telegram Kino Bot...")

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
