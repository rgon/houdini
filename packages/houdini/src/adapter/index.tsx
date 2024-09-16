import type { serverAdapterFactory as createAdapter } from '../runtime/router/server.js'

export const endpoint: string = ''

export let createServerAdapter: (
	args: Omit<
		Parameters<typeof createAdapter>[0],
		| 'on_render'
		| 'manifest'
		| 'yoga'
		| 'schema'
		| 'graphqlEndpoint'
		| 'componentCache'
		| 'client'
	>
) => ReturnType<typeof createAdapter>
