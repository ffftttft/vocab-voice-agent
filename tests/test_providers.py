import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.agent_server.config import AppConfig, ModelsConfig, ModelStageConfig  # noqa: E402
from src.agent_server.providers.base import ProviderError  # noqa: E402
from src.agent_server.providers.llm.openai_compat import (  # noqa: E402
    OpenAICompatibleLLMProvider,
    _strip_code_fence,
)
from src.agent_server.providers.registry import ProviderRegistry  # noqa: E402
from src.agent_server.providers.tts.edge_tts_impl import EdgeTTSProvider  # noqa: E402


class DemoModel(BaseModel):
    name: str
    score: int


def _llm() -> OpenAICompatibleLLMProvider:
    return OpenAICompatibleLLMProvider(
        base_url="https://example.invalid/v1", api_key="k", model_name="m"
    )


def _fake_response(content: str):
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = content
    return resp


class TestStripCodeFence:
    @pytest.mark.parametrize(
        ("raw", "expected"),
        [
            ('{"a": 1}', '{"a": 1}'),
            ('```json\n{"a": 1}\n```', '{"a": 1}'),
            ('```\n{"a": 1}\n```', '{"a": 1}'),
            ('  {"a": 1}  ', '{"a": 1}'),
        ],
    )
    def test_strips_fences(self, raw: str, expected: str) -> None:
        assert _strip_code_fence(raw) == expected


class TestGenerateStructured:
    async def test_parses_valid_json(self) -> None:
        provider = _llm()
        provider._client.chat.completions.create = AsyncMock(
            return_value=_fake_response('{"name": "alice", "score": 9}')
        )
        result = await provider.generate_structured("sys", "user", DemoModel)
        assert isinstance(result, DemoModel)
        assert result.name == "alice"
        await provider.close()

    async def test_schema_injected_into_system_prompt(self) -> None:
        provider = _llm()
        mock_create = AsyncMock(return_value=_fake_response('{"name": "a", "score": 1}'))
        provider._client.chat.completions.create = mock_create
        await provider.generate_structured("BASE_PROMPT", "user", DemoModel)
        sent = mock_create.call_args.kwargs["messages"][0]["content"]
        assert "BASE_PROMPT" in sent
        assert "JSON Schema" in sent
        assert '"score"' in sent
        await provider.close()

    async def test_self_heals_after_invalid_json(self) -> None:
        """SPEC 3.2 要求解析失败自动触发最多 2 次带错误信息的自愈重试。"""
        provider = _llm()
        provider._client.chat.completions.create = AsyncMock(
            side_effect=[
                _fake_response("not json at all"),
                _fake_response('{"name": "fixed", "score": 3}'),
            ]
        )
        result = await provider.generate_structured("sys", "user", DemoModel)
        assert result.name == "fixed"
        assert provider._client.chat.completions.create.call_count == 2
        await provider.close()

    async def test_raises_after_three_failures(self) -> None:
        provider = _llm()
        provider._client.chat.completions.create = AsyncMock(
            return_value=_fake_response("still not json")
        )
        with pytest.raises(ProviderError, match="structured generation failed"):
            await provider.generate_structured("sys", "user", DemoModel)
        # 首次 + 2 次自愈
        assert provider._client.chat.completions.create.call_count == 3
        await provider.close()

    async def test_rejects_schema_violating_json(self) -> None:
        provider = _llm()
        provider._client.chat.completions.create = AsyncMock(
            return_value=_fake_response('{"name": "x", "score": "not-a-number"}')
        )
        with pytest.raises(ProviderError):
            await provider.generate_structured("sys", "user", DemoModel)
        await provider.close()


class TestEdgeTTS:
    def test_cache_key_is_deterministic(self, tmp_path: Path) -> None:
        tts = EdgeTTSProvider("v1", tmp_path)
        assert tts.cache_key_for("hello") == tts.cache_key_for("hello")

    def test_cache_key_differs_by_voice_and_text(self, tmp_path: Path) -> None:
        a = EdgeTTSProvider("v1", tmp_path)
        b = EdgeTTSProvider("v2", tmp_path)
        assert a.cache_key_for("hello") != b.cache_key_for("hello")
        assert a.cache_key_for("hello") != a.cache_key_for("world")

    def test_cache_key_is_sha256_hex(self, tmp_path: Path) -> None:
        key = EdgeTTSProvider("v1", tmp_path).cache_key_for("hello")
        assert len(key) == 64
        assert all(c in "0123456789abcdef" for c in key)

    async def test_returns_cached_file_without_network(self, tmp_path: Path) -> None:
        tts = EdgeTTSProvider("v1", tmp_path)
        key = tts.cache_key_for("hello")
        cached = tmp_path / f"{key}.mp3"
        cached.write_bytes(b"fake-mp3-bytes")

        with patch("edge_tts.Communicate", side_effect=AssertionError("不应该调用网络")):
            path = await tts.synthesize_to_file("hello")
        assert path == cached

    async def test_rejects_empty_text(self, tmp_path: Path) -> None:
        with pytest.raises(ProviderError):
            await EdgeTTSProvider("v1", tmp_path).synthesize_to_file("   ")

    def test_sanitize_strips_emphasis_markers(self) -> None:
        assert EdgeTTSProvider.sanitize_for_tts("I **deprecate** that") == "I deprecate that"


class TestProviderRegistry:
    def _config(self, **kwargs) -> AppConfig:
        text = ModelStageConfig(
            provider="openai_compatible",
            base_url="https://api.example/v1",
            api_key="secret",
            model_name="deepseek-v4.1-flash",
            temperature=0.6,
        )
        tts = ModelStageConfig(provider="edge_tts", voice_id="en-US-Andrew")
        return AppConfig(models=ModelsConfig(text_llm=text, tts=tts, **kwargs))

    def test_registry_returns_configured_llm(self, tmp_path: Path) -> None:
        reg = ProviderRegistry(self._config(), tmp_path)
        llm = reg.get_text_llm()
        assert isinstance(llm, OpenAICompatibleLLMProvider)
        assert llm.model_name == "deepseek-v4.1-flash"
        assert llm.temperature == 0.6

    def test_registry_caches_instances(self, tmp_path: Path) -> None:
        reg = ProviderRegistry(self._config(), tmp_path)
        assert reg.get_text_llm() is reg.get_text_llm()

    def test_reload_clears_cache(self, tmp_path: Path) -> None:
        """热切换：config 更新后必须拿到新实例。"""
        reg = ProviderRegistry(self._config(), tmp_path)
        first = reg.get_text_llm()
        new_config = self._config()
        new_config.models.text_llm.model_name = "qwen-max"
        reg.reload(new_config)
        second = reg.get_text_llm()
        assert second is not first
        assert second.model_name == "qwen-max"

    def test_missing_llm_config_raises(self, tmp_path: Path) -> None:
        reg = ProviderRegistry(AppConfig(), tmp_path)
        with pytest.raises(ProviderError, match="text_llm"):
            reg.get_text_llm()

    def test_unregistered_voice_provider_raises_with_hint(self, tmp_path: Path) -> None:
        cfg = self._config()
        cfg.models.realtime_voice.provider = "doubao_realtime"
        reg = ProviderRegistry(cfg, tmp_path)
        with pytest.raises(ProviderError, match="doubao_realtime"):
            reg.get_realtime_voice()

    def test_unknown_tts_provider_raises(self, tmp_path: Path) -> None:
        cfg = self._config()
        cfg.models.tts.provider = "nonexistent"
        reg = ProviderRegistry(cfg, tmp_path)
        with pytest.raises(ProviderError, match="未注册的 TTS"):
            reg.get_tts()
