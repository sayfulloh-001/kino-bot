import os
from dotenv import load_dotenv

# Load .env variables initially
load_dotenv()

BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
DB_PATH: str = os.getenv("DB_PATH", "bot.db")


def get_admin_ids() -> list[int]:
    """
    Dynamically returns admin Telegram IDs from environment variable ADMIN_ID.
    Supports comma-separated IDs (e.g. "123456,987654").
    """
    load_dotenv(override=True)
    raw_admins = os.getenv("ADMIN_ID", "")
    admin_ids = []
    for item in raw_admins.split(","):
        item = item.strip()
        if item.isdigit():
            admin_ids.append(int(item))
    return admin_ids


def get_required_channels() -> list[str]:
    """
    Dynamically returns mandatory subscription channels from environment variable REQUIRED_CHANNELS.
    Supports comma-separated usernames or channel IDs (e.g. "@sayfulloh_pro,@kino_tv,@moviesuz").
    Reloads .env to reflect runtime changes without modifying source code.
    """
    load_dotenv(override=True)
    raw_channels = os.getenv("REQUIRED_CHANNELS", "")
    channels = []
    for ch in raw_channels.split(","):
        ch = ch.strip()
        if ch:
            # Add @ prefix if it's a username without @ or negative channel id
            if not ch.startswith("@") and not ch.startswith("-"):
                ch = f"@{ch}"
            channels.append(ch)
    return channels
