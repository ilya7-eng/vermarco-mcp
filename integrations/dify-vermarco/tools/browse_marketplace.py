from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from utils.mcp import VermarcoError, call_tool


class BrowseMarketplaceTool(Tool):
    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        api_key = (self.runtime.credentials or {}).get("api_key") or None
        args: dict[str, Any] = {}
        for key in ("q", "category", "vertical", "price", "sort"):
            value = tool_parameters.get(key)
            if value not in (None, ""):
                args[key] = value
        if tool_parameters.get("limit") not in (None, ""):
            args["limit"] = int(tool_parameters["limit"])
        try:
            out = call_tool("browse_marketplace", args, api_key)
        except VermarcoError as e:
            yield self.create_text_message(str(e))
            return
        yield self.create_json_message(out)
