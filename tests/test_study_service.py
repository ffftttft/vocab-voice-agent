import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.agent_server.db.models import (  # noqa: E402
    VOICE_FAILED,
    VOICE_USED_PROACTIVELY,
    VOICE_USED_WITH_HINT,
    DailyPlanItem,
    FSRSCard,
)
from src.agent_server.db.repos import add_words_with_cards, get_or_create_plan  # noqa: E402
from src.agent_server.db.session import build_engine, init_db, make_session_factory  # noqa: E402
from src.agent_server.services.study_service import (  # noqa: E402
    StudyError,
    daily_voice_targets,
    get_study_queue,
    mark_hint_requested,
    mark_word_used,
    progress,
    stats_snapshot,
    submit_rating,
)

TODAY = date(2026, 11, 3)


@pytest.fixture
async def session(tmp_path):
    engine = build_engine(f"sqlite+aiosqlite:///{tmp_path / 's.db'}")
    await init_db(engine)
    factory = make_session_factory(engine)
    async with factory() as s:
        yield s
    await engine.dispose()


async def _make_plan(session, n: int = 3, voice_targets: int = 2) -> list[int]:
    """造一个今日计划，返回 word_id 列表。"""
    entries = [
        {
            "word": f"term{i}",
            "phonetic_us": f"/term{i}/",
            "pos_defs": [{"pos": "v.", "def": f"释义{i}"}],
            "topic_tags": ["tech_dev"],
        }
        for i in range(n)
    ]
    words, _ = await add_words_with_cards(session, entries, "Test")
    await session.commit()

    plan = await get_or_create_plan(session, TODAY)
    plan.scenario_title = "测试场景"
    plan.status = "STUDYING"

    for i, w in enumerate(words):
        session.add(
            DailyPlanItem(
                plan_date=TODAY,
                word_id=w.id,
                item_type="NEW",
                custom_sentence_en=f"We should {w.word} it now.",
                custom_sentence_zh="我们现在应该这么做。",
                mcq_options=[
                    {"label": "A", "pos": "v.", "text": "正确释义", "is_correct": True},
                    {"label": "B", "pos": "v.", "text": "干扰1", "is_correct": False},
                    {"label": "C", "pos": "v.", "text": "干扰2", "is_correct": False},
                    {"label": "D", "pos": "v.", "text": "干扰3", "is_correct": False},
                ],
                is_voice_target=i < voice_targets,
                order_index=i,
            )
        )
    await session.commit()
    return [w.id for w in words]


class TestStudyQueue:
    async def test_returns_pending_cards(self, session) -> None:
        await _make_plan(session, 3)
        queue = await get_study_queue(session, TODAY)
        assert len(queue) == 3

    async def test_does_not_leak_correct_answer(self, session) -> None:
        """出题态绝不能告诉前端哪个选项是对的。"""
        await _make_plan(session, 1)
        queue = await get_study_queue(session, TODAY)
        for opt in queue[0].options:
            assert "is_correct" not in opt

    async def test_done_cards_excluded_by_default(self, session) -> None:
        ids = await _make_plan(session, 2)
        await submit_rating(session, TODAY, ids[0], "A", 1000)
        assert len(await get_study_queue(session, TODAY)) == 1
        assert len(await get_study_queue(session, TODAY, include_done=True)) == 2

    async def test_requeued_cards_sink_to_bottom(self, session) -> None:
        """答错的词必须排到队尾（SPEC 5.2）。"""
        ids = await _make_plan(session, 3)
        await submit_rating(session, TODAY, ids[0], "B", 1000)  # 答错
        queue = await get_study_queue(session, TODAY)
        assert queue[-1].word_id == ids[0]


