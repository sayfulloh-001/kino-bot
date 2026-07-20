from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from typing import List


def get_sub_channels_keyboard(channels: List[str]) -> InlineKeyboardMarkup:
    """
    Generates inline keyboard for mandatory channels subscription check.
    Handles 1, 5, or 20+ channels dynamically.
    Each channel gets a button '📢 Kanalga obuna bo'lish', followed by a single '✅ Tekshirish' button.
    """
    buttons = []
    for idx, channel in enumerate(channels, start=1):
        clean_channel = channel.replace("@", "")
        url = f"https://t.me/{clean_channel}" if not channel.startswith("-") else "https://t.me"
        btn_text = f"📢 {idx}-kanalga obuna bo'lish" if len(channels) > 1 else "📢 Kanalga obuna bo'lish"
        buttons.append(
            [InlineKeyboardButton(text=btn_text, url=url)]
        )

    buttons.append(
        [
            InlineKeyboardButton(
                text="✅ Tekshirish", callback_data="check_subscription"
            )
        ]
    )
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def admin_confirm_keyboard(action: str) -> InlineKeyboardMarkup:
    """Confirmation inline buttons for Save/Cancel actions in admin tasks."""
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="✅ Tasdiqlash va Saqlash",
                    callback_data=f"confirm_{action}",
                ),
            ],
            [
                InlineKeyboardButton(
                    text="❌ Bekor qilish", callback_data="cancel_action"
                ),
            ],
        ]
    )
    return keyboard


def categories_inline_keyboard(categories: List[str]) -> InlineKeyboardMarkup:
    """Generates inline keyboard for movie categories."""
    buttons = []
    for category in categories:
        buttons.append(
            [
                InlineKeyboardButton(
                    text=f"📂 {category}",
                    callback_data=f"cat_{category[:20]}",
                )
            ]
        )
    return InlineKeyboardMarkup(inline_keyboard=buttons)
