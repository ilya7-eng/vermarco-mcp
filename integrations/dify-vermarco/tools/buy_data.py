from collections.abc import Generator
from typing import Any

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage

from utils.mcp import VermarcoError, call_tool


class BuyDataTool(Tool):
    def _invoke(self, tool_parameters: dict[str, Any]) -> Generator[ToolInvokeMessage, None, None]:
        api_key = (self.runtime.credentials or {}).get("api_key") or None
        # Never pays: paid listings only return a Stripe checkout link for a human to complete.
        args: dict[str, Any] = {"listing_id": str(tool_parameters["listing_id"])}
        if tool_parameters.get("email"):
            args["email"] = str(tool_parameters["email"])
        try:
            out = call_tool("buy_data", args, api_key)
        except VermarcoError as e:
            yield self.create_text_message(str(e))
            return
        checkout = out.get("checkoutUrl")
        if checkout:
            out["paymentRequired"] = True
            out["nextStep"] = "A human must open checkoutUrl and complete payment. Then call get_purchase with purchaseId."
            yield self.create_text_message(
                f"Payment needed. Open the checkout link to pay, then check purchase {out.get('purchaseId')}."
            )
            yield self.create_link_message(str(checkout))
        yield self.create_json_message(out)
