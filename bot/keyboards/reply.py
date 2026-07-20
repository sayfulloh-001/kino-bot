from aiogram.types import ReplyKeyboardMarkup, KeyboardButton


def main_menu_keyboard() -> ReplyKeyboardMarkup:
    """Main User Reply Keyboard menu (without Help button)."""
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🎬 Kino qidirish")],
            [
                KeyboardButton(text="📂 Kategoriyalar"),
                KeyboardButton(text="🆕 Yangi kinolar"),
            ],
            [
                KeyboardButton(text="🔥 Top kinolar"),
            ],
        ],
        resize_keyboard=True,
        persistent=True,
    )
    return keyboard


def admin_menu_keyboard() -> ReplyKeyboardMarkup:
    """Admin Panel Reply Keyboard menu."""
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="➕ Kino qo'shish"),
                KeyboardButton(text="✏ Kino tahrirlash"),
            ],
            [
                KeyboardButton(text="🗑 Kino o'chirish"),
                KeyboardButton(text="📊 Statistika"),
            ],
            [
                KeyboardButton(text="👥 Foydalanuvchilar"),
                KeyboardButton(text="📢 Reklama"),
            ],
            [
                KeyboardButton(text="⚙ Sozlamalar"),
                KeyboardButton(text="🔙 Bosh menyu"),
            ],
        ],
        resize_keyboard=True,
        persistent=True,
    )
    return keyboard


def cancel_keyboard() -> ReplyKeyboardMarkup:
    """Cancel action keyboard for state workflows."""
    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text="❌ Bekor qilish")]],
        resize_keyboard=True,
    )
    return keyboard


def skip_keyboard() -> ReplyKeyboardMarkup:
    """Skip optional step keyboard for poster/optional state."""
    keyboard = ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="⏭ O'tkazib yuborish")],
            [KeyboardButton(text="❌ Bekor qilish")],
        ],
        resize_keyboard=True,
    )
    return keyboard
