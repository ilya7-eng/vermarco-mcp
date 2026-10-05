from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from utils.mcp import VermarcoError, call_tool


class GetPurchaseTool(Tool):
    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        api_key = (self.runtime.credentials or {}).get("api_key") or None
        try:
            out = call_tool("get_purchase", {"purchase_id": str(tool_parameters["purchase_id"])}, api_key)
        except VermarcoError as e:
            yield self.create_text_message(str(e))
            return
        yield self.create_json_message(out)
