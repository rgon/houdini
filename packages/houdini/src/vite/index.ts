import type * as graphql from 'graphql'
import minimatch from 'minimatch'
import type { Plugin } from 'vite'
import watch_and_run from 'vite-plugin-watch-and-run'

import generate from '../codegen/index.js'
import type { PluginConfig } from '../lib/index.js'
import { getConfig, formatErrors, path } from '../lib/index.js'
import houdini_vite from './houdini.js'
import { watch_local_schema, watch_remote_schema } from './schema.js'

export * from './ast.js'
export * from './imports.js'
export * from './schema.js'
export * from './houdini.js'

export default function (opts?: PluginConfig): (Plugin | null)[] {
	// we need some way for the graphql tag to detect that we are running on the server
	// so we don't get an error when importing.
	process.env.HOUDINI_PLUGIN = 'true'

	// a container of a list
	const watchSchemaListref = { list: [] as string[] }

	return [
		houdini_vite(opts),
		watch_remote_schema(opts),
		watch_local_schema(watchSchemaListref),
		watch_and_run([
			{
				name: 'Houdini',
				quiet: true,
				async watchFile(filepath: string) {
					// load the config file
					const config = await getConfig(opts)

					// we need to watch some specific files
					if (config.localSchema) {
						const toWatch = watchSchemaListref.list
						if (toWatch.includes(filepath)) {
							// if it's a schema change, let's reload the config
							await getConfig({ ...opts, forceReload: true })
							return true
						}
					} else {
						const schemaPath = path.join(
							path.dirname(config.filepath),
							config.schemaPath!
						)
						if (minimatch(filepath, schemaPath)) {
							// if it's a schema change, let's reload the config
							await getConfig({ ...opts, forceReload: true })
							return true
						}
					}

					return config.includeFile(filepath, { root: process.cwd() })
				},
				async run(server) {
					// load the config file
					const config = await getConfig(opts)
					if (config.localSchema) {
						config.schema = (await server.ssrLoadModule(config.localSchemaPath))
							.default as graphql.GraphQLSchema
						// reload the schema
						// config.schema = await loadLocalSchema(config)
					}

					// make sure we behave as if we're generating from inside the plugin (changes logging behavior)
					config.pluginMode = true

					// generate the runtime
					await generate(config)
				},
				delay: 100,
				watchKind: ['add', 'change', 'unlink'],
				formatErrors,
			},
		]),
	]
}
