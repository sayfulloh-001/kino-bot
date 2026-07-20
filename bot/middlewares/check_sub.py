import logging
from typing import Callable, Dict, Any, Awaitable
from aiogram import BaseMiddleware, Bot
from aiogram.types import Message, CallbackQuery, TelegramObject

from bot.config import get_required_channels, get_admin_ids
from bot.utils.helpers import check_channel_subscriptions
from bot.keyboards.inline import get_sub_channels_keyboard

logger = logging.getLogger(__name__)


class CheckSubscriptionMiddleware(BaseMiddleware):
    """
    Aiogram 3.x Middleware to check if user is subscribed to all mandatory Telegram channels.
    Dynamically loads required channels from environment configuration.
    Bypasses check for Bot Admins and the check_subscription callback query.
    """

    async def __call__(
        self,
        handler: Callable[[TelegramObject, Dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: Dict[str, Any],
    ) -> Any:
        bot: Bot = data.get("bot")
        user = data.get("event_from_user")

        if not user or not bot:
            return await handler(event, data)

        # Bypass check for bot admins
        admin_ids = get_admin_ids()
        if user.id in admin_ids:
            return await handler(event, data)

        # Get list of required channels dynamically from .env
        required_channels = get_required_channels()
        if not required_channels:
            return await handler(event, data)

        # Allow callback query 'check_subscription' to proceed to its handler
        if isinstance(event, CallbackQuery) and event.data == "check_subscription":
            return await handler(event, data)

        # Check subscription status
        all_sub, unsubscribed = await check_channel_subscriptions(
            bot=bot, user_id=user.id, channels=required_channels
        )

        if all_sub:
            return await handler(event, data)

        # User is not subscribed to all channels
        sub_text = (
            "📢 <b>Botdan foydalanish uchun quyidagi kanallarga a'zo bo'ling.</b>\n\n"
            "Kanallarga a'zo bo'lgach, <b>✅ Tekshirish</b> tugmasini bosing."
        )
        keyboard = get_sub_channels_keyboard(unsubscribed)

        if isinstance(event, Message):
            await event.answer(sub_text, reply_markup=keyboard, parse_mode="HTML")
            return None
        elif isinstance(event, CallbackQuery):
            await event.answer(
                "📢 Botdan foydalanish uchun barcha kanallarga a'zo bo'ling!",
                show_alert=True,
            )
            if event.message:
                await event.message.answer(
                    sub_text, reply_markup=keyboard, parse_mode="HTML"
                )
            return None

        return None
