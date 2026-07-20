import logging
from aiogram import Router, Bot, F
from aiogram.filters import CommandStart
from aiogram.types import Message, CallbackQuery

from bot.database.database import Database
from bot.config import get_required_channels, get_admin_ids
from bot.utils.helpers import check_channel_subscriptions
from bot.keyboards.reply import main_menu_keyboard
from bot.keyboards.inline import get_sub_channels_keyboard

logger = logging.getLogger(__name__)
start_router = Router()


@start_router.message(CommandStart())
async def cmd_start(message: Message, db: Database, bot: Bot):
    """
    Handles /start command.
    Registers user into SQLite database and verifies channel subscriptions.
    """
    user = message.from_user
    if not user:
        return

    # 1. Register or update user in SQLite database
    await db.add_user(
        telegram_id=user.id,
        fullname=user.full_name,
        username=user.username,
    )

    # 2. Check channel subscriptions
    required_channels = get_required_channels()

    if required_channels:
        all_sub, unsubscribed = await check_channel_subscriptions(
            bot=bot, user_id=user.id, channels=required_channels
        )

        if not all_sub:
            sub_text = (
                "⚠️ <b>Kanalga obuna bo'lmagansiz!</b>\n\n"
                "🎬 Kino qidirish va tomosha qilish uchun iltimos, avval kanalga <b>obuna bo'ling</b>.\n\n"
                "Kanallarga obuna bo'lgach, <b>✅ Tekshirish</b> tugmasini bosing."
            )
            keyboard = get_sub_channels_keyboard(unsubscribed)
            await message.answer(sub_text, reply_markup=keyboard, parse_mode="HTML")
            return

    # 3. If subscribed or no required channels, send welcome message with main menu
    welcome_text = (
        f"Assalomu alaykum, <b>{user.full_name}</b>!\n\n"
        "🎬 <b>Kino Bot</b>ga xush kelibsiz!\n"
        "Kino tomosha qilish uchun <b>kino kodini</b> yuboring yoki menyudan foydalaning."
    )
    await message.answer(
        welcome_text, reply_markup=main_menu_keyboard(), parse_mode="HTML"
    )


@start_router.callback_query(F.data == "check_subscription")
async def cb_check_subscription(call: CallbackQuery, db: Database, bot: Bot):
    """
    Handles inline callback '✅ Tekshirish' button.
    Re-verifies channel subscription status.
    """
    user = call.from_user
    if not user:
        return

    required_channels = get_required_channels()
    if not required_channels:
        await call.answer("✅ Barcha kanallarga a'zo bo'lgansiz!", show_alert=True)
        if call.message:
            await call.message.delete()
            await call.message.answer(
                "🎬 Assalomu alaykum! Asosiy menyudasiz:",
                reply_markup=main_menu_keyboard(),
            )
        return

    all_sub, unsubscribed = await check_channel_subscriptions(
        bot=bot, user_id=user.id, channels=required_channels
    )

    if all_sub:
        await call.answer("✅ Rahmat! Barcha kanallarga a'zo bo'ldingiz.", show_alert=True)
        if call.message:
            try:
                await call.message.delete()
            except Exception:
                pass
            await call.message.answer(
                "🎉 Tabriklaymiz! Endi botdan to'liq foydalanishingiz mumkin.\n"
                "Kino kodini yuboring:",
                reply_markup=main_menu_keyboard(),
            )
    else:
        await call.answer(
            "❌ Hali barcha kanallarga a'zo bo'lmadingiz!", show_alert=True
        )
        keyboard = get_sub_channels_keyboard(unsubscribed)
        if call.message:
            try:
                await call.message.edit_text(
                    "📢 <b>Siz hali quyidagi kanallarga a'zo bo'lmadingiz:</b>\n\n"
                    "Iltimos, a'zo bo'lib <b>✅ Tekshirish</b> tugmasini qayta bosing.",
                    reply_markup=keyboard,
                    parse_mode="HTML",
                )
            except Exception:
                pass
