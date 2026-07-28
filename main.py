import sys
import asyncio
import logging
import os
import threading
import random
from http.server import BaseHTTPRequestHandler, HTTPServer
from aiogram import Bot, Dispatcher, Router, types, F
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart, Command, StateFilter
from aiogram.types import (
    ReplyKeyboardMarkup,
    KeyboardButton,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    ReplyKeyboardRemove
)
from aiogram.client.default import DefaultBotProperties
from aiogram.fsm.state import StatesGroup, State
from aiogram.fsm.context import FSMContext
from dotenv import load_dotenv
import aiosqlite

# Load env variables
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_ID_RAW = os.getenv("ADMIN_ID", "")
ADMIN_IDS = [int(x.strip()) for x in ADMIN_ID_RAW.split(",") if x.strip().isdigit()]
DB_PATH = os.getenv("DB_PATH", "bot.db")
WEB_APP_URL = os.getenv("RENDER_EXTERNAL_URL", os.getenv("WEB_APP_URL", ""))


# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

router = Router()

# ==========================================
# DATABASE LOGIC
# ==========================================

async def init_db():
    """Initializes the database and populates with sample questions if empty."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT,
                full_name TEXT,
                score INTEGER DEFAULT 0,
                tests_taken INTEGER DEFAULT 0
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_text TEXT,
                option_a TEXT,
                option_b TEXT,
                option_c TEXT,
                option_d TEXT,
                correct_option TEXT
            )
        """)
        await db.commit()
        
        # Check if questions empty, insert sample ones
        async with db.execute("SELECT COUNT(*) FROM questions") as cursor:
            count = (await cursor.fetchone())[0]
            if count == 0:
                samples = [
                    ("O'zbekistonning poytaxti qayer?", "Toshkent", "Samarqand", "Buxoro", "Andijon", "A"),
                    ("Python dasturlash tili qachon yaratilgan?", "1991", "2000", "1989", "1995", "A"),
                    ("Telegram asoschisi kim?", "Pavel Durov", "Mark Zuckerberg", "Bill Gates", "Elon Musk", "A")
                ]
                await db.executemany("""
                    INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, samples)
                await db.commit()
                logger.info("Sample questions inserted successfully.")

async def add_user(user_id, username, full_name):
    """Registers user if not exists."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT OR IGNORE INTO users (id, username, full_name, score, tests_taken)
            VALUES (?, ?, ?, 0, 0)
        """, (user_id, username, full_name))
        await db.commit()

async def get_user(user_id):
    """Gets user's statistics."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT score, tests_taken FROM users WHERE id = ?", (user_id,)) as cursor:
            return await cursor.fetchone()

async def update_user_score(user_id, added_score):
    """Updates user's score and tests count."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE users 
            SET score = score + ?, tests_taken = tests_taken + 1 
            WHERE id = ?
        """, (added_score, user_id))
        await db.commit()

async def get_top_users():
    """Gets top 10 users ordered by score."""
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("""
            SELECT full_name, score FROM users 
            ORDER BY score DESC LIMIT 10
        """) as cursor:
            return await cursor.fetchall()

# ==========================================
# WEB SERVER FOR HEALTH CHECK (RENDER DEPLOYMENT)
# ==========================================

