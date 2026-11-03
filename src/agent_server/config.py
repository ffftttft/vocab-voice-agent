"""配置加载：config.yaml 的 `${VAR:default}` 语法 + .env。"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]

_ENV_PATTERN = re.compile(r"\$\{([A-Z0-9_]+)(?::([^}]*))?\}")


class StudyPlanConfig(BaseModel):
    daily_new_words: int = 15
    daily_review_limit: int = 90
    voice_target_words_count: int = 22
    voice_sliding_window_size: int = 4


class ModelStageConfig(BaseModel):
    """单一模型阶段的配置。provider/base_url/api_key/model_name 全部可热切换。"""

    provider: str = ""
    base_url: str = ""
    api_key: str = ""
    model_name: str = ""
    ws_url: str = ""
    voice_id: str = ""
    temperature: float | None = None
    extra_body: dict[str, Any] = Field(default_factory=dict)
    input_sample_rate: int = 16000
    output_sample_rate: int = 24000


class ModelsConfig(BaseModel):
    text_llm: ModelStageConfig = Field(default_factory=ModelStageConfig)
    realtime_voice: ModelStageConfig = Field(default_factory=ModelStageConfig)
    tts: ModelStageConfig = Field(default_factory=ModelStageConfig)


class AppConfig(BaseModel):
    study_plan: StudyPlanConfig = Field(default_factory=StudyPlanConfig)
    models: ModelsConfig = Field(default_factory=ModelsConfig)


class Settings(BaseSettings):
    """进程级设置。环境变量优先，其次 .env。"""

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"), env_file_encoding="utf-8", extra="ignore"
    )

    app_env: str = "dev"
    data_dir: Path = PROJECT_ROOT / "data"
    config_file: Path = PROJECT_ROOT / "config.yaml"
    database_url: str = ""

    @property
    def db_path(self) -> Path:
        return self.data_dir / "app.db"

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite+aiosqlite:///{self.db_path}"

    @property
    def audio_cache_dir(self) -> Path:
        return self.data_dir / "audio_cache"

    @property
    def wordbooks_dir(self) -> Path:
        return self.data_dir / "wordbooks"

    @property
    def memory_dir(self) -> Path:
        return self.data_dir / "memory"


def _substitute_env(value: Any) -> Any:
    """递归把 `${VAR}` / `${VAR:default}` 替换为环境变量值。"""
    if isinstance(value, str):

        def repl(m: re.Match[str]) -> str:
            var, default = m.group(1), m.group(2)
            return os.environ.get(var, default if default is not None else "")

        return _ENV_PATTERN.sub(repl, value)
    if isinstance(value, dict):
        return {k: _substitute_env(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_substitute_env(v) for v in value]
    return value


def load_app_config(config_file: Path | None = None) -> AppConfig:
    """读取 config.yaml 并完成环境变量替换。文件不存在时返回全默认值。"""
    path = config_file or (PROJECT_ROOT / "config.yaml")
    if not path.exists():
        return AppConfig()
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return AppConfig.model_validate(_substitute_env(raw))


settings = Settings()
