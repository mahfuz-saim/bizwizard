// @dead-code — 2026-09-24 knip+grep: 0 active imports, candidate for removal (kept per request)
// Centralized MaterialCommunityIcons re-exports. Importing from the deep path
// `@expo/vector-icons/MaterialCommunityIcons` keeps the icon glyphs scoped to
// that single set rather than pulling the entire icon registry. Hoisting these
// component references to module scope lets us pass the same React component
// identity to every row, so React can skip reconciliation when only props
// change.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'

export const MinusCircleIcon = (props) => (
	<MaterialCommunityIcons name="minus-circle-outline" {...props} />
)

export const PlusCircleIcon = (props) => (
	<MaterialCommunityIcons name="plus-circle-outline" {...props} />
)