class WebAppServer(BaseHTTPRequestHandler):
    """Serve game assets and the frontend for the 3D runner game."""
    def do_GET(self):
        # Clean path and prevent traversal
        clean_path = self.path.split('?')[0]
        if clean_path == "/" or clean_path == "/index.html":
            file_path = "static/index.html"
        else:
            normalized_path = os.path.normpath(clean_path.lstrip("/"))
            if normalized_path.startswith("..") or os.path.isabs(normalized_path):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"Forbidden")
                return
            file_path = os.path.join("static", normalized_path)

        if os.path.exists(file_path) and os.path.isfile(file_path):
            ext = os.path.splitext(file_path)[1].lower()
            content_types = {
                ".html": "text/html; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".js": "application/javascript; charset=utf-8",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon",
                ".mp3": "audio/mpeg",
                ".wav": "audio/wav"
            }
            content_type = content_types.get(ext, "application/octet-stream")
            
            try:
                with open(file_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-type", content_type)
                # Disable caching so updates apply immediately
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.send_header("Pragma", "no-cache")
                self.send_header("Expires", "0")
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                logger.error(f"Error serving file {file_path}: {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"Server error: {e}".encode("utf-8"))
        else:
            self.send_response(404)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not Found")

    def log_message(self, format, *args):
        # Silence standard HTTP logging
        return


def run_web_server():
    """Runs the basic healthcheck web server in a daemon thread."""
    port = int(os.getenv("PORT", 8000))
    try:
        server = HTTPServer(("0.0.0.0", port), WebAppServer)
        logger.info(f"Web server started successfully on port {port}")
        server.serve_forever()
    except Exception as e:
        logger.error(f"Failed to start web server: {e}")

# ==========================================
# KEYBOARDS
# ==========================================

def get_main_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📝 Testni boshlash")],
            [KeyboardButton(text="📊 Mening natijalarim"), KeyboardButton(text="🏆 Top o'yinchilar")],
            [KeyboardButton(text="ℹ️ Yordam")]
        ],
        resize_keyboard=True
    )

def get_admin_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="➕ Yangi savol qo'shish"), KeyboardButton(text="🗑️ Savol o'chirish")],
            [KeyboardButton(text="📋 Barcha savollar"), KeyboardButton(text="📊 Bot statistikasi")],
            [KeyboardButton(text="🚪 Chiqish")]
        ],
        resize_keyboard=True
    )

# ==========================================
# STATES (FSM)
# ==========================================

class QuizStates(StatesGroup):
    answering = State()

class AdminStates(StatesGroup):
    waiting_for_question = State()
    waiting_for_option_a = State()
    waiting_for_option_b = State()
    waiting_for_option_c = State()
    waiting_for_option_d = State()
    waiting_for_correct = State()

class AdminDeleteState(StatesGroup):
    waiting_for_id = State()

# ==========================================
# HELPERS
# ==========================================

async def send_question(event, state: FSMContext):
    """Sends the current question of the quiz session with option buttons."""
    data = await state.get_data()
    questions = data.get("questions")
    index = data.get("current_index")
    
    q = questions[index]
    q_id, text, oa, ob, oc, od, correct = q
    
    msg_text = (
        f"📝 <b>Savol {index + 1}/{len(questions)}:</b>\n\n"
        f"💬 <b>{text}</b>\n\n"
        f"🇦 {oa}\n"
        f"🇧 {ob}\n"
        f"🇨 {oc}\n"
        f"🇩 {od}"
    )
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="A", callback_data=f"answer:A:{index}"),
                InlineKeyboardButton(text="B", callback_data=f"answer:B:{index}"),
            ],
            [
                InlineKeyboardButton(text="C", callback_data=f"answer:C:{index}"),
                InlineKeyboardButton(text="D", callback_data=f"answer:D:{index}"),
            ]
        ]
    )
    
    if isinstance(event, types.CallbackQuery):
        await event.message.answer(msg_text, reply_markup=keyboard)
    else:
        await event.answer(msg_text, reply_markup=keyboard)

# ==========================================
# GENERAL HANDLERS (USER)
# ==========================================

@router.message(CommandStart())
async def start_handler(message: types.Message):
    await add_user(message.from_user.id, message.from_user.username, message.from_user.full_name)
    
    inline_keyboard = None
    if WEB_APP_URL:
        from aiogram.types import WebAppInfo
        inline_keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="🎮 O'yinni o'ynash (3D Runner)",
                        web_app=WebAppInfo(url=WEB_APP_URL)
                    )
                ]
            ]
        )
        
    await message.answer(
        f"Salom, <b>{message.from_user.full_name}</b>! 👋\n\n"
        f"Savol-javob (Quiz) botimiz va 3D Yugurish o'yinimizga xush kelibsiz!\n\n"
        f"🎮 O'yinni o'ynash uchun pastdagi tugmani bosing, yoki bot menyusidan foydalanib bilimingizni sinab ko'ring.",
        reply_markup=inline_keyboard
    )
    
    await message.answer(
        "Asosiy bot menyusi:",
        reply_markup=get_main_keyboard()
    )


