import logging
import asyncio
from aiogram import Router, F, Bot
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.exceptions import TelegramAPIError, TelegramRetryAfter

from bot.database.database import Database
from bot.filters.admin_filter import IsAdminFilter
from bot.states.movie_states import AddMovieStates, DeleteMovieStates, BroadcastStates
from bot.keyboards.reply import (
    admin_menu_keyboard,
    main_menu_keyboard,
    cancel_keyboard,
    skip_keyboard,
)
from bot.keyboards.inline import admin_confirm_keyboard
from bot.config import get_required_channels, get_admin_ids
from bot.utils.helpers import format_movie_caption

logger = logging.getLogger(__name__)
admin_router = Router()

# Apply IsAdminFilter to all handlers in this router
admin_router.message.filter(IsAdminFilter())
admin_router.callback_query.filter(IsAdminFilter())


# ==================== CANCEL HANDLER ====================
@admin_router.message(F.text == "❌ Bekor qilish")
async def cancel_handler(message: Message, state: FSMContext):
    """Cancel current FSM state workflow."""
    current_state = await state.get_state()
    if current_state is None:
        return

    await state.clear()
    await message.answer(
        "❌ Amaliyot bekor qilindi.", reply_markup=admin_menu_keyboard()
    )


# ==================== ADMIN PANEL MENU ====================
@admin_router.message(Command("admin"))
async def cmd_admin(message: Message, state: FSMContext):
    """Displays Admin Panel menu."""
    await state.clear()
    await message.answer(
        "⚙️ <b>Admin panelga xush kelibsiz!</b>\n"
        "Kerakli bo'limni tanlang:",
        reply_markup=admin_menu_keyboard(),
        parse_mode="HTML",
    )


# ==================== STATISTIKA ====================
@admin_router.message(F.text == "📊 Statistika")
async def btn_stats(message: Message, db: Database):
    """Displays bot statistics."""
    total_users = await db.count_users()
    today_users = await db.count_today_users()
    total_movies = await db.count_movies()
    total_views = await db.count_total_views()

    stats_text = (
        "📊 <b>BOT STATISTIKASI</b>\n\n"
        f"👥 <b>Jami foydalanuvchilar:</b> {total_users:,} ta\n"
        f"📅 <b>Bugungi foydalanuvchilar:</b> {today_users:,} ta\n"
        f"🎬 <b>Jami kinolar:</b> {total_movies:,} ta\n"
        f"👁 <b>Umumiy ko'rishlar:</b> {total_views:,} marta\n"
    )
    await message.answer(
        stats_text, reply_markup=admin_menu_keyboard(), parse_mode="HTML"
    )


# ==================== FOYDALANUVCHILAR ====================
@admin_router.message(F.text == "👥 Foydalanuvchilar")
async def btn_users(message: Message, db: Database):
    """Displays user count breakdown."""
    total_users = await db.count_users()
    today_users = await db.count_today_users()

    text = (
        "👥 <b>FOYDALANUVCHILAR MA'LUMOTI</b>\n\n"
        f"🔹 Jami ro'yxatdan o'tganlar: <b>{total_users}</b> ta\n"
        f"🔹 Bugun qo'shilganlar: <b>{today_users}</b> ta\n"
    )
    await message.answer(
        text, reply_markup=admin_menu_keyboard(), parse_mode="HTML"
    )


# ==================== SOZLAMALAR ====================
@admin_router.message(F.text == "⚙ Sozlamalar")
async def btn_settings(message: Message):
    """Displays settings guide for .env dynamic configuration."""
    channels = get_required_channels()
    admins = get_admin_ids()

    channels_str = ", ".join(channels) if channels else "Birorta ham yo'q"
    admins_str = ", ".join(map(str, admins))

    settings_text = (
        "⚙️ <b>BOT SOZLAMALARI (.env)</b>\n\n"
        "Barcha sozlamalar <code>.env</code> fayli orqali boshqariladi:\n\n"
        f"📢 <b>Majburiy kanallar:</b>\n<code>{channels_str}</code>\n\n"
        f"👑 <b>Admin IDlar:</b>\n<code>{admins_str}</code>\n\n"
        "💡 <i>Kanal qo'shish yoki olib tashlash uchun faqat .env faylidagi REQUIRED_CHANNELS qiymatini o'zgartiring va saqlang. Bot qayta yuklanganda avtomatik o'qiydi. Kodni o'zgartirish shart emas!</i>"
    )
    await message.answer(
        settings_text, reply_markup=admin_menu_keyboard(), parse_mode="HTML"
    )


