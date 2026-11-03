"""实时语音会话编排器（SPEC 5.3）。

职责：
1. 滑动窗口目标词注入（不把 12 个词全塞进 system prompt）
2. 三段式节奏（破冰 / 引导 / 收尾）
3. Tool Calling 拦截（mark_word_used / log_mistake）
4. FSRS 口语联动
5. 为 SSE 提示维护 recent_transcript 与 active_target_words
6. 记忆压缩触发

纯编排逻辑与传输层解耦：`VoiceOrchestrator` 只依赖 `RealtimeVoiceProvider`
抽象，不关心底层是 WebSocket 还是别的。
"""

from __future__ import annotations

import json
from collections import deque
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from enum import StrEnum

from ..db.models import (
    MISTAKE_GRAMMAR,
    MISTAKE_PRONUNCIATION,
    MISTAKE_WORD_CHOICE,
)
from ..providers.base import (
    ToolCallEvent,
    TranscriptDeltaEvent,
    VoiceSessionConfig,
)

MAX_TRANSCRIPT_ROUNDS = 4  # SPEC 5.4：内存中保留最近 4 轮
VALID_MISTAKE_TYPES = {MISTAKE_PRONUNCIATION, MISTAKE_GRAMMAR, MISTAKE_WORD_CHOICE}


class SessionPhase(StrEnum):
    """SPEC 5.3 的三段式节奏。"""

    ICEBREAKING = "ICEBREAKING"  # 0-2 分钟，AI 主动打招呼
    GUIDING = "GUIDING"  # 2-25 分钟，场景引导 + 词汇激活
    CLOSING = "CLOSING"  # 收尾


@dataclass
class TargetWord:
    word_id: int
    word: str
    sentence_en: str = ""
    pos_defs: list = field(default_factory=list)


@dataclass
class SessionState:
    """一次语音会话的全部运行时状态。"""

    session_id: int
    plan_date: date
    scenario_title: str
    scenario_brief: str
    queue: list[TargetWord] = field(default_factory=list)
    active: list[TargetWord] = field(default_factory=list)
    completed: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)
    recent_transcript: deque = field(
        default_factory=lambda: deque(maxlen=MAX_TRANSCRIPT_ROUNDS * 2)
    )
    phase: SessionPhase = SessionPhase.ICEBREAKING
    started_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    target_seconds: int = 600
    hints_requested: set[str] = field(default_factory=set)
    mistakes: list[dict] = field(default_factory=list)

    @property
    def elapsed_seconds(self) -> int:
        return int((datetime.now(UTC) - self.started_at).total_seconds())

    @property
    def progress(self) -> dict:
        total = len(self.queue) + len(self.active) + len(self.completed) + len(self.failed)
        return {
            "total": total,
            "completed": len(self.completed),
            "remaining": len(self.active) + len(self.queue),
            "failed": len(self.failed),
        }


class ToolCallResult:
    def __init__(self, call_id: str, name: str, result: dict, broadcast: list[dict] | None = None):
        self.call_id = call_id
        self.name = name
        self.result = result
        self.broadcast = broadcast or []


