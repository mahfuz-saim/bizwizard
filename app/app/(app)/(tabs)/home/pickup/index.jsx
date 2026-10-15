// import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalization } from '../../../../../src/localization/localizationContext'
// import useApi from '../../../../../src/hooks/useApi.jsx'
// import { getPickUp } from '../../../../../src/controllers/pickup.js'
// import { router } from 'expo-router'

export default function PickUpHome() {
	// const [pickUpItems, setPickUpItems] = useState([])
	const { loc } = useLocalization()
	// const { fetchData } = useApi()

	// useEffect(() => {
	// 	async function fetchPickUp() {
	// 		const pickup = await fetchData(getPickUp, {})
	// 		setPickUpItems(pickup.data)
	// 	}

	// 	fetchPickUp()
	// }, [])

	// function handleItemPress(item) {
	// 	console.log(item)
	// }

	// function listPickUp(data) {
	// 	return (
	// 		<Pressable onPress={() => handleItemPress(data)}>
	// 			<View className="mx-4 p-2 mb-4 border-2 border-color_5">
	// 				<View className="flex-row justify-between">
	// 					<Text>{loc.t('pickup.time')}</Text>
	// 					<Text>{data.createdAt}</Text>
	// 				</View>
	// 				<View className="flex-row justify-between">
	// 					<View>
	// 						<Text>{loc.t('pickup.totalPrice')}</Text>
	// 						<Text>{data.totalPrice}</Text>
	// 					</View>
	// 					<View>
	// 						<Text>{loc.t('pickup.totalQty')}</Text>
	// 						<Text>{data.totalQuantity}</Text>
	// 					</View>
	// 				</View>
	// 			</View>
	// 		</Pressable>
	// 	)
	// }

	return (
		<View className="flex-1 justify-center items-center bg-gray-50">
			<View className="items-center px-8">
				{/* Icon placeholder */}
				<View className="w-24 h-24 bg-blue-100 rounded-full mb-6 justify-center items-center">
					<Text className="text-4xl">🚀</Text>
				</View>

				{/* Main heading */}
				<Text className="text-2xl font-bold text-gray-800 mb-3 text-center">
					{loc.t('pickup.comingSoon')}
				</Text>

				{/* Description */}
				<Text className="text-lg text-gray-600 text-center mb-2">
					{loc.t('pickup.comingSoonDescription')}
				</Text>

				{/* Additional info */}
				<Text className="text-sm text-gray-500 text-center leading-5">
					{loc.t('pickup.comingSoonDetails')}
				</Text>
			</View>
		</View>
	)

	// return (
	// 	<View className="mt-2">
	// 		<FlatList
	// 			data={pickUpItems}
	// 			renderItem={({ item }) => listPickUp(item)}
	// 		></FlatList>
	// 	</View>
	// )
}