# ==================== KINO QO'SHISH (10 STEPS FSM) ====================
@admin_router.message(F.text == "➕ Kino qo'shish")
async def start_add_movie(message: Message, state: FSMContext):
    """Step 1: Ask for movie video."""
    await state.clear()
    await state.set_state(AddMovieStates.waiting_for_video)
    await message.answer(
        "1️⃣ <b>Kino videosini yuboring:</b>",
        reply_markup=cancel_keyboard(),
        parse_mode="HTML",
    )


@admin_router.message(AddMovieStates.waiting_for_video, F.video)
async def process_video(message: Message, state: FSMContext):
    """Step 1 handler: Save file_id and ask for Title."""
    video_file_id = message.video.file_id
    await state.update_data(file_id=video_file_id)

    await state.set_state(AddMovieStates.waiting_for_title)
    await message.answer(
        "2️⃣ <b>Kino nomini kiriting:</b>\n<i>Misol: Qasoskorlar: Intihoy</i>",
        reply_markup=cancel_keyboard(),
        parse_mode="HTML",
    )


@admin_router.message(AddMovieStates.waiting_for_video)
async def invalid_video(message: Message):
    """Invalid video handler."""
    await message.answer(
        "❌ Iltimos, faqat <b>video fayl</b> yuboring!", parse_mode="HTML"
    )


@admin_router.message(AddMovieStates.waiting_for_title, F.text)
async def process_title(message: Message, state: FSMContext):
    """Step 2 handler: Save Title and ask for unique Code."""
    title = message.text.strip()
    await state.update_data(title=title)

    await state.set_state(AddMovieStates.waiting_for_code)
    await message.answer(
        "3️⃣ <b>Kino kodini kiriting:</b>\n<i>Misol: 100, 205, 999</i>",
        reply_markup=cancel_keyboard(),
        parse_mode="HTML",
    )


@admin_router.message(AddMovieStates.waiting_for_code, F.text)
async def process_code(message: Message, state: FSMContext, db: Database):
    """Step 3 handler: Validate Code uniqueness and ask for Year."""
    code = message.text.strip()

    # Check if movie code already exists in DB
    existing_movie = await db.get_movie_by_code(code)
    if existing_movie:
        await message.answer(
            "❌ <b>Bu kod oldin ishlatilgan.</b>\nYangi kod kiriting:",
            reply_markup=cancel_keyboard(),
            parse_mode="HTML",
        )
        return

    await state.update_data(code=code)
    await state.set_state(AddMovieStates.waiting_for_year)
    await message.answer(
        "4️⃣ <b>Kino chiqarilgan yilini kiriting:</b>\n<i>Misol: 2024</i>",
        reply_markup=cancel_keyboard(),
        parse_mode="HTML",
    )


@admin_router.message(AddMovieStates.waiting_for_year, F.text)
async def process_year(message: Message, state: FSMContext):
    """Step 4 handler: Save Year and ask for Genre."""
    year = message.text.strip()
    await state.update_data(year=year)

    await state.set_state(AddMovieStates.waiting_for_genre)
    await message.answer(
        "5️⃣ <b>Kino janrini kiriting:</b>\n<i>Misol: Jangari, Fantastika</i>",
        reply_markup=cancel_keyboard(),
        parse_mode="HTML",
    )


@admin_router.message(AddMovieStates.waiting_for_genre, F.text)
async def process_genre(message: Message, state: FSMContext):
    """Step 5 handler: Save Genre and ask for Country."""
    genre = message.text.strip()
    await state.update_data(genre=genre)

    await state.set_state(AddMovieStates.waiting_for_country)
    await message.answer(
        "6️⃣ <b>Kino ishlab chiqarilgan davlatini kiriting:</b>\n<i>Misol: AQSH</i>",
        reply_markup=cancel_keyboard(),
        parse_mode="HTML",
    )


@admin_router.message(AddMovieStates.waiting_for_country, F.text)
async def process_country(message: Message, state: FSMContext):
    """Step 6 handler: Save Country and ask for Duration."""
    country = message.text.strip()
    await state.update_data(country=country)

    await state.set_state(AddMovieStates.waiting_for_duration)
    await message.answer(
        "7️⃣ <b>Kino davomiyligini kiriting:</b>\n<i>Misol: 2 soat 15 daqiqa</i>",
        reply_markup=cancel_keyboard(),
        parse_mode="HTML",
    )


