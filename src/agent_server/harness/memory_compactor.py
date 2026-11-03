"""每日记忆压缩（SPEC 5.5）。

触发：点「结束今日学习」时异步触发，或凌晨 04:00 定时兜底。

流程：
  今日 transcript + 今日 mistakes + 现有两份 md
     ↓ LLM 结构化归并
  user_profile.md 追加「## 近期动态」
  error_patterns.md 聚合 Top 15
     ↓
  transcript_json 置 NULL（释放空间 + 隔离上下文）
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import (
    DEFAULT_USER_ID,
    MISTAKE_GRAMMAR,
    MISTAKE_PRONUNCIATION,
    LinguisticMistake,
    VoiceSession,
)
from ..providers.base import TextLLMProvider
from ..services.memory_store import MemoryStore

COMPACT_SYSTEM = """你是记忆整理助手。你在处理一位英语学习者的对话记录与错误记录，
需要从中提炼出**值得长期保留**的信息。

{user_profile}

## 提炼原则
1. 只提取**新出现**的个人事实与长期有效的错误模式，不要重复已有内容。
2. 忽略一次性的寒暄、天气、无关闲聊。
3. 错误模式要抽象成可复用的规律（"过去时标记缺失"），不要照抄原句。
4. 每条都精简到一句话以内。
5. 宁缺毋滥：没有值得保留的就返回空数组。
"""

COMPACT_USER = """今日日期：{today}

## 今日对话转写
{transcript}

## 今日错误记录
{mistakes}

## 当前的近期动态（不要重复这些）
{existing_recent}

## 当前的错误病历（不要重复这些）
{existing_errors}
"""


class CompactionResult(BaseModel):
    """LLM 的结构化输出。"""

    new_profile_events: list[str] = Field(
        default_factory=list, description="值得加入个人画像「近期动态」的新事实，每条一句话"
    )
    pronunciation_patterns: list[str] = Field(
        default_factory=list, description="发音易错点规律，如「deprecate 重音位置错误」"
    )
    grammar_patterns: list[str] = Field(
        default_factory=list, description="语法/用词盲区规律，如「过去时标记缺失」"
    )


class MemoryCompactor:
    def __init__(self, llm: TextLLMProvider, memory: MemoryStore) -> None:
        self.llm = llm
        self.memory = memory

    async def compact(
        self,
        session: AsyncSession,
        plan_date: date,
        user_id: str = DEFAULT_USER_ID,
        clear_transcript: bool = True,
    ) -> dict:
        sessions = (
            (
                await session.execute(
                    select(VoiceSession).where(
                        VoiceSession.plan_date == plan_date, VoiceSession.user_id == user_id
                    )
                )
            )
            .scalars()
            .all()
        )

        transcript_text = _format_transcripts(sessions)
        mistakes = (
            (
                await session.execute(
                    select(LinguisticMistake).where(
                        LinguisticMistake.plan_date == plan_date,
                        LinguisticMistake.user_id == user_id,
                    )
                )
            )
            .scalars()
            .all()
        )
        mistakes_text = _format_mistakes(mistakes)

        if not transcript_text.strip() and not mistakes_text.strip():
            return {
                "skipped": True,
                "reason": "今日无对话记录与错误记录",
                "profile_events_added": 0,
                "pronunciation_added": 0,
                "grammar_added": 0,
                "transcripts_cleared": 0,
            }

        existing_profile = self.memory.read_profile()
        existing_errors = self.memory.read_errors()

        result = await self.llm.generate_structured(
            system_prompt=COMPACT_SYSTEM.format(user_profile=existing_profile),
            user_prompt=COMPACT_USER.format(
                today=plan_date.isoformat(),
                transcript=transcript_text or "（无）",
                mistakes=mistakes_text or "（无）",
                existing_recent=_extract_section(existing_profile, "## 近期动态"),
                existing_errors=existing_errors,
            ),
            response_model=CompactionResult,
        )

        events_added = self.memory.append_recent_events(result.new_profile_events, plan_date)
        merge_stats = self.memory.merge_error_patterns(
            result.pronunciation_patterns, result.grammar_patterns
        )

        cleared = 0
        if clear_transcript:
            for vs in sessions:
                if vs.transcript_json is not None:
                    vs.transcript_json = None
                    cleared += 1
            await session.commit()

        return {
            "skipped": False,
            "profile_events_added": events_added,
            "pronunciation_added": merge_stats["pronunciation_added"],
            "grammar_added": merge_stats["grammar_added"],
            "transcripts_cleared": cleared,
        }


def _format_transcripts(sessions: list[VoiceSession]) -> str:
    lines = []
    for vs in sessions:
        if not vs.transcript_json:
            continue
        for entry in vs.transcript_json:
            role = "AI" if entry.get("role") == "assistant" else "用户"
            text = entry.get("text", "").strip()
            if text:
                lines.append(f"{role}: {text}")
    return "\n".join(lines)


def _format_mistakes(mistakes: list[LinguisticMistake]) -> str:
    labels = {
        MISTAKE_PRONUNCIATION: "发音",
        MISTAKE_GRAMMAR: "语法",
    }
    lines = []
    for m in mistakes:
        label = labels.get(m.mistake_type, "用词")
        line = f"- [{label}] 说了「{m.user_original}」→ 应为「{m.corrected_version}」"
        if m.explanation:
            line += f"（{m.explanation}）"
        lines.append(line)
    return "\n".join(lines)


def _extract_section(content: str, header: str) -> str:
    lines = content.splitlines()
    start = None
    for i, line in enumerate(lines):
        if line.strip() == header:
            start = i
            break
    if start is None:
        return "（无）"
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if lines[j].startswith("## "):
            end = j
            break
    body = "\n".join(lines[start + 1 : end]).strip()
    return body or "（无）"
