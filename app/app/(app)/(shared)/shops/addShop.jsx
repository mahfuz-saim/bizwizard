import React, { useState, useEffect } from 'react'
import {
	View,
	ImageBackground,
	ScrollView,
	StatusBar,
	BackHandler,
	ToastAndroid,
	KeyboardAvoidingView,
	Keyboard,
	Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback } from 'react'
import ShopForm from './shopForm'
import { addShop, getShops } from '../../../../src/controllers/shop'
import useApi from '../../../../src/hooks/useApi'
import { useLocalization } from '../../../../src/localization/localizationContext'
import { statusBarColor, barStyleMode } from '../../../../src/constants'
import { BACKEND } from '../../../../src/constants'
import Analytics from '../../../../src/firebase/analytics'

export default function AddShop() {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const { isFirstShop } = useLocalSearchParams()
	const [shopCategory, setShopCategory] = useState([])
	const [keyboardHeight, setKeyboardHeight] = useState(0)

	useEffect(() => {
		const showSub = Keyboard.addListener(
			Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
			(e) => setKeyboardHeight(e.endCoordinates.height)
		)
		const hideSub = Keyboard.addListener(
			Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
			() => setKeyboardHeight(0)
		)
		return () => {
			showSub.remove()
			hideSub.remove()
		}
	}, [])

	useFocusEffect(
		useCallback(() => {
			const onBackPress = () => {
				// If this is the first shop (no shops yet), going back to /shops would loop to addShop again
				// Let Shops handle the 0-shops redirect; for first-shop flow keep user here
				if (isFirstShop === 'true') {
					return true // swallow back press — user must create shop or exit app via system
				}
				router.replace('/shops')
				return true
			}

			const subscription = BackHandler.addEventListener(
				'hardwareBackPress',
				onBackPress
			)

			return () => subscription.remove()
		}, [isFirstShop])
	)

	useEffect(() => {
		const fetchCategories = async () => {
			try {
				const res = await fetch(`${BACKEND}/shop/all-category`, {
					method: 'GET',
				})
				const resJson = await res.json()
				setShopCategory(resJson.data)
			} catch (error) {
				console.error('🚨 Error fetching shop categories:', error)
			}
		}

		fetchCategories()
	}, [])

	async function handleSubmit(data) {
		// Combine address fields for API
		const formattedData = {
			shopName: data.name,
			contact: data.phone,
			tradeLicense: data.tradeLicense,
			category: data.category,
			address: {
				street: data.street,
				upazila: data.upazila,
				district: data.district,
			},
		}

		//TODO: do somethiing with t&c

		const result = await fetchData(addShop, formattedData)
		if (result.success === true) {
			try {
				await Analytics.shopCreated()
				await Analytics.setHasShop(true)
			} catch (error) {
				console.error('🚨 Analytics shop created error:', error)
			}
			ToastAndroid.show(
				loc.t('shops.add.successMsg') || 'Shop added successfully',
				ToastAndroid.SHORT,
				ToastAndroid.CENTER
			)
			// First shop → auto-redirect to dashboard via Shops auto-selection (reuses existing logic)
			// isFirstShop is set when Shops had 0 shops before. Fallback: if not set, check shop count after creation.
			if (isFirstShop === 'true') {
				router.replace('/shops?autoRedirect=true')
				return
			}
			try {
				const shopsRes = await fetchData(getShops, {})
				const shops = shopsRes?.data?.data
				if (
					shopsRes?.success === true &&
					Array.isArray(shops) &&
					shops.length === 1
				) {
					router.replace('/shops?autoRedirect=true')
					return
				}
			} catch (e) {
				console.error('🚨 post-create shop count check failed', e)
			}
		} else {
			ToastAndroid.show(
				loc.t('shops.add.errMsg') || 'Something went wrong, please try again',
				ToastAndroid.SHORT,
				ToastAndroid.CENTER
			)
		}
		router.replace('/shops')
	}

	return (
		<SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
			<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />
			<KeyboardAvoidingView
				className="flex-1"
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ImageBackground
					source={require('../../../../assets/shop-illustration.png')}
					className="flex-1"
					resizeMode="cover"
				>
					<ScrollView
						className="flex-1"
						keyboardShouldPersistTaps="handled"
						automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
						contentContainerStyle={{
							flexGrow: 1,
							paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0,
						}}
					>
						<ShopForm
							initialValues={{
								name: '',
								category: '',
								street: '',
								city: '',
								district: '',
								phone: '',
								tradeLicense: '',
								termsAccepted: false,
							}}
							handleSubmit={handleSubmit}
							formTitle={loc.t('shops.add.title') || 'Create your account'}
							submitText={loc.t('shops.add.submit') || 'Add Shop'}
							shopCategories={shopCategory}
							loc={loc}
						/>
					</ScrollView>
				</ImageBackground>
			</KeyboardAvoidingView>
		</SafeAreaView>
	)
}
