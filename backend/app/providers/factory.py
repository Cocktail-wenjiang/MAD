import httpx
from app.config import Settings, env_value, load_provider_catalog
from app.providers.anthropic import AnthropicProvider
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.providers.registry import ProviderRegistry


def create_registry(
    settings: Settings, client: httpx.AsyncClient | None = None
) -> ProviderRegistry:
    catalog = load_provider_catalog(settings.provider_catalog_path).get("providers", {})
    providers = {}
    for provider_id, item in catalog.items():
        base_url = env_value(item["base_url_env"], "")
        api_key = env_value(item["api_key_env"], "")
        # Pydantic settings also supports process/env-file values; use them when present.
        setting_prefix = item["api_key_env"].lower()
        base_prefix = item["base_url_env"].lower()
        base_url = getattr(settings, base_prefix, base_url)
        api_key = getattr(settings, setting_prefix, api_key)
        models = item.get("models", [])
        if item.get("adapter") == "anthropic":
            providers[provider_id] = AnthropicProvider(base_url, api_key, models, client)
        else:
            providers[provider_id] = OpenAICompatibleProvider(
                provider_id, item["name"], base_url, api_key, models, client
            )
    return ProviderRegistry(providers)
