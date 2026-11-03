import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.agent_server.config import StudyPlanConfig  # noqa: E402
from src.agent_server.db.models import (  # noqa: E402
    ITEM_NEW,
    ITEM_REVIEW,
    PLAN_STUDYING,
    DailyPlanItem,
    FSRSCard,
    Word,
)
from src.agent_server.db.repos import add_words_with_cards, get_or_create_plan  # noqa: E402
from src.agent_server.db.session import build_engine, init_db, make_session_factory  # noqa: E402
from src.agent_server.harness.daily_planner import (  # noqa: E402
    DailyPlanner,
    ScenarioSelection,
    WordCard,
    _is_valid_card,
)
from src.agent_server.services.memory_store import MemoryStore  # noqa: E402
from tests.fakes import FakeTextLLM, FakeTTS  # noqa: E402

TODAY = date(2026, 11, 3)


@pytest.fixture
async def session(tmp_path):
    engine = build_engine(f"sqlite+aiosqlite:///{tmp_path / 'p.db'}")
    await init_db(engine)
    factory = make_session_factory(engine)
    async with factory() as s:
        yield s
    await engine.dispose()


@pytest.fixture
def memory(tmp_path: Path) -> MemoryStore:
    m = MemoryStore(tmp_path / "memory")
    m.ensure_initialized()
    return m


@pytest.fixture
def planner(memory: MemoryStore, tmp_path: Path):
    def _make(**overrides):
        cfg = StudyPlanConfig(
            daily_new_words=overrides.get("daily_new_words", 5),
            daily_review_limit=overrides.get("daily_review_limit", 10),
            voice_target_words_count=overrides.get("voice_target_words_count", 3),
        )
        return DailyPlanner(
            llm=FakeTextLLM(),
            tts=FakeTTS(tmp_path / "audio"),
            memory=memory,
            study_plan=cfg,
            batch_size=overrides.get("batch_size", 15),
        )

    return _make


async def _seed(session, n: int, tags: list[str] | None = None, prefix: str = "word") -> list[Word]:
    entries = [
        {
            "word": f"{prefix}{i}",
            "phonetic_us": f"/{prefix}{i}/",
            "pos_defs": [{"pos": "v.", "def": f"释义{i}"}],
            "topic_tags": tags or ["tech_dev"],
        }
        for i in range(n)
    ]
    words, _ = await add_words_with_cards(session, entries, "Test")
    await session.commit()
    return words


class TestHourlyPlanGeneration:
    async def test_generates_new_and_review_items(self, session, planner) -> None:
        await _seed(session, 8, prefix="new")
        # 造 2 张已复习、已到期的卡
        await _seed(session, 2, prefix="rev")
        from sqlalchemy import select

        from src.agent_server.db.models import utcnow

        rows = await session.execute(select(Word).where(Word.word.like("rev%")))
        for w in rows.scalars():
            card = await session.get(FSRSCard, w.id)
            card.stability = 2.0
            card.difficulty = 5.0
            card.state = 2
            card.due = utcnow().replace(year=2020)
            card.last_review = utcnow().replace(year=2019)
        await session.commit()

        p = planner()
        result = await p.generate_plan(session, TODAY)

        assert result.new_count > 0
        assert result.review_count == 2
        assert result.scenario_title

        from sqlalchemy import func, select

        new_items = await session.scalar(
            select(func.count())
            .select_from(DailyPlanItem)
            .where(DailyPlanItem.plan_date == TODAY, DailyPlanItem.item_type == ITEM_NEW)
        )
        review_items = await session.scalar(
            select(func.count())
            .select_from(DailyPlanItem)
            .where(DailyPlanItem.plan_date == TODAY, DailyPlanItem.item_type == ITEM_REVIEW)
        )
        assert new_items > 0
        assert review_items == 2

    async def test_plan_status_becomes_studying(self, session, planner) -> None:
        await _seed(session, 5)
        await planner().generate_plan(session, TODAY)
        plan = await get_or_create_plan(session, TODAY)
        assert plan.status == PLAN_STUDYING

    async def test_scenario_persisted(self, session, planner) -> None:
        await _seed(session, 5)
        await planner().generate_plan(session, TODAY)
        plan = await get_or_create_plan(session, TODAY)
        assert plan.scenario_title == "线上故障排查"
        assert "排查" in plan.scenario_brief

    async def test_items_have_sentence_and_options(self, session, planner) -> None:
        await _seed(session, 5)
        await planner().generate_plan(session, TODAY)
        from sqlalchemy import select

        items = (
            (await session.execute(select(DailyPlanItem).where(DailyPlanItem.plan_date == TODAY)))
            .scalars()
            .all()
        )
        assert items
        for item in items:
            assert item.custom_sentence_en
            assert item.custom_sentence_zh
            assert len(item.mcq_options) == 4
            assert sum(1 for o in item.mcq_options if o["is_correct"]) == 1

    async def test_regeneration_is_idempotent(self, session, planner) -> None:
        """同一天重复生成不应产生重复条目。"""
        await _seed(session, 5)
        p = planner()
        await p.generate_plan(session, TODAY)
        from sqlalchemy import func, select

        first = await session.scalar(
            select(func.count()).select_from(DailyPlanItem).where(DailyPlanItem.plan_date == TODAY)
        )
        await p.generate_plan(session, TODAY)
        second = await session.scalar(
            select(func.count()).select_from(DailyPlanItem).where(DailyPlanItem.plan_date == TODAY)
        )
        assert first == second

    async def test_empty_wordbook_yields_no_new_words(self, session, planner) -> None:
        result = await planner().generate_plan(session, TODAY)
        assert result.new_count == 0
        assert result.warnings
        assert "导入词书" in result.warnings[0]

    async def test_voice_targets_capped_by_config(self, session, planner) -> None:
        await _seed(session, 10)
        p = planner(daily_new_words=8, voice_target_words_count=3)
        result = await p.generate_plan(session, TODAY)
        assert result.voice_target_count == 3

    async def test_audio_warmed(self, session, planner) -> None:
        await _seed(session, 5)
        p = planner()
        result = await p.generate_plan(session, TODAY)
        assert result.audio_ready > 0
        assert p.tts.calls

    async def test_audio_can_be_skipped(self, session, planner) -> None:
        await _seed(session, 5)
        p = planner()
        result = await p.generate_plan(session, TODAY, warm_audio=False)
        assert result.audio_ready == 0
        assert p.tts.calls == []


