import { type Adapter, fs, path } from 'houdini'
import { fileURLToPath } from 'node:url'

const adapter: Adapter = async ({ outDir, adapterPath }) => {
	// read the contents of the app file
	let serverContents = (await fs.readFile(
		import.meta ?
			fileURLToPath(new URL('./app.js', import.meta.url).href)
			: require.resolve('./app.js')
	))!

	// make sure that the adapter module imports from the correct path
	serverContents = serverContents.replaceAll('houdini/adapter', adapterPath + '.js')

	await fs.writeFile(path.join(outDir, 'index.js'), serverContents!)
}

export default adapter
