import type { ConfigFile } from '../lib/config.js'

const configs: ((old: ConfigFile) => ConfigFile)[] = []

export default configs
