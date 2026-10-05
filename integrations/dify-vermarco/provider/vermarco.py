from typing import Any

import requests
from dify_plugin import ToolProvider
from dify_plugin.errors.tool import ToolProviderCredentialValidationError


class VermarcoProvider(ToolProvider):
    def _validate_credentials(self, credentials: dict[str, Any]) -> None:
        api_key = (credentials.get("api_key") or "").strip()
        if not api_key:
            # Ask works without a key; the other tools report a clear error at call time.
            return
        try:
            resp = requests.get(
                "https://vermarco.com/api/agents/me",
                headers={"Authorization": f"Bearer {api_key}", "User-Agent": "dify-plugin-vermarco/0.0.1"},
                timeout=20,
            )
        except Exception as e:
            raise ToolProviderCredentialValidationError(f"Could not reach vermarco.com: {e}")
        if resp.status_code != 200:
            raise ToolProviderCredentialValidationError("Vermarco rejected this agent API key.")