class TestSubmitRating:
    async def test_correct_fast_answer_maps_easy(self, session) -> None:
        ids = await _make_plan(session, 1)
        r = await submit_rating(session, TODAY, ids[0], "A", 1200)
        assert r["is_correct"] is True
        assert r["rating"] == 4

    async def test_correct_medium_answer_maps_good(self, session) -> None:
        ids = await _make_plan(session, 1)
        r = await submit_rating(session, TODAY, ids[0], "A", 5000)
        assert r["rating"] == 3

    async def test_correct_slow_answer_maps_hard(self, session) -> None:
        ids = await _make_plan(session, 1)
        r = await submit_rating(session, TODAY, ids[0], "A", 12000)
        assert r["rating"] == 2

    async def test_wrong_answer_locks_again(self, session) -> None:
        ids = await _make_plan(session, 1)
        r = await submit_rating(session, TODAY, ids[0], "C", 500)
        assert r["is_correct"] is False
        assert r["rating"] == 1
        assert r["requeued"] is True

    async def test_wrong_answer_cannot_be_overridden(self, session) -> None:
        """答错时用户不能手动把评级改成 Easy。"""
        ids = await _make_plan(session, 1)
        r = await submit_rating(session, TODAY, ids[0], "D", 500, manual_rating=4)
        assert r["rating"] == 1

    async def test_manual_rating_overrides_auto(self, session) -> None:
        ids = await _make_plan(session, 1)
        r = await submit_rating(session, TODAY, ids[0], "A", 500, manual_rating=2)
        assert r["rating"] == 2
        assert r["rating_source"] == "manual"

    async def test_invalid_manual_rating_rejected(self, session) -> None:
        ids = await _make_plan(session, 1)
        with pytest.raises(StudyError, match="manual_rating"):
            await submit_rating(session, TODAY, ids[0], "A", 500, manual_rating=9)

    async def test_unknown_word_rejected(self, session) -> None:
        await _make_plan(session, 1)
        with pytest.raises(StudyError, match="没有 word_id"):
            await submit_rating(session, TODAY, 99999, "A", 500)

    async def test_returns_correct_labels_after_answer(self, session) -> None:
        ids = await _make_plan(session, 1)
        r = await submit_rating(session, TODAY, ids[0], "B", 500)
        assert r["correct_labels"] == ["A"]

    async def test_requeue_count_increments(self, session) -> None:
        ids = await _make_plan(session, 1)
        await submit_rating(session, TODAY, ids[0], "B", 500)
        r = await submit_rating(session, TODAY, ids[0], "C", 500)
        assert r["requeue_count"] == 2

    async def test_correct_after_requeue_completes_card(self, session) -> None:
        ids = await _make_plan(session, 1)
        await submit_rating(session, TODAY, ids[0], "B", 500)
        r = await submit_rating(session, TODAY, ids[0], "A", 500)
        assert r["is_correct"] is True
        assert r["requeued"] is False
        item = await session.get(
            DailyPlanItem,
            (
                await session.execute(
                    __import__("sqlalchemy")
                    .select(DailyPlanItem)
                    .where(DailyPlanItem.plan_date == TODAY, DailyPlanItem.word_id == ids[0])
                )
            )
            .scalar_one()
            .id,
        )
        assert item.card_done is True


class TestFsrsIntegration:
    async def test_card_updated_after_review(self, session) -> None:
        ids = await _make_plan(session, 1)
        card_before = await session.get(FSRSCard, ids[0])
        assert card_before.stability is None

        await submit_rating(session, TODAY, ids[0], "A", 1000)
        card = await session.get(FSRSCard, ids[0])
        assert card.stability is not None
        assert card.reps == 1

    async def test_lapses_increment_on_repeated_wrong(self, session) -> None:
        ids = await _make_plan(session, 1)
        await submit_rating(session, TODAY, ids[0], "A", 1000)  # reps=1
        await submit_rating(session, TODAY, ids[0], "B", 1000)  # 错，reps=2 → lapses+1
        card = await session.get(FSRSCard, ids[0])
        assert card.reps == 2
        assert card.lapses == 1

    async def test_tz_aware_due(self, session) -> None:
        ids = await _make_plan(session, 1)
        r = await submit_rating(session, TODAY, ids[0], "A", 1000)
        assert r["next_due"] is not None


