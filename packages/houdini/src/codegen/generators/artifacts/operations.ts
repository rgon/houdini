import * as graphql from 'graphql'

import type { Config } from '../../../lib/index.js'
import { parentTypeFromAncestors } from '../../../lib/index.js'
import type { MutationOperation } from '../../../runtime/lib/types.js'
import { convertValue } from './utils.js'

// return the list of operations that are part of a mutation
export function operationsByPath(
	config: Config,
	filepath: string,
	definition: graphql.OperationDefinitionNode,
	filterTypes: FilterMap
): { [path: string]: MutationOperation[] } {
	if (!definition) {
		return {}
	}

	// map the path in the response to the list of operations that treat it as the source
	const pathOperations: { [path: string]: MutationOperation[] } = {}

	// we need to look for three different things in the operation:
	// - insert fragments
	// - remove fragments
	// - delete directives
	//
	// note: for now, we're going to ignore the possibility that fragments
	// inside of the mutation could contain operations
	graphql.visit(definition, {
		FragmentSpread(node, _, __, ___, ancestors) {
			// at this point, the fragment spread can contain the hashed parameters from an `@with` directive in it.
			// if this fragment spread has a `@with` directive, strip the last `_asdf` from the name and check if that is a list fragment
			let nameWithoutHash = node.name.value

			if (
				node.directives &&
				node.directives.find((directive) => directive.name.value === 'with')
			) {
				nameWithoutHash = nameWithoutHash.substring(0, nameWithoutHash.lastIndexOf('_'))
			}

			// if the fragment is not a list operation, we don't care about it now
			if (!config.isListFragment(nameWithoutHash)) {
				return
			}

			// if this is the first time we've seen this path give us a home
			const path = ancestorKey(ancestors)
			if (!pathOperations[path]) {
				pathOperations[path] = []
			}

			// add the operation object to the list
			pathOperations[path].push(
				operationObject({
					config,
					filepath,
					listName: config.listNameFromFragment(nameWithoutHash),
					operationKind: config.listOperationFromFragment(nameWithoutHash),
					type: parentTypeFromAncestors(config.schema, filepath, ancestors).name,
					selection: node,
				})
			)
		},
		Directive(node, _, __, ___, ancestors) {
			// we only care about delete directives
			if (!config.isDeleteDirective(node.name.value)) {
				return
			}

			// if this is the first time we've seen this path give us a home
			const path = ancestorKey(ancestors)
			if (!pathOperations[path]) {
				pathOperations[path] = []
			}

			// add the operation object to the list
			pathOperations[path].push(
				operationObject({
					config,
					filepath,
					listName: node.name.value,
					operationKind: 'delete',
					type: config.listNameFromDirective(node.name.value),
					selection: ancestors[ancestors.length - 1] as graphql.FieldNode,
				})
			)
		},
	})

	return pathOperations
}