@admin_router.message(AddMovieStates.waiting_for_duration, F.text)
async def process_duration(message: Message, state: FSMContext):
    """Step 7 handler: Save Duration and ask for Description."""
    duration = message.text.strip()
    await state.update_data(duration=duration)

    await state.set_state(AddMovieStates.waiting_for_description)
    await message.answer(
        "8️⃣ <b>Kino tavsifini kiriting:</b>\n<i>Misol: Qiziqarli voqelarga boy film...</i>",
        reply_markup=cancel_keyboard(),
        parse_mode="HTML",
    )


@admin_router.message(AddMovieStates.waiting_for_description, F.text)
async def process_description(message: Message, state: FSMContext):
    """Step 8 handler: Save Description and ask for Poster (optional)."""
    description = message.text.strip()
    await state.update_data(description=description)

    await state.set_state(AddMovieStates.waiting_for_poster)
    await message.answer(
        "9️⃣ <b>Kino posterini yuboring (ixtiyoriy):</b>\n<i>Aksiya qilmasangiz 'O'tkazib yuborish' tugmasini bosing.</i>",
        reply_markup=skip_keyboard(),
        parse_mode="HTML",
    )


@admin_router.message(AddMovieStates.waiting_for_poster, F.photo)
async def process_poster_photo(message: Message, state: FSMContext):
    """Step 9 handler: Poster photo provided."""
    poster_id = message.photo[-1].file_id
    await state.update_data(poster=poster_id)
    await show_add_movie_summary(message, state)


@admin_router.message(
    AddMovieStates.waiting_for_poster, F.text == "⏭ O'tkazib yuborish"
)
async def process_poster_skip(message: Message, state: FSMContext):
    """Step 9 handler: Poster skipped."""
    await state.update_data(poster=None)
    await show_add_movie_summary(message, state)


async def show_add_movie_summary(message: Message, state: FSMContext):
    """Step 10: Show summary preview and ask for confirmation."""
    data = await state.get_data()
    await state.set_state(AddMovieStates.waiting_for_confirmation)

    caption = format_movie_caption(data)
    summary_text = (
        "🔟 <b>MA'LUMOTLARNI TASDIQLANG:</b>\n\n"
        f"{caption}\n\n"
        f"🔑 <b>Kino kodi:</b> <code>{data['code']}</code>\n\n"
        "Kino bazaga saqlansinmi?"
    )

    await message.answer(
        summary_text,
        reply_markup=admin_confirm_keyboard("add_movie"),
        parse_mode="HTML",
    )


@admin_router.callback_query(
    AddMovieStates.waiting_for_confirmation, F.data == "confirm_add_movie"
)
async def save_movie_to_db(call: CallbackQuery, state: FSMContext, db: Database):
    """Step 10 confirm: Save movie to database."""
    data = await state.get_data()
    success = await db.add_movie(
        code=data["code"],
        title=data["title"],
        file_id=data["file_id"],
        year=data.get("year"),
        genre=data.get("genre"),
        country=data.get("country"),
        duration=data.get("duration"),
        description=data.get("description"),
        poster=data.get("poster"),
    )

    await state.clear()
    await call.answer()

    if success:
        if call.message:
            await call.message.edit_text(
                f"✅ <b>Kino muvaffaqiyatli saqlandi!</b>\n🔑 Kodi: <code>{data['code']}</code>",
                parse_mode="HTML",
            )
            await call.message.answer(
                "Admin menyusi:", reply_markup=admin_menu_keyboard()
            )
    else:
        if call.message:
            await call.message.edit_text("❌ Kino saqlashda xatolik yuz berdi.")


# ==================== KINO O'CHIRISH ====================
@admin_router.message(F.text == "🗑 Kino o'chirish")
async def start_delete_movie(message: Message, state: FSMContext):
    """Prompt for code of movie to delete."""
    await state.clear()
    await state.set_state(DeleteMovieStates.waiting_for_code)
    await message.answer(
        "🗑 <b>O'chirmoqchi bo'lgan kino kodini kiriting:</b>",
        reply_markup=cancel_keyboard(),
        parse_mode="HTML",
    )


