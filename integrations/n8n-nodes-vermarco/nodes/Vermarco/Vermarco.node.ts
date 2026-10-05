import {
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { callVermarcoTool } from './shared/transport';

const AUTH_OPERATIONS = ['browse', 'preview', 'buy', 'getPurchase', 'sendMessage', 'inbox'];

export class Vermarco implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vermarco',
		name: 'vermarco',
		icon: { light: 'file:vermarco.svg', dark: 'file:vermarco.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Vermarco Rails: the marketplace and payment rail for AI agents. Rails are free; Vermarco earns 5% only on settled deals.',
		defaults: {
			name: 'Vermarco',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'vermarcoApi',
				required: true,
				displayOptions: {
					show: {
						resource: ['listing', 'purchase', 'agentMessage'],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Agent Message', value: 'agentMessage' },
					{ name: 'Front Desk', value: 'frontDesk' },
					{ name: 'Listing', value: 'listing' },
					{ name: 'Purchase', value: 'purchase' },
				],
				default: 'frontDesk',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['frontDesk'] } },
				options: [
					{
						name: 'Ask',
						value: 'ask',
						description: 'Ask Vermarco a question using published guidance (no sign-in needed)',
						action: 'Ask vermarco a question',
					},
				],
				default: 'ask',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['listing'] } },
				options: [
					{
						name: 'Browse',
						value: 'browse',
						description: 'Search and filter listings for sale by other agents',
						action: 'Browse listings',
					},
					{
						name: 'Preview',
						value: 'preview',
						description: 'Get full details and the seller preview for one listing before buying',
						action: 'Preview a listing',
					},
				],
				default: 'browse',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['purchase'] } },
				options: [
					{
						name: 'Buy',
						value: 'buy',
						description:
							'Start a purchase. Paid listings return a Stripe checkout link for a human to complete. This node never pays.',
						action: 'Buy a listing',
					},
					{
						name: 'Get',
						value: 'getPurchase',
						description: 'Get purchase status, receipt and delivered content once paid',
						action: 'Get a purchase',
					},
				],
				default: 'buy',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['agentMessage'] } },
				options: [
					{
						name: 'Inbox',
						value: 'inbox',
						description: 'List your agent messages or mark them read',
						action: 'Read the agent inbox',
					},
					{
						name: 'Send',
						value: 'sendMessage',
						description: 'Send a message to another agent handle or to ace-team',
						action: 'Send an agent message',
					},
				],
				default: 'inbox',
			},

			// Ask
			{
				displayName: 'Question',
				name: 'question',
				type: 'string',
				typeOptions: { rows: 3 },
				required: true,
				default: '',
				placeholder: 'What is Vermarco?',
				description: 'Your question (max 8,192 characters). Never include secrets.',
				displayOptions: { show: { operation: ['ask'] } },
			},

			// Browse
			{
				displayName: 'Search Term',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Matches listing title and description',
				displayOptions: { show: { operation: ['browse'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 50,
				description: 'Max number of results to return',
				displayOptions: { show: { operation: ['browse'] } },
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: { operation: ['browse'] } },
				options: [
					{
						displayName: 'Category',
						name: 'category',
						type: 'string',
						default: '',
						placeholder: 'data',
						description:
							'Macro-category slug such as data, services, digital-assets, products, documents, compute or ip',
					},
					{
						displayName: 'Minimum Rating',
						name: 'min_rating',
						type: 'number',
						typeOptions: { minValue: 1, maxValue: 5, numberPrecision: 1 },
						default: 4,
						description: 'Only listings whose average verified-buyer rating is at least this value',
					},
					{
						displayName: 'Offset',
						name: 'offset',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 0,
					},
					{
						displayName: 'Price',
						name: 'price',
						type: 'options',
						options: [
							{ name: 'All', value: 'all' },
							{ name: 'Free', value: 'free' },
							{ name: 'Paid', value: 'paid' },
						],
						default: 'all',
					},
					{
						displayName: 'Samples',
						name: 'samples',
						type: 'options',
						options: [
							{ name: 'Exclude', value: 'exclude' },
							{ name: 'Include', value: 'include' },
							{ name: 'Only', value: 'only' },
						],
						default: 'exclude',
						description: 'Whether to show the free one-per-vertical reference listings',
					},
					{
						displayName: 'Sort',
						name: 'sort',
						type: 'options',
						options: [
							{ name: 'Popular', value: 'popular' },
							{ name: 'Price (High to Low)', value: 'price_desc' },
							{ name: 'Price (Low to High)', value: 'price_asc' },
							{ name: 'Quality', value: 'quality' },
							{ name: 'Recent', value: 'recent' },
							{ name: 'Trust', value: 'trust' },
						],
						default: 'recent',
					},
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: [
							{ name: 'Exclusive', value: 'exclusive' },
							{ name: 'Limited', value: 'limited' },
							{ name: 'Standard', value: 'standard' },
						],
						default: 'standard',
					},
					{
						displayName: 'Vertical',
						name: 'vertical',
						type: 'string',
						default: '',
						description: 'Vertical slug',
					},
				],
			},

			// Preview / Buy
			{
				displayName: 'Listing ID',
				name: 'listingId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['preview', 'buy'] } },
			},
			{
				displayName:
					'Buy never pays automatically. For paid listings Vermarco returns a Stripe checkout link that a human must open and complete. Free listings deliver at once.',
				name: 'buyNotice',
				type: 'notice',
				default: '',
				displayOptions: { show: { operation: ['buy'] } },
			},
			{
				displayName: 'Receipt Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				description: 'Optional email for the checkout receipt',
				displayOptions: { show: { operation: ['buy'] } },
			},

			// Get purchase
			{
				displayName: 'Purchase ID',
				name: 'purchaseId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['getPurchase'] } },
			},

			// Send message
			{
				displayName: 'Recipient Handle',
				name: 'handle',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'A-1a2b3c4d',
				description: 'An A-xxxxxxxx agent handle, or ace-team',
				displayOptions: { show: { operation: ['sendMessage'] } },
			},
			{
				displayName: 'Message',
				name: 'body',
				type: 'string',
				typeOptions: { rows: 4 },
				required: true,
				default: '',
				description: 'Up to 16,384 UTF-8 bytes',
				displayOptions: { show: { operation: ['sendMessage'] } },
			},
			{
				displayName: 'Client Message ID',
				name: 'clientMessageId',
				type: 'string',
				default: '',
				description:
					'Idempotency key. Reuse it with the same recipient and body to retry safely. Leave empty to generate one per execution and item.',
				displayOptions: { show: { operation: ['sendMessage'] } },
			},

			// Inbox
			{
				displayName: 'Action',
				name: 'inboxAction',
				type: 'options',
				options: [
					{ name: 'List', value: 'list' },
					{ name: 'Mark Read', value: 'mark_read' },
				],
				default: 'list',
				displayOptions: { show: { operation: ['inbox'] } },
			},
			{
				displayName: 'After Sequence',
				name: 'after',
				type: 'number',
				typeOptions: { minValue: 0 },
				default: 0,
				description: 'Return messages after this sequence (use your saved readCursor)',
				displayOptions: { show: { operation: ['inbox'], inboxAction: ['list'] } },
			},
			{
				displayName: 'Limit',
				name: 'inboxLimit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 100 },
				default: 50,
				description: 'Max number of results to return',
				displayOptions: { show: { operation: ['inbox'], inboxAction: ['list'] } },
			},
			{
				displayName: 'Through Sequence',
				name: 'through',
				type: 'number',
				typeOptions: { minValue: 0 },
				required: true,
				default: 0,
				description:
					'Last sequence you have read. Returns a readCursor to store and pass as After next time.',
				displayOptions: { show: { operation: ['inbox'], inboxAction: ['mark_read'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const useCredentials = AUTH_OPERATIONS.includes(operation);
				let tool = '';
				const args: IDataObject = {};

				if (operation === 'ask') {
					tool = 'ask_vermarco';
					args.question = this.getNodeParameter('question', i) as string;
				} else if (operation === 'browse') {
					tool = 'browse_marketplace';
					const q = this.getNodeParameter('q', i) as string;
					if (q) args.q = q;
					args.limit = this.getNodeParameter('limit', i) as number;
					const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
					for (const [key, value] of Object.entries(filters)) {
						if (value !== '' && value !== undefined && value !== null) args[key] = value;
					}
				} else if (operation === 'preview') {
					tool = 'preview_listing';
					args.listing_id = this.getNodeParameter('listingId', i) as string;
				} else if (operation === 'buy') {
					tool = 'buy_data';
					args.listing_id = this.getNodeParameter('listingId', i) as string;
					const email = this.getNodeParameter('email', i) as string;
					if (email) args.email = email;
				} else if (operation === 'getPurchase') {
					tool = 'get_purchase';
					args.purchase_id = this.getNodeParameter('purchaseId', i) as string;
				} else if (operation === 'sendMessage') {
					tool = 'agent_send_message';
					args.handle = this.getNodeParameter('handle', i) as string;
					args.body = this.getNodeParameter('body', i) as string;
					const clientMessageId = this.getNodeParameter('clientMessageId', i) as string;
					args.clientMessageId = clientMessageId || `n8n-${this.getExecutionId() ?? 'manual'}-${i}`;
				} else if (operation === 'inbox') {
					tool = 'agent_inbox';
					const action = this.getNodeParameter('inboxAction', i) as string;
					args.action = action;
					if (action === 'mark_read') {
						args.through = this.getNodeParameter('through', i) as number;
					} else {
						args.after = this.getNodeParameter('after', i) as number;
						args.limit = this.getNodeParameter('inboxLimit', i) as number;
					}
				}

				// The agent key travels only in the Authorization header, never in tool arguments.
				const output = await callVermarcoTool.call(this, i, tool, args, useCredentials);

				if (operation === 'buy' && typeof output.checkoutUrl === 'string') {
					output.paymentRequired = true;
					output.nextStep =
						'A human must open checkoutUrl and complete payment. Then run Get Purchase with purchaseId.';
				}

				returnData.push({ json: output, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
