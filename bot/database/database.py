import logging
from typing import Optional, List, Dict, Any
import aiosqlite
from bot.config import DB_PATH

logger = logging.getLogger(__name__)


class Database:

    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    async def init_db(self) -> None:
        """Initialize SQLite database tables asynchronously."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id BIGINT UNIQUE NOT NULL,
                    fullname TEXT,
                    username TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            await db.execute(
                """
                CREATE TABLE IF NOT EXISTS movies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE NOT NULL,
                    title TEXT NOT NULL,
                    year TEXT,
                    genre TEXT,
                    country TEXT,
                    duration TEXT,
                    description TEXT,
                    poster TEXT,
                    file_id TEXT NOT NULL,
                    views INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """
            )
            await db.commit()
            logger.info("Database tables initialized successfully.")

    # ==================== USER METHODS ====================

    async def add_user(
        self,
        telegram_id: int,
        fullname: Optional[str] = None,
        username: Optional[str] = None,
    ) -> bool:
        """Register or update user in database."""
        async with aiosqlite.connect(self.db_path) as db:
            try:
                await db.execute(
                    """
                    INSERT INTO users (telegram_id, fullname, username)
                    VALUES (?, ?, ?)
                    ON CONFLICT(telegram_id) DO UPDATE SET
                        fullname = excluded.fullname,
                        username = excluded.username;
                    """,
                    (telegram_id, fullname, username),
                )
                await db.commit()
                return True
            except Exception as e:
                logger.error(f"Error adding user {telegram_id}: {e}")
                return False

    async def get_user(self, telegram_id: int) -> Optional[Dict[str, Any]]:
        """Fetch user by Telegram ID."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)
            ) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    async def get_all_users(self) -> List[Dict[str, Any]]:
        """Fetch all registered users."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute("SELECT * FROM users ORDER BY id ASC") as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    async def count_users(self) -> int:
        """Count total registered users."""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT COUNT(*) FROM users") as cursor:
                row = await cursor.fetchone()
                return row[0] if row else 0

    async def count_today_users(self) -> int:
        """Count users registered today."""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT COUNT(*) FROM users WHERE DATE(created_at) = DATE('now', 'localtime')"
            ) as cursor:
                row = await cursor.fetchone()
                return row[0] if row else 0

    # ==================== MOVIE METHODS ====================

    async def add_movie(
        self,
        code: str,
        title: str,
        file_id: str,
        year: Optional[str] = None,
        genre: Optional[str] = None,
        country: Optional[str] = None,
        duration: Optional[str] = None,
        description: Optional[str] = None,
        poster: Optional[str] = None,
    ) -> bool:
        """Insert a new movie into database."""
        async with aiosqlite.connect(self.db_path) as db:
            try:
                await db.execute(
                    """
                    INSERT INTO movies (code, title, year, genre, country, duration, description, poster, file_id, views)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0);
                    """,
                    (
                        code.strip(),
                        title.strip(),
                        year.strip() if year else None,
                        genre.strip() if genre else None,
                        country.strip() if country else None,
                        duration.strip() if duration else None,
                        description.strip() if description else None,
                        poster,
                        file_id,
                    ),
                )
                await db.commit()
                return True
            except aiosqlite.IntegrityError:
                logger.warning(f"Movie code '{code}' already exists.")
                return False
            except Exception as e:
                logger.error(f"Error adding movie code {code}: {e}")
                return False

    async def get_movie_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """Fetch movie details by unique code."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM movies WHERE code = ?", (code.strip(),)
            ) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None

    async def increment_views(self, code: str) -> None:
        """Increment movie view count by 1."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE movies SET views = views + 1 WHERE code = ?", (code.strip(),)
            )
            await db.commit()

    async def delete_movie(self, code: str) -> bool:
        """Delete movie by code."""
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("DELETE FROM movies WHERE code = ?", (code.strip(),))
            await db.commit()
            return cursor.rowcount > 0

    async def count_movies(self) -> int:
        """Count total movies in database."""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT COUNT(*) FROM movies") as cursor:
                row = await cursor.fetchone()
                return row[0] if row else 0

    async def count_total_views(self) -> int:
        """Sum total movie views."""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("SELECT SUM(views) FROM movies") as cursor:
                row = await cursor.fetchone()
                return row[0] if row and row[0] else 0

    async def get_latest_movies(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get latest added movies."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM movies ORDER BY id DESC LIMIT ?", (limit,)
            ) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    async def get_top_movies(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get most viewed movies."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM movies ORDER BY views DESC, id DESC LIMIT ?", (limit,)
            ) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

    async def get_categories(self) -> List[str]:
        """Get list of unique movie genres."""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute(
                "SELECT DISTINCT genre FROM movies WHERE genre IS NOT NULL AND genre != ''"
            ) as cursor:
                rows = await cursor.fetchall()
                return [row[0] for row in rows]

    async def get_movies_by_category(self, genre: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get movies by specific category/genre."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM movies WHERE LOWER(genre) = LOWER(?) ORDER BY id DESC LIMIT ?",
                (genre.strip(), limit),
            ) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
