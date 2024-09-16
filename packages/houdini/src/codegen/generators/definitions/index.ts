import * as graphql from 'graphql'

import type { Config } from '../../../lib/index.js'
import { fs } from '../../../lib/index.js'
import enums from './enums.js'

// schemaGenerator updates the schema file to contain all of the generated
export default async function schemaGenerator(config: Config) {
	await Promise.all([
		fs.writeFile(
			config.definitionsSchemaPath,
			config.localSchema ? graphql.printSchema(config.schema) : config.newSchema
		),
		fs.writeFile(config.definitionsDocumentsPath, config.newDocuments),
		enums(config),
	])
}
