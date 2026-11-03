import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.agent_server.harness.voice_orchestrator import (  # noqa: E402
    TOOL_DEFINITIONS,
    SessionPhase,
    SessionState,
    TargetWord,
    VoiceOrchestrator,
)
from src.agent_server.providers.base import (  # noqa: E402
    AudioDeltaEvent,
    SpeechStartedEvent,
    ToolCallEvent,
    TranscriptDeltaEvent,
)
from tests.fakes import FakeRealtimeVoice  # noqa: E402

TODAY = date(2026, 11, 3)


def _state(n_targets: int = 6) -> SessionState:
    words = [
        TargetWord(word_id=i, word=f"word{i}", sentence_en=f"I {i} it.") for i in range(n_targets)
    ]
    return SessionState(
        session_id=1,
        plan_date=TODAY,
        scenario_title="线上故障排查",
        scenario_brief="服务报警了。",
        queue=list(words),
        target_seconds=600,
    )


def _orch(n_targets: int = 6, window: int = 4, events=None) -> VoiceOrchestrator:
    return VoiceOrchestrator(
        provider=FakeRealtimeVoice(events or []),
        session_state=_state(n_targets),
        memory_profile="程序员",
        error_patterns="时态混用",
        sliding_window_size=window,
    )


class TestSlidingWindow:
    async def test_window_filled_on_start(self) -> None:
        o = _orch(6, 4)
        await o.start()
        assert [t.word for t in o.state.active] == ["word0", "word1", "word2", "word3"]
        assert len(o.state.queue) == 2

    async def test_system_prompt_contains_only_active_words(self) -> None:
        """核心：12 个目标词不能全塞进 prompt，只注入窗口内的 4 个。"""
        o = _orch(12, 4)
        await o.start()
        prompt = o.provider.session_config.system_prompt
        for t in o.state.active:
            assert t.word in prompt
        for t in o.state.queue:
            assert t.word not in prompt

    async def test_window_smaller_than_targets(self) -> None:
        o = _orch(2, 4)
        await o.start()
        assert len(o.state.active) == 2
        assert o.state.queue == []

    async def test_empty_targets_ok(self) -> None:
        o = _orch(0, 4)
        await o.start()
        assert o.state.active == []
        assert "窗口已空" in o.provider.session_config.system_prompt

    async def test_retire_word_backfills_window(self) -> None:
        o = _orch(6, 4)
        await o.start()
        o._retire_word("word0")
        assert "word0" not in [t.word for t in o.state.active]
        assert len(o.state.active) == 4
        assert "word4" in [t.word for t in o.state.active]

    async def test_retire_unknown_word_noop(self) -> None:
        o = _orch(4, 4)
        await o.start()
        assert o._retire_word("nonexistent") is False
        assert len(o.state.active) == 4

    async def test_window_size_one(self) -> None:
        o = _orch(3, 1)
        await o.start()
        assert len(o.state.active) == 1


class TestToolCallMarkWordUsed:
    async def _run_tool(self, orch, name, args, call_id="c1"):
        events = [ToolCallEvent(call_id=call_id, name=name, arguments=args)]
        orch.provider._events = events
        return [e async for e in orch.iter_events()]

    async def test_correct_usage_retires_word(self) -> None:
        o = _orch(6, 4)
        await o.start()
        out = await self._run_tool(o, "mark_word_used", {"word": "word0", "used_correctly": True})
        assert out[0]["type"] == "server.word_used"
        assert out[0]["used_correctly"] is True
        assert "word0" in o.state.completed
        assert "word0" not in [t.word for t in o.state.active]

    async def test_incorrect_usage_marked_failed(self) -> None:
        o = _orch(6, 4)
        await o.start()
        out = await self._run_tool(o, "mark_word_used", {"word": "word1", "used_correctly": False})
        assert "word1" in o.state.failed
        assert out[0]["used_correctly"] is False

    async def test_tool_result_sent_back(self) -> None:
        o = _orch(6, 4)
        await o.start()
        await self._run_tool(o, "mark_word_used", {"word": "word0", "used_correctly": True})
        assert o.provider.tool_results
        assert o.provider.tool_results[0][0] == "c1"

    async def test_instructions_refreshed_after_retire(self) -> None:
        o = _orch(6, 4)
        await o.start()
        await self._run_tool(o, "mark_word_used", {"word": "word0", "used_correctly": True})
        assert len(o.provider.instruction_updates) == 1
        new_prompt = o.provider.instruction_updates[0]
        assert "word0" not in new_prompt
        assert "word4" in new_prompt

    async def test_word_outside_window_not_retired(self) -> None:
        o = _orch(6, 4)
        await o.start()
        out = await self._run_tool(o, "mark_word_used", {"word": "word5", "used_correctly": True})
        assert out[0]["in_window"] is False
        assert "word5" not in o.state.completed

    async def test_missing_word_rejected(self) -> None:
        o = _orch(4, 4)
        await o.start()
        out = await self._run_tool(o, "mark_word_used", {"used_correctly": True})
        assert out == []
        sent = o.provider.tool_results[0][1]
        assert "missing word" in sent

    async def test_emits_persist_hint(self) -> None:
        """必须把落库意图交给上层，编排器本身不碰数据库。"""
        o = _orch(6, 4)
        await o.start()
        out = await self._run_tool(o, "mark_word_used", {"word": "word0", "used_correctly": True})
        assert out[0]["_persist"]["kind"] == "mark_word_used"


