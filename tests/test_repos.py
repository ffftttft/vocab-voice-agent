import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.agent_server.db.models import FSRSCard, Word  # noqa: E402
from src.agent_server.db.repos import (  # noqa: E402
    add_words_with_cards,
    count_cards_by_state,
    get_due_review_words,
    get_new_word_candidates,
    upcoming_due_counts,
)
from src.agent_server.db.session import build_engine, init_db, make_session_factory  # noqa: E402
from src.agent_server.services.fsrs_service import apply_rating  # noqa: E402


@pytest.fixture
async def session(tmp_path):
    db = tmp_path / "test.db"
    engine = build_engine(f"sqlite+aiosqlite:///{db}")
    await init_db(engine)
    factory = make_session_factory(engine)
    async with factory() as s:
        yield s
    await engine.dispose()


def _entries(n: int, prefix: str = "w") -> list[dict]:
    return [
        {"word": f"{prefix}{i}", "phonetic_us": f"/{prefix}{i}/", "pos_defs": [{"pos": "v.", "def": f"释义{i}"}]}
        for i in range(n)
    ]


class TestWordImport:
    async def test_import_creates_word_and_card_pair(self, session):
        words, skipped = await add_words_with_cards(session, _entries(3), "Core_3000")
        await session.commit()
        assert len(words) == 3
        assert skipped == 0
        assert all(w.id for w in words)

        from sqlalchemy import func, select

        card_count = await session.scalar(select(func.count()).select_from(FSRSCard))
        assert card_count == 3

    async def test_duplicate_words_skipped(self, session):
        await add_words_with_cards(session, _entries(2), "Core_3000")
        await session.commit()
        words, skipped = await add_words_with_cards(session, _entries(2), "Core_3000")
        await session.commit()
        assert len(words) == 0
        assert skipped == 2

    async def test_imported_card_is_new(self, session):
        words, _ = await add_words_with_cards(session, _entries(1), "Core_3000")
        await session.commit()
        card = await session.get(FSRSCard, words[0].id)
        assert card.stability is None
        assert card.state == 1


class TestNewWordSelection:
    async def test_new_candidates_returns_unreviewed_words(self, session):
        await add_words_with_cards(session, _entries(5), "Core_3000")
        await session.commit()
        candidates = await get_new_word_candidates(session, 10)
        assert len(candidates) == 5

    async def test_reviewed_word_leaves_new_pool(self, session):
        """核心回归：SPEC 的 state==0 会漏掉这里的新词判定。"""
        words, _ = await add_words_with_cards(session, _entries(3), "Core_3000")
        await session.commit()

        card = await session.get(FSRSCard, words[0].id)
        snap, fields = apply_rating(None, 3)
        for key in ("state", "step", "stability", "difficulty", "due", "last_review", "fsrs_card_json"):
            setattr(card, key, fields[key])
        card.reps = 1
        await session.commit()

        candidates = await get_new_word_candidates(session, 10)
        assert len(candidates) == 2
        assert words[0].word not in [c[0].word for c in candidates]

    async def test_new_pool_empty_when_nothing_imported(self, session):
        assert await get_new_word_candidates(session, 10) == []


class TestDueReviewSelection:
    async def test_due_card_selected_due_to_past_due_date(self, session):
        words, _ = await add_words_with_cards(session, _entries(1), "Core_3000")
        await session.commit()

        card = await session.get(FSRSCard, words[0].id)
        card.stability = 2.5
        card.difficulty = 5.0
        card.state = 2
        card.last_review = None
        card.due = __import__("datetime").datetime.now(__import__("datetime").timezone.utc) - timedelta(days=1)
        await session.commit()

        due = await get_due_review_words(session, 10)
        assert len(due) == 1
        assert due[0][0].word == words[0].word

    async def test_new_card_never_counts_as_due_review(self, session):
        await add_words_with_cards(session, _entries(3), "Core_3000")
        await session.commit()
        assert await get_due_review_words(session, 10) == []


class TestStats:
    async def test_counts_split_new_and_total(self, session):
        await add_words_with_cards(session, _entries(4), "Core_3000")
        await session.commit()
        stats = await count_cards_by_state(session)
        assert stats["total"] == 4
        assert stats["new"] == 4
        assert stats["due"] == 0

    async def test_upcoming_due_counts_has_fixed_length(self, session):
        await add_words_with_cards(session, _entries(2), "Core_3000")
        await session.commit()
        buckets = await upcoming_due_counts(session, days=7)
        assert len(buckets) == 7
        assert all("count" in b for b in buckets)


class TestWalMode:
    async def test_sqlite_uses_wal(self, session):
        from sqlalchemy import text

        mode = await session.scalar(text("PRAGMA journal_mode"))
        assert str(mode).lower() == "wal"
