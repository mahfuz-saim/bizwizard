// @dead-code — 2026-09-24 knip+grep: 0 active imports, candidate for removal (kept per request)
import { View, Text } from 'react-native'
import { useCallback } from 'react'
import { FlashList } from '@shopify/flash-list'
import TableRow from './table/TableRow'

// Static table header data — module-level so it isn't re-allocated each render.
const TABLE_HEADER_DATA = {
	barcode: 'Barcode',
	productName: 'Name',
	sellPrice: 'Price',
	quantity: 'Quantity',
	unit: 'Unit',
}

// Declared at module scope so it isn't re-allocated on every cart mutation in
// the parent. Pure function of TABLE_HEADER_DATA — no props, no state.
function TableHeader() {
	return (
		<View className="flex-row justify-between">
			<Text className="flex-1 text-center text-xl">
				{TABLE_HEADER_DATA.productName}
			</Text>
			<Text className="flex-1 text-center text-xl">
				{TABLE_HEADER_DATA.sellPrice}
			</Text>
			<Text className="flex-1 text-center text-xl">
				{TABLE_HEADER_DATA.quantity}
			</Text>
		</View>
	)
}

export default function ItemTable(props) {
	const { cartProducts, handleQtyChange = null } = props

	// Stable key extractor — only invalidates when an item is replaced.
	const keyExtractor = useCallback(
		(item, index) => item?.lotId?.toString?.() || `cart-item-${index}`,
		[]
	)

	const renderItem = useCallback(
		({ item }) => <TableRow item={item} onQtyChange={handleQtyChange} />,
		[handleQtyChange]
	)

	return (
		<View className="flex-1 my-2">
			<TableHeader />
			<FlashList
				data={cartProducts}
				keyExtractor={keyExtractor}
				renderItem={renderItem}
			/>
		</View>
	)
}
