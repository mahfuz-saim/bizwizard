import React, { useState, useEffect } from 'react'
import {
	ToastAndroid,
	View,
	ImageBackground,
	ScrollView,
	ActivityIndicator,
	StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import ShopForm from './shopForm'
import { getShopDetails, updateShop } from '../../../../src/controllers/shop'
import useApi from '../../../../src/hooks/useApi'
import { useLocalization } from '../../../../src/localization/localizationContext'
import { statusBarColor, barStyleMode } from '../../../../src/constants'

export default function EditShop() {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const params = useLocalSearchParams()
	const [loading, setLoading] = useState(true)
	const [shopData, setShopData] = useState(null)

	// Fetch the shop details
	useEffect(() => {
		const fetchShopDetails = async () => {
			try {
				const result = await fetchData(getShopDetails, { id: params.id })
				if (result.success && result.data) {
					// Parse address if needed
					const address = result.data.location || ''
					let street = '',
						city = '',
						district = ''

					if (typeof address === 'string') {
						const addressParts = address.split(', ')
						street = addressParts[0] || ''
						city = addressParts[1] || ''
						district = addressParts[2] || ''
					}

					setShopData({
						...result.data,
						street,
						city,
						district,
						termsAccepted: true, // Already accepted when creating
					})
				} else {
					ToastAndroid.show(
						loc.t('shops.edit.errorLoading') || 'Error loading shop data',
						ToastAndroid.LONG
					)
					router.back()
				}
			} catch (error) {
				ToastAndroid.show(
					loc.t('shops.edit.errorLoading') || 'Error loading shop data',
					ToastAndroid.LONG
				)
				router.back()
			} finally {
				setLoading(false)
			}
		}

		fetchShopDetails()
	}, [params.id])

	async function handleSubmit(data) {
		// Combine address fields
		const updatedData = {
			...data,
			id: params.id,
			location: `${data.street}, ${data.city}, ${data.district}`,
		}

		// Remove individual address fields before sending to API
		delete updatedData.street
		delete updatedData.city
		delete updatedData.district
		delete updatedData.termsAccepted

		const result = await fetchData(updateShop, updatedData)
		if (result.success === true) {
			ToastAndroid.show(
				loc.t('shops.edit.successMsg') || 'Shop updated successfully',
				ToastAndroid.LONG
			)
		} else {
			ToastAndroid.show(
				loc.t('shops.edit.errMsg') || 'Failed to update shop',
				ToastAndroid.LONG
			)
		}
		router.back()
	}

	if (loading) {
		return (
			<View className="flex-1 justify-center items-center bg-white">
				<ActivityIndicator size="large" color="#4169E1" />
			</View>
		)
	}

	return (
		<SafeAreaView className="flex-1 bg-white">
			<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />
			<ImageBackground
				source={require('../../../../assets/shop-illustration.png')}
				className="flex-1"
				resizeMode="cover"
			>
				<ScrollView className="flex-1">
					<View className="mt-4 px-4 pb-8">
						<ShopForm
							initialValues={shopData}
							handleSubmit={handleSubmit}
							formTitle={loc.t('shops.edit.title') || 'Edit Shop'}
							submitText={loc.t('shops.edit.submit') || 'Update Shop'}
						/>
					</View>
				</ScrollView>
			</ImageBackground>
		</SafeAreaView>
	)
}
