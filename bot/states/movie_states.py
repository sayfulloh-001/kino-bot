from aiogram.fsm.state import State, StatesGroup


class AddMovieStates(StatesGroup):
    """FSM States for adding a new movie (10 steps)."""
    waiting_for_video = State()
    waiting_for_title = State()
    waiting_for_code = State()
    waiting_for_year = State()
    waiting_for_genre = State()
    waiting_for_country = State()
    waiting_for_duration = State()
    waiting_for_description = State()
    waiting_for_poster = State()
    waiting_for_confirmation = State()


class DeleteMovieStates(StatesGroup):
    """FSM States for deleting a movie by code."""
    waiting_for_code = State()


class BroadcastStates(StatesGroup):
    """FSM States for broadcasting advertisement to users."""
    waiting_for_content = State()
    waiting_for_confirmation = State()
