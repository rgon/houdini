import type { ProjectManifest, routerConventions } from './index.js'
import type { Config } from '../config.js'

export type Adapter = ((args: {
	config: Config
	conventions: typeof routerConventions
	sourceDir: string
	publicBase: string
	outDir: string
	manifest: ProjectManifest
	adapterPath: string
}) => void | Promise<void>) & {
	includePaths?: Record<string, string>
	disableServer?: boolean
	pre?: (args: {
		config: Config
		conventions: typeof routerConventions
		sourceDir: string
		publicBase: string
		outDir: string
	}) => Promise<void> | void
}
