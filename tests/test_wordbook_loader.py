import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.agent_server.db.repos import get_new_word_candidates  # noqa: E402
from src.agent_server.db.session import build_engine, init_db, make_session_factory  # noqa: E402
from src.agent_server.services.wordbook_loader import (  # noqa: E402
    TOPIC_POOL,
    WordbookError,
    import_wordbook,
    parse_wordbook,
)


@pytest.fixture
async def session(tmp_path):
    engine = build_engine(f"sqlite+aiosqlite:///{tmp_path / 't.db'}")
    await init_db(engine)
    factory = make_session_factory(engine)
    async with factory() as s:
        yield s
    await engine.dispose()


class TestParseJSON:
    def test_parses_array_of_objects(self) -> None:
        raw = json.dumps(
            [{"word": "deprecate", "phonetic": "/ˈdeprəkeɪt/", "definitions": "v. 弃用"}]
        ).encode()
        entries = parse_wordbook(raw, "book.json")
        assert len(entries) == 1
        assert entries[0]["word"] == "deprecate"
        assert entries[0]["phonetic_us"] == "/ˈdeprəkeɪt/"
        assert entries[0]["pos_defs"] == [{"pos": "v.", "def": "弃用"}]

    def test_parses_wrapped_object(self) -> None:
        raw = json.dumps({"words": [{"word": "alpha"}]}).encode()
        assert len(parse_wordbook(raw, "b.json")) == 1

    def test_parses_list_definitions(self) -> None:
        raw = json.dumps(
            [{"word": "refactor", "definitions": [{"pos": "v.", "def": "重构"}]}]
        ).encode()
        assert parse_wordbook(raw, "b.json")[0]["pos_defs"] == [{"pos": "v.", "def": "重构"}]

    def test_skips_rows_without_word(self) -> None:
        raw = json.dumps([{"def": "x"}, {"word": "ok"}]).encode()
        entries = parse_wordbook(raw, "b.json")
        assert len(entries) == 1
        assert entries[0]["word"] == "ok"


class TestParseCSV:
    def test_parses_csv_with_header(self) -> None:
        raw = "word,phonetic,definitions\ndeprecate,/dep/,v. 弃用\nrefactor,/ri/,v. 重构\n".encode()
        entries = parse_wordbook(raw, "book.csv")
        assert len(entries) == 2
        assert entries[0]["word"] == "deprecate"

    def test_parses_chinese_headers(self) -> None:
        raw = "单词,音标,释义\n部署,/dɪˈplɔɪ/,v. 部署\n".encode()
        entries = parse_wordbook(raw, "b.csv")
        assert entries[0]["word"] == "部署"

    def test_parses_pipe_separated_tags(self) -> None:
        raw = b"word,topic_tags\ndeploy,tech_dev|workplace_comm\n"
        entries = parse_wordbook(raw, "b.csv")
        assert entries[0]["topic_tags"] == ["tech_dev", "workplace_comm"]

    def test_rejects_unknown_tags(self) -> None:
        raw = b"word,topic_tags\ndeploy,not_a_real_tag\n"
        assert parse_wordbook(raw, "b.csv")[0]["topic_tags"] == []


class TestParseErrors:
    def test_unsupported_extension(self) -> None:
        with pytest.raises(WordbookError, match="不支持的词书格式"):
            parse_wordbook(b"x", "book.xlsx")

    def test_invalid_json(self) -> None:
        with pytest.raises(WordbookError, match="JSON 解析失败"):
            parse_wordbook(b"{not json", "book.json")

    def test_empty_json_parses_to_empty_list(self) -> None:
        # 空数组是合法格式，解析层不报错；「无有效词条」由导入层拒绝
        assert parse_wordbook(b"[]", "book.json") == []


class TestImport:
    async def test_import_creates_words_and_cards(self, session) -> None:
        raw = json.dumps([{"word": "alpha"}, {"word": "beta"}]).encode()
        stats = await import_wordbook(session, raw, "core.json", "Core_3000")
        assert stats["imported"] == 2
        assert stats["book_name"] == "Core_3000"
        assert len(await get_new_word_candidates(session, 10)) == 2

    async def test_import_is_idempotent(self, session) -> None:
        raw = json.dumps([{"word": "alpha"}, {"word": "beta"}]).encode()
        await import_wordbook(session, raw, "core.json")
        stats = await import_wordbook(session, raw, "core.json")
        assert stats["imported"] == 0
        assert stats["skipped"] == 2

    async def test_import_empty_raises(self, session) -> None:
        with pytest.raises(WordbookError):
            await import_wordbook(session, b"[]", "empty.json")

    async def test_book_name_defaults_to_filename_stem(self, session) -> None:
        raw = json.dumps([{"word": "alpha"}]).encode()
        stats = await import_wordbook(session, raw, "my_book.json")
        assert stats["book_name"] == "my_book"

    def test_topic_pool_matches_spec(self) -> None:
        assert TOPIC_POOL == [
            "tech_dev",
            "workplace_comm",
            "daily_life",
            "travel_dining",
            "finance_business",
            "emotion_opinion",
            "problem_solving",
        ]