class VoiceOrchestrator:
    """一次语音通话的编排器。

    初始化时传入当天目标词队列与场景，之后：
      - `start()` 下发会话配置并让 AI 破冰
      - `feed_audio()` 上行音频
      - `iter_events()` 下行事件（已翻译为前端可消费的事件）
    """

    def __init__(
        self,
        provider,
        session_state: SessionState,
        memory_profile: str = "",
        error_patterns: str = "",
        sliding_window_size: int = 4,
    ) -> None:
        self.provider = provider
        self.state = session_state
        self.profile = memory_profile
        self.error_patterns = error_patterns
        self.window_size = max(1, sliding_window_size)

    # ------------------------------------------------------------ 会话生命周期
    async def start(self) -> None:
        self._fill_window()
        await self.provider.connect(
            VoiceSessionConfig(
                system_prompt=self._build_system_prompt(),
                model_name="",
                tools=TOOL_DEFINITIONS,
            )
        )

    async def feed_audio(self, pcm16: bytes) -> None:
        await self.provider.send_audio_chunk(pcm16)

    async def interrupt(self) -> None:
        await self.provider.interrupt()

    async def close(self) -> None:
        await self.provider.close()

    # ------------------------------------------------------------ 下行事件
    async def iter_events(self) -> AsyncIterator[dict]:
        """把 provider 的原始事件翻译成前端协议（SPEC 6.2）。

        注意返回的是普通 dict，不是 VoiceEvent —— 传输层直接 JSON 序列化。
        """
        async for event in self.provider.events():
            if isinstance(event, ToolCallEvent):
                result = await self._handle_tool_call(event)
                if result is not None:
                    yield result
                continue

            if isinstance(event, TranscriptDeltaEvent):
                if event.text:
                    self.state.recent_transcript.append({"role": event.role, "text": event.text})
                yield {
                    "type": "server.transcript",
                    "role": event.role,
                    "text": event.text,
                    "is_final": event.is_final,
                }
                continue

            kind = getattr(event, "kind", "")
            if kind == "audio_delta":
                # 传输层走二进制帧，这里只发一个占位由路由层处理
                yield {"type": "_audio_bytes", "payload": event.pcm24}  # type: ignore[attr-defined]
            elif kind == "speech_started":
                yield {"type": "server.speech_started"}
            elif kind == "session_closed":
                yield {"type": "server.session_closed", "reason": getattr(event, "reason", "")}

    # ------------------------------------------------------------ 滑动窗口
    def _fill_window(self) -> None:
        while len(self.state.active) < self.window_size and self.state.queue:
            self.state.active.append(self.state.queue.pop(0))

    def _retire_word(self, word: str) -> bool:
        """从活跃窗口移除一个词并补位。返回是否确实移除了。"""
        lowered = word.strip().lower()
        for i, target in enumerate(self.state.active):
            if target.word.lower() == lowered:
                self.state.active.pop(i)
                self._fill_window()
                return True
        return False

    async def refresh_instructions(self) -> None:
        """窗口变化后静默刷新上游指令，不打断通话。"""
        await self.provider.update_instructions(self._build_system_prompt())

    # ------------------------------------------------------------ Tool 处理
    async def _handle_tool_call(self, event: ToolCallEvent) -> dict | None:
        args = event.arguments or {}

        if event.name == "mark_word_used":
            word = str(args.get("word", "")).strip()
            used_correctly = bool(args.get("used_correctly", True))

            if not word:
                await self.provider.send_tool_result(
                    event.call_id, '{"ok": false, "error": "missing word"}'
                )
                return None

            removed = self._retire_word(word)
            if removed:
                if used_correctly:
                    self.state.completed.append(word)
                else:
                    self.state.failed.append(word)
                await self.refresh_instructions()

            await self.provider.send_tool_result(
                event.call_id,
                json.dumps(
                    {"ok": True, "in_window": removed, "remaining": len(self.state.active)}
                ),
            )

            # 交给上层（路由层）落库 FSRS
            return {
                "type": "server.word_used",
                "word": word,
                "used_correctly": used_correctly,
                "in_window": removed,
                "_persist": {
                    "kind": "mark_word_used",
                    "word": word,
                    "used_correctly": used_correctly,
                },
                **self._progress_payload(),
            }

        if event.name == "log_mistake":
            category = str(args.get("category", "")).upper()
            if category not in VALID_MISTAKE_TYPES:
                await self.provider.send_tool_result(
                    event.call_id, '{"ok": false, "error": "invalid category"}'
                )
                return None

            record = {
                "category": category,
                "user_said": str(args.get("user_said", "")),
                "suggested": str(args.get("suggested", "")),
                "tip_zh": str(args.get("tip_zh", "")),
            }
            self.state.mistakes.append(record)
            await self.provider.send_tool_result(event.call_id, '{"ok": true}')

            return {
                "type": "server.mistake_card",
                **record,
                "_persist": {"kind": "log_mistake", **record},
            }

        await self.provider.send_tool_result(
            event.call_id, '{"ok": false, "error": "unknown tool"}'
        )
        return None

    # ------------------------------------------------------------ Prompt 构建
    def _build_system_prompt(self) -> str:
        """构造注入给实时语音模型的 system prompt。

        这里体现 SPEC 5.3 的全部要求：滑动窗口、Recast 纠错、节奏控制。
        """
        active_block = self._format_active_words()
        window_words = ", ".join(t.word for t in self.state.active) or "（暂无）"

        return f"""你是一位友好的英语口语陪练，正在和一位中国程序员进行实时语音对话。

## 学员背景
{self.profile.strip() or "（未提供）"}

## 学员的已知薄弱点（倾听时重点关注，但不要刻意提起）
{self.error_patterns.strip() or "（暂无记录）"}

## 今日场景
{self.state.scenario_title}
{self.state.scenario_brief}

## 本次对话的核心任务
在自然的对话中，引导学员主动说出以下目标词。**当前活跃窗口**：{window_words}

{active_block}

## 引导规则
1. 不要念词表，不要考试式提问。用设问、追问、情境推进来自然引出这些词。
2. 如果学员连续 2 轮都没用出某个词，你自己自然地示范使用它一次，然后换下一个话题。
3. 当学员说出了窗口内的词（或今日学过的任意词），**静默调用** `mark_word_used` 工具，
   不要在语音里说"很好，你用到了 xxx 这个词"。
4. 每次只推进一个话题，不要连珠炮式发问。学员是初学者，语速放慢，用词简单。

## 纠错规则（极其重要，不打断对话流）
1. **轻微语法错误或口音**：不要停下来讲解。用 Recast 技巧 —— 在你回应的开头，
   用正确的语法自然复述一遍学员的意思，然后继续话题。同时静默调用 `log_mistake`。
2. **明显发音错误或重音错位**：温和地插一句口头纠正，慢速示范一次，让学员跟读一遍，
   再回到刚才的话题。同时调用 `log_mistake(category="PRONUNCIATION")`。
3. 绝不说"你的语法错了"这类评判性表述。

## 节奏
- 现在处于 **{self.state.phase}** 阶段。
- 已进行 {self.state.elapsed_seconds // 60} 分钟，目标 {self.state.target_seconds // 60} 分钟。
- 所有目标词都用完、或接近目标时长时，用 1-2 句话鼓励并自然道别。
"""

    def _format_active_words(self) -> str:
        if not self.state.active:
            return "（窗口已空，可以进入收尾）"
        lines = ["窗口内的词及其今日例句（供你设计提问时参考，不要直接念出来）："]
        for t in self.state.active:
            defs = "; ".join(d.get("def", "") for d in (t.pos_defs or []) if d.get("def"))
            line = f"- **{t.word}**"
            if defs:
                line += f"（{defs}）"
            if t.sentence_en:
                line += f" | 学员今天的例句：{t.sentence_en}"
            lines.append(line)
        return "\n".join(lines)

    def _progress_payload(self) -> dict:
        return {
            "active_words": [t.word for t in self.state.active],
            "completed_words": list(self.state.completed),
        }

    # ------------------------------------------------------------ SSE 提示支持
    def hint_context(self) -> tuple[list[str], list[dict]]:
        """返回 (当前活跃词, 最近转录)，供 hint_streamer 组装 prompt。"""
        return [t.word for t in self.state.active], list(self.state.recent_transcript)

    def note_hint_requested(self) -> list[str]:
        """记录用户点了提示，返回被标记的词。"""
        words = [t.word for t in self.state.active]
        self.state.hints_requested.update(w.lower() for w in words)
        return words

    def build_transcript_messages(self) -> list[dict]:
        """把最近转录转成 LLM 的 messages 格式。"""
        msgs = []
        for entry in self.state.recent_transcript:
            role = "assistant" if entry["role"] == "assistant" else "user"
            msgs.append({"role": role, "content": entry["text"]})
        return msgs

    # ------------------------------------------------------------ 阶段推进
    def update_phase(self) -> SessionPhase:
        """根据时长与进度自动推进阶段（SPEC 5.3 三段式）。"""
        elapsed = self.state.elapsed_seconds
        ratio = elapsed / self.state.target_seconds if self.state.target_seconds else 0

        if ratio < 0.15 and not self.state.completed:
            phase = SessionPhase.ICEBREAKING
        elif ratio >= 0.85 or not self.state.active and not self.state.queue:
            phase = SessionPhase.CLOSING
        else:
            phase = SessionPhase.GUIDING

        self.state.phase = phase
        return phase


TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "mark_word_used",
            "description": (
                "当学员在对话中说出了今日目标词（或今日学过的词）时调用。"
                "静默调用，不要在语音里提及。"
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "word": {"type": "string", "description": "学员用到的那个英文词"},
                    "used_correctly": {
                        "type": "boolean",
                        "description": "用对了词义为 true，用错词义为 false",
                    },
                },
                "required": ["word", "used_correctly"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_mistake",
            "description": "记录学员的发音/语法/用词错误。静默调用，不要在语音里说'我记录一下'。",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["PRONUNCIATION", "GRAMMAR", "WORD_CHOICE"],
                    },
                    "user_said": {"type": "string", "description": "学员原话"},
                    "suggested": {"type": "string", "description": "正确表达"},
                    "tip_zh": {"type": "string", "description": "简短中文说明，一句话"},
                },
                "required": ["category", "user_said", "suggested", "tip_zh"],
            },
        },
    },
]