class TestToolCallLogMistake:
    async def _run_tool(self, orch, name, args):
        orch.provider._events = [ToolCallEvent(call_id="c2", name=name, arguments=args)]
        return [e async for e in orch.iter_events()]

    async def test_grammar_mistake_emits_card(self) -> None:
        o = _orch(4, 4)
        await o.start()
        out = await self._run_tool(
            o,
            "log_mistake",
            {
                "category": "GRAMMAR",
                "user_said": "I go there yesterday",
                "suggested": "I went there yesterday",
                "tip_zh": "过去时",
            },
        )
        assert out[0]["type"] == "server.mistake_card"
        assert out[0]["category"] == "GRAMMAR"
        assert out[0]["tip_zh"] == "过去时"

    async def test_mistake_recorded_in_state(self) -> None:
        o = _orch(4, 4)
        await o.start()
        await self._run_tool(
            o,
            "log_mistake",
            {"category": "PRONUNCIATION", "user_said": "a", "suggested": "b", "tip_zh": "c"},
        )
        assert len(o.state.mistakes) == 1

    async def test_invalid_category_rejected(self) -> None:
        o = _orch(4, 4)
        await o.start()
        out = await self._run_tool(
            o,
            "log_mistake",
            {"category": "SPELLING", "user_said": "a", "suggested": "b", "tip_zh": "c"},
        )
        assert out == []
        assert "invalid category" in o.provider.tool_results[0][1]

    async def test_mistake_does_not_retire_words(self) -> None:
        """纠错不应影响目标词窗口（纠错和词汇激活是两件事）。"""
        o = _orch(4, 4)
        await o.start()
        before = [t.word for t in o.state.active]
        await self._run_tool(
            o,
            "log_mistake",
            {"category": "GRAMMAR", "user_said": "a", "suggested": "b", "tip_zh": "c"},
        )
        assert [t.word for t in o.state.active] == before
        assert o.provider.instruction_updates == []


class TestEventTranslation:
    async def test_transcript_event_translated(self) -> None:
        o = _orch(1, 1, [TranscriptDeltaEvent(role="user", text="hello")])
        await o.start()
        out = [e async for e in o.iter_events()]
        assert out[0]["type"] == "server.transcript"
        assert out[0]["role"] == "user"

    async def test_transcript_kept_in_recent_history(self) -> None:
        o = _orch(1, 1, [TranscriptDeltaEvent(role="user", text="hello there")])
        await o.start()
        [e async for e in o.iter_events()]
        assert len(o.state.recent_transcript) == 1

    async def test_speech_started_translated(self) -> None:
        o = _orch(1, 1, [SpeechStartedEvent()])
        await o.start()
        out = [e async for e in o.iter_events()]
        assert out[0]["type"] == "server.speech_started"

    async def test_audio_delta_marked_internal(self) -> None:
        o = _orch(1, 1, [AudioDeltaEvent(pcm24=b"\x00\x01")])
        await o.start()
        out = [e async for e in o.iter_events()]
        assert out[0]["type"] == "_audio_bytes"
        assert out[0]["payload"] == b"\x00\x01"

    async def test_recent_transcript_is_bounded(self) -> None:
        """SPEC 5.4：只保留最近 4 轮，防止内存无限增长。"""
        events = [TranscriptDeltaEvent(role="user", text=f"t{i}") for i in range(50)]
        o = _orch(1, 1, events)
        await o.start()
        [e async for e in o.iter_events()]
        assert len(o.state.recent_transcript) <= 8


