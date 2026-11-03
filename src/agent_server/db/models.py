"""SQLAlchemy 2.0 Async ORM 模型。

与上游 SPEC.md 4.1 的偏差（重要，会影响查询逻辑）：

1. **`state` 取值**：SPEC 声明 `0=New,1=Learning,2=Review,3=Relearning`。
   实测 py-fsrs 6.3.2 无 New(0)。本实现 `state` 直接存 py-fsrs 的真实值
   (1/2/3)，"新卡"的判定改用 `stability IS NULL`。
   见 `fsrs_service.is_new_card()` 与 `repos.get_new_word_candidates()`。

2. **`reps` / `lapses`**：py-fsrs 的 Card 没有这两个字段，由 ORM 侧自行累加，
   仅用于统计与前端展示，不参与 FSRS 计算。

3. **单用户预留**：所有业务表带 `user_id` 列，MVP 恒为 `DEFAULT_USER_ID`。
   将来商业化放开多用户时，只需加用户表并把查询条件从常量改为上下文，
   不需要重构 schema。
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# MVP 单用户固定标识
DEFAULT_USER_ID = "local-user"

# 今日计划状态机（SPEC 4.1 表 3）
PLAN_GENERATING = "GENERATING"
PLAN_STUDYING = "STUDYING"
PLAN_VOICE_READY = "VOICE_READY"
PLAN_COMPLETED = "COMPLETED"

# daily_plan_items.item_type
ITEM_NEW = "NEW"
ITEM_REVIEW = "REVIEW"

# daily_plan_items.voice_used_status
VOICE_UNUSED = "UNUSED"
VOICE_USED_PROACTIVELY = "USED_PROACTIVELY"
VOICE_USED_WITH_HINT = "USED_WITH_HINT"
VOICE_FAILED = "FAILED"

# linguistic_mistakes.mistake_type
MISTAKE_PRONUNCIATION = "PRONUNCIATION"
MISTAKE_GRAMMAR = "GRAMMAR"
MISTAKE_WORD_CHOICE = "WORD_CHOICE"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Word(Base):
    """基础词库表（SPEC 4.1 表 1）。"""

    __tablename__ = "words"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    word: Mapped[str] = mapped_column(String(100), nullable=False)
    phonetic_us: Mapped[str | None] = mapped_column(String(100))
    pos_defs: Mapped[list] = mapped_column(JSON, default=list)
    book_name: Mapped[str] = mapped_column(String(100), default="Core_3000")
    topic_tags: Mapped[list] = mapped_column(JSON, default=list)
    word_audio_path: Mapped[str | None] = mapped_column(String(255))
    user_id: Mapped[str] = mapped_column(String(64), default=DEFAULT_USER_ID)

    __table_args__ = (UniqueConstraint("word", "user_id", name="uq_words_word_user"),)
    __table_args__ += (Index("ix_words_user_topic", "user_id"),)


class FSRSCard(Base):
    """FSRS 记忆状态表，与 words 1:1（SPEC 4.1 表 2）。"""

    __tablename__ = "fsrs_cards"

    word_id: Mapped[int] = mapped_column(ForeignKey("words.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), default=DEFAULT_USER_ID)
    state: Mapped[int] = mapped_column(Integer, default=1)
    step: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stability: Mapped[float | None] = mapped_column(Float, nullable=True)
    difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)
    due: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_review: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reps: Mapped[int] = mapped_column(Integer, default=0)
    lapses: Mapped[int] = mapped_column(Integer, default=0)
    fsrs_card_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        # 选词主查询：按 due 取到期复习卡
        Index("ix_fsrs_user_due", "user_id", "due"),
        # 选词主查询：按 stability IS NULL 取新卡
        Index("ix_fsrs_user_stability", "user_id", "stability"),
    )


class DailyStudyPlan(Base):
    """每日学习计划主表（SPEC 4.1 表 3）。"""

    __tablename__ = "daily_study_plans"

    plan_date: Mapped[date] = mapped_column(Date, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=DEFAULT_USER_ID)
    scenario_title: Mapped[str | None] = mapped_column(String(200))
    scenario_brief: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default=PLAN_GENERATING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    items: Mapped[list[DailyPlanItem]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        lazy="selectin",
        # 复合主键 (plan_date, user_id) 无法由单个 ForeignKey 推导 join 条件，
        # 必须显式声明，否则 mapper 初始化直接抛 InvalidRequestError。
        primaryjoin=(
            "and_(DailyStudyPlan.plan_date == foreign(DailyPlanItem.plan_date),"
            " DailyStudyPlan.user_id == foreign(DailyPlanItem.user_id))"
        ),
        viewonly=True,
    )


class DailyPlanItem(Base):
    """每日单词明细与定制内容表（SPEC 4.1 表 4）。"""

    __tablename__ = "daily_plan_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_date: Mapped[date] = mapped_column(Date, index=True)
    user_id: Mapped[str] = mapped_column(String(64), default=DEFAULT_USER_ID)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id"), index=True)
    item_type: Mapped[str] = mapped_column(String(20), default=ITEM_NEW)
    custom_sentence_en: Mapped[str | None] = mapped_column(Text)
    custom_sentence_zh: Mapped[str | None] = mapped_column(Text)
    sentence_audio_path: Mapped[str | None] = mapped_column(String(255))
    mcq_options: Mapped[list] = mapped_column(JSON, default=list)
    card_done: Mapped[bool] = mapped_column(Boolean, default=False)
    card_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_voice_target: Mapped[bool] = mapped_column(Boolean, default=False)
    voice_used_status: Mapped[str] = mapped_column(String(20), default=VOICE_UNUSED)
    # 用户是否在本词上点过「提示示例回答」——用于区分「无提示主动掌握」与「看提示才用出」
    hint_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    # 答错后压回当日队尾重过，SPEC 5.2 要求「直到选对为止」
    requeue_count: Mapped[int] = mapped_column(Integer, default=0)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    plan: Mapped[DailyStudyPlan] = relationship(
        primaryjoin=(
            "and_(DailyStudyPlan.plan_date == foreign(DailyPlanItem.plan_date),"
            " DailyStudyPlan.user_id == foreign(DailyPlanItem.user_id))"
        ),
        viewonly=True,
    )
    word: Mapped[Word] = relationship(lazy="selectin")

    __table_args__ = (
        UniqueConstraint("plan_date", "user_id", "word_id", name="uq_plan_item_word"),
    )


class VoiceSession(Base):
    """语音会话表（SPEC 4.1 表 5）。"""

    __tablename__ = "voice_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_date: Mapped[date] = mapped_column(Date, index=True)
    user_id: Mapped[str] = mapped_column(String(64), default=DEFAULT_USER_ID)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    # Compaction 后置为 NULL 以释放空间并隔离上下文
    transcript_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    target_progress_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class LinguisticMistake(Base):
    """发音/语法/用词错误记录表（SPEC 4.1 表 5）。"""

    __tablename__ = "linguistic_mistakes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("voice_sessions.id"), nullable=True)
    plan_date: Mapped[date] = mapped_column(Date, index=True)
    user_id: Mapped[str] = mapped_column(String(64), default=DEFAULT_USER_ID)
    mistake_type: Mapped[str] = mapped_column(String(20))
    user_original: Mapped[str] = mapped_column(Text)
    corrected_version: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
