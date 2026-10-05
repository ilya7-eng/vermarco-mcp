// Live smoke test for the compiled node against https://vermarco.com/api/mcp.
// Read-only: ask (no auth), browse, preview, inbox list, get purchase (bogus id). Never buys or sends.
const { Vermarco } = require('../dist/nodes/Vermarco/Vermarco.node.js');
const key = process.env.VERMARCO_API_KEY || '';

async function http(opts) {
	const res = await fetch(opts.url, { method: opts.method, headers: opts.headers, body: JSON.stringify(opts.body) });
	const text = await res.text();
	if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`), { httpCode: res.status });
	try { return JSON.parse(text); } catch { return text; }
}

function ctx(params) {
	return {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
		getNode: () => ({ name: 'Vermarco', type: 'vermarco', typeVersion: 1, parameters: {} }),
		getExecutionId: () => 'test',
		getCredentials: async () => ({ apiKey: key }),
		continueOnFail: () => false,
		helpers: {
			httpRequest: http,
			httpRequestWithAuthentication: async function (_type, opts) {
				return http({ ...opts, headers: { ...opts.headers, Authorization: `Bearer ${key}` } });
			},
		},
	};
}

async function run(label, params, expectError = false) {
	const node = new Vermarco();
	try {
		const [[out]] = await node.execute.call(ctx(params));
		const preview = JSON.stringify(out.json).slice(0, 160);
		console.log(`${expectError ? 'FAIL' : 'PASS'} ${label}: ${preview}`);
		return expectError ? null : out.json;
	} catch (e) {
		console.log(`${expectError ? 'PASS' : 'FAIL'} ${label}: error -> ${e.message.slice(0, 160)}`);
		return null;
	}
}

(async () => {
	await run('ask (no auth)', { resource: 'frontDesk', operation: 'ask', question: 'what is vermarco' });
	const browse = await run('browse (free, limit 3)', { resource: 'listing', operation: 'browse', q: '', limit: 3, filters: { price: 'free', samples: 'include' } });
	const list = browse && (browse.listings || browse.results || browse.items || []);
	const first = Array.isArray(list) && list[0];
	if (first && (first.id || first.listingId)) {
		await run('preview first listing', { resource: 'listing', operation: 'preview', listingId: first.id || first.listingId });
	} else console.log('SKIP preview: no listing id in browse output keys=' + Object.keys(browse || {}));
	await run('inbox list', { resource: 'agentMessage', operation: 'inbox', inboxAction: 'list', after: 0, inboxLimit: 5 });
	await run('get purchase (bogus id -> error expected)', { resource: 'purchase', operation: 'getPurchase', purchaseId: '00000000-0000-0000-0000-000000000000' }, true);
})();