class TestVoiceAndAudioPassthrough:
    async def test_feed_audio_forwards_to_provider(self) -> None:
        o = _orch(1, 1)
        await o.start()
        await o.feed_audio(b"\x00\x01" * 100)
        assert len(o.provider.audio_sent) == 1

    async def test_interrupt_forwards(self) -> None:
        o = _orch(1, 1)
        await o.start()
        await o.interrupt()
        assert o.provider.interrupted == 1

    async def test_close_forwards(self) -> None:
        o = _orch(1, 1)
        await o.start()
        await o.close()
        assert o.provider.closed is True


class TestHintSupport:
    async def test_hint_context_returns_active_words(self) -> None:
        o = _orch(6, 4)
        await o.start()
        words, transcript = o.hint_context()
        assert words == ["word0", "word1", "word2", "word3"]
        assert transcript == []

    async def test_hint_context_includes_transcript(self) -> None:
        o = _orch(1, 1, [TranscriptDeltaEvent(role="assistant", text="How is it going?")])
        await o.start()
        [e async for e in o.iter_events()]
        _words, transcript = o.hint_context()
        assert transcript[0]["text"] == "How is it going?"

    async def test_note_hint_requested_marks_words(self) -> None:
        o = _orch(6, 4)
        await o.start()
        words = o.note_hint_requested()
        assert len(words) == 4
        assert o.state.hints_requested == {"word0", "word1", "word2", "word3"}

    async def test_transcript_messages_format(self) -> None:
        o = _orch(1, 1, [TranscriptDeltaEvent(role="user", text="hi")])
        await o.start()
        [e async for e in o.iter_events()]
        msgs = o.build_transcript_messages()
        assert msgs == [{"role": "user", "content": "hi"}]


class TestPhaseProgression:
    async def test_starts_in_icebreaking(self) -> None:
        o = _orch(6, 4)
        await o.start()
        assert o.update_phase() == SessionPhase.ICEBREAKING

    async def test_closing_when_all_words_done(self) -> None:
        o = _orch(4, 4)
        await o.start()
        for w in ["word0", "word1", "word2", "word3"]:
            o._retire_word(w)
            o.state.completed.append(w)
        assert o.update_phase() == SessionPhase.CLOSING

    async def test_guiding_midway(self) -> None:
        o = _orch(6, 4)
        await o.start()
        o.state.completed.append("word0")
        o.state.started_at = o.state.started_at - __import__("datetime").timedelta(seconds=200)
        assert o.update_phase() == SessionPhase.GUIDING

    async def test_closing_when_time_exceeded(self) -> None:
        o = _orch(6, 4)
        await o.start()
        o.state.started_at = o.state.started_at - __import__("datetime").timedelta(seconds=700)
        assert o.update_phase() == SessionPhase.CLOSING

    async def test_phase_in_prompt(self) -> None:
        o = _orch(6, 4)
        await o.start()
        assert "ICEBREAKING" in o.provider.session_config.system_prompt


class TestProgress:
    async def test_progress_counts(self) -> None:
        o = _orch(6, 4)
        await o.start()
        p = o.state.progress
        assert p["total"] == 6
        assert p["completed"] == 0
        assert p["remaining"] == 6

    async def test_progress_after_completion(self) -> None:
        o = _orch(6, 4)
        await o.start()
        o._retire_word("word0")
        o.state.completed.append("word0")
        p = o.state.progress
        assert p["completed"] == 1
        assert p["remaining"] == 5


class TestPromptContent:
    async def test_prompt_contains_profile(self) -> None:
        o = _orch(1, 1)
        await o.start()
        assert "程序员" in o.provider.session_config.system_prompt

    async def test_prompt_contains_error_patterns(self) -> None:
        o = _orch(1, 1)
        await o.start()
        assert "时态混用" in o.provider.session_config.system_prompt

    async def test_prompt_contains_scenario(self) -> None:
        o = _orch(1, 1)
        await o.start()
        assert "线上故障排查" in o.provider.session_config.system_prompt

    async def test_prompt_enforces_recast(self) -> None:
        """纠错双轨制必须写进 prompt，否则模型会打断学员。"""
        o = _orch(1, 1)
        await o.start()
        prompt = o.provider.session_config.system_prompt
        assert "Recast" in prompt
        assert "不要停下来" in prompt or "不打断" in prompt

    def test_tool_definitions_valid(self) -> None:
        names = {t["function"]["name"] for t in TOOL_DEFINITIONS}
        assert names == {"mark_word_used", "log_mistake"}
        for tool in TOOL_DEFINITIONS:
            assert tool["type"] == "function"
            assert "parameters" in tool["function"]
