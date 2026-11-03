import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.agent_server.db.models import (  # noqa: E402
    MISTAKE_GRAMMAR,
    MISTAKE_PRONUNCIATION,
    LinguisticMistake,
    VoiceSession,
)
from src.agent_server.db.session import build_engine, init_db, make_session_factory  # noqa: E402
from src.agent_server.harness.hint_streamer import HintStreamer, parse_hint  # noqa: E402
from src.agent_server.harness.memory_compactor import (  # noqa: E402
    MemoryCompactor,
    _extract_section,
    _format_mistakes,
    _format_transcripts,
)
from src.agent_server.services.memory_store import MemoryStore  # noqa: E402
from tests.fakes import FakeTextLLM  # noqa: E402

TODAY = date(2026, 11, 3)


@pytest.fixture
async def session(tmp_path):
    engine = build_engine(f"sqlite+aiosqlite:///{tmp_path / 'm.db'}")
    await init_db(engine)
    factory = make_session_factory(engine)
    async with factory() as s:
        yield s
    await engine.dispose()


@pytest.fixture
def memory(tmp_path: Path) -> MemoryStore:
    """与生产一致：从 data/memory/ 的模板初始化。"""
    md = tmp_path / "memory"
    md.mkdir(parents=True, exist_ok=True)
    template_dir = Path(__file__).resolve().parents[1] / "data" / "memory"
    for name in ("user_profile.example.md", "error_patterns.example.md"):
        src = template_dir / name
        if src.exists():
            (md / name).write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    m = MemoryStore(md)
    m.ensure_initialized()
    return m


def _compactor(memory: MemoryStore, llm: FakeTextLLM | None = None) -> MemoryCompactor:
    return MemoryCompactor(llm or FakeTextLLM(), memory)


class _CompactionLLM(FakeTextLLM):
    def __init__(self, payload: dict) -> None:
        super().__init__()
        self.payload = payload

    async def generate_structured(
        self, system_prompt, user_prompt, response_model, temperature=None
    ):
        self.structured_calls.append({"system_prompt": system_prompt, "user_prompt": user_prompt})
        return response_model.model_validate(self.payload)


async def _seed_session(db, transcript: list[dict] | None = None) -> VoiceSession:
    vs = VoiceSession(plan_date=TODAY, transcript_json=transcript)
    db.add(vs)
    await db.commit()
    await db.refresh(vs)
    return vs


class TestTranscriptFormatting:
    def test_formats_roles(self) -> None:
        vs = VoiceSession(
            plan_date=TODAY,
            transcript_json=[
                {"role": "assistant", "text": "How are you?"},
                {"role": "user", "text": "I am fine."},
            ],
        )
        out = _format_transcripts([vs])
        assert "AI: How are you?" in out
        assert "用户: I am fine." in out

    def test_skips_empty_sessions(self) -> None:
        vs = VoiceSession(plan_date=TODAY, transcript_json=None)
        assert _format_transcripts([vs]) == ""

    def test_skips_empty_text(self) -> None:
        vs = VoiceSession(plan_date=TODAY, transcript_json=[{"role": "user", "text": "  "}])
        assert _format_transcripts([vs]) == ""


class TestMistakeFormatting:
    def test_formats_with_label(self) -> None:
        m = LinguisticMistake(
            plan_date=TODAY,
            mistake_type=MISTAKE_GRAMMAR,
            user_original="I go yesterday",
            corrected_version="I went yesterday",
            explanation="过去时",
        )
        out = _format_mistakes([m])
        assert "语法" in out
        assert "I go yesterday" in out
        assert "过去时" in out


class TestExtractSection:
    def test_extracts_section_body(self) -> None:
        content = "# 画像\n\n## 近期动态\n\n- 事件A\n- 事件B\n\n## 其他\n\n内容\n"
        body = _extract_section(content, "## 近期动态")
        assert "事件A" in body
        assert "其他" not in body

    def test_missing_section_returns_placeholder(self) -> None:
        assert _extract_section("# 空\n", "## 近期动态") == "（无）"


