"""API 集成测试：真实 HTTP 请求打到底层数据库与假 provider。

验证的是完整请求链路（路由 → 服务 → DB），不是 mock。
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.agent_server.app_context import create_app  # noqa: E402
from src.agent_server.config import (  # noqa: E402
    AppConfig,
    ModelsConfig,
    ModelStageConfig,
    StudyPlanConfig,
)
from tests.fakes import FakeTextLLM, FakeTTS  # noqa: E402


@pytest.fixture
def app(tmp_path: Path):
    """用假 provider 替换掉外部 API，其余全部走真实代码路径。"""
    cfg = AppConfig(
        study_plan=StudyPlanConfig(
            daily_new_words=5, daily_review_limit=10, voice_target_words_count=3
        ),
        models=ModelsConfig(
            text_llm=ModelStageConfig(
                provider="openai_compatible",
                base_url="https://x/v1",
                api_key="k",
                model_name="m",
            ),
            tts=ModelStageConfig(provider="edge_tts", voice_id="v"),
        ),
    )
    application = create_app(
        config=cfg, data_dir=tmp_path / "data", db_url=f"sqlite+aiosqlite:///{tmp_path / 'a.db'}"
    )
    # 注入假 provider
    from src.agent_server.app_context import get_context

    with TestClient(application) as client:
        ctx = get_context(application)
        ctx.registry._text_llm = FakeTextLLM()
        ctx.registry._tts = FakeTTS(tmp_path / "tts")
        application.state.client = client
        yield application


@pytest.fixture
def client(app) -> TestClient:
    return app.state.client


def _wordbook(n: int = 6) -> dict:
    return {
        "words": [
            {
                "word": f"term{i}",
                "phonetic": f"/t{i}/",
                "definitions": "v. 释义",
                "topic_tags": "tech_dev,workplace_comm",
            }
            for i in range(n)
        ]
    }


class TestHealth:
    def test_health(self, client: TestClient) -> None:
        r = client.get("/api/v1/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


class TestWordbookImport:
    def test_import_json(self, client: TestClient) -> None:
        import json

        r = client.post(
            "/api/v1/wordbooks/import",
            files={"file": ("core.json", json.dumps(_wordbook(5)), "application/json")},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["imported"] == 5
        assert body["book_name"] == "core"

    def test_import_csv(self, client: TestClient) -> None:
        csv = "word,phonetic,definitions\nalpha,/a/,v. 甲\nbeta,/b/,v. 乙\n"
        r = client.post(
            "/api/v1/wordbooks/import",
            files={"file": ("b.csv", csv.encode(), "text/csv")},
        )
        assert r.status_code == 200
        assert r.json()["imported"] == 2

    def test_import_empty_file_rejected(self, client: TestClient) -> None:
        r = client.post(
            "/api/v1/wordbooks/import", files={"file": ("e.json", b"", "application/json")}
        )
        assert r.status_code == 400

    def test_import_malformed_rejected(self, client: TestClient) -> None:
        r = client.post(
            "/api/v1/wordbooks/import",
            files={"file": ("bad.json", b"{oops", "application/json")},
        )
        assert r.status_code == 400
        assert "JSON" in r.json()["detail"]


class TestDailyPlan:
    def test_generate_plan(self, client: TestClient) -> None:
        import json

        client.post(
            "/api/v1/wordbooks/import",
            files={"file": ("c.json", json.dumps(_wordbook(6)), "application/json")},
        )
        r = client.post("/api/v1/study/daily-plan")
        assert r.status_code == 200
        body = r.json()
        assert body["cached"] is False
        assert body["new_count"] > 0
        assert body["scenario_title"]

    def test_second_call_returns_cached(self, client: TestClient) -> None:
        import json

        client.post(
            "/api/v1/wordbooks/import",
            files={"file": ("c.json", json.dumps(_wordbook(6)), "application/json")},
        )
        client.post("/api/v1/study/daily-plan")
        r = client.post("/api/v1/study/daily-plan")
        assert r.json()["cached"] is True

    def test_regenerate_flag(self, client: TestClient) -> None:
        import json

        client.post(
            "/api/v1/wordbooks/import",
            files={"file": ("c.json", json.dumps(_wordbook(6)), "application/json")},
        )
        client.post("/api/v1/study/daily-plan")
        r = client.post("/api/v1/study/daily-plan?regenerate=true")
        assert r.json()["cached"] is False

    def test_empty_wordbook_warns(self, client: TestClient) -> None:
        r = client.post("/api/v1/study/daily-plan")
        assert r.status_code == 200
        assert r.json()["warnings"]


class TestStudyQueueAndReview:
    def _setup_plan(self, client: TestClient) -> list[dict]:
        import json

        client.post(
            "/api/v1/wordbooks/import",
            files={"file": ("c.json", json.dumps(_wordbook(5)), "application/json")},
        )
        client.post("/api/v1/study/daily-plan")
        r = client.get("/api/v1/study/queue")
        return r.json()["cards"]

    def test_queue_returns_cards(self, client: TestClient) -> None:
        cards = self._setup_plan(client)
        assert len(cards) > 0
        card = cards[0]
        assert card["word"]
        assert card["sentence_en"]
        assert len(card["options"]) == 4

    def test_queue_does_not_leak_answers(self, client: TestClient) -> None:
        cards = self._setup_plan(client)
        for opt in cards[0]["options"]:
            assert "is_correct" not in opt

    def test_submit_correct_answer(self, client: TestClient) -> None:
        cards = self._setup_plan(client)
        card = cards[0]
        r = client.post(
            "/api/v1/study/review-card",
            json={"word_id": card["word_id"], "selected_label": "A", "duration_ms": 1000},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["is_correct"] is True
        assert body["rating"] == 4

    def test_submit_wrong_answer_requeues(self, client: TestClient) -> None:
        cards = self._setup_plan(client)
        card = cards[0]
        r = client.post(
            "/api/v1/study/review-card",
            json={"word_id": card["word_id"], "selected_label": "B", "duration_ms": 1000},
        )
        body = r.json()
        assert body["is_correct"] is False
        assert body["requeued"] is True
        assert body["rating"] == 1

    def test_unknown_word_returns_400(self, client: TestClient) -> None:
        self._setup_plan(client)
        r = client.post(
            "/api/v1/study/review-card",
            json={"word_id": 999999, "selected_label": "A", "duration_ms": 100},
        )
        assert r.status_code == 400

    def test_invalid_manual_rating_422(self, client: TestClient) -> None:
        r = client.post(
            "/api/v1/study/review-card",
            json={"word_id": 1, "selected_label": "A", "manual_rating": 9},
        )
        assert r.status_code == 422

    def test_progress_advances(self, client: TestClient) -> None:
        cards = self._setup_plan(client)
        before = client.get("/api/v1/study/queue").json()["progress"]
        client.post(
            "/api/v1/study/review-card",
            json={"word_id": cards[0]["word_id"], "selected_label": "A", "duration_ms": 500},
        )
        after = client.get("/api/v1/study/queue").json()["progress"]
        assert after["done"] == before["done"] + 1


class TestStats:
    def test_stats_shape(self, client: TestClient) -> None:
        r = client.get("/api/v1/study/stats")
        assert r.status_code == 200
        body = r.json()
        assert "total" in body
        assert "upcoming" in body
        assert len(body["upcoming"]) == 7


class TestTTS:
    def test_speak_returns_audio(self, client: TestClient) -> None:
        r = client.post("/api/v1/tts/speak", json={"text": "Hello world"})
        assert r.status_code == 200
        assert r.headers["content-type"] == "audio/mpeg"
        assert len(r.content) > 0

    def test_empty_text_422(self, client: TestClient) -> None:
        r = client.post("/api/v1/tts/speak", json={"text": ""})
        assert r.status_code == 422


class TestAdmin:
    def test_get_config_masks_keys(self, client: TestClient) -> None:
        r = client.get("/api/v1/admin/config")
        assert r.status_code == 200
        body = r.json()
        assert "study_plan" in body
        key = body["models"]["text_llm"]["api_key"]
        assert "*" in key or key == ""

    def test_get_memory(self, client: TestClient) -> None:
        r = client.get("/api/v1/admin/memory")
        assert r.status_code == 200
        assert "user_profile" in r.json()
        assert "error_patterns" in r.json()

    def test_update_memory(self, client: TestClient) -> None:
        r = client.put(
            "/api/v1/admin/memory/user_profile",
            json={"content": "# 用户画像\n\n测试内容\n"},
        )
        assert r.status_code == 200
        assert "测试内容" in client.get("/api/v1/admin/memory").json()["user_profile"]

    def test_update_unknown_memory_404(self, client: TestClient) -> None:
        r = client.put("/api/v1/admin/memory/nonexistent", json={"content": "x"})
        assert r.status_code == 404


class TestVoiceEndpoints:
    def test_hint_stream_unknown_session_404(self, client: TestClient) -> None:
        r = client.get("/api/v1/voice/99999/hint-stream")
        assert r.status_code == 404

    def test_ws_without_targets_closes(self, client: TestClient) -> None:
        """没有目标词时应优雅拒绝，而不是崩溃。"""
        with client.websocket_connect("/api/v1/voice/ws") as ws:
            msg = ws.receive_json()
            assert msg["type"] == "server.error"
            assert "目标词" in msg["message"]
