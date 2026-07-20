import logging
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext

from bot.database.database import Database
from bot.keyboards.reply import main_menu_keyboard
from bot.keyboards.inline import categories_inline_keyboard

logger = logging.getLogger(__name__)
user_router = Router()


@user_router.message(F.text == "🎬 Kino qidirish")
async def btn_search_movie(message: Message, state: FSMContext):
    """Prompt user to send movie code."""
    await state.clear()
    await message.answer(
        "🔍 <b>Kino qidirish</b>\n\n"
        "Kino tomosha qilish uchun <b>kino kodi</b>ni yuboring.\n"
        "<i>Misol: 100, 205, 999, 12345</i>",
        parse_mode="HTML",
        reply_markup=main_menu_keyboard(),
    )


@user_router.message(F.text == "📂 Kategoriyalar")
async def btn_categories(message: Message, db: Database):
    """Show available movie categories."""
    categories = await db.get_categories()
    if not categories:
        await message.answer(
            "📂 Hozircha kategoriyalar mavjud emas.",
            reply_markup=main_menu_keyboard(),
        )
        return

    keyboard = categories_inline_keyboard(categories)
    await message.answer(
        "📂 <b>Kategoriyalardan birini tanlang:</b>",
        reply_markup=keyboard,
        parse_mode="HTML",
    )


@user_router.callback_query(F.data.startswith("cat_"))
async def cb_category_movies(call: CallbackQuery, db: Database):
    """Display movies in selected category."""
    genre_name = call.data.replace("cat_", "")
    movies = await db.get_movies_by_category(genre_name)

    if not movies:
        await call.answer(
            "Ushbu kategoriyada kinolar topilmadi.", show_alert=True
        )
        return

    text = f"📂 <b>{genre_name}</b> janridagi kinolar:\n\n"
    for idx, movie in enumerate(movies, start=1):
        text += (
            f"{idx}. 🎬 <b>{movie['title']}</b> ({movie['year'] or 'Noma\'lum'})\n"
            f"   🔑 Kodi: <code>{movie['code']}</code> | 👁 {movie['views']} ko'rish\n\n"
        )

    text += "📌 Tomosha qilish uchun kino kodini yuboring."
    await call.answer()
    if call.message:
        await call.message.answer(text, parse_mode="HTML")


@user_router.message(F.text == "🆕 Yangi kinolar")
async def btn_new_movies(message: Message, db: Database):
    """Display latest added movies."""
    movies = await db.get_latest_movies(limit=10)
    if not movies:
        await message.answer(
            "🆕 Hozircha kinolar qo'shilmagan.",
            reply_markup=main_menu_keyboard(),
        )
        return

    text = "🆕 <b>Yangi qo'shilgan kinolar:</b>\n\n"
    for idx, movie in enumerate(movies, start=1):
        text += (
            f"{idx}. 🎬 <b>{movie['title']}</b> ({movie['year'] or 'Noma\'lum'})\n"
            f"   🔑 Kodi: <code>{movie['code']}</code> | 🎭 Janri: {movie['genre'] or 'Noma\'lum'}\n\n"
        )

    text += "📌 Tomosha qilish uchun kerakli <b>kino kodi</b>ni yuboring."
    await message.answer(
        text, reply_markup=main_menu_keyboard(), parse_mode="HTML"
    )


@user_router.message(F.text == "🔥 Top kinolar")
async def btn_top_movies(message: Message, db: Database):
    """Display most viewed top movies."""
    movies = await db.get_top_movies(limit=10)
    if not movies:
        await message.answer(
            "🔥 Hozircha kinolar mavjud emas.",
            reply_markup=main_menu_keyboard(),
        )
        return

    text = "🔥 <b>Eng ko'p ko'rilgan top kinolar:</b>\n\n"
    for idx, movie in enumerate(movies, start=1):
        text += (
            f"{idx}. 🎬 <b>{movie['title']}</b>\n"
            f"   🔑 Kodi: <code>{movie['code']}</code> | 👁 Ko'rilgan: <b>{movie['views']}</b> ta\n\n"
        )

    text += "📌 Tomosha qilish uchun kerakli <b>kino kodi</b>ni yuboring."
    await message.answer(
        text, reply_markup=main_menu_keyboard(), parse_mode="HTML"
    )


@user_router.message(F.text == "🔙 Bosh menyu")
async def btn_back_main(message: Message, state: FSMContext):
    """Return to main menu."""
    await state.clear()
    await message.answer(
        "🎬 Asosiy menyudasiz.", reply_markup=main_menu_keyboard()
    )
