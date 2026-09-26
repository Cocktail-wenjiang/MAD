from functools import lru_cache
from pathlib import Path
import os
import yaml
try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:  # Allows a minimal local smoke test before installing requirements.
    from pydantic import BaseModel as BaseSettings

    class SettingsConfigDict(dict):
        pass


class Settings(BaseSettings):
    app_name: str = "MAD AI Gateway"
    app_env: str = "development"
    backend_api_key: str = ""
    request_timeout_seconds: float = 60.0
    max_retries: int = 1
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    anthropic_api_key: str = ""
    anthropic_base_url: str = "https://api.anthropic.com"
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    kimi_api_key: str = ""
    kimi_base_url: str = "https://api.moonshot.cn/v1"
    zhipu_api_key: str = ""
    zhipu_base_url: str = "https://open.bigmodel.cn/api/paas/v4"
    model_aliases: str = ""
    provider_catalog_path: str = str(Path(__file__).resolve().parents[1] / "config" / "providers.yaml")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def load_provider_catalog(path: str | None = None) -> dict:
    catalog_path = Path(path or get_settings().provider_catalog_path)
    with catalog_path.open("r", encoding="utf-8") as stream:
        return yaml.safe_load(stream) or {"providers": {}}


def env_value(name: str, default: str = "") -> str:
    return os.getenv(name, default)