@admin_router.message(DeleteMovieStates.waiting_for_code, F.text)
async def process_delete_movie(message: Message, state: FSMContext, db: Database):
    """Delete movie by code."""
    code = message.text.strip()
    deleted = await db.delete_movie(code)
    await state.clear()

    if deleted:
        await message.answer(
            f"✅ Kodi <code>{code}</code> bo'lgan kino o'chirildi!",
            reply_markup=admin_menu_keyboard(),
            parse_mode="HTML",
        )
    else:
        await message.answer(
            f"❌ Kodi <code>{code}</code> bo'lgan kino topilmadi.",
            reply_markup=admin_menu_keyboard(),
            parse_mode="HTML",
        )


# ==================== KINO TAHRIRLASH ====================
@admin_router.message(F.text == "✏ Kino tahrirlash")
async def btn_edit_movie(message: Message):
    """Instruction for editing movie."""
    await message.answer(
        "✏️ <b>Kino tahrirlash:</b>\n\n"
        "Kino ma'lumotlarini o'zgartirish uchun eskisini o'chirib (🗑 Kino o'chirish), qayta qo'shishingiz (➕ Kino qo'shish) tavsiya etiladi.",
        reply_markup=admin_menu_keyboard(),
        parse_mode="HTML",
    )


# ==================== REKLAMA (BROADCAST SYSTEM) ====================
@admin_router.message(F.text == "📢 Reklama")
async def start_broadcast(message: Message, state: FSMContext):
    """Prompt admin for broadcast message."""
    await state.clear()
    await state.set_state(BroadcastStates.waiting_for_content)
    await message.answer(
        "📢 <b>Reklama xabarini yuboring:</b>\n\n"
        "Har qanday turdagi xabar yuborishingiz mumkin (Matn, Rasm, Video, GIF, Sticker, Hujjat yoki Forward).",
        reply_markup=cancel_keyboard(),
        parse_mode="HTML",
    )


@admin_router.message(BroadcastStates.waiting_for_content)
async def process_broadcast_content(message: Message, state: FSMContext):
    """Ask for broadcast confirmation."""
    await state.update_data(broadcast_message_id=message.message_id, from_chat_id=message.chat.id)
    await state.set_state(BroadcastStates.waiting_for_confirmation)

    await message.reply(
        "📢 <b>Ushbu xabar barcha foydalanuvchilarga yuborilsinmi?</b>",
        reply_markup=admin_confirm_keyboard("broadcast"),
        parse_mode="HTML",
    )


@admin_router.callback_query(
    BroadcastStates.waiting_for_confirmation, F.data == "confirm_broadcast"
)
async def execute_broadcast(
    call: CallbackQuery, state: FSMContext, db: Database, bot: Bot
):
    """Execute asynchronous broadcast to all registered users."""
    data = await state.get_data()
    message_id = data["broadcast_message_id"]
    from_chat_id = data["from_chat_id"]

    await state.clear()
    await call.answer("📢 Reklama tarqatish boshlandi...", show_alert=True)

    if call.message:
        await call.message.edit_text("⏳ Reklama yuborilmoqda, iltimos kuting...")

    users = await db.get_all_users()
    total = len(users)
    success = 0
    failed = 0

    for user in users:
        user_id = user["telegram_id"]
        try:
            await bot.copy_message(
                chat_id=user_id,
                from_chat_id=from_chat_id,
                message_id=message_id,
            )
            success += 1
            await asyncio.sleep(0.05)  # Flood limit protection
        except TelegramRetryAfter as e:
            await asyncio.sleep(e.retry_after)
            try:
                await bot.copy_message(
                    chat_id=user_id,
                    from_chat_id=from_chat_id,
                    message_id=message_id,
                )
                success += 1
            except Exception:
                failed += 1
        except TelegramAPIError:
            failed += 1
        except Exception as e:
            logger.error(f"Error sending broadcast to {user_id}: {e}")
            failed += 1

    report_text = (
        "✅ <b>Reklama tarqatish yakunlandi!</b>\n\n"
        f"👥 Jami foydalanuvchilar: <b>{total}</b>\n"
        f"✅ Muvaffaqiyatli yetkazildi: <b>{success}</b>\n"
        f"❌ Yetkazilmadi: <b>{failed}</b>"
    )

    if call.message:
        await call.message.answer(
            report_text, reply_markup=admin_menu_keyboard(), parse_mode="HTML"
        )


@admin_router.callback_query(F.data == "cancel_action")
async def cancel_callback_action(call: CallbackQuery, state: FSMContext):
    """Cancel action inline button."""
    await state.clear()
    await call.answer("Bekor qilindi.")
    if call.message:
        await call.message.edit_text("❌ Amaliyot bekor qilindi.")
        await call.message.answer("Menyu:", reply_markup=admin_menu_keyboard())
