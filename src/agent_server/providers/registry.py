"""Provider 动态工厂（SPEC 3.1/3.2：运行时切换，零硬编码）。

业务代码永远不 import 具体实现，只调用：
    registry.get_text_llm()
    registry.get_tts()
    registry.get_realtime_voice()

实现类与配置字符串的映射集中在这里，新增厂商只需在此登记一行。
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from ..config import AppConfig, ModelStageConfig
from .base import ProviderError, RealtimeVoiceProvider, TextLLMProvider, TTSProvider
from .llm.openai_compat import OpenAICompatibleLLMProvider
from .tts.edge_tts_impl import EdgeTTSProvider
from .voice.qwen_omni import QwenOmniRealtimeAdapter

# 已注册的 voice 实现。MVP 只实现 qwen_omni（SPEC 允许备选后置）
_VOICE_FACTORIES: dict[str, Callable[[ModelStageConfig], RealtimeVoiceProvider]] = {
    "qwen_omni": lambda cfg: QwenOmniRealtimeAdapter(
        ws_url=cfg.ws_url,
        api_key=cfg.api_key,
        model_name=cfg.model_name or "qwen-omni-turbo-realtime",
        voice_id=cfg.voice_id or "Chelsie",
    ),
}
# 已注册的 tts 实现
_TTS_FACTORIES: dict[str, Callable[[ModelStageConfig, Path], TTSProvider]] = {
    "edge_tts": lambda cfg, cache_dir: EdgeTTSProvider(
        voice_id=cfg.voice_id or "en-US-AndrewMultilingualNeural",
        cache_dir=cache_dir,
    ),
}


def register_voice_provider(name: str, factory) -> None:  # type: ignore[no-untyped-def]
    _VOICE_FACTORIES[name] = factory


def register_tts_provider(name: str, factory) -> None:  # type: ignore[no-untyped-def]
    _TTS_FACTORIES[name] = factory


class ProviderRegistry:
    """按当前配置动态实例化并缓存各阶段 provider。"""

    def __init__(self, config: AppConfig, cache_dir: Path) -> None:
        self._config = config
        self._cache_dir = cache_dir
        self._text_llm: TextLLMProvider | None = None
        self._tts: TTSProvider | None = None

    def reload(self, config: AppConfig) -> None:
        """热切换：配置更新后清空缓存实例，下次调用重新构造。"""
        self._config = config
        self._text_llm = None
        self._tts = None

    @property
    def config(self) -> AppConfig:
        return self._config

    def get_text_llm(self) -> TextLLMProvider:
        if self._text_llm is None:
            cfg = self._config.models.text_llm
            if not cfg.base_url or not cfg.model_name:
                raise ProviderError("text_llm 未配置 base_url 或 model_name")
            self._text_llm = OpenAICompatibleLLMProvider(
                base_url=cfg.base_url,
                api_key=cfg.api_key,
                model_name=cfg.model_name,
                temperature=cfg.temperature if cfg.temperature is not None else 0.7,
                extra_body=cfg.extra_body,
            )
        return self._text_llm

    def get_tts(self) -> TTSProvider:
        if self._tts is None:
            cfg = self._config.models.tts
            name = cfg.provider or "edge_tts"
            factory = _TTS_FACTORIES.get(name)
            if factory is None:
                raise ProviderError(
                    f"未注册的 TTS provider: {name!r}，已注册: {sorted(_TTS_FACTORIES)}"
                )
            self._tts = factory(cfg, self._cache_dir)
        return self._tts

    def get_realtime_voice(self) -> RealtimeVoiceProvider:
        cfg = self._config.models.realtime_voice
        name = cfg.provider or ""
        factory = _VOICE_FACTORIES.get(name)
        if factory is None:
            raise ProviderError(
                f"未注册的实时语音 provider: {name!r}，已注册: {sorted(_VOICE_FACTORIES)}"
            )
        return factory(cfg)
