"""每日场景化组局引擎（SPEC 5.1）。

流程：
  Step 1  取到期复习词
  Step 2  场景聚类 → 选新词 → 拟场景标题
  Step 3  并发生成定制例句 + 同词性 4 选 1
  Step 4  预热 TTS 音频

设计约束：
- **不写死模型**：全部通过 TextLLMProvider / TTSProvider 抽象。
- **Step 2 的新词查询用 stability IS NULL**，不是 SPEC 的 state == 0（见 STATUS.md D1）。
- 批大小、并发度可通过构造参数调整，便于按实际 API 延迟调优。
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import date

from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import StudyPlanConfig
from ..db.models import (
    DEFAULT_USER_ID,
    ITEM_NEW,
    ITEM_REVIEW,
    PLAN_STUDYING,
    DailyPlanItem,
    FSRSCard,
    Word,
)
from ..db.repos import (
    get_due_review_words,
    get_new_word_candidates_by_topics,
    get_or_create_plan,
    top_topic_tags,
)
from ..providers.base import TextLLMProvider, TTSProvider
from ..services.memory_store import MemoryStore

BATCH_SIZE = 15
MAX_CONCURRENT_BATCHES = 4


# ---------------------------------------------------------------- 结构化输出契约


class SelectedWord(BaseModel):
    word: str
    reason: str = ""


class ScenarioSelection(BaseModel):
    """Step 2 的 LLM 输出。"""

    scenario_title: str = Field(description="今日场景主题，中文，如「线上故障排查」")
    scenario_brief: str = Field(description="场景背景简述，2-3 句中文，用于晚上语音开场")
    selected_words: list[SelectedWord] = Field(default_factory=list)
    voice_candidates: list[str] = Field(
        default_factory=list, description="适合作为晚间口语主动输出的词"
    )


class McqOption(BaseModel):
    label: str
    pos: str
    text: str
    is_correct: bool = False


class WordCard(BaseModel):
    """Step 3 的单个词输出。"""

    word: str
    sentence_en: str
    sentence_zh: str
    target_pos: str = Field(description="目标词在该例句中的词性，如 v.")
    options: list[McqOption]
    is_voice_target: bool = False


class WordCardBatch(BaseModel):
    cards: list[WordCard] = Field(default_factory=list)


# ---------------------------------------------------------------- Prompt


SCENARIO_SYSTEM = """你是一位英语教学场景设计师，服务对象是一名中国程序员。

{user_profile}

## 任务
从候选词中挑选最能自然融入【同一个连贯真实场景】的词，构成今日学习组。

## 硬性约束
1. 所有选中的词必须能出现在**同一个具体场景**里（如同一场代码评审、同一次线上故障）。
2. 优先选程序员日常真正会说的词，避开学术生僻词。
3. scenario_title 用中文，不超过 20 字，要具体（"和同事争论接口设计"好过"工作"）。
4. scenario_brief 用中文写 2-3 句，描述这个场景发生了什么，晚上 AI 会据此开场。
5. selected_words 数量必须正好 {count} 个，只能从候选词表中选，不得自创。
6. voice_candidates 从中挑 {voice_count} 个最适合口语主动使用的词（具体名词/动词优先，
   抽象词靠后）。
"""

SCENARIO_USER = """今日日期：{today}

候选新词（word | 释义 | 场景标签）：
{candidates}
"""

CARD_SYSTEM = """你是一位英语教学材料编写者，服务对象是一名中国程序员，英语水平：能读简单单词，
但**几乎无法组织完整句子开口说话**。

{user_profile}

今日场景：{scenario_title}
场景背景：{scenario_brief}

## 任务
为下列每个词生成一张背词卡片。

## 硬性约束（违反任意一条即不合格）
1. **例句长度 10~22 个英文单词**，必须是这个程序员在今日场景下真的会说出口的话。
   杜绝鸡汤、杜绝名言、杜绝"作为一名开发者，我认为……"这类作文腔。
2. 例句必须包含目标词的原形或其屈折变化。
3. **4 个中文选项的词性必须完全一致**（目标词在例句中作动词，则 4 个选项都以 "v." 开头）。
4. 3 个干扰项要有迷惑性，分别是：
   - 1 个形近词或同根词的释义
   - 1 个反义/近义边界的释义
   - 1 个同场景常见词的释义
   严禁出现一眼假的选项。
