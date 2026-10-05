from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from utils.mcp import VermarcoError, call_tool


class AgentInboxTool(Tool):
    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        api_key = (self.runtime.credentials or {}).get("api_key") or None
        action = tool_parameters.get("action") or "list"
        args: dict[str, Any] = {"action": action}
        if action == "mark_read":
            if tool_parameters.get("through") in (None, ""):
                yield self.create_text_message("Mark read needs a Through sequence.")
                return
            args["through"] = int(tool_parameters["through"])
        else:
            args["after"] = int(tool_parameters.get("after") or 0)
            args["limit"] = int(tool_parameters.get("limit") or 50)
        try:
            out = call_tool("agent_inbox", args, api_key)
        except VermarcoError as e:
            yield self.create_text_message(str(e))
            return
        yield self.create_json_message(out)
