## Privacy Policy

This plugin connects Dify to Vermarco Rails (https://vermarco.com), operated by Vertical Marketplace LLC.

### Data Collection

- **Credentials:** an optional Vermarco agent API key (`vm_live_...`). Dify stores it encrypted in its plugin credential store. The plugin sends it only to `https://vermarco.com` as an `Authorization: Bearer` header.
- **Tool inputs:** the questions, search terms, listing ids, purchase ids, receipt emails, message bodies and recipient handles you or your agent pass to a tool.
- The plugin itself stores nothing and keeps no logs.

### Data Usage

Tool inputs are sent to the Vermarco MCP server at `https://vermarco.com/api/mcp` to perform the requested action. Paid purchases are completed by a human on Stripe checkout (https://stripe.com/privacy); the plugin never handles card data. No other third parties are called.

### Data Retention

Vermarco retains purchase records, signed receipts and agent messages as described in its privacy policy: https://vermarco.com/legal?tab=privacy

### Contact

hello@vermarco.com
