import logging
from aiogram import Router, Bot, F
from aiogram.filters import CommandStart
from aiogram.types import Message, CallbackQuery

from bot.database.database import Database
from bot.config import get_required_channels, get_admin_ids, BOT_TOKEN
from bot.utils.helpers import check_channel_subscriptions
from bot.keyboards.reply import main_menu_keyboard
from bot.keyboards.inline import get_sub_channels_keyboard
from bot.utils.bot_manager import BotManager

logger = logging.getLogger(__name__)
start_router = Router()


# ==================== BOT CONSTRUCTOR / TOKEN HANDLER ====================
@start_router.message(F.text.regexp(r"^\d+:[A-Za-z0-9_-]{35,45}$"))
async def handle_bot_token_submission(
    message: Message, db: Database, bot: Bot, bot_manager: BotManager
):
    """
    Handles bot constructor token submission.
    Verifies token validity, registers the child bot in DB, and starts polling.
    """
    token = message.text.strip()
    user = message.from_user
    if not user:
        return

    # Check if this token is sent to the main bot (constructor works on main bot only)
    if bot.token != BOT_TOKEN:
        await message.answer("⚠️ Yangi bot yaratish faqat asosiy bot orqali amalga oshiriladi!")
        return

    await message.answer("🔄 <b>Token tekshirilmoqda, iltimos kuting...</b>", parse_mode="HTML")

    # Validate bot token using standard Telegram API call
    try:
        temp_bot = Bot(token=token)
        bot_user = await temp_bot.get_me()
        await temp_bot.session.close()
    except Exception as e:
        logger.warning(f"Invalid bot token submission: {e}")
        await message.answer(
            "❌ <b>Xatolik!</b> Noto'g'ri token yuborildi.\n\n"
            "Iltimos, @BotFather dan olingan to'g'ri tokenni yuboring.",
            parse_mode="HTML",
        )
        return

    # Check if bot already exists in database
    exists = await db.get_child_bot_by_token(token)
    if exists:
        await message.answer("⚠️ Ushbu bot allaqachon tizimga qo'shilgan!")
        return

    # Save child bot details in DB
    success = await db.add_child_bot(
        user_id=user.id,
        token=token,
        bot_username=bot_user.username,
        bot_name=bot_user.full_name,
    )

    if not success:
        await message.answer("❌ Xatolik yuz berdi. Iltimos keyinroq qayta urinib ko'ring.")
        return

    # Dynamically start polling for the new child bot
    started = await bot_manager.start_child_bot(token)

    if started:
        # Notify global admins about new child bot creation
        admin_ids = get_admin_ids()
        admin_text = (
            f"🔔 <b>Yangi kino bot yaratildi!</b>\n\n"
            f"👤 Foydalanuvchi: {user.full_name} ({user.id})\n"
            f"🤖 Bot: @{bot_user.username}\n"
            f"🔑 Token: <code>{token}</code>"
        )
        for admin_id in admin_ids:
            try:
                await bot.send_message(chat_id=admin_id, text=admin_text, parse_mode="HTML")
            except Exception:
                pass

        await message.answer(
            f"🎉 <b>Tabriklaymiz! Botingiz muvaffaqiyatli ishga tushirildi!</b>\n\n"
            f"🤖 Botingiz: @{bot_user.username}\n\n"
            f"Kinolarni boshqarish va botingizni sozlash uchun o'z botingizga kirib <b>/admin</b> buyrug'ini yuboring!",
            parse_mode="HTML",
        )
    else:
        await message.answer("❌ Botni ishga tushirishda xatolik yuz berdi.")


@start_router.message(CommandStart())
async def cmd_start(message: Message, db: Database, bot: Bot):
    """
    Handles /start command.
    Registers user into SQLite database and verifies channel subscriptions.
    """
    user = message.from_user
    if not user:
        return

    # 1. Register or update user in SQLite database with current bot_token mapping
    await db.add_user(
        telegram_id=user.id,
        fullname=user.full_name,
        username=user.username,
        bot_token=bot.token,
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