@router.message(F.text == "ℹ️ Yordam")
async def help_handler(message: types.Message):
    await message.answer(
        "🧠 <b>Botdan foydalanish bo'yicha yordam:</b>\n\n"
        "1️⃣ <b>Testni boshlash</b>: Bazadan random tartibda savollar beriladi. Har bir to'g'ri javob uchun sizga 10 ball beriladi.\n"
        "2️⃣ <b>Mening natijalarim</b>: Umumiy to'plagan ballaringiz va nechta test yechganingiz haqida ma'lumot.\n"
        "3️⃣ <b>Top o'yinchilar</b>: Eng yuqori ball to'plagan 10 ta eng kuchli o'yinchilar ro'yxati.\n\n"
        "Omad tilaymiz! 🚀"
    )

@router.message(F.text == "📊 Mening natijalarim")
async def stats_handler(message: types.Message):
    user_data = await get_user(message.from_user.id)
    if user_data:
        score, tests = user_data
        await message.answer(
            f"📊 <b>Sizning natijalaringiz:</b>\n\n"
            f"👤 Foydalanuvchi: <b>{message.from_user.full_name}</b>\n"
            f"🏆 Umumiy ballingiz: <b>{score}</b> ball\n"
            f"📝 Yechilgan testlar soni: <b>{tests}</b> ta"
        )
    else:
        await message.answer("Siz hali bazada yo'qsiz. /start buyrug'ini yuboring.")

@router.message(F.text == "🏆 Top o'yinchilar")
async def top_players_handler(message: types.Message):
    top_list = await get_top_users()
    if not top_list:
        await message.answer("Hozircha reyting mavjud emas.")
        return
    
    text = "🏆 <b>Eng yuqori natija ko'rsatgan 10 ta o'yinchi:</b>\n\n"
    for idx, (name, score) in enumerate(top_list, 1):
        emoji = "🥇" if idx == 1 else "🥈" if idx == 2 else "🥉" if idx == 3 else f"{idx}."
        text += f"{emoji} {name} — <b>{score} ball</b>\n"
    
    await message.answer(text)

@router.message(F.text == "📝 Testni boshlash")
async def start_quiz_handler(message: types.Message, state: FSMContext):
    # Fetch all questions from the database
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option FROM questions") as cursor:
            questions = await cursor.fetchall()
    
    if not questions:
        await message.answer("⚠️ Hozircha bazada savollar yo'q. Iltimos keyinroq urunib ko'ring yoki adminlar bilan bog'laning.")
        return

    # Shuffle and pick up to 10 questions
    random.shuffle(questions)
    questions = questions[:10]

    # Save details into state
    await state.update_data(
        questions=questions,
        current_index=0,
        score=0
    )

    await state.set_state(QuizStates.answering)
    await send_question(message, state)

# ==========================================
# QUIZ CALLBACK HANDLERS
# ==========================================