class TestCompaction:
    async def test_no_data_skips(self, session, memory) -> None:
        result = await _compactor(memory).compact(session, TODAY)
        assert result["skipped"] is True
        assert "无对话记录" in result["reason"]

    async def test_appends_profile_events(self, session, memory) -> None:
        await _seed_session(session, [{"role": "user", "text": "I will launch a payment service"}])
        llm = _CompactionLLM(
            {
                "new_profile_events": ["下周要上线一个新的支付微服务"],
                "pronunciation_patterns": [],
                "grammar_patterns": [],
            }
        )
        result = await _compactor(memory, llm).compact(session, TODAY)
        assert result["profile_events_added"] == 1
        assert "下周要上线一个新的支付微服务" in memory.read_profile()

    async def test_appends_error_patterns(self, session, memory) -> None:
        await _seed_session(session, [{"role": "user", "text": "I go there yesterday"}])
        llm = _CompactionLLM(
            {
                "new_profile_events": [],
                "pronunciation_patterns": ["deprecate 重音应在第一音节"],
                "grammar_patterns": ["过去时标记缺失"],
            }
        )
        result = await _compactor(memory, llm).compact(session, TODAY)
        assert result["pronunciation_added"] == 1
        assert result["grammar_added"] == 1
        errors = memory.read_errors()
        assert "deprecate 重音应在第一音节" in errors
        assert "过去时标记缺失" in errors

    async def test_clears_transcript(self, session, memory) -> None:
        vs = await _seed_session(session, [{"role": "user", "text": "hello"}])
        llm = _CompactionLLM(
            {"new_profile_events": [], "pronunciation_patterns": [], "grammar_patterns": []}
        )
        result = await _compactor(memory, llm).compact(session, TODAY)
        assert result["transcripts_cleared"] == 1

        await session.refresh(vs)
        assert vs.transcript_json is None

    async def test_can_keep_transcript(self, session, memory) -> None:
        vs = await _seed_session(session, [{"role": "user", "text": "hello"}])
        llm = _CompactionLLM(
            {"new_profile_events": [], "pronunciation_patterns": [], "grammar_patterns": []}
        )
        await _compactor(memory, llm).compact(session, TODAY, clear_transcript=False)
        await session.refresh(vs)
        assert vs.transcript_json is not None

    async def test_llm_receives_existing_memory(self, session, memory) -> None:
        """必须把现有记忆喂给模型，否则会重复追加相同内容。"""
        memory.append_recent_events(["已有事件"], TODAY)
        await _seed_session(session, [{"role": "user", "text": "hello"}])
        llm = _CompactionLLM(
            {"new_profile_events": [], "pronunciation_patterns": [], "grammar_patterns": []}
        )
        await _compactor(memory, llm).compact(session, TODAY)
        prompt = llm.structured_calls[0]["user_prompt"]
        assert "已有事件" in prompt

    async def test_deduplicates_existing_events(self, session, memory) -> None:
        memory.append_recent_events(["下周要上线支付微服务"], TODAY)
        await _seed_session(session, [{"role": "user", "text": "x"}])
        llm = _CompactionLLM(
            {
                "new_profile_events": ["下周要上线支付微服务"],
                "pronunciation_patterns": [],
                "grammar_patterns": [],
            }
        )
        result = await _compactor(memory, llm).compact(session, TODAY)
        assert result["profile_events_added"] == 0

    async def test_mistakes_also_trigger_compaction(self, session, memory) -> None:
        """即使没有转写，有错误记录也要提炼。"""
        session.add(
            LinguisticMistake(
                plan_date=TODAY,
                mistake_type=MISTAKE_PRONUNCIATION,
                user_original="dep-recate",
                corrected_version="ˈdeprəkeɪt",
                explanation="重音",
            )
        )
        await session.commit()
        llm = _CompactionLLM(
            {
                "new_profile_events": [],
                "pronunciation_patterns": ["deprecate 重音"],
                "grammar_patterns": [],
            }
        )
        result = await _compactor(memory, llm).compact(session, TODAY)
        assert result["skipped"] is False
        assert result["pronunciation_added"] == 1


class TestHintStreamer:
    async def test_streams_sse_chunks(self, memory) -> None:
        streamer = HintStreamer(FakeTextLLM(), memory)
        events = [e async for e in streamer.stream(["deploy"], [])]
        assert all(e.startswith("data: ") for e in events)
        assert any('"type": "hint"' in e for e in events)
        assert any('"type": "done"' in e for e in events)

    async def test_done_event_contains_parsed_en_zh(self, memory) -> None:
        streamer = HintStreamer(FakeTextLLM(), memory)
        events = [e async for e in streamer.stream(["deploy"], [])]
        done = next(e for e in events if '"type": "done"' in e)
        assert "deprecated" in done
        assert "我昨天弃用了它" in done

    async def test_prompt_includes_target_words(self, memory) -> None:
        llm = FakeTextLLM()
        streamer = HintStreamer(llm, memory)
        [e async for e in streamer.stream(["deploy", "refactor"], [])]
        assert "deploy" in llm.stream_calls[0]["messages"][-1]["content"]

    async def test_prompt_includes_transcript(self, memory) -> None:
        llm = FakeTextLLM()
        streamer = HintStreamer(llm, memory)
        transcript = [{"role": "assistant", "text": "What did you do today?"}]
        [e async for e in streamer.stream(["deploy"], transcript)]
        messages = llm.stream_calls[0]["messages"]
        assert any("What did you do today?" in m["content"] for m in messages)

    async def test_prompt_includes_user_profile(self, memory) -> None:
        llm = FakeTextLLM()
        streamer = HintStreamer(llm, memory)
        [e async for e in streamer.stream(["deploy"], [])]
        assert "程序员" in llm.stream_calls[0]["system_prompt"]


class TestParseHint:
    def test_parses_both_lines(self) -> None:
        en, zh = parse_hint("EN: I deployed it.\nZH: 我部署了它。")
        assert en == "I deployed it."
        assert zh == "我部署了它。"

    def test_strips_code_fence(self) -> None:
        en, zh = parse_hint("```\nEN: Hello\nZH: 你好\n```")
        assert en == "Hello"
        assert zh == "你好"

    def test_falls_back_to_plain_text(self) -> None:
        en, _zh = parse_hint("I deployed it yesterday.")
        assert en == "I deployed it yesterday."

    def test_handles_chinese_colon(self) -> None:
        en, zh = parse_hint("EN：Hello\nZH：你好")
        assert en == "Hello"

    def test_empty_input(self) -> None:
        en, zh = parse_hint("")
        assert en == ""
        assert zh == ""
