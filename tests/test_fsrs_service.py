import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

from src.agent_server.services.fsrs_service import (  # noqa: E402
    RATING_AGAIN,
    RATING_EASY,
    RATING_GOOD,
    RATING_HARD,
    apply_rating,
    is_new_card,
    new_card_snapshot,
    rating_from_duration,
)


class TestRatingFromDuration:
    """SPEC 5.2 状态 B 的自动评级规则。"""

    @pytest.mark.parametrize(
        ("duration_ms", "expected"),
        [
            (0, RATING_EASY),
            (3499, RATING_EASY),
            (3500, RATING_GOOD),
            (8000, RATING_GOOD),
            (8001, RATING_HARD),
            (60000, RATING_HARD),
        ],
    )
    def test_correct_answer_maps_duration_to_rating(self, duration_ms: int, expected: int) -> None:
        assert rating_from_duration(duration_ms, correct=True) == expected

    def test_wrong_answer_always_again(self) -> None:
        # 答错无论多快都锁定 Again
        assert rating_from_duration(100, correct=False) == RATING_AGAIN
        assert rating_from_duration(99999, correct=False) == RATING_AGAIN


class TestIsNewCard:
    def test_empty_snapshot_is_new(self) -> None:
        assert is_new_card(None) is True
        assert is_new_card({}) is True

    def test_card_without_stability_is_new(self) -> None:
        # py-fsrs 的新卡 stability 为 None —— 这是判定新卡的唯一可靠依据
        assert is_new_card(new_card_snapshot()) is True

    def test_card_with_stability_is_not_new(self) -> None:
        _, fields = apply_rating(None, RATING_GOOD)
        assert is_new_card(fields["fsrs_card_json"]) is False


class TestApplyRating:
    def test_new_card_snapshot_has_no_state_zero(self) -> None:
        """回归测试：py-fsrs 不存在 New(0) 状态。

        SPEC 曾声明 0=New，实测 py-fsrs 6.3.2 的 State 只有 1/2/3。
        若此测试失败，说明依赖升级改变了状态语义，需重新审视选词逻辑。
        """
        snap = new_card_snapshot()
        assert snap["state"] in (1, 2, 3)
        assert snap["stability"] is None

    def test_first_review_moves_card_into_learning(self) -> None:
        snap, fields = apply_rating(None, RATING_GOOD)
        assert fields["state"] == 1  # Learning
        assert fields["stability"] is not None
        assert fields["difficulty"] is not None
        assert fields["last_review"] is not None
        assert snap == fields["fsrs_card_json"]

    def test_repeated_reviews_reach_review_state(self) -> None:
        """New -> Learning -> Review 的状态流转（SPEC Milestone 1 要求验证）。"""
        snap = None
        for _ in range(3):
            snap, fields = apply_rating(snap, RATING_GOOD)
        assert fields["state"] == 2  # Review
        assert fields["due"] > datetime.now(timezone.utc)

    def test_again_from_review_goes_to_relearning(self) -> None:
        snap = None
        for _ in range(3):
            snap, _ = apply_rating(snap, RATING_GOOD)
        _, fields = apply_rating(snap, RATING_AGAIN)
        assert fields["state"] == 3  # Relearning

    def test_due_increases_with_better_rating(self) -> None:
        now = datetime.now(timezone.utc)
        _, hard = apply_rating(None, RATING_HARD, now=now)
        _, easy = apply_rating(None, RATING_EASY, now=now)
        assert easy["due"] >= hard["due"]

    def test_invalid_rating_rejected(self) -> None:
        with pytest.raises(ValueError):
            apply_rating(None, 0)
        with pytest.raises(ValueError):
            apply_rating(None, 5)

    def test_snapshot_roundtrip_is_lossless(self) -> None:
        """SPEC 4.1 要求 fsrs_card_json 与 py-fsrs 无损互转。"""
        from fsrs import Card

        snap, _ = apply_rating(None, RATING_GOOD)
        restored = Card.from_dict(snap)
        assert restored.to_dict()["card_id"] == snap["card_id"]
        assert restored.to_dict()["state"] == snap["state"]
        assert restored.stability == snap["stability"]

    def test_last_review_uses_utc(self) -> None:
        now = datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)
        _, fields = apply_rating(None, RATING_GOOD, now=now)
        assert fields["last_review"] == now
        assert fields["last_review"].tzinfo is not None

    def test_due_respects_supplied_now(self) -> None:
        now = datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)
        _, fields = apply_rating(None, RATING_GOOD, now=now)
        assert fields["due"] >= now
        assert fields["due"] < now + timedelta(days=365)
