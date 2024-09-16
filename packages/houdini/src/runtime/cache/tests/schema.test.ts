import { test } from 'vitest'

import { testConfigFile } from '../../../test/index.js'
import { Cache } from '../cache.js'

const config = testConfigFile()

test('writing a selection loads the schema information', function () {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// write the data
	cache.write({
		selection: {
			fields: {
				viewer: {
					type: 'User',
					visible: true,
					keyRaw: 'viewer',
					selection: {
						fields: {
							id: {
								type: 'ID',
								visible: true,
								keyRaw: 'id',
							},
							firstName: {
								type: 'String',
								visible: true,
								keyRaw: 'firstName(id: "1")',
							},
						},
					},
				},
			},
		},
		data: {
			viewer: {
				id: '1',
				firstName: 'bob',
			},
		},
	})
})
