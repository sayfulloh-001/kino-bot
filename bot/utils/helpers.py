import logging
from typing import List, Tuple, Dict, Any
from aiogram import Bot
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError

logger = logging.getLogger(__name__)


async def check_channel_subscriptions(
    bot: Bot, user_id: int, channels: List[str]
) -> Tuple[bool, List[str]]:
    """
    Checks if a user is a member of all required channels using getChatMember.
    Returns (all_subscribed: bool, unsubscribed_channels: List[str]).
    """
    unsubscribed: List[str] = []

    for channel in channels:
        try:
            member = await bot.get_chat_member(chat_id=channel, user_id=user_id)
            # Valid statuses for subscribed member
            if member.status not in ["creator", "administrator", "member"]:
                unsubscribed.append(channel)
        except (TelegramBadRequest, TelegramForbiddenError) as e:
            logger.warning(
                f"Cannot check subscription for channel {channel} for user {user_id}: {e}"
            )
            # If bot cannot check (e.g., channel not found or bot not admin), assume unsubscribed
            unsubscribed.append(channel)
        except Exception as e:
            logger.error(f"Unexpected error checking {channel}: {e}")
            unsubscribed.append(channel)

    all_subscribed = len(unsubscribed) == 0
    return all_subscribed, unsubscribed


def format_movie_caption(movie: Dict[str, Any]) -> str:
    """
    Formats movie object details into clean caption text according to specifications.
    """
    title = movie.get("title", "Noma'lum")
    year = movie.get("year") or "Noma'lum"
    genre = movie.get("genre") or "Noma'lum"
    country = movie.get("country") or "Noma'lum"
    duration = movie.get("duration") or "Noma'lum"
    description = movie.get("description") or "Mavjud emas"
    views = movie.get("views", 0)

    caption = (
        f"🎬 <b>Kino nomi:</b> {title}\n"
        f"📅 <b>Yili:</b> {year}\n"
        f"🎭 <b>Janri:</b> {genre}\n"
        f"🌍 <b>Davlati:</b> {country}\n"
        f"⏳ <b>Davomiyligi:</b> {duration}\n"
        f"📝 <b>Tavsifi:</b> {description}\n"
        f"👁 <b>Ko'rilganlar soni:</b> {views}"
    )
    return caption
