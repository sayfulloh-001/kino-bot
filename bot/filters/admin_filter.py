import logging
from aiogram.filters import Filter
from aiogram.types import Message, CallbackQuery
from typing import Union
from bot.config import get_admin_ids

logger = logging.getLogger(__name__)


class IsAdminFilter(Filter):
    """
    Aiogram 3.x Filter to strictly restrict Admin handlers to configured ADMIN_ID list.
    Blocks any non-admin users from accessing /admin.
    """

    async def __call__(self, event: Union[Message, CallbackQuery]) -> bool:
        user_id = event.from_user.id if event.from_user else 0
        admin_ids = get_admin_ids()

        is_admin = user_id in admin_ids
        if not is_admin:
            logger.warning(
                f"Unauthorized admin attempt by user ID: {user_id}"
            )
        return is_admin
