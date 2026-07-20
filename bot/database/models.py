from dataclasses import dataclass
from typing import Optional


@dataclass
class User:
    id: int
    telegram_id: int
    fullname: Optional[str]
    username: Optional[str]
    created_at: str


@dataclass
class Movie:
    id: int
    code: str
    title: str
    year: Optional[str]
    genre: Optional[str]
    country: Optional[str]
    duration: Optional[str]
    description: Optional[str]
    poster: Optional[str]
    file_id: str
    views: int
    created_at: str
