import logging
from aiogram import Router, F, Bot
from aiogram.types import Message
from aiogram.exceptions import TelegramBadRequest

from bot.database.database import Database
from bot.utils.helpers import format_movie_caption

logger = logging.getLogger(__name__)
movie_router = Router()

# List of main menu button texts to avoid capturing them as movie codes
MENU_BUTTON_TEXTS = {
    "🎬 Kino qidirish",
    "📂 Kategoriyalar",
    "🆕 Yangi kinolar",
    "🔥 Top kinolar",
    "➕ Kino qo'shish",
    "✏ Kino tahrirlash",
    "🗑 Kino o'chirish",
    "📊 Statistika",
    "👥 Foydalanuvchilar",
    "📢 Reklama",
    "⚙ Sozlamalar",
    "🔙 Bosh menyu",
    "❌ Bekor qilish",
    "⏭ O'tkazib yuborish",
}


@movie_router.message(F.text & ~F.text.startswith("/"))
async def handle_movie_code(message: Message, db: Database, bot: Bot):
    """
    Handles search by movie code.
    Fetches movie from SQLite database, sends video with details, and increments view count.
    """
    code = message.text.strip()

    # Ignore reply menu button texts
    if code in MENU_BUTTON_TEXTS:
        return

    # Search movie by code in SQLite DB
    movie = await db.get_movie_by_code(code)

    if not movie:
        await message.answer("❌ Bunday kodli kino topilmadi.")
        return

    # Increment views counter in database
    await db.increment_views(code)
    movie["views"] = movie["views"] + 1

    caption = format_movie_caption(movie)
    file_id = movie["file_id"]

    try:
        # Send video file using Telegram file_id
        await message.answer_video(
            video=file_id,
            caption=caption,
            parse_mode="HTML",
        )
    except TelegramBadRequest as e:
        logger.error(f"Failed to send video for movie code {code}: {e}")
        # Fallback if file_id is invalid or lost
        await message.answer(
            f"⚠️ Video yuborishda xatolik yuz berdi.\n\n{caption}",
            parse_mode="HTML",
        )
    except Exception as e:
        logger.error(f"Unexpected error sending movie {code}: {e}")
        await message.answer("❌ Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.")