class TestScenarioSelection:
    async def test_llm_receives_user_profile(self, session, planner) -> None:
        await _seed(session, 5)
        p = planner()
        await p.generate_plan(session, TODAY)
        scenario_call = next(
            c for c in p.llm.structured_calls if c["response_model"] == "ScenarioSelection"
        )
        assert "程序员" in scenario_call["system_prompt"]

    async def test_llm_receives_candidate_words(self, session, planner) -> None:
        await _seed(session, 5)
        p = planner()
        await p.generate_plan(session, TODAY)
        scenario_call = next(
            c for c in p.llm.structured_calls if c["response_model"] == "ScenarioSelection"
        )
        assert "word0" in scenario_call["user_prompt"]

    async def test_invented_words_are_dropped(self, session, planner) -> None:
        """模型自创的词必须被丢弃，不能落库。"""
        await _seed(session, 3)
        p = planner()
        p.llm.scenario_response = {
            "scenario_title": "测试场景",
            "scenario_brief": "描述",
            "selected_words": [
                {"word": "word0", "reason": "ok"},
                {"word": "NOT_IN_DB", "reason": "模型幻觉"},
            ],
            "voice_candidates": ["NOT_IN_DB"],
        }
        result = await p.generate_plan(session, TODAY, warm_audio=False)
        assert result.new_count == 1


class TestValidation:
    def _card(self, **kw) -> WordCard:
        base = {
            "word": "deploy",
            "sentence_en": "We need to deploy the new service before the release.",
            "sentence_zh": "我们需要在发布前部署新服务。",
            "target_pos": "v.",
            "options": [
                {"label": "A", "pos": "v.", "text": "部署", "is_correct": True},
                {"label": "B", "pos": "v.", "text": "撤回", "is_correct": False},
                {"label": "C", "pos": "v.", "text": "扩展", "is_correct": False},
                {"label": "D", "pos": "v.", "text": "压缩", "is_correct": False},
            ],
            "is_voice_target": True,
        }
        base.update(kw)
        return WordCard.model_validate(base)

    def test_valid_card_passes(self) -> None:
        assert _is_valid_card(self._card())

    def test_too_short_sentence_rejected(self) -> None:
        assert not _is_valid_card(self._card(sentence_en="Deploy it."))

    def test_too_long_sentence_rejected(self) -> None:
        assert not _is_valid_card(self._card(sentence_en=" ".join(["word"] * 40)))

    def test_wrong_option_count_rejected(self) -> None:
        assert not _is_valid_card(self._card(options=self._card().options[:3]))

    def test_missing_correct_option_rejected(self) -> None:
        opts = [o.model_copy(update={"is_correct": False}) for o in self._card().options]
        assert not _is_valid_card(
            self._card(
                options=opts,
            )
        )

    def test_two_correct_options_rejected(self) -> None:
        opts = [o.model_copy(update={"is_correct": True}) for o in self._card().options]
        assert not _is_valid_card(self._card(options=opts))

    def test_inconsistent_pos_rejected(self) -> None:
        """SPEC 要求 4 个选项词性完全一致。"""
        opts = [o.model_copy() for o in self._card().options]
        opts[1] = opts[1].model_copy(update={"pos": "n."})
        assert not _is_valid_card(self._card(options=opts))

    def test_wrong_labels_rejected(self) -> None:
        labels = "ABCD"
        opts = [
            o.model_copy(update={"label": lbl})
            for o, lbl in zip(self._card().options, labels, strict=True)
        ]
        opts[0] = opts[0].model_copy(update={"label": "X"})
        assert not _is_valid_card(self._card(options=opts))

    def test_empty_sentence_rejected(self) -> None:
        assert not _is_valid_card(self._card(sentence_en="   "))


class TestGracefulDegradation:
    async def test_llm_failure_on_cards_does_not_crash(self, session, planner) -> None:
        """LLM 批次失败时应降级而非让整个计划生成崩掉。"""
        await _seed(session, 5)
        p = planner()
        p.llm.fail_cards = True
        result = await p.generate_plan(session, TODAY, warm_audio=False)
        assert result.new_count > 0  # 选词成功
        from sqlalchemy import func, select

        count = await session.scalar(select(func.count()).select_from(DailyPlanItem))
        assert count == 0  # 但卡片全丢，不落库坏数据


class TestScenarioSelectionModel:
    def test_defaults_are_safe(self) -> None:
        s = ScenarioSelection(scenario_title="t", scenario_brief="b")
        assert s.selected_words == []
        assert s.voice_candidates == []
