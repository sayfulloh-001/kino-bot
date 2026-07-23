import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode

from bot.database.database import Database

logger = logging.getLogger(__name__)


class BotManager:
    """
    Manages multiple Telegram Bot instances concurrently.
    Allows starting and keeping track of child bot polling loops at runtime.
    """

    def __init__(self, dp: Dispatcher, db: Database):
        self.dp = dp
        self.db = db
        self.active_bots: dict[str, Bot] = {}

    async def start_all(self, main_bot: Bot) -> None:
        """Startup: start polling for main bot and all registered child bots."""
        # Main bot is already started or handled, let's track it
        self.active_bots["main"] = main_bot

        # Retrieve all active child bots from database
        child_bots = await self.db.get_all_child_bots()
        logger.info(f"Retrieved {len(child_bots)} child bots from database to start.")

        for cb in child_bots:
            token = cb["token"]
            asyncio.create_task(self.start_child_bot(token))

    async def start_child_bot(self, token: str) -> bool:
        """Dynamically start a child bot polling loop at runtime."""
        token = token.strip()
        if token in self.active_bots:
            logger.info("Bot with this token is already running.")
            return True

        try:
            bot = Bot(
                token=token,
                default=DefaultBotProperties(parse_mode=ParseMode.HTML),
            )
            # Test token validity
            bot_user = await bot.get_me()
            self.active_bots[token] = bot

            # Start child bot polling concurrently
            asyncio.create_task(self._poll_bot(bot, bot_user.username))
            return True
        except Exception as e:
            logger.error(f"Failed to start child bot polling for token {token[:10]}...: {e}")
            return False

    async def _poll_bot(self, bot: Bot, username: str) -> None:
        """Internal worker to execute polling for a single bot instance."""
        try:
            await bot.delete_webhook(drop_pending_updates=True)
            logger.info(f"Started polling loop for child bot @{username}")
            await self.dp.start_polling(bot)
        except Exception as e:
            logger.error(f"Error in polling loop for @{username}: {e}")
        finally:
            # Cleanup on stop
            await bot.session.close()
            self.active_bots.pop(bot.token, None)
            logger.info(f"Stopped polling loop for child bot @{username}")
