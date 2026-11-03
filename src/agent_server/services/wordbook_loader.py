"""词书导入（SPEC 5.1）。

支持 JSON 与 CSV 两种格式，容忍常见字段名变体（不同来源的词表五花八门）。
导入后为每个词初始化一张 FSRS 新卡，并按批次异步打场景标签。
"""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

from ..db.models import DEFAULT_USER_ID
from ..db.repos import add_words_with_cards
from sqlalchemy.ext.asyncio import AsyncSession

# SPEC 5.1 规定的场景标签枚举池
TOPIC_POOL = [
    "tech_dev",
    "workplace_comm",
    "daily_life",
    "travel_dining",
    "finance_business",
    "emotion_opinion",
    "problem_solving",
]

# 常见字段名变体 -> 标准字段
_FIELD_ALIASES = {
    "word": ["word", "english", "term", "headword", "单词"],
    "phonetic_us": ["phonetic_us", "phonetic", "us_phonetic", "ipa", "音标", "phonetic_uk"],
    "definitions": ["definitions", "definition", "meaning", "meanings", "释义", "中文"],
    "pos": ["pos", "part_of_speech", "词性"],
    "topic_tags": ["topic_tags", "topics", "tags", "场景标签"],
}


class WordbookError(ValueError):
    """词书格式错误。"""


def _pick(row: dict, field: str):
    for alias in _FIELD_ALIASES[field]:
        if alias in row and row[alias] not in (None, ""):
            return row[alias]
    return None


def _normalize_definitions(raw) -> list[dict]:
    """把各种释义写法统一成 [{"pos": "v.", "def": "..."}]。"""
    if raw is None:
        return []
    if isinstance(raw, str):
        # "v. 弃用；反对" 或 "弃用；反对"
        text = raw.strip()
        pos = ""
        parts = text.split(maxsplit=1)
        if parts and parts[0].endswith(".") and len(parts[0]) <= 5:
            pos = parts[0]
            text = parts[1] if len(parts) > 1 else ""
        return [{"pos": pos, "def": text}] if text else []
    if isinstance(raw, dict):
        return [{"pos": raw.get("pos", ""), "def": raw.get("def") or raw.get("meaning", "")}]
    if isinstance(raw, list):
        out = []
        for item in raw:
            if isinstance(item, dict):
                out.append(
                    {"pos": item.get("pos", ""), "def": item.get("def") or item.get("meaning", "")}
                )
            elif isinstance(item, str):
                out.extend(_normalize_definitions(item))
        return out
    return []


def parse_wordbook(content: bytes, filename: str) -> list[dict]:
    """解析词书内容为标准化词条列表。"""
    text = content.decode("utf-8-sig", errors="replace")
    name = filename.lower()

    if name.endswith(".json"):
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise WordbookError(f"JSON 解析失败: {exc}") from exc
        if isinstance(data, dict):
            data = data.get("words") or data.get("data") or data.get("items") or []
        if not isinstance(data, list):
            raise WordbookError("JSON 词书应为数组，或包含 words/data/items 数组")
        rows = data
    elif name.endswith((".csv", ".txt")):
        rows = list(csv.DictReader(io.StringIO(text)))
    else:
        raise WordbookError(f"不支持的词书格式: {filename}（仅支持 .json/.csv/.txt）")

    entries: list[dict] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        word = _pick(row, "word")
        if not word:
            continue
        word = str(word).strip()
        if not word:
            continue

        defs = _normalize_definitions(_pick(row, "definitions"))
        if not defs:
            # 兼容 pos 与 definitions 分列的情况
            defs = _normalize_definitions(row)

        tags = _pick(row, "topic_tags")
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.replace("|", ",").split(",") if t.strip()]
        elif not isinstance(tags, list):
            tags = []

        entries.append(
            {
                "word": word,
                "phonetic_us": _pick(row, "phonetic_us"),
                "pos_defs": defs,
                "topic_tags": [t for t in tags if t in TOPIC_POOL],
            }
        )
    return entries


async def import_wordbook(
    session: AsyncSession,
    content: bytes,
    filename: str,
    book_name: str | None = None,
    user_id: str = DEFAULT_USER_ID,
) -> dict:
    """导入词书，返回统计。"""
    entries = parse_wordbook(content, filename)
    if not entries:
        raise WordbookError("词书中没有解析到任何有效词条")

    book = book_name or Path(filename).stem
    words, skipped = await add_words_with_cards(session, entries, book, user_id)
    await session.commit()
    return {
        "book_name": book,
        "parsed": len(entries),
        "imported": len(words),
        "skipped": skipped,
        "need_tagging": sum(1 for w in words if not w.topic_tags),
    }
