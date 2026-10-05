from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from utils.mcp import VermarcoError, call_tool


class PreviewListingTool(Tool):
    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        api_key = (self.runtime.credentials or {}).get("api_key") or None
        try:
            out = call_tool("preview_listing", {"listing_id": str(tool_parameters["listing_id"])}, api_key)
        except VermarcoError as e:
            yield self.create_text_message(str(e))
            return
        yield self.create_json_message(out)
