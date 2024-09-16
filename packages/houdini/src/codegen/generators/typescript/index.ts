import type { Config, Document } from '../../../lib/index.js'
import { generateDocumentTypes } from './documentTypes.js'
import imperativeCacheTypedef from './imperativeTypeDef.js'

// typescriptGenerator generates typescript definitions for the artifacts
export default async function typescriptGenerator(config: Config, docs: Document[]) {
	await Promise.all([
		generateDocumentTypes(config, docs),
		// write the imperative cache type definition
		imperativeCacheTypedef(config, docs),
	])
}