class TestProgress:
    async def test_progress_counts(self, session) -> None:
        ids = await _make_plan(session, 3)
        p0 = await progress(session, TODAY)
        assert p0["total"] == 3
        assert p0["done"] == 0

        await submit_rating(session, TODAY, ids[0], "A", 1000)
        p1 = await progress(session, TODAY)
        assert p1["done"] == 1
        assert p1["remaining"] == 2

    async def test_all_done_flag(self, session) -> None:
        ids = await _make_plan(session, 2)
        for wid in ids:
            await submit_rating(session, TODAY, wid, "A", 1000)
        p = await progress(session, TODAY)
        assert p["all_done"] is True

    async def test_plan_status_advances_when_complete(self, session) -> None:
        """全部背完 → 解锁语音实战（VOICE_READY）。"""
        ids = await _make_plan(session, 2)
        for wid in ids:
            await submit_rating(session, TODAY, wid, "A", 1000)
        plan = await get_or_create_plan(session, TODAY)
        assert plan.status == "VOICE_READY"

    async def test_status_not_advanced_while_incomplete(self, session) -> None:
        ids = await _make_plan(session, 2)
        await submit_rating(session, TODAY, ids[0], "A", 1000)
        plan = await get_or_create_plan(session, TODAY)
        assert plan.status == "STUDYING"


class TestVoiceIntegration:
    async def test_voice_targets_listed(self, session) -> None:
        await _make_plan(session, 4, voice_targets=2)
        targets = await daily_voice_targets(session, TODAY)
        assert len(targets) == 2
        assert all("word" in t for t in targets)

    async def test_mark_used_correctly_awards_easy(self, session) -> None:
        await _make_plan(session, 2, voice_targets=2)
        targets = await daily_voice_targets(session, TODAY)
        r = await mark_word_used(session, TODAY, targets[0]["word"], True)
        assert r["status"] == VOICE_USED_PROACTIVELY
        assert r["fsrs_applied"] is True

    async def test_mark_used_after_hint_does_not_award(self, session) -> None:
        """点过提示的词用对了，不算主动掌握（SPEC 5.3 Tool 1）。"""
        await _make_plan(session, 2, voice_targets=2)
        targets = await daily_voice_targets(session, TODAY)
        await mark_hint_requested(session, TODAY, [targets[0]["word"]])
        r = await mark_word_used(session, TODAY, targets[0]["word"], True)
        assert r["status"] == VOICE_USED_WITH_HINT
        assert r["fsrs_applied"] is False

    async def test_mark_used_incorrectly_marks_failed(self, session) -> None:
        await _make_plan(session, 1, voice_targets=1)
        targets = await daily_voice_targets(session, TODAY)
        r = await mark_word_used(session, TODAY, targets[0]["word"], False)
        assert r["status"] == VOICE_FAILED

    async def test_mark_unknown_word_returns_not_found(self, session) -> None:
        await _make_plan(session, 1)
        r = await mark_word_used(session, TODAY, "nonexistent", True)
        assert r["found"] is False

    async def test_hint_marks_words(self, session) -> None:
        await _make_plan(session, 2, voice_targets=2)
        targets = await daily_voice_targets(session, TODAY)
        n = await mark_hint_requested(session, TODAY, [t["word"] for t in targets])
        assert n == 2

    async def test_hint_marking_is_idempotent(self, session) -> None:
        await _make_plan(session, 1, voice_targets=1)
        targets = await daily_voice_targets(session, TODAY)
        assert await mark_hint_requested(session, TODAY, [targets[0]["word"]]) == 1
        assert await mark_hint_requested(session, TODAY, [targets[0]["word"]]) == 0


class TestStats:
    async def test_snapshot_has_upcoming(self, session) -> None:
        await _make_plan(session, 2)
        snap = await stats_snapshot(session)
        assert "upcoming" in snap
        assert len(snap["upcoming"]) == 7
