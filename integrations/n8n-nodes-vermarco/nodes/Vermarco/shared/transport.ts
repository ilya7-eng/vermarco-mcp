import type { IDataObject, IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export const VERMARCO_MCP_URL = 'https://vermarco.com/api/mcp';

interface McpContent {
	type: string;
	text?: string;
}

interface McpResponse {
	jsonrpc: string;
	id: number | string | null;
	result?: { content?: McpContent[]; isError?: boolean; structuredContent?: IDataObject };
	error?: { code: number; message: string; data?: unknown };
}

/**
 * Streamable HTTP servers may answer with plain JSON or with a single SSE event.
 * Accept both and return the JSON-RPC envelope.
 */
function parseEnvelope(raw: unknown): McpResponse {
	if (typeof raw === 'object' && raw !== null) {
		return raw as McpResponse;
	}
	const text = String(raw ?? '');
	const trimmed = text.trim();
	if (trimmed.startsWith('{')) {
		return JSON.parse(trimmed) as McpResponse;
	}
	const dataLines = text
		.split(/\r?\n/)
		.filter((line) => line.startsWith('data:'))
		.map((line) => line.slice(5).trim());
	for (let i = dataLines.length - 1; i >= 0; i--) {
		if (dataLines[i].startsWith('{')) {
			return JSON.parse(dataLines[i]) as McpResponse;
		}
	}
	throw new Error('Unexpected response from the Vermarco MCP server');
}

function parseToolResult(result: McpResponse['result']): IDataObject {
	if (result?.structuredContent) {
		return result.structuredContent;
	}
	const texts = (result?.content ?? [])
		.filter((c) => c.type === 'text' && typeof c.text === 'string')
		.map((c) => c.text as string);
	if (texts.length === 1) {
		try {
			const parsed = JSON.parse(texts[0]) as unknown;
			if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
				return parsed as IDataObject;
			}
			return { result: parsed as IDataObject };
		} catch {
			return { text: texts[0] };
		}
	}
	return { content: (result?.content ?? []) as unknown as IDataObject[] };
}

/**
 * Calls one Vermarco MCP tool with JSON-RPC `tools/call` and returns the parsed tool output.
 */
export async function callVermarcoTool(
	this: IExecuteFunctions,
	itemIndex: number,
	toolName: string,
	args: IDataObject,
	useCredentials: boolean,
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method: 'POST',
		url: VERMARCO_MCP_URL,
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json, text/event-stream',
			'User-Agent': 'n8n-nodes-vermarco/0.1.0',
		},
		body: {
			jsonrpc: '2.0',
			id: Date.now(),
			method: 'tools/call',
			params: { name: toolName, arguments: args },
		},
		json: true,
	};

	let raw: unknown;
	try {
		raw = useCredentials
			? await this.helpers.httpRequestWithAuthentication.call(this, 'vermarcoApi', options)
			: await this.helpers.httpRequest(options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as never, { itemIndex });
	}

	const envelope = parseEnvelope(raw);
	if (envelope.error) {
		throw new NodeOperationError(
			this.getNode(),
			`Vermarco MCP error ${envelope.error.code}: ${envelope.error.message}`,
			{ itemIndex },
		);
	}
	const output = parseToolResult(envelope.result);
	// Some tools report failures as { error } without setting isError.
	if (envelope.result?.isError || typeof output.error === 'string') {
		const message =
			typeof output.error === 'string' ? output.error : JSON.stringify(output).slice(0, 500);
		const hint =
			message.includes('AUTH_REQUIRED') || message.includes('API key')
				? ' Add a Vermarco API credential (agent key) to this node.'
				: '';
		throw new NodeOperationError(this.getNode(), `Vermarco tool ${toolName} failed: ${message}`, {
			itemIndex,
			description: hint || undefined,
		});
	}
	return output;
}
