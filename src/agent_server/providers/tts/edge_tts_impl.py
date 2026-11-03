"""Edge-TTS 适配器（免费、高自然度，SPEC 3.2 默认 TTS）。

缓存策略（SPEC 3.2(3)）：文件名 = sha256(provider + voice_id + text)。
命中 `/data/audio_cache/{hash}.mp3` 则直接返回，不打网络。
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from ..base import ProviderError, TTSProvider


class EdgeTTSProvider(TTSProvider):
    provider_name = "edge_tts"

    def __init__(self, voice_id: str, cache_dir: Path, rate: str = "+0%") -> None:
        self.voice_id = voice_id
        self.cache_dir = cache_dir
        self.rate = rate

    def cache_key_for(self, text: str) -> str:
        raw = f"{self.provider_name}:{self.voice_id}:{self.rate}:{text}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _path_for(self, cache_key: str) -> Path:
        return self.cache_dir / f"{cache_key}.mp3"

    async def synthesize_to_file(self, text: str, cache_key: str | None = None) -> Path:
        if not text.strip():
            raise ProviderError("cannot synthesize empty text")

        key = cache_key or self.cache_key_for(text)
        target = self._path_for(key)
        target.parent.mkdir(parents=True, exist_ok=True)

        if target.exists() and target.stat().st_size > 0:
            return target

        # 延迟导入：edge_tts 只在真正合成时加载，避免拖慢启动
        import edge_tts

        tmp = target.with_suffix(".tmp.mp3")
        try:
            communicate = edge_tts.Communicate(text, self.voice_id, rate=self.rate)
            await communicate.save(str(tmp))
            tmp.replace(target)  # 原子替换，避免并发读到半个文件
        except Exception as exc:  # noqa: BLE001
            tmp.unlink(missing_ok=True)
            raise ProviderError(f"edge-tts failed: {exc}") from exc

        if not target.exists() or target.stat().st_size == 0:
            raise ProviderError("edge-tts produced empty file")
        return target

    @staticmethod
    def sanitize_for_tts(text: str) -> str:
        """去掉 **强调** 标记等不适合朗读的字符。"""
        return re.sub(r"\*\*(.*?)\*\*", r"\1", text).strip()
