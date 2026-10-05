"""Validate YAML against dify_plugin entities, then live-test tools against vermarco.com (read-only)."""
import importlib, json, os, sys, types, yaml
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dify_plugin.entities.tool import ToolProviderConfiguration, ToolConfiguration
from dify_plugin.core.entities.plugin.setup import PluginConfiguration

ok = True
def check(label, fn):
    global ok
    try:
        r = fn(); print("PASS", label, r if r else ""); return r
    except Exception as e:
        ok = False; print("FAIL", label, type(e).__name__, str(e)[:300])

manifest = yaml.safe_load(open("manifest.yaml"))
check("manifest schema", lambda: PluginConfiguration(**manifest) and None)
prov = yaml.safe_load(open("provider/vermarco.yaml"))
for t in prov["tools"]:
    check(f"tool schema {t}", lambda t=t: ToolConfiguration(**yaml.safe_load(open(t))) and None)
check("provider schema", lambda: ToolProviderConfiguration(**prov) and None)

from utils.mcp import tools_list
check("live tools/list count", lambda: f"{len(tools_list())} tools")

key = os.environ.get("VERMARCO_API_KEY")
def run(module, cls, params, creds):
    mod = importlib.import_module(f"tools.{module}")
    tool = getattr(mod, cls).from_credentials(creds, user_id="int1-test")
    msgs = list(tool._invoke(params))
    out = []
    for m in msgs:
        msg = m.message
        out.append(getattr(msg, "text", None) or json.dumps(getattr(msg, "json_object", None))[:120])
    if any(isinstance(o, str) and "failed:" in o for o in out):
        raise RuntimeError(out[0])
    return " | ".join(o[:120] for o in out if o)

check("ask_vermarco (no key)", lambda: run("ask_vermarco", "AskVermarcoTool", {"question": "what is vermarco"}, {}))
if key:
    from utils.mcp import call_tool
    check("agent_whoami (Bearer)", lambda: json.dumps(call_tool("agent_whoami", {}, key))[:120])
    b = check("browse_marketplace (free, 3)", lambda: run("browse_marketplace", "BrowseMarketplaceTool", {"price": "free", "limit": 3}, {"api_key": key}))
    lst = call_tool("browse_marketplace", {"price": "free", "limit": 1, "samples": "include"}, key)
    items = lst.get("listings") or lst.get("results") or []
    if items:
        check("preview_listing", lambda: run("preview_listing", "PreviewListingTool", {"listing_id": items[0]["id"]}, {"api_key": key}))
    check("agent_inbox list", lambda: run("agent_inbox", "AgentInboxTool", {"action": "list", "after": 0, "limit": 5}, {"api_key": key}))
    def bogus():
        try:
            run("get_purchase", "GetPurchaseTool", {"purchase_id": "00000000-0000-0000-0000-000000000000"}, {"api_key": key})
        except RuntimeError as e:
            return f"error surfaced as expected: {str(e)[:80]}"
        raise AssertionError("no error for bogus purchase id")
    check("get_purchase bogus id", bogus)
    check("provider credential validation", lambda: importlib.import_module("provider.vermarco").VermarcoProvider.__new__(importlib.import_module("provider.vermarco").VermarcoProvider)._validate_credentials({"api_key": key}))
    def badkey():
        P = importlib.import_module("provider.vermarco").VermarcoProvider
        try:
            P.__new__(P)._validate_credentials({"api_key": "vm_live_invalid"})
        except Exception as e:
            return f"rejected as expected: {type(e).__name__}"
        raise AssertionError("bad key accepted")
    check("provider rejects bad key", badkey)
print("ALL PASS" if ok else "SOME FAILED")
