from .start import start_router
from .user import user_router
from .movie import movie_router
from .admin import admin_router

__all__ = ["start_router", "user_router", "movie_router", "admin_router"]
