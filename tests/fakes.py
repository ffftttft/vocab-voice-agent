"""测试用的 Provider 假实现。

存在的意义：让编排逻辑（daily_planner / orchestrator）在**没有真实 API key** 的
情况下也能被完整验证。这不是 mock 掉被测逻辑，而是替换外部服务边界 ——
被测的编排、校验、落库逻辑全部是真实代码。
"""

from __future__ import annotations

import copy
import hashlib
from collections.abc import AsyncIterator
from pathlib import Path

from src.agent_server.providers.base import (
    RealtimeVoiceProvider,
    TextLLMProvider,
    TTSProvider,
    VoiceEvent,
    VoiceSessionConfig,
)


class FakeTextLLM(TextLLMProvider):
    """按 response_model 的类型返回预置数据的假文本模型。"""

    def __init__(self) -> None:
        self.structured_calls: list[dict] = []
        self.stream_calls: list[dict] = []
        self.scenario_response: dict | None = None
        self.card_response: dict | None = None
        self.stream_chunks: list[str] = [
            "EN: I ",
            "**deprecated** ",
            "it yesterday.\n",
            "ZH: 我昨天弃用了它。",
        ]
        self.fail_cards = False

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model,
        temperature: float | None = None,
    ):
        self.structured_calls.append(
            {
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
                "response_model": response_model.__name__,
            }
        )
        name = response_model.__name__
        if name == "ScenarioSelection":
            data = self.scenario_response or _default_scenario(self._extract_words(user_prompt))
        elif name == "WordCardBatch":
            if self.fail_cards:
                raise RuntimeError("simulated LLM failure")
            data = self.card_response or _default_cards(self._extract_words(user_prompt))
        else:
            raise AssertionError(f"未预期的 response_model: {name}")
        return response_model.model_validate(copy.deepcopy(data))

    async def stream_text(
        self,
        system_prompt: str,
        messages: list[dict],
        temperature: float | None = None,
    ) -> AsyncIterator[str]:
        self.stream_calls.append({"system_prompt": system_prompt, "messages": messages})
        for chunk in self.stream_chunks:
            yield chunk

    @staticmethod
    def _extract_words(user_prompt: str) -> list[str]:
        words = []
        for line in user_prompt.splitlines():
            line = line.strip()
            if line.startswith("- "):
                words.append(line[2:].split("|")[0].strip())
        return words


def _default_scenario(words: list[str]) -> dict:
    picked = words[:10]
    return {
        "scenario_title": "线上故障排查",
        "scenario_brief": "服务凌晨报警，你和同事排查一个接口超时问题。",
        "selected_words": [{"word": w, "reason": "场景相关"} for w in picked],
        "voice_candidates": picked[:4],
    }


def _default_cards(words: list[str]) -> dict:
    cards = []
    for i, w in enumerate(words):
        cards.append(
            {
                "word": w,
                "sentence_en": f"We need to {w} this module before the release tomorrow.",
                "sentence_zh": f"我们需要在明天发布前{w}这个模块。",
                "target_pos": "v.",
                "options": [
                    {"label": "A", "pos": "v.", "text": f"{w}的释义", "is_correct": True},
                    {"label": "B", "pos": "v.", "text": "形近词释义", "is_correct": False},
                    {"label": "C", "pos": "v.", "text": "反义释义", "is_correct": False},
                    {"label": "D", "pos": "v.", "text": "同场景词释义", "is_correct": False},
                ],
                "is_voice_target": i < 2,
            }
        )
    return {"cards": cards}


class FakeTTS(TTSProvider):
    provider_name = "fake"
    voice_id = "fake-voice"

    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.calls: list[str] = []

    def cache_key_for(self, text: str) -> str:
        return hashlib.sha256(f"{self.provider_name}:{self.voice_id}:{text}".encode()).hexdigest()

    async def synthesize_to_file(self, text: str, cache_key: str | None = None) -> Path:
        self.calls.append(text)
        key = cache_key or self.cache_key_for(text)
        path = self.cache_dir / f"{key}.mp3"
        if not path.exists():
            path.write_bytes(b"fake-mp3")
        return path


class FakeRealtimeVoice(RealtimeVoiceProvider):
    def __init__(self, events: list[VoiceEvent] | None = None) -> None:
        self.session_config: VoiceSessionConfig | None = None
        self.audio_sent: list[bytes] = []
        self.instruction_updates: list[str] = []
        self.tool_results: list[tuple[str, str]] = []
        self.interrupted = 0
        self.closed = False
        self._events = events or []
        self._index = 0

    async def connect(self, session_config: VoiceSessionConfig) -> None:
        self.session_config = session_config

    async def send_audio_chunk(self, pcm16_bytes: bytes) -> None:
        self.audio_sent.append(pcm16_bytes)

    async def update_instructions(self, new_system_prompt: str) -> None:
        self.instruction_updates.append(new_system_prompt)

    async def send_tool_result(self, call_id: str, result_json: str) -> None:
        self.tool_results.append((call_id, result_json))

    async def interrupt(self) -> None:
        self.interrupted += 1

    def events(self) -> AsyncIterator[VoiceEvent]:
        async def gen():
            for event in self._events:
                yield event

        return gen()

    async def close(self) -> None:
        self.closed = True

    def push_event(self, event: VoiceEvent) -> None:
        self._events.append(event)
