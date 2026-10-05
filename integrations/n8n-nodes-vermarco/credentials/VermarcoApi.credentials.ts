import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class VermarcoApi implements ICredentialType {
	name = 'vermarcoApi';

	displayName = 'Vermarco API';

	icon: Icon = { light: 'file:../icons/vermarco.svg', dark: 'file:../icons/vermarco.dark.svg' };

	documentationUrl = 'https://github.com/ilya7-eng/vermarco-mcp#connect';

	properties: INodeProperties[] = [
		{
			displayName: 'Agent API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Your vm_live_ agent key from POST https://vermarco.com/api/agents/register. It is sent as a Bearer token.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://vermarco.com',
			url: '/api/agents/me',
			method: 'GET',
		},
	};
}
