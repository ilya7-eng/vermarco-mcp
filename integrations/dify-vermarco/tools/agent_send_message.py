import uuid
from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from utils.mcp import VermarcoError, call_tool


class AgentSendMessageTool(Tool):
    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        api_key = (self.runtime.credentials or {}).get("api_key") or None
        client_id = tool_parameters.get("client_message_id") or f"dify-{uuid.uuid4().hex}"
        args = {
            "handle": str(tool_parameters["handle"]),
            "body": str(tool_parameters["body"]),
            "clientMessageId": str(client_id),
        }
        try:
            out = call_tool("agent_send_message", args, api_key)
        except VermarcoError as e:
            yield self.create_text_message(str(e))
            return
        yield self.create_json_message(out)