5. 干扰项的词义必须与正确项**语义距离足够近**，让人需要真的想一下。
6. options 里必须有且只有 1 个 is_correct=true。
7. is_voice_target：该词是否适合晚间口语对话中主动说出（具体、高频、好造句 → true）。
"""

CARD_USER = """今日日期：{today}
要生成卡片的词：
{words}
"""


@dataclass
class PlanResult:
    plan_date: date
    scenario_title: str
    scenario_brief: str
    new_count: int
    review_count: int
    voice_target_count: int
    audio_ready: int = 0
    warnings: list[str] = field(default_factory=list)


class DailyPlanner:
    def __init__(
        self,
        llm: TextLLMProvider,
        tts: TTSProvider,
        memory: MemoryStore,
        study_plan: StudyPlanConfig,
        batch_size: int = BATCH_SIZE,
    ) -> None:
        self.llm = llm
        self.tts = tts
        self.memory = memory
        self.study_plan = study_plan
        self.batch_size = batch_size

    # ------------------------------------------------------------ 入口
    async def generate_plan(
        self,
        session: AsyncSession,
        plan_date: date,
        user_id: str = DEFAULT_USER_ID,
        warm_audio: bool = True,
    ) -> PlanResult:
        plan = await get_or_create_plan(session, plan_date, user_id)
        profile = self.memory.read_profile()

        # Step 1：到期复习词
        due = await get_due_review_words(session, self.study_plan.daily_review_limit, user_id)

        # Step 2：场景聚类选新词
        scenario = await self._select_scenario(session, plan_date, due, profile, user_id)

        # 落库场景
        plan.scenario_title = scenario.scenario_title
        plan.scenario_brief = scenario.scenario_brief
        plan.status = PLAN_STUDYING

        # 清掉同日旧条目，保证幂等（重新生成不会重复）
        await session.execute(
            delete(DailyPlanItem).where(
                DailyPlanItem.plan_date == plan_date, DailyPlanItem.user_id == user_id
            )
        )

        new_words = await self._resolve_words(session, scenario, user_id)
        items = await self._build_items(
            session, plan_date, due, new_words, scenario, profile, user_id
        )

        audio_ready = 0
        if warm_audio:
            audio_ready = await self._warm_audio(items)

        await session.commit()

        return PlanResult(
            plan_date=plan_date,
            scenario_title=scenario.scenario_title,
            scenario_brief=scenario.scenario_brief,
            new_count=len(new_words),
            review_count=len(due),
            voice_target_count=sum(1 for i in items if i.is_voice_target),
            audio_ready=audio_ready,
            warnings=[] if new_words else ["新词池为空，请先导入词书"],
        )

    # ------------------------------------------------------------ Step 2
    async def _select_scenario(
        self,
        session: AsyncSession,
        plan_date: date,
        due: list[tuple[Word, FSRSCard]],
        profile: str,
        user_id: str,
    ) -> ScenarioSelection:
        # 今日主场景标签：复习词里最高频的
        topics = await top_topic_tags(session, plan_date, limit=3, user_id=user_id)
        if not topics:
            topics = ["tech_dev", "workplace_comm"]  # 用户是程序员，缺省偏好

        want_new = self.study_plan.daily_new_words
        candidates = await get_new_word_candidates_by_topics(
            session, topics, max(want_new * 6, 60), user_id
        )

        if not candidates:
            # 新词池空 → 允许只有复习词的计划
            return ScenarioSelection(
                scenario_title="今日复习",
                scenario_brief="今天没有新词，专注巩固到期复习。",
                selected_words=[],
                voice_candidates=[],
            )

        listing = "\n".join(
            f"- {w.word} | {'; '.join(d.get('def', '') for d in (w.pos_defs or []))} "
            f"| {', '.join(w.topic_tags or [])}"
            for w, _ in candidates
        )

        selection = await self.llm.generate_structured(
            system_prompt=SCENARIO_SYSTEM.format(
                user_profile=profile,
                count=min(want_new, len(candidates)),
                voice_count=self.study_plan.voice_target_words_count,
            ),
            user_prompt=SCENARIO_USER.format(today=plan_date.isoformat(), candidates=listing),
            response_model=ScenarioSelection,
        )
        return selection

    async def _resolve_words(
        self, session: AsyncSession, scenario: ScenarioSelection, user_id: str
    ) -> list[Word]:
        """把 LLM 选出的词名映射回 Word 对象（防模型自创词）。"""
        names = [s.word.strip().lower() for s in scenario.selected_words if s.word.strip()]
        if not names:
            return []
        rows = await session.execute(
            select(Word).where(Word.user_id == user_id, Word.word.in_(names))
        )
        found = {w.word.lower(): w for w in rows.scalars()}
        return [found[n] for n in names if n in found]

    # ------------------------------------------------------------ Step 3
    async def _build_items(
        self,
        session: AsyncSession,
        plan_date: date,
        due: list[tuple[Word, FSRSCard]],
        new_words: list[Word],
        scenario: ScenarioSelection,
        profile: str,
        user_id: str,
    ) -> list[DailyPlanItem]:
        voice_targets = {w.strip().lower() for w in scenario.voice_candidates}
        items: list[DailyPlanItem] = []

        # 新词：完整生成
        new_cards = await self._generate_cards(
            new_words, scenario, profile, plan_date, voice_targets
        )
        order = 0
        for word, card in new_cards:
            items.append(
                DailyPlanItem(
                    plan_date=plan_date,
                    user_id=user_id,
                    word_id=word.id,
                    item_type=ITEM_NEW,
                    custom_sentence_en=card.sentence_en,
                    custom_sentence_zh=card.sentence_zh,
                    mcq_options=[o.model_dump() for o in card.options],
                    is_voice_target=card.is_voice_target,
                    order_index=order,
                )
            )
            order += 1

        # 复习词：同样需要新语境例句才能测「产出」，此处一并生成
        review_words = [w for w, _ in due]
        review_cards = await self._generate_cards(
            review_words, scenario, profile, plan_date, voice_targets
        )
        for word, card in review_cards:
            items.append(
                DailyPlanItem(
                    plan_date=plan_date,
                    user_id=user_id,
                    word_id=word.id,
                    item_type=ITEM_REVIEW,
                    custom_sentence_en=card.sentence_en,
                    custom_sentence_zh=card.sentence_zh,
                    mcq_options=[o.model_dump() for o in card.options],
                    is_voice_target=card.is_voice_target,
                    order_index=order,
                )
            )
            order += 1

        for item in items:
            session.add(item)

        # 语音目标词名额校准：
        # 1) 超额的裁掉（配置值是不可超过的上限，不是下限）
        # 2) 不足的按 order 顺序补齐
        target = self.study_plan.voice_target_words_count
        current = [i for i in items if i.is_voice_target]

        for item in current[target:]:
            item.is_voice_target = False
        current = current[:target]

        if len(current) < target:
            chosen = {id(i) for i in current}
            for item in items:
                if len(current) >= target:
                    break
                if id(item) not in chosen:
                    item.is_voice_target = True
                    current.append(item)

        await session.flush()
        return items

    async def _generate_cards(
        self,
        words: list[Word],
        scenario: ScenarioSelection,
        profile: str,
        plan_date: date,
        voice_targets: set[str],
    ) -> list[tuple[Word, WordCard]]:
        if not words:
            return []

        system = CARD_SYSTEM.format(
            user_profile=profile,
            scenario_title=scenario.scenario_title,
            scenario_brief=scenario.scenario_brief,
        )

        batches = [words[i : i + self.batch_size] for i in range(0, len(words), self.batch_size)]
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_BATCHES)

        async def run(batch: list[Word]) -> list[tuple[Word, WordCard]]:
            async with semaphore:
                listing = "\n".join(
                    f"- {w.word} | {'; '.join(d.get('def', '') for d in (w.pos_defs or []))}"
                    for w in batch
                )
                try:
                    result = await self.llm.generate_structured(
                        system_prompt=system,
                        user_prompt=CARD_USER.format(today=plan_date.isoformat(), words=listing),
                        response_model=WordCardBatch,
                    )
                except Exception:  # noqa: BLE001
                    return []
                by_word = {c.word.strip().lower(): c for c in result.cards}
                out = []
                for word in batch:
                    card = by_word.get(word.word.lower())
                    if card is None or not _is_valid_card(card):
                        continue
                    if word.word.lower() in voice_targets:
                        card.is_voice_target = True
                    out.append((word, card))
                return out

        results = await asyncio.gather(*(run(b) for b in batches))
        return [item for batch in results for item in batch]

    # ------------------------------------------------------------ Step 4
    async def _warm_audio(self, items: list[DailyPlanItem]) -> int:
        """预热单词与例句音频，避免前端切换时等待。"""
        ready = 0
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_BATCHES)

        async def synth(text: str) -> str | None:
            async with semaphore:
                try:
                    path = await self.tts.synthesize_to_file(text)
                    return str(path)
                except Exception:  # noqa: BLE001
                    return None

        tasks = []
        for item in items:
            if item.custom_sentence_en:
                tasks.append((item, synth(item.custom_sentence_en)))

        for item, task in zip(items, [t for _, t in tasks], strict=False):
            path = await task
            if path:
                item.sentence_audio_path = path
                ready += 1

        return ready


def _is_valid_card(card: WordCard) -> bool:
    """校验 LLM 输出是否满足硬约束。不合格的卡片直接丢弃，不污染学习数据。"""
    if not card.sentence_en.strip() or not card.sentence_zh.strip():
        return False
    word_count = len(card.sentence_en.split())
    if not 5 <= word_count <= 30:  # 略宽于 10~22，容忍模型轻微越界
        return False
    if len(card.options) != 4:
        return False
    correct = [o for o in card.options if o.is_correct]
    if len(correct) != 1:
        return False
    # 词性一致性
    pos_prefixes = {o.pos.strip().split()[0] if o.pos.strip() else "" for o in card.options}
    if len(pos_prefixes) != 1:
        return False
    labels = {o.label.strip() for o in card.options}
    return labels == {"A", "B", "C", "D"}