@router.callback_query(F.data.startswith("answer:"), StateFilter(QuizStates.answering))
async def answer_callback_handler(callback: types.CallbackQuery, state: FSMContext):
    parts = callback.data.split(":")
    selected = parts[1]
    q_index = int(parts[2])
    
    data = await state.get_data()
    questions = data.get("questions")
    current_index = data.get("current_index")
    score = data.get("score")
    
    # Avoid out-of-order clicks
    if q_index != current_index:
        await callback.answer("Bu eski savol, iltimos keyingisiga o'ting.", show_alert=True)
        return

    q = questions[current_index]
    q_id, text, oa, ob, oc, od, correct = q
    
    is_correct = (selected == correct)
    options_map = {"A": oa, "B": ob, "C": oc, "D": od}
    correct_value = options_map.get(correct)
    
    if is_correct:
        score += 10
        await state.update_data(score=score)
        res_text = f"✅ <b>To'g'ri!</b> (+10 ball)"
    else:
        res_text = f"❌ <b>Noto'g'ri!</b>\nTo'g'ri javob: <b>{correct}) {correct_value}</b>"
        
    next_index = current_index + 1
    has_more = (next_index < len(questions))
    
    next_btn_text = "Keyingi savol ➡️" if has_more else "Natijani ko'rish 🏁"
    next_callback = "next_q" if has_more else "finish_q"
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=next_btn_text, callback_data=next_callback)]
        ]
    )
    
    new_msg_text = (
        f"📝 <b>Savol {current_index + 1}/{len(questions)}:</b>\n\n"
        f"💬 <b>{text}</b>\n\n"
        f"Sizning javobingiz: <b>{selected}</b>\n\n"
        f"{res_text}"
    )
    
    await callback.message.edit_text(new_msg_text, reply_markup=keyboard)
    await callback.answer()

@router.callback_query(F.data == "next_q", StateFilter(QuizStates.answering))
async def next_question_callback(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    current_index = data.get("current_index")
    
    new_index = current_index + 1
    await state.update_data(current_index=new_index)
    
    # Clean up the previous message button
    try:
        await callback.message.edit_reply_markup(reply_markup=None)
    except Exception:
        pass
        
    await send_question(callback, state)
    await callback.answer()

@router.callback_query(F.data == "finish_q", StateFilter(QuizStates.answering))
async def finish_quiz_callback(callback: types.CallbackQuery, state: FSMContext):
    data = await state.get_data()
    questions = data.get("questions")
    score = data.get("score")
    
    total_questions = len(questions)
    correct_answers = score // 10
    
    # Save the score and tests count into database
    await update_user_score(callback.from_user.id, score)
    
    # Clean up inline buttons on final question
    try:
        await callback.message.edit_reply_markup(reply_markup=None)
    except Exception:
        pass

    await callback.message.answer(
        f"🏁 <b>Test yakunlandi!</b>\n\n"
        f"📊 <b>Natijangiz:</b>\n"
        f"🔹 Jami savollar: <b>{total_questions} ta</b>\n"
        f"✅ To'g'ri javoblar: <b>{correct_answers} ta</b>\n"
        f"🏆 Topilgan ball: <b>+{score} ball</b>\n\n"
        f"Ajoyib ishtirok! Bilimingizni oshirishda davom eting! 🌟",
        reply_markup=get_main_keyboard()
    )
    
    await state.clear()
    await callback.answer()

# ==========================================
# ADMIN HANDLERS
# ==========================================

@router.message(Command("admin"))
async def admin_start_handler(message: types.Message):
    if message.from_user.id not in ADMIN_IDS:
        await message.answer("⚠️ Kechirasiz, siz ushbu botning administratorlar ro'yxatida yo'qsiz.")
        return
    
    await message.answer(
        "👑 <b>Admin panelga xush kelibsiz!</b>\n\n"
        "Kerakli menyuni tanlang:",
        reply_markup=get_admin_keyboard()
    )

@router.message(F.text == "🚪 Chiqish")
async def admin_exit_handler(message: types.Message):
    if message.from_user.id not in ADMIN_IDS:
        return
    
    await message.answer(
        "Asosiy menyuga qaytdingiz.",
        reply_markup=get_main_keyboard()
    )

@router.message(Command("bekor"), StateFilter(AdminStates, AdminDeleteState))
async def cancel_handler(message: types.Message, state: FSMContext):
    await state.clear()
    await message.answer("Amal bekor qilindi.", reply_markup=get_admin_keyboard())

# --- Add Question Flow ---

@router.message(F.text == "➕ Yangi savol qo'shish")
async def admin_add_question_start(message: types.Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    
    await state.set_state(AdminStates.waiting_for_question)
    await message.answer(
        "❓ <b>Savol matnini kiriting:</b>\n\n"
        "(Amalni bekor qilish uchun istalgan vaqt /bekor buyrug'ini yuboring)", 
        reply_markup=ReplyKeyboardRemove()
    )

@router.message(AdminStates.waiting_for_question)
async def admin_save_question_text(message: types.Message, state: FSMContext):
    await state.update_data(question_text=message.text)
    await state.set_state(AdminStates.waiting_for_option_a)
    await message.answer("🇦 <b>A variant matnini kiriting:</b>")

@router.message(AdminStates.waiting_for_option_a)
async def admin_save_option_a(message: types.Message, state: FSMContext):
    await state.update_data(option_a=message.text)
    await state.set_state(AdminStates.waiting_for_option_b)
    await message.answer("🇧 <b>B variant matnini kiriting:</b>")

@router.message(AdminStates.waiting_for_option_b)
async def admin_save_option_b(message: types.Message, state: FSMContext):
    await state.update_data(option_b=message.text)
    await state.set_state(AdminStates.waiting_for_option_c)
    await message.answer("🇨 <b>C variant matnini kiriting:</b>")

@router.message(AdminStates.waiting_for_option_c)
async def admin_save_option_c(message: types.Message, state: FSMContext):
    await state.update_data(option_c=message.text)
    await state.set_state(AdminStates.waiting_for_option_d)
    await message.answer("🇩 <b>D variant matnini kiriting:</b>")

@router.message(AdminStates.waiting_for_option_d)
async def admin_save_option_d(message: types.Message, state: FSMContext):
    await state.update_data(option_d=message.text)
    await state.set_state(AdminStates.waiting_for_correct)
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="A", callback_data="admin_correct:A"),
                InlineKeyboardButton(text="B", callback_data="admin_correct:B"),
            ],
            [
                InlineKeyboardButton(text="C", callback_data="admin_correct:C"),
                InlineKeyboardButton(text="D", callback_data="admin_correct:D"),
            ]
        ]
    )
    await message.answer("🎯 <b>To'g'ri javob variantini tanlang:</b>", reply_markup=keyboard)

