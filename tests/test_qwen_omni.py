"""Qwen-Omni 适配器测试。

不连真实服务，而是用本地假 WebSocket 服务器验证：
1. 连接时下发的 session.update 内容正确
2. 上游事件能正确翻译成统一事件
3. 音频 base64 编解码无损
4. 未配置 key 时报错清晰
"""

import asyncio
import base64
import json
import sys
from pathlib import Path

import pytest
import websockets

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.agent_server.providers.base import (  # noqa: E402
    AudioDeltaEvent,
    ProviderError,
    SessionClosedEvent,
    SpeechStartedEvent,
    ToolCallEvent,
    TranscriptDeltaEvent,
    VoiceSessionConfig,
)
from src.agent_server.providers.voice.qwen_omni import QwenOmniRealtimeAdapter  # noqa: E402


class FakeDashScopeServer:
    """模拟 DashScope realtime 服务端。"""

    def __init__(self) -> None:
        self.received: list[dict] = []
        self.server = None
        self.port = 0
        self._pending: list[dict] = []

    async def start(self) -> None:
        async def handler(ws):
            async for raw in ws:
                payload = json.loads(raw)
                self.received.append(payload)
                # 回一条确认，让客户端知道收到了
                await ws.send(json.dumps({"type": "session.updated"}))
                # 若有预置下行事件，第一次收到消息后推送
                while self._pending:
                    await ws.send(json.dumps(self._pending.pop(0)))
                    await asyncio.sleep(0.01)

        self.server = await websockets.serve(handler, "127.0.0.1", 0)
        self.port = self.server.sockets[0].getsockname()[1]

    async def stop(self) -> None:
        if self.server:
            self.server.close()
            await self.server.wait_closed()

    @property
    def url(self) -> str:
        return f"ws://127.0.0.1:{self.port}"

    def queue_downstream(self, payload: dict) -> None:
        self._pending.append(payload)


@pytest.fixture
async def server():
    s = FakeDashScopeServer()
    await s.start()
    yield s
    await s.stop()


def _config(prompt: str = "You are a tutor") -> VoiceSessionConfig:
    return VoiceSessionConfig(system_prompt=prompt, voice_id="Chelsie", tools=[])


def _adapter(server: FakeDashScopeServer) -> QwenOmniRealtimeAdapter:
    return QwenOmniRealtimeAdapter(
        ws_url=server.url, api_key="test-key", model_name="qwen-omni-turbo-realtime"
    )


class TestConstruction:
    def test_missing_key_raises_with_hint(self) -> None:
        with pytest.raises(ProviderError, match="VOICE_API_KEY"):
            QwenOmniRealtimeAdapter(api_key="")

    def test_valid_key_ok(self) -> None:
        a = QwenOmniRealtimeAdapter(api_key="k")
        assert a.model_name == "qwen-omni-turbo-realtime"


class TestSessionSetup:
    async def test_sends_session_update(self, server) -> None:
        adapter = _adapter(server)
        await adapter.connect(_config("CUSTOM PROMPT"))
        await asyncio.sleep(0.15)

        update = next(p for p in server.received if p["type"] == "session.update")
        assert update["session"]["instructions"] == "CUSTOM PROMPT"
        assert update["session"]["voice"] == "Chelsie"
        assert update["session"]["input_audio_format"] == "pcm16"
        assert update["session"]["output_audio_format"] == "pcm16"
        assert update["session"]["turn_detection"]["type"] == "server_vad"
        await adapter.close()

    async def test_sends_icebreaker_trigger(self, server) -> None:
        """SPEC 5.3 阶段 1：连接后 AI 必须主动开口。"""
        adapter = _adapter(server)
        await adapter.connect(_config())
        await asyncio.sleep(0.15)

        types = [p["type"] for p in server.received]
        assert "conversation.item.create" in types
        assert "response.create" in types
        await adapter.close()


class TestAudioUplink:
    async def test_audio_sent_as_base64(self, server) -> None:
        adapter = _adapter(server)
        await adapter.connect(_config())
        await asyncio.sleep(0.1)

        pcm = b"\x01\x02\x03\x04"
        await adapter.send_audio_chunk(pcm)
        await asyncio.sleep(0.15)

        append = next(p for p in server.received if p["type"] == "input_audio_buffer.append")
        assert base64.b64decode(append["audio"]) == pcm
        await adapter.close()

    async def test_empty_audio_ignored(self, server) -> None:
        adapter = _adapter(server)
        await adapter.connect(_config())
        await asyncio.sleep(0.1)
        before = len(server.received)
        await adapter.send_audio_chunk(b"")
        await asyncio.sleep(0.1)
        assert len(server.received) == before
        await adapter.close()


class TestInstructionsUpdate:
    async def test_update_instructions_sends_partial_update(self, server) -> None:
        """滑动窗口刷新时只更新 instructions，不动其它会话参数。"""
        adapter = _adapter(server)
        await adapter.connect(_config("OLD"))
        await asyncio.sleep(0.15)

        await adapter.update_instructions("NEW PROMPT")
        await asyncio.sleep(0.15)

        updates = [p for p in server.received if p["type"] == "session.update"]
        assert updates[-1]["session"] == {"instructions": "NEW PROMPT"}
        await adapter.close()


