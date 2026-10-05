from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from utils.mcp import VermarcoError, call_tool


class AskVermarcoTool(Tool):
    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        api_key = (self.runtime.credentials or {}).get("api_key") or None
        args = {"question": str(tool_parameters["question"])}
        try:
            out = call_tool("ask_vermarco", args, api_key)
        except VermarcoError as e:
            yield self.create_text_message(str(e))
            return
        if out.get("answer"):
            yield self.create_text_message(str(out["answer"]))
        yield self.create_json_message(out)