@router.callback_query(F.data.startswith("admin_correct:"), StateFilter(AdminStates.waiting_for_correct))
async def admin_save_correct_option(callback: types.CallbackQuery, state: FSMContext):
    correct = callback.data.split(":")[1]
    data = await state.get_data()
    
    q_text = data.get("question_text")
    oa = data.get("option_a")
    ob = data.get("option_b")
    oc = data.get("option_c")
    od = data.get("option_d")
    
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (q_text, oa, ob, oc, od, correct))
        await db.commit()
        
    await callback.message.edit_text(f"Savol saqlandi! To'g'ri variant: <b>{correct}</b> ✅")
    await state.clear()
    await callback.message.answer("Savol muvaffaqiyatli saqlandi! 🚀", reply_markup=get_admin_keyboard())
    await callback.answer()

# --- Delete Question Flow ---

@router.message(F.text == "🗑️ Savol o'chirish")
async def admin_delete_question_start(message: types.Message, state: FSMContext):
    if message.from_user.id not in ADMIN_IDS:
        return
    
    await state.set_state(AdminDeleteState.waiting_for_id)
    await message.answer(
        "🗑️ <b>O'chirmoqchi bo'lgan savolingiz ID raqamini kiriting:</b>\n\n"
        "(Barcha savollarni va ularning ID raqamlarini '📋 Barcha savollar' tugmasi orqali ko'rishingiz mumkin)\n"
        "(Amalni bekor qilish uchun /bekor buyrug'ini yuboring)", 
        reply_markup=ReplyKeyboardRemove()
    )