class TestToolResult:
    async def test_tool_result_sent_and_triggers_response(self, server) -> None:
        adapter = _adapter(server)
        await adapter.connect(_config())
        await asyncio.sleep(0.1)

        await adapter.send_tool_result("call_1", '{"ok": true}')
        await asyncio.sleep(0.15)

        types = [p["type"] for p in server.received]
        assert "conversation.item.create" in types
        outputs = [
            p
            for p in server.received
            if p["type"] == "conversation.item.create"
            and p["item"]["type"] == "function_call_output"
        ]
        assert outputs[0]["item"]["call_id"] == "call_1"
        assert outputs[0]["item"]["output"] == '{"ok": true}'
        await adapter.close()


class TestDownstreamTranslation:
    async def _collect(self, adapter, timeout=0.6):
        events = []

        async def consume():
            async for e in adapter.events():
                events.append(e)

        task = asyncio.create_task(consume())
        await asyncio.sleep(timeout)
        task.cancel()
        return events

    async def test_audio_delta_decoded(self, server) -> None:
        raw = b"\x10\x20\x30\x40"
        server.queue_downstream(
            {"type": "response.audio.delta", "delta": base64.b64encode(raw).decode()}
        )
        adapter = _adapter(server)
        await adapter.connect(_config())
        adapter._events.put_nowait(AudioDeltaEvent(pcm24=raw))  # 确保类型可用

        events = await self._collect(adapter, 0.4)
        audio = [e for e in events if isinstance(e, AudioDeltaEvent)]
        assert audio and audio[0].pcm24 == raw
        await adapter.close()

    async def test_speech_started_translated(self, server) -> None:
        server.queue_downstream({"type": "input_audio_buffer.speech_started"})
        adapter = _adapter(server)
        await adapter.connect(_config())
        events = await self._collect(adapter, 0.4)
        assert any(isinstance(e, SpeechStartedEvent) for e in events)
        await adapter.close()

    async def test_user_transcript_delta(self, server) -> None:
        server.queue_downstream(
            {
                "type": "conversation.item.input_audio_transcription.delta",
                "delta": "hello wor",
            }
        )
        adapter = _adapter(server)
        await adapter.connect(_config())
        events = await self._collect(adapter, 0.4)
        transcripts = [e for e in events if isinstance(e, TranscriptDeltaEvent)]
        assert transcripts
        assert transcripts[0].role == "user"
        assert transcripts[0].text == "hello wor"
        assert transcripts[0].is_final is False
        await adapter.close()

    async def test_assistant_transcript_completed(self, server) -> None:
        server.queue_downstream(
            {
                "type": "response.audio_transcript.done",
                "transcript": "Sure, let's start.",
            }
        )
        adapter = _adapter(server)
        await adapter.connect(_config())
        events = await self._collect(adapter, 0.4)
        transcripts = [e for e in events if isinstance(e, TranscriptDeltaEvent)]
        assert transcripts
        assert transcripts[0].role == "assistant"
        assert transcripts[0].is_final is True
        await adapter.close()

    async def test_tool_call_arguments_parsed(self, server) -> None:
        server.queue_downstream(
            {
                "type": "response.function_call_arguments.done",
                "call_id": "c9",
                "name": "mark_word_used",
                "arguments": '{"word": "deploy", "used_correctly": true}',
            }
        )
        adapter = _adapter(server)
        await adapter.connect(_config())
        events = await self._collect(adapter, 0.4)
        calls = [e for e in events if isinstance(e, ToolCallEvent)]
        assert calls
        assert calls[0].name == "mark_word_used"
        assert calls[0].arguments["word"] == "deploy"
        await adapter.close()

    async def test_malformed_tool_arguments_become_empty_dict(self, server) -> None:
        server.queue_downstream(
            {
                "type": "response.function_call_arguments.done",
                "call_id": "c9",
                "name": "mark_word_used",
                "arguments": "{not json",
            }
        )
        adapter = _adapter(server)
        await adapter.connect(_config())
        events = await self._collect(adapter, 0.4)
        calls = [e for e in events if isinstance(e, ToolCallEvent)]
        assert calls and calls[0].arguments == {}
        await adapter.close()

    async def test_unknown_events_ignored(self, server) -> None:
        server.queue_downstream({"type": "some.unknown.event"})
        adapter = _adapter(server)
        await adapter.connect(_config())
        events = await self._collect(adapter, 0.4)
        assert not [e for e in events if isinstance(e, ToolCallEvent)]
        await adapter.close()

    async def test_upstream_close_yields_session_closed(self, server) -> None:
        adapter = _adapter(server)
        await adapter.connect(_config())
        await asyncio.sleep(0.2)
        await server.stop()
        events = await self._collect(adapter, 0.6)
        assert any(isinstance(e, SessionClosedEvent) for e in events)
        await adapter.close()


class TestInterrupt:
    async def test_interrupt_sends_cancel_and_clear(self, server) -> None:
        adapter = _adapter(server)
        await adapter.connect(_config())
        await asyncio.sleep(0.15)

        await adapter.interrupt()
        await asyncio.sleep(0.15)

        types = [p["type"] for p in server.received]
        assert "response.cancel" in types
        assert "input_audio_buffer.clear" in types
        await adapter.close()


class TestClose:
    async def test_close_is_idempotent(self, server) -> None:
        adapter = _adapter(server)
        await adapter.connect(_config())
        await adapter.close()
        await adapter.close()

    async def test_send_after_close_raises(self, server) -> None:
        adapter = _adapter(server)
        await adapter.connect(_config())
        await adapter.close()
        with pytest.raises(ProviderError):
            await adapter.send_audio_chunk(b"\x00\x01")
