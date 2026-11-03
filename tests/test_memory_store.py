import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.agent_server.services.memory_store import MAX_ERROR_PATTERNS, MemoryStore  # noqa: E402


@pytest.fixture
def store(tmp_path: Path) -> MemoryStore:
    template_dir = Path(__file__).resolve().parents[1] / "data" / "memory"
    for name in ("user_profile.example.md", "error_patterns.example.md"):
        src = template_dir / name
        if src.exists():
            (tmp_path / name).write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    s = MemoryStore(tmp_path)
    s.ensure_initialized()
    return s


class TestInitialization:
    def test_creates_files_from_template(self, store: MemoryStore) -> None:
        assert store.profile_path.exists()
        assert store.errors_path.exists()
        assert "程序员" in store.read_profile()
        assert "病历" in store.read_errors()

    def test_does_not_overwrite_existing(self, store: MemoryStore) -> None:
        store.write_profile("# 用户画像\n\n我自己写的\n")
        store.ensure_initialized()
        assert "我自己写的" in store.read_profile()

    def test_creates_files_without_template(self, tmp_path: Path) -> None:
        s = MemoryStore(tmp_path)
        s.ensure_initialized()
        assert "用户画像" in s.read_profile()
        assert "病历" in s.read_errors()


class TestAppendRecentEvents:
    def test_appends_to_recent_section(self, store: MemoryStore) -> None:
        n = store.append_recent_events(["下周要上线支付微服务"], today=date(2026, 11, 5))
        assert n == 1
        content = store.read_profile()
        assert "2026-11-05 下周要上线支付微服务" in content

    def test_appended_under_correct_section(self, store: MemoryStore) -> None:
        store.append_recent_events(["新事件A"], today=date(2026, 11, 5))
        content = store.read_profile()
        idx_section = content.index("## 近期动态")
        idx_event = content.index("新事件A")
        assert idx_event > idx_section

    def test_deduplicates_same_event(self, store: MemoryStore) -> None:
        assert store.append_recent_events(["重复事件"], today=date(2026, 11, 5)) == 1
        assert store.append_recent_events(["重复事件"], today=date(2026, 11, 5)) == 0

    def test_ignores_empty_events(self, store: MemoryStore) -> None:
        assert store.append_recent_events(["", "   "], today=date(2026, 11, 5)) == 0

    def test_preserves_user_written_sections(self, store: MemoryStore) -> None:
        """用户手写的内容必须原样保留。"""
        import re

        original = re.sub(r"<!--.*?-->", "", store.read_profile(), flags=re.DOTALL)
        store.append_recent_events(["新事件B"], today=date(2026, 11, 5))
        updated = store.read_profile()
        for line in original.splitlines():
            if line.strip():
                assert line in updated

    def test_strips_format_comments_on_write(self, store: MemoryStore) -> None:
        """模板里的示例注释是一次性说明，追加真实内容后应被清理，
        否则多行注释中形如 '- ...' 的示例行会污染后续去重判断。"""
        assert "<!--" in store.read_profile()
        store.append_recent_events(["真实事件"], today=date(2026, 11, 5))
        assert "<!--" not in store.read_profile()

    def test_creates_section_if_missing(self, tmp_path: Path) -> None:
        s = MemoryStore(tmp_path)
        s.write_profile("# 用户画像\n\n## 身份背景\n\n程序员\n")
        assert s.append_recent_events(["事件C"], today=date(2026, 11, 5)) == 1
        assert "## 近期动态" in s.read_profile()
        assert "事件C" in s.read_profile()


class TestMergeErrorPatterns:
    def test_merges_pronunciation(self, store: MemoryStore) -> None:
        stats = store.merge_error_patterns(["deprecate 重音错误，应为第一音节"], [])
        assert stats["pronunciation_added"] == 1
        assert "deprecate 重音错误" in store.read_errors()

    def test_merges_grammar(self, store: MemoryStore) -> None:
        stats = store.merge_error_patterns([], ["时态混用：I go there yesterday"])
        assert stats["grammar_added"] == 1
        assert "时态混用" in store.read_errors()

    def test_deduplicates(self, store: MemoryStore) -> None:
        store.merge_error_patterns(["介词搭配 depend of"], [])
        stats = store.merge_error_patterns(["介词搭配 depend of"], [])
        assert stats["pronunciation_added"] == 0

    def test_caps_section_at_limit(self, store: MemoryStore) -> None:
        items = [f"发音错误模式编号{i}" for i in range(MAX_ERROR_PATTERNS + 5)]
        store.merge_error_patterns(items, [])
        content = store.read_errors()
        section = content.split("## 发音易错点")[1].split("## ")[0]
        bullets = [ln for ln in section.splitlines() if ln.startswith("- ")]
        assert len(bullets) <= MAX_ERROR_PATTERNS

    def test_keeps_newest_when_trimming(self, store: MemoryStore) -> None:
        items = [f"模式编号{i}" for i in range(MAX_ERROR_PATTERNS + 3)]
        store.merge_error_patterns(items, [])
        content = store.read_errors()
        # 最后加入的应被保留
        assert f"模式编号{MAX_ERROR_PATTERNS + 2}" in content
        # 最早的应被裁掉
        assert "模式编号0\n" not in content

    def test_empty_input_no_change(self, store: MemoryStore) -> None:
        before = store.read_errors()
        stats = store.merge_error_patterns([], [])
        assert stats == {"pronunciation_added": 0, "grammar_added": 0}
        assert store.read_errors() == before


class TestAtomicWrite:
    def test_write_replaces_content(self, store: MemoryStore) -> None:
        store.write_errors("# 全新病历\n\n- 一条\n")
        assert store.read_errors() == "# 全新病历\n\n- 一条\n"
