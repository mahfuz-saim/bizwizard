// @dead-code — 2026-09-24 knip+grep: 0 active imports, candidate for removal (kept per request)
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { memo } from 'react'
import { MinusCircleIcon, PlusCircleIcon } from './icons'

// Static styles — registered once with React Native's StyleSheet so the
// platform/native style hash is computed at module load and reused across
// renders. Building these from a className template literal on every render
// forces NativeWind to re-parse and re-hash the class string, which costs work
// in every memoized row re-render. StyleSheet.create sidesteps that.
const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		marginVertical: 8,
	},
	cell: {
		flex: 1,
		textAlign: 'center',
	},
	qtyContainer: {
		flex: 1,
		flexDirection: 'row',
		justifyContent: 'space-evenly',
	},
	qtyText: {
		textAlign: 'center',
	},
})

// Memoized row. Re-renders only when the relevant item fields change, or when
// the parent swaps the onQtyChange handler reference. Extracted to its own
// file so React.memo + its custom comparator live in a stable module — being
// declared inside another component body would re-allocate the memo wrapper
// every render of the parent and silently defeat the memoization.
const TableRow = memo(
	function TableRow({ item, onQtyChange }) {
		const editable = onQtyChange != null
		return (
			<View style={styles.row}>
				<Text style={styles.cell}>{item.productName}</Text>
				<Text style={styles.cell}>{item.sellPrice}</Text>
				<View style={styles.qtyContainer}>
					{editable ? (
						<TouchableOpacity onPress={() => onQtyChange(item, '-')}>
							<MinusCircleIcon size={24} color="black" />
						</TouchableOpacity>
					) : null}
					<Text style={styles.qtyText}>{item.quantity}</Text>
					{editable ? (
						<TouchableOpacity onPress={() => onQtyChange(item, '+')}>
							<PlusCircleIcon size={24} color="black" />
						</TouchableOpacity>
					) : null}
				</View>
			</View>
		)
	},
	(prev, next) =>
		prev.item?.lotId === next.item?.lotId &&
		prev.item?.productName === next.item?.productName &&
		prev.item?.sellPrice === next.item?.sellPrice &&
		prev.item?.quantity === next.item?.quantity &&
		prev.onQtyChange === next.onQtyChange
)

export default TableRow