function operationObject({
	config,
	listName,
	operationKind,
	type,
	selection,
	filepath,
}: {
	config: Config
	filepath: string
	listName: string
	operationKind: MutationOperation['action']
	type: string
	selection: graphql.SelectionNode
}): MutationOperation {
	// look at the directives applies to the spread for meta data about the mutation
	let parentID
	let parentKind: 'Variable' | 'String' = 'String'

	let position: MutationOperation['position'] = config.internalListPosition
	let allLists: MutationOperation['target'] = config.defaultListTarget ?? undefined
	let operationWhen: MutationOperation['when'] | undefined

	const internalDirectives = selection.directives?.filter((directive) =>
		config.isInternalDirective(directive.name.value)
	)
	if (internalDirectives && internalDirectives.length > 0) {
		// is prepend applied?
		const prepend = internalDirectives.find(
			({ name }) => name.value === config.listPrependDirective
		)
		// is append applied?
		const append = internalDirectives.find(
			({ name }) => name.value === config.listAppendDirective
		)

		// if both are applied, there's a problem, this should never happen has it's checked in validation step
		if (append) {
			position = 'last'
		}
		if (prepend) {
			position = 'first'
		}

		// is allLists applied?
		const allListsDirective = internalDirectives.find(
			({ name }) => name.value === config.listAllListsDirective
		)

		// look for the parentID directive
		let parent = internalDirectives.find(
			({ name }) => name.value === config.listParentDirective
		)

		// if both are applied, there's a problem, this should never happen has it's checked in validation step
		allLists = allListsDirective ? 'all' : undefined

		// is when applied?
		const when = internalDirectives.find(({ name }) => name.value === 'when')
		// is when_not applied?
		const when_not = internalDirectives.find(({ name }) => name.value === 'when_not')

		// the parent ID can be provided only with the parentID directive.
		let parentIDArg = parent?.arguments?.find((argument) => argument.name.value === 'value')
		if (parentIDArg) {
			// if the argument is a string
			if (parentIDArg.value.kind === 'StringValue') {
				// use its value
				parentID = parentIDArg.value.value
				parentKind = 'String'
			} else if (parentIDArg.value.kind === 'Variable') {
				parentKind = 'Variable'
				parentID = parentIDArg.value.name.value
			}
		}

		// look for a when arguments on the operation directives
		const whenArg = (append || prepend)?.arguments?.find(({ name }) => name.value === 'when')
		// look for a when_not condition on the operation
		const whenNotArg = (append || prepend)?.arguments?.find(
			({ name }) => name.value === 'when_not'
		)

		for (const [i, arg] of [whenArg, whenNotArg].entries()) {
			// we may not have the argument
			if (!arg || arg.value.kind !== 'ObjectValue') {
				continue
			}

			// make sure we have a place to record the when condition
			if (!operationWhen) {
				operationWhen = {}
			}

			// the kind of `value` is always going to be a string because the directive
			// can only take one type as its argument so we'll worry about parsing when
			// generating the artifact
			operationWhen[i ? 'must_not' : 'must'] = arg.value.fields.reduce(
				(obj, arg) => ({
					...obj,
					[arg.name.value]: convertValue(config, arg.value).value,
				}),
				{}
			)
		}

		// look at the when and when_not directives
		for (const [i, directive] of [when, when_not].entries()) {
			// we may not have the directive applied
			if (!directive) {
				continue
			}
			// which are we looking at
			const which = i ? 'must_not' : 'must'

			// make sure we have a place to record the when condition
			if (!operationWhen) {
				operationWhen = {}
			}

			// look for the argument field
			operationWhen[which] = directive.arguments?.reduce(
				(filters, argument) => ({
					...filters,
					[argument.name.value]: convertValue(config, argument.value).value,
				}),
				{}
			)
		}
	}

	const operation: MutationOperation = {
		action: operationKind,
	}

	// delete doesn't have a target
	if (operationKind !== 'delete') {
		operation.list = listName
	}

	// add the target type to delete operations
	if (operationKind === 'delete' && type) {
		operation.type = type
	}

	// only add the position argument if we are inserting or toggling something
	if (operationKind === 'insert' || operationKind === 'toggle') {
		operation.position = position
	}

	// add target
	if (allLists && operationKind !== 'delete') {
		operation.target = 'all'
	}

	// if there is a parent id
	if (parentID) {
		// add it to the object
		operation.parentID = {
			kind: parentKind,
			value: parentID,
		}
	}

	// if there is a conditional
	if (operationWhen) {
		operation.when = operationWhen
	}

	return operation
}

// TODO: find a way to reference the actual type for ancestors, using any as escape hatch
function ancestorKey(ancestors: any): string {
	return (
		ancestors
			.filter(
				// @ts-ignore
				(entry) => !Array.isArray(entry) && entry.kind === 'Field'
			)
			// @ts-ignore
			.map((field) => field.name.value)
			.join(',')
	)
}

export type FilterMap = {
	[listName: string]: {
		[filterName: string]: 'String' | 'Float' | 'Int' | 'Boolean'
	}
}
