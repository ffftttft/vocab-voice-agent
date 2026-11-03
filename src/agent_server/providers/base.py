"""三大模型阶段的抽象接口（SPEC 3.2）。

铁律：业务代码只依赖本模块的抽象类，永不 import 具体实现。
具体实现由 `registry.ProviderRegistry` 按配置动态实例化。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any, Literal, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class VoiceSessionConfig(BaseModel):
    """建立实时语音会话所需的全部参数。"""

    system_prompt: str
    voice_id: str = ""
    model_name: str = ""
    input_sample_rate: int = 16000
    output_sample_rate: int = 24000
    tools: list[dict] = []


class TimestampedEvent(BaseModel):
    """下行事件的基类，保证所有事件都有可辨识的 kind。"""

    kind: str


class AudioDeltaEvent(TimestampedEvent):
    """模型返回的流式音频帧（24kHz PCM16）。"""

    kind: Literal["audio_delta"] = "audio_delta"
    pcm24: bytes


class TranscriptDeltaEvent(TimestampedEvent):
    kind: Literal["transcript_delta"] = "transcript_delta"
    role: Literal["user", "assistant"]
    text: str
    is_final: bool = False


class ToolCallEvent(TimestampedEvent):
    kind: Literal["tool_call"] = "tool_call"
    call_id: str
    name: str
    arguments: dict


class SpeechStartedEvent(TimestampedEvent):
    """服务端 VAD 检测到用户开口，前端应立即清空播放队列。"""

    kind: Literal["speech_started"] = "speech_started"


class SessionClosedEvent(TimestampedEvent):
    kind: Literal["session_closed"] = "session_closed"
    reason: str = ""


VoiceEvent = (
    AudioDeltaEvent | TranscriptDeltaEvent | ToolCallEvent | SpeechStartedEvent | SessionClosedEvent
)


class TextLLMProvider(ABC):
    """阶段 1：文本大模型。"""

    @abstractmethod
    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: type[T],
        temperature: float | None = None,
    ) -> T:
        """返回严格符合 Pydantic Schema 的结构化对象。"""

    @abstractmethod
    def stream_text(
        self,
        system_prompt: str,
        messages: list[dict],
        temperature: float | None = None,
    ) -> AsyncIterator[str]:
        """流式生成文本，用于按需 SSE 提示。"""


class RealtimeVoiceProvider(ABC):
    """阶段 2：端到端实时语音模型。"""

    @abstractmethod
    async def connect(self, session_config: VoiceSessionConfig) -> None: ...

    @abstractmethod
    async def send_audio_chunk(self, pcm16_bytes: bytes) -> None: ...

    @abstractmethod
    async def update_instructions(self, new_system_prompt: str) -> None: ...

    @abstractmethod
    async def send_tool_result(self, call_id: str, result_json: str) -> None: ...

    @abstractmethod
    async def interrupt(self) -> None: ...

    @abstractmethod
    def events(self) -> AsyncIterator[VoiceEvent]:
        """下游事件流。"""

    @abstractmethod
    async def close(self) -> None: ...


class TTSProvider(ABC):
    """阶段 3：语音合成，带本地磁盘缓存。"""

    @abstractmethod
    async def synthesize_to_file(self, text: str, cache_key: str) -> Path:
        """合成并返回本地文件路径；命中缓存则直接返回。"""

    @abstractmethod
    def cache_key_for(self, text: str) -> str:
        """sha256(provider + voice_id + text)，SPEC 3.2 规定。"""


class ProviderError(RuntimeError):
    """提供商调用失败的统一异常。"""