@router.message(AdminDeleteState.waiting_for_id)
async def admin_delete_question_execute(message: types.Message, state: FSMContext):
    if not message.text.isdigit():
        await message.answer("⚠️ Iltimos, faqat savolning ID raqamini (son ko'rinishida) yuboring:")
        return
    
    q_id = int(message.text)
    
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id FROM questions WHERE id = ?", (q_id,)) as cursor:
            exists = await cursor.fetchone()
        
        if not exists:
            await message.answer(f"❌ ID <b>{q_id}</b> bo'lgan savol topilmadi. Qaytadan kiriting:")
            return
            
        await db.execute("DELETE FROM questions WHERE id = ?", (q_id,))
        await db.commit()
        
    await state.clear()
    await message.answer(f"Savol (ID: {q_id}) muvaffaqiyatli o'chirildi! ✅", reply_markup=get_admin_keyboard())

# --- List Questions ---

@router.message(F.text == "📋 Barcha savollar")
async def admin_list_questions(message: types.Message):
    if message.from_user.id not in ADMIN_IDS:
        return
    
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT id, question_text, correct_option FROM questions") as cursor:
            questions = await cursor.fetchall()
            
    if not questions:
        await message.answer("Bazada hech qanday savol yo'q.")
        return
        
    text = "📋 <b>Barcha savollar ro'yxati:</b>\n\n"
    for q_id, q_text, correct in questions:
        short_text = q_text[:50] + "..." if len(q_text) > 50 else q_text
        text += f"🔹 <b>ID: {q_id}</b>. {short_text} [Javob: {correct}]\n"
        
    # Split text if it exceeds Telegram's limit
    if len(text) > 4000:
        parts = [text[i:i+4000] for i in range(0, len(text), 4000)]
        for part in parts:
            await message.answer(part)
    else:
        await message.answer(text)

# --- Statistics ---

@router.message(F.text == "📊 Bot statistikasi")
async def admin_bot_stats(message: types.Message):
    if message.from_user.id not in ADMIN_IDS:
        return
        
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT COUNT(*) FROM users") as c1:
            users_count = (await c1.fetchone())[0]
        async with db.execute("SELECT COUNT(*) FROM questions") as c2:
            q_count = (await c2.fetchone())[0]
        async with db.execute("SELECT SUM(tests_taken) FROM users") as c3:
            total_tests = (await c3.fetchone())[0] or 0
            
    await message.answer(
        f"📊 <b>Botning umumiy statistikasi:</b>\n\n"
        f"👥 Foydalanuvchilar: <b>{users_count} ta</b>\n"
        f"❓ Bazadagi savollar: <b>{q_count} ta</b>\n"
        f"📝 Jami yechilgan testlar: <b>{total_tests} marta</b>"
    )

# ==========================================
# MAIN INITIALIZATION
# ==========================================

async def set_menu_button(bot: Bot):
    """Sets the bottom-left Menu Button in chat to open the Web App."""
    if WEB_APP_URL:
        try:
            from aiogram.types import MenuButtonWebApp, WebAppInfo
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="Play",
                    web_app=WebAppInfo(url=WEB_APP_URL)
                )
            )
            logger.info(f"Chat Menu Button configured with Web App URL: {WEB_APP_URL}")
        except Exception as e:
            logger.error(f"Failed to set Chat Menu Button: {e}")

async def main() -> None:
    logger.info("Initializing Telegram Quiz Bot...")

    # Run the web health check server in background thread for Render
    threading.Thread(target=run_web_server, daemon=True).start()

    # Initialize DB (creates tables & adds sample questions if empty)
    await init_db()

    if not BOT_TOKEN:
        logger.critical("BOT_TOKEN is missing! Please set BOT_TOKEN in .env or Environment Variables.")
        return

    # Set up Bot and Dispatcher
    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp.include_router(router)

    # Set the menu button for the Web App
    await set_menu_button(bot)

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
