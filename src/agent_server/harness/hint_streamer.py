"""按需 SSE 示例回答（SPEC 5.4）。

**核心约束：绝不预生成。** 只有用户点了「提示示例回答」按钮才走到这里。

输出协议（SSE）：
    data: {"type": "hint", "chunk": "EN: I "}
    ...
    data: {"type": "done", "en": "...", "zh": "..."}
"""

from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator

from ..providers.base import TextLLMProvider
from ..services.memory_store import MemoryStore

HINT_SYSTEM = """你是一个口语实战助攻助手。用户正在进行实时英语语音对话，面对 AI 刚才的提问卡壳了。

{user_profile}

## 任务
结合用户背景，直接给出一个地道、自然、口语化的**第一人称**英文回答示例：
- 长度 1~2 句话，15~30 个单词
- 尽可能自然地融入给定的待考目标词中的 1~2 个
- 必须是用户真的会说的话，不要书面语、不要演讲腔

## 输出格式（严格遵守，不要任何多余寒暄）
EN: <英文示例句子，用到的目标词用 **词** 包裹>
ZH: <对应的中文意思>
"""


class HintStreamer:
    def __init__(self, llm: TextLLMProvider, memory: MemoryStore) -> None:
        self.llm = llm
        self.memory = memory

    async def stream(self, active_words: list[str], transcript: list[dict]) -> AsyncIterator[str]:
        """产出 SSE 事件流。"""
        words_repr = "、".join(active_words) if active_words else "（无特定目标词）"
        recent = "\n".join(
            f"{'AI' if e['role'] == 'assistant' else '用户'}: {e['text']}" for e in transcript[-8:]
        )

        system = HINT_SYSTEM.format(user_profile=self.memory.read_profile())
        messages = []
        if recent:
            messages.append({"role": "user", "content": f"最近的对话：\n{recent}"})
        messages.append(
            {
                "role": "user",
                "content": f"待考目标词：{words_repr}\n请给我一个示例回答。",
            }
        )

        buffer = []
        try:
            async for chunk in self.llm.stream_text(system, messages):
                buffer.append(chunk)
                yield _sse({"type": "hint", "chunk": chunk})
        except Exception as exc:  # noqa: BLE001
            yield _sse({"type": "error", "message": f"提示生成失败：{exc}"})
            return

        full = "".join(buffer)
        en, zh = parse_hint(full)
        yield _sse({"type": "done", "en": en, "zh": zh})


def parse_hint(text: str) -> tuple[str, str]:
    """从模型输出里解析 EN / ZH 两行。

    容忍模型不听话加上的 Markdown 代码块或额外空行。
    """
    cleaned = text.replace("```", "").strip()
    en, zh = "", ""
    # 兼容半角 ":" 与全角 "："，模型两种都会输出
    en_prefixes = ("EN:", "EN：")
    zh_prefixes = ("ZH:", "ZH：")
    for line in cleaned.splitlines():
        stripped = line.strip()
        upper = stripped.upper()
        if upper.startswith(en_prefixes):
            en = stripped[3:].strip()
        elif upper.startswith(zh_prefixes):
            zh = stripped[3:].strip()

    # 兜底：模型没按格式输出时，把整段当英文示例
    if not en:
        plain = re.sub(r"^(EN|ZH)\s*[:：]", "", cleaned, flags=re.IGNORECASE).strip()
        # 去掉可能残留的 ZH 行
        plain = re.split(r"\n\s*ZH\s*[:：]", plain, flags=re.IGNORECASE)[0].strip()
        en = plain
    return en, zh


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
