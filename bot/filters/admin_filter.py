import logging
from aiogram.filters import Filter
from aiogram.types import Message, CallbackQuery
from typing import Union
from bot.config import get_admin_ids

from aiogram import Bot
from bot.database.database import Database

logger = logging.getLogger(__name__)


class IsAdminFilter(Filter):
    """
    Aiogram 3.x Filter to restrict Admin handlers.
    Allows access to:
      1. Global admin IDs defined in .env
      2. Creators of child bots on their respective bot instances.
    """

    async def __call__(self, event: Union[Message, CallbackQuery], bot: Bot, db: Database) -> bool:
        user_id = event.from_user.id if event.from_user else 0
        admin_ids = get_admin_ids()

        # Global admin has access to all bots
        if user_id in admin_ids:
            return True

        # Check if user is the creator of this child bot instance
        child_bot = await db.get_child_bot_by_token(bot.token)
        if child_bot and child_bot["user_id"] == user_id:
            return True

        logger.warning(
            f"Unauthorized admin attempt by user ID: {user_id} on bot: {bot.token[:10]}..."
        )
        return False
