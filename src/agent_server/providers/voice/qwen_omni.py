"""阿里百炼 Qwen-Omni-Realtime 适配器（SPEC 3.2(2)）。

协议：DashScope 的 realtime 接口与 OpenAI Realtime API 高度相似，
但事件名与字段有差异，下面逐一映射。

可靠性设计：
- 连接断开时向事件流推送 SessionClosedEvent，而不是静默挂起；
- 发送失败不抛到业务层，转为错误事件，避免一次网络抖动毁掉整场通话；
- 所有发送在 _send_lock 内串行化 —— websockets 库不保证并发 send 安全。
"""

from __future__ import annotations

import asyncio
import base64
import contextlib
import json
from collections.abc import AsyncIterator
from typing import Any

import websockets
from websockets.asyncio.client import ClientConnection

from ..base import (
    AudioDeltaEvent,
    ProviderError,
    RealtimeVoiceProvider,
    SessionClosedEvent,
    SpeechStartedEvent,
    ToolCallEvent,
    TranscriptDeltaEvent,
    VoiceEvent,
    VoiceSessionConfig,
)

# DashScope realtime 事件名 -> 我们的统一事件
DASHSCOPE_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"


class QwenOmniRealtimeAdapter(RealtimeVoiceProvider):
    def __init__(
        self,
        ws_url: str = DASHSCOPE_WS_URL,
        api_key: str = "",
        model_name: str = "qwen-omni-turbo-realtime",
        voice_id: str = "Chelsie",
        connect_timeout: float = 15.0,
    ) -> None:
        if not api_key:
            raise ProviderError(
                "Qwen-Omni 需要 API Key。请在 .env 或 config.yaml 中设置 VOICE_API_KEY。"
            )
        self.ws_url = ws_url or DASHSCOPE_WS_URL
        self.api_key = api_key
        self.model_name = model_name
        self.voice_id = voice_id
        self.connect_timeout = connect_timeout

        self._ws: ClientConnection | None = None
        self._events: asyncio.Queue[VoiceEvent | None] = asyncio.Queue()
        self._send_lock = asyncio.Lock()
        self._reader_task: asyncio.Task | None = None
        self._closed = False

    # ------------------------------------------------------------ 连接
    async def connect(self, session_config: VoiceSessionConfig) -> None:
        url = f"{self.ws_url}?model={self.model_name}"
        headers = {"Authorization": f"Bearer {self.api_key}"}

        try:
            self._ws = await asyncio.wait_for(
                websockets.connect(url, additional_headers=headers, max_size=None),
                timeout=self.connect_timeout,
            )
        except Exception as exc:  # noqa: BLE001
            raise ProviderError(f"连接 Qwen-Omni 失败：{exc}") from exc

        voice = session_config.voice_id or self.voice_id
        await self._send(
            {
                "type": "session.update",
                "session": {
                    "modalities": ["text", "audio"],
                    "voice": voice,
                    "instructions": session_config.system_prompt,
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16",
                    "input_audio_transcription": {"model": "gummy-realtime-v1"},
                    "turn_detection": {
                        "type": "server_vad",
                        "threshold": 0.5,
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": 700,
                    },
                    "tools": session_config.tools,
                    "tool_choice": "auto",
                },
            }
        )

        # 主动触发 AI 破冰（SPEC 5.3 阶段 1）
        await self._send(
            {
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": "（现在是通话开始，请先用自然亲切的语气跟我打招呼，"
                            "切入今天的场景。不要提到这条消息本身。）",
                        }
                    ],
                },
            }
        )
        await self._send({"type": "response.create"})

        self._reader_task = asyncio.create_task(self._read_loop())

    async def _read_loop(self) -> None:
        """后台读取上游事件，翻译后放入队列。"""
        assert self._ws is not None
        try:
            async for raw in self._ws:
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                for event in self._translate(payload):
                    await self._events.put(event)
        except Exception:  # noqa: BLE001
            pass
        finally:
            await self._events.put(SessionClosedEvent(reason="upstream closed"))
            await self._events.put(None)

    def _translate(self, payload: dict[str, Any]) -> list[VoiceEvent]:
        """DashScope 事件 -> 统一事件。一个上游事件可能产出多个下游事件。"""
        kind = payload.get("type", "")

        if kind == "response.audio.delta":
            delta = payload.get("delta") or payload.get("audio")
            if not delta:
                return []
            try:
                return [AudioDeltaEvent(pcm24=base64.b64decode(delta))]
            except Exception:  # noqa: BLE001
                return []

        if kind in (
            "conversation.item.input_audio_transcription.delta",
            "response.audio_transcript.delta",
        ):
            text = payload.get("delta") or payload.get("text") or ""
            if not text:
                return []
            role = "user" if "input_audio" in kind else "assistant"
            return [TranscriptDeltaEvent(role=role, text=text, is_final=False)]

        if kind in (
            "conversation.item.input_audio_transcription.completed",
            "response.audio_transcript.done",
        ):
            text = payload.get("transcript") or payload.get("text") or ""
            if not text:
                return []
            role = "user" if "input_audio" in kind else "assistant"
            return [TranscriptDeltaEvent(role=role, text=text, is_final=True)]

        if kind == "input_audio_buffer.speech_started":
            return [SpeechStartedEvent()]

        if kind == "response.function_call_arguments.done":
            try:
                args = json.loads(payload.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            return [
                ToolCallEvent(
                    call_id=payload.get("call_id", ""),
                    name=payload.get("name", ""),
                    arguments=args,
                )
            ]

        return []

    # ------------------------------------------------------------ 上行
    async def _send(self, payload: dict) -> None:
        if self._ws is None:
            raise ProviderError("尚未连接，无法发送")
        async with self._send_lock:
            try:
                await self._ws.send(json.dumps(payload))
            except Exception as exc:  # noqa: BLE001
                await self._events.put(SessionClosedEvent(reason=f"send failed: {exc}"))
                await self._events.put(None)
                raise ProviderError(f"发送失败：{exc}") from exc

    async def send_audio_chunk(self, pcm16_bytes: bytes) -> None:
        if not pcm16_bytes:
            return
        await self._send(
            {
                "type": "input_audio_buffer.append",
                "audio": base64.b64encode(pcm16_bytes).decode("ascii"),
            }
        )

    async def update_instructions(self, new_system_prompt: str) -> None:
        """滑动窗口变化时静默刷新，不中断当前通话（SPEC 3.2(2)）。"""
        await self._send(
            {"type": "session.update", "session": {"instructions": new_system_prompt}}
        )

    async def send_tool_result(self, call_id: str, result_json: str) -> None:
        await self._send(
            {
                "type": "conversation.item.create",
                "item": {
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": result_json,
                },
            }
        )
        await self._send({"type": "response.create"})

    async def interrupt(self) -> None:
        """用户抢话：取消当前回复并清空上游缓冲。"""
        await self._send({"type": "response.cancel"})
        await self._send({"type": "input_audio_buffer.clear"})

    # ------------------------------------------------------------ 下行
    def events(self) -> AsyncIterator[VoiceEvent]:
        async def gen():
            while True:
                event = await self._events.get()
                if event is None:
                    break
                yield event

        return gen()

    async def close(self) -> None:
        self._closed = True
        if self._reader_task and not self._reader_task.done():
            self._reader_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._reader_task
        if self._ws is not None:
            with contextlib.suppress(Exception):
                await self._ws.close()
            self._ws = None
        await self._events.put(None)
