"""记忆文件读写（SPEC 4.2 双层记忆）。

设计要点：
- 记忆是**纯 Markdown**，用户可随时手动编辑（前端 Settings 页也直接编辑它）。
- Compaction 只做「追加/聚合」，不重写全文，避免模型改动用户手写的部分。
- MVP 单用户；路径按 user_id 分目录，为将来多用户预留。
"""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path

from ..db.models import DEFAULT_USER_ID

PROFILE_HEADER = "# 用户画像"
ERRORS_HEADER = "# 语言顽疾病历本"
RECENT_SECTION = "## 近期动态"

MAX_ERROR_PATTERNS = 15  # SPEC 5.5：保留最核心的 Top 15 条


class MemoryStore:
    def __init__(self, memory_dir: Path, user_id: str = DEFAULT_USER_ID) -> None:
        self.memory_dir = memory_dir
        self.user_id = user_id
        self.memory_dir.mkdir(parents=True, exist_ok=True)

    # ---- 路径 ----
    @property
    def profile_path(self) -> Path:
        return self.memory_dir / "user_profile.md"

    @property
    def errors_path(self) -> Path:
        return self.memory_dir / "error_patterns.md"

    # ---- 初始化 ----
    def ensure_initialized(self) -> None:
        """首次运行时从模板创建可编辑的记忆文件。"""
        if not self.profile_path.exists():
            template = self.memory_dir / "user_profile.example.md"
            if template.exists():
                self.profile_path.write_text(template.read_text(encoding="utf-8"), encoding="utf-8")
            else:
                self.profile_path.write_text(
                    f"{PROFILE_HEADER}\n\n## 身份背景\n\n## 学习偏好\n\n"
                    f"{RECENT_SECTION}\n\n",
                    encoding="utf-8",
                )
        if not self.errors_path.exists():
            template = self.memory_dir / "error_patterns.example.md"
            if template.exists():
                self.errors_path.write_text(template.read_text(encoding="utf-8"), encoding="utf-8")
            else:
                self.errors_path.write_text(
                    f"{ERRORS_HEADER}\n\n## 发音易错点\n\n## 语法 / 用词盲区\n\n",
                    encoding="utf-8",
                )

    # ---- 读 ----
    def read_profile(self) -> str:
        return self._read(self.profile_path)

    def read_errors(self) -> str:
        return self._read(self.errors_path)

    def _read(self, path: Path) -> str:
        if not path.exists():
            self.ensure_initialized()
        return path.read_text(encoding="utf-8")

    # ---- 写 ----
    def write_profile(self, content: str) -> None:
        self._write_atomic(self.profile_path, content)

    def write_errors(self, content: str) -> None:
        self._write_atomic(self.errors_path, content)

    @staticmethod
    def _write_atomic(path: Path, content: str) -> None:
        tmp = path.with_suffix(".tmp.md")
        tmp.write_text(content, encoding="utf-8")
        tmp.replace(path)

    # ---- Compaction 用：追加近期动态 ----
    def append_recent_events(self, events: list[str], today: date | None = None) -> int:
        """把新提到的事实追加到 `## 近期动态`，返回真正追加的条数。

        只追加，不改动用户手写的其它章节。
        """
        if not events:
            return 0
        day = (today or date.today()).isoformat()
        content = self.read_profile()
        lines = content.splitlines()

        # 找 `## 近期动态` 章节范围
        start = None
        for i, line in enumerate(lines):
            if line.strip() == RECENT_SECTION:
                start = i
                break

        existing = set()
        if start is not None:
            section_end = len(lines)
            for j in range(start + 1, len(lines)):
                if lines[j].startswith("## "):
                    section_end = j
                    break
            existing = {ln.strip() for ln in lines[start + 1 : section_end]}

        added = 0
        new_lines = []
        for event in events:
            text = event.strip()
            if not text:
                continue
            bullet = f"- {day} {text}"
            # 去重：同日同内容不重复追加
            if any(text in ln for ln in existing):
                continue
            new_lines.append(bullet)
            added += 1

        if added == 0:
            return 0

        if start is None:
            content = content.rstrip() + f"\n\n{RECENT_SECTION}\n\n" + "\n".join(new_lines) + "\n"
        else:
            section_end = len(lines)
            for j in range(start + 1, len(lines)):
                if lines[j].startswith("## "):
                    section_end = j
                    break
            insert_at = section_end
            # 插到章节末尾之前，去掉尾部空行
            while insert_at > start + 1 and not lines[insert_at - 1].strip():
                insert_at -= 1
            lines[insert_at:insert_at] = new_lines
            content = "\n".join(lines).rstrip() + "\n"

        self.write_profile(content)
        return added

    # ---- Compaction 用：合并错误病历 ----
    def merge_error_patterns(
        self, pronunciation: list[str], grammar: list[str]
    ) -> dict:
        """把新错误按类别合并进病历，去重并保留 Top N。返回统计。"""
        content = self.read_errors()

        pron_added = self._merge_bullets(content, "## 发音易错点", pronunciation)
        content = self.read_errors()
        gram_added = self._merge_bullets(content, "## 语法 / 用词盲区", grammar)

        return {
            "pronunciation_added": pron_added,
            "grammar_added": gram_added,
        }

    def _merge_bullets(self, content: str, section: str, items: list[str]) -> int:
        if not items:
            return 0
        lines = content.splitlines()
        start = None
        for i, line in enumerate(lines):
            if line.strip() == section:
                start = i
                break

        added = 0
        new_bullets = []
        existing_text = content
        for item in items:
            text = item.strip()
            if not text:
                continue
            # 去重：核心词片段已存在则跳过
            key = re.sub(r"[^\w\s]", "", text)[:20].strip().lower()
            if key and key in existing_text.lower():
                continue
            new_bullets.append(f"- {text}")
            added += 1

        if added == 0:
            return 0

        if start is None:
            content = content.rstrip() + f"\n\n{section}\n\n" + "\n".join(new_bullets) + "\n"
        else:
            section_end = len(lines)
            for j in range(start + 1, len(lines)):
                if lines[j].startswith("## "):
                    section_end = j
                    break
            insert_at = section_end
            while insert_at > start + 1 and not lines[insert_at - 1].strip():
                insert_at -= 1
            lines[insert_at:insert_at] = new_bullets
            content = "\n".join(lines).rstrip() + "\n"

        content = self._trim_section(content, section, MAX_ERROR_PATTERNS)
        self.write_errors(content)
        return added

    @staticmethod
    def _trim_section(content: str, section: str, limit: int) -> str:
        """章节内 bullet 超过 limit 时保留最后 limit 条（新的优先保留）。"""
        lines = content.splitlines()
        start = None
        for i, line in enumerate(lines):
            if line.strip() == section:
                start = i
                break
        if start is None:
            return content

        section_end = len(lines)
        for j in range(start + 1, len(lines)):
            if lines[j].startswith("## "):
                section_end = j
                break

        bullets = [i for i in range(start + 1, section_end) if lines[i].startswith("- ")]
        if len(bullets) <= limit:
            return content

        drop = set(bullets[: len(bullets) - limit])
        kept = [ln for i, ln in enumerate(lines) if i not in drop]
        return "\n".join(kept).rstrip() + "\n"
