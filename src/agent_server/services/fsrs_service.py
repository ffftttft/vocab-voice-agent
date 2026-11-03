"""FSRS 调度服务。

与上游 SPEC.md 的一处关键偏差（已实测 py-fsrs 6.3.2 确认）：

    SPEC 4.1 表 2 声明 `state: 0=New, 1=Learning, 2=Review, 3=Relearning`，
    且 5.1 Step 2 用 `WHERE state == 0` 挑选新词。

    但 py-fsrs 6.3.2 的 State 枚举只有 Learning(1) / Review(2) / Relearning(3)，
    不存在 New(0)。新建的 `Card()` 默认就是 `state=Learning, step=0`，
    且 `stability is None`。

    因此本服务的判定标准是：**"新卡" = stability is None**（尚未产生任何复习记录），
    而不是 state == 0。这在语义上更准确，且与 py-fsrs 的实现一致。

另一处偏差：py-fsrs 的 `Card` 对象没有 `reps` / `lapses` 字段，
其 `to_dict()` 仅包含 card_id/state/step/stability/difficulty/due/last_review。
因此 reps / lapses 由 ORM 侧自行累加维护。
"""

from __future__ import annotations

from datetime import UTC, datetime

from fsrs import Card, Rating, Scheduler

__all__ = [
    "DEFAULT_SCHEDULER",
    "RATING_AGAIN",
    "RATING_HARD",
    "RATING_GOOD",
    "RATING_EASY",
    "is_new_card",
    "new_card_snapshot",
    "apply_rating",
    "rating_from_duration",
]

# FSRS 四级评分。数值与 SPEC 4.1「card_rating」约定一致：1=Again 2=Hard 3=Good 4=Easy
RATING_AGAIN = 1
RATING_HARD = 2
RATING_GOOD = 3
RATING_EASY = 4

# SPEC 5.2：90% 目标保留率 + 开启 fuzzing 防止同日到期扎堆
DEFAULT_SCHEDULER = Scheduler(desired_retention=0.90, enable_fuzzing=True)


def is_new_card(card_snapshot: dict | None) -> bool:
    """判断一张 FSRS 卡片是否从未被复习过。

    py-fsrs 没有 new 状态，新卡的特征是 stability 为 None。
    """
    if not card_snapshot:
        return True
    return card_snapshot.get("stability") is None


def new_card_snapshot() -> dict:
    """生成一张全新卡片的初始快照。"""
    return Card().to_dict()


def rating_from_duration(duration_ms: int, correct: bool) -> int:
    """把「作答正确与否 + 响应耗时」映射为 FSRS 评级。

    对应 SPEC 5.2 状态 B 的自动评级规则：
      - 答错                      -> Again(1)，本轮锁定
      - 答对且 < 3500ms           -> Easy(4)
      - 答对且 3500ms ~ 8000ms    -> Good(3)
      - 答对且 > 8000ms           -> Hard(2)
    """
    if not correct:
        return RATING_AGAIN
    if duration_ms < 3500:
        return RATING_EASY
    if duration_ms <= 8000:
        return RATING_GOOD
    return RATING_HARD


def apply_rating(
    card_snapshot: dict | None,
    rating_int: int,
    now: datetime | None = None,
    scheduler: Scheduler | None = None,
) -> tuple[dict, dict]:
    """对卡片应用一次评分，返回 (更新后的快照, 需要写回 ORM 的字段dict)。

    `card_snapshot` 为空时视为新卡。
    """
    if not 1 <= rating_int <= 4:
        raise ValueError(f"rating must be 1..4, got {rating_int}")

    sched = scheduler or DEFAULT_SCHEDULER
    review_dt = now or datetime.now(UTC)

    card = Card.from_dict(card_snapshot) if card_snapshot else Card()
    updated, review_log = sched.review_card(card, Rating(rating_int), review_dt)

    snapshot = updated.to_dict()
    orm_fields = {
        "state": int(updated.state),
        "step": updated.step,
        "stability": updated.stability,
        "difficulty": updated.difficulty,
        "due": updated.due,
        "last_review": review_dt,
        "fsrs_card_json": snapshot,
    }
    return snapshot, orm_fields
