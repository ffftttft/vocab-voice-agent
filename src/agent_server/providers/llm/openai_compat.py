"""通用 OpenAI 兼容文本模型实现（SPEC 3.2(1)）。

兼容 DeepSeek / Qwen / GLM / 中转站等所有 OpenAI 协议接口。

关键实现点：不同厂商对 `response_format` 与 `json_schema` 的支持参差不齐，
因此本实现不依赖厂商的 structured outputs，而是：
  1. 把 Pydantic model_json_schema() 注入 system prompt
  2. 请求 response_format={"type": "json_object"}
  3. 收到后用 model_validate_json() 校验
  4. 校验失败带错误信息自愈重试，最多 2 次（SPEC 明确要求）
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import TypeVar

from openai import AsyncOpenAI
from pydantic import ValidationError

from ..base import ProviderError, TextLLMProvider

T = TypeVar("T")

_MAX_REPAIR_ATTEMPTS = 2


class OpenAICompatibleLLMProvider(TextLLMProvider):
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model_name: str,
        temperature: float = 0.7,
        extra_body: dict | None = None,
        timeout: float = 120.0,
    ) -> None:
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=timeout)
        self.model_name = model_name
        self.temperature = temperature
        self.extra_body = extra_body or {}

    async def generate_structured(
        self,
        system_prompt: str,
        user_prompt: str,
        response_model: type[T],
        temperature: float | None = None,
    ) -> T:  # type: ignore[type-var]
        schema_json = json.dumps(response_model.model_json_schema(), ensure_ascii=False, indent=2)
        strict_system = (
            f"{system_prompt}\n\n"
            "## 输出格式硬约束\n"
            "你必须只输出一个 JSON 对象，不要输出 Markdown 代码块、不要任何解释文字。\n"
            f"该 JSON 必须严格符合以下 JSON Schema：\n{schema_json}"
        )

        messages: list[dict] = [
            {"role": "system", "content": strict_system},
            {"role": "user", "content": user_prompt},
        ]
        last_error: Exception | None = None

        for attempt in range(_MAX_REPAIR_ATTEMPTS + 1):
            try:
                resp = await self._client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,  # type: ignore[arg-type]
                    temperature=temperature if temperature is not None else self.temperature,
                    response_format={"type": "json_object"},
                    extra_body=self.extra_body or None,
                )
                content = resp.choices[0].message.content or ""
                return response_model.model_validate_json(_strip_code_fence(content))  # type: ignore[attr-defined]
            except (ValidationError, json.JSONDecodeError) as exc:
                last_error = exc
                if attempt >= _MAX_REPAIR_ATTEMPTS:
                    break
                # 自愈：把上一次的错误回灌给模型
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            "上一次输出无法通过 JSON Schema 校验，错误如下：\n"
                            f"{exc}\n请重新输出，确保严格符合 schema。"
                        ),
                    }
                )
            except Exception as exc:  # noqa: BLE001
                raise ProviderError(f"text LLM call failed: {exc}") from exc

        raise ProviderError(
            f"structured generation failed after {_MAX_REPAIR_ATTEMPTS + 1} attempts: {last_error}"
        )

    async def stream_text(
        self,
        system_prompt: str,
        messages: list[dict],
        temperature: float | None = None,
    ) -> AsyncIterator[str]:
        stream = await self._client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "system", "content": system_prompt}, *messages],  # type: ignore[arg-type,list-item]
            temperature=temperature if temperature is not None else self.temperature,
            stream=True,
            extra_body=self.extra_body or None,
        )
        async for chunk in stream:  # type: ignore[union-attr]
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content

    async def close(self) -> None:
        await self._client.close()


def _strip_code_fence(text: str) -> str:
    """部分模型仍会包 ```json ... ```，剥掉再解析。"""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        return "\n".join(lines).strip()
    return stripped
