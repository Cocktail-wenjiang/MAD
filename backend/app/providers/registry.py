from app.providers.base import Capability


class ProviderRegistry:
    def __init__(self, providers: dict[str, object]):
        self.providers = providers

    def get(self, provider_id: str):
        try:
            return self.providers[provider_id]
        except KeyError as exc:
            raise KeyError(f"unknown provider: {provider_id}") from exc

    def require(self, provider_id: str, capability: Capability):
        provider = self.get(provider_id)
        if capability not in provider.capabilities:
            raise NotImplementedError(f"provider {provider_id} does not support {capability.value}")
        return provider

    def resolve(self, model: str, capability: Capability, provider_id: str | None = None):
        requested_provider = provider_id
        requested_model = model
        if "/" in model:
            prefix, candidate = model.split("/", 1)
            if prefix in self.providers:
                requested_provider, requested_model = prefix, candidate
        if requested_provider:
            return self.require(requested_provider, capability), requested_model
        for provider in self.providers.values():
            if capability not in provider.capabilities:
                continue
            models = getattr(provider, "models", [])
            if any(
                item.get("id") == requested_model
                and capability.value in item.get("capabilities", [])
                for item in models
            ):
                return provider, requested_model
        raise KeyError(f"unknown model: {model}")

    def infos(self):
        return [
            {
                "id": p.provider_id,
                "name": p.display_name,
                "capabilities": sorted(c.value for c in p.capabilities),
                "configured": p.configured,
            }
            for p in self.providers.values()
        ]
