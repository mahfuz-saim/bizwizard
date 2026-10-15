import {
	Text,
	View,
	StatusBar,
	TouchableOpacity,
	FlatList,
	ImageBackground,
	ActivityIndicator,
	Animated,
	Modal,
	BackHandler,
	ToastAndroid,
} from 'react-native'
import { useAuth } from '../../../../src/context/AuthContext'
import { useCallback, useState, useEffect, useRef } from 'react'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import useApi from '../../../../src/hooks/useApi'
import { getShops } from '../../../../src/controllers/shop'
import {
	getEmployeeShop,
	getEmployeePendingRequests,
} from '../../../../src/controllers/employee'
import shopBackground from '../../../../assets/shop-bg.png'
import { statusBarColor, barStyleMode } from '../../../../src/constants'
import { useLocalization } from '../../../../src/localization/localizationContext'
import { useNavigation } from '@react-navigation/native'
import * as SecureStore from 'expo-secure-store'
import apiClient from '@/src/controllers/apiClient'

export default function Shops() {
	const navigation = useNavigation()
	const { loc } = useLocalization()
	const { setAuthState, authState } = useAuth()
	const [usrShops, setUsrShops] = useState([])
	const [selectedShop, setSelectedShop] = useState(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isRedirecting, setIsRedirecting] = useState(false)
	const [exitModalVisible, setExitModalVisible] = useState(false)
	const { fetchData } = useApi()
	const { autoRedirect } = useLocalSearchParams()
	const shouldAutoRedirect = autoRedirect === 'true'

	// Animation for loading dots
	const dot1Opacity = useRef(new Animated.Value(0.3)).current
	const dot2Opacity = useRef(new Animated.Value(0.3)).current
	const dot3Opacity = useRef(new Animated.Value(0.3)).current

	// Handle back button press
	useEffect(() => {
		const backAction = () => {
			if (shouldAutoRedirect) {
				setExitModalVisible(true)
				return true // Prevent default back action
			} else {
				router.replace('/home')
				return true // Prevent default back action
			}
		}

		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			backAction
		)

		return () => backHandler.remove()
	}, [shouldAutoRedirect])

	// Handle exit app
	const handleExitApp = () => {
		BackHandler.exitApp()
	}

	// Animated loading dots effect
	useEffect(() => {
		const animateDots = () => {
			const animateSequence = (dot, delay) => {
				return Animated.sequence([
					Animated.delay(delay),
					Animated.timing(dot, {
						toValue: 1,
						duration: 400,
						useNativeDriver: true,
					}),
					Animated.timing(dot, {
						toValue: 0.3,
						duration: 400,
						useNativeDriver: true,
					}),
				])
			}

			Animated.loop(
				Animated.stagger(200, [
					animateSequence(dot1Opacity, 0),
					animateSequence(dot2Opacity, 0),
					animateSequence(dot3Opacity, 0),
				])
			).start()
		}

		if (isLoading || isRedirecting) {
			animateDots()
		}
	}, [isLoading, isRedirecting])

	useFocusEffect(
		useCallback(() => {
			async function fetchShops() {
				setIsLoading(true)
				try {
					//HANDLE EMPLOYEE ROLE
					if (authState.role === 'EMPLOYEE') {
						const res = await fetchData(getEmployeeShop, {})
						if (res?.data) {
							await SecureStore.setItemAsync(
								'tenantID',
								String(res.data.tenantID)
							)
							// set axios header
							apiClient.defaults.headers.common['x-tenant-id'] = String(
								shop.tenantID
							)
							setAuthState((prev) => ({
								...prev,
								shopId: res.data.id,
								tenantID: res.data.tenantID,
								shopName: res.data.shopName,
							}))
							const shop = res.data
							if (
								shop.Subscription.length >= 0 &&
								shop.Subscription[0]?.status === 'ACTIVE'
							) {
								setAuthState((prev) => ({
									...prev,
									isSubscriptionValid: true,
								}))
								router.replace('/home')
							} else {
								router.replace('/home/subscriptionBuy/')
							}
						} else {
							const res = await fetchData(getEmployeePendingRequests, {})

							if (res?.data?.status === 'PENDING') {
								navigation.navigate('waitForJoining', {
									shopId: res.data.Shop.shopName,
								})
							} else {
								router.replace('/shops/joinShop')
							}
						}
						return
					}

					const result = await fetchData(getShops, {})
					if (result.success === true) {
						setUsrShops(result.data.data)
						const storedShopId =
							await SecureStore.getItemAsync('selectedShopId')
						if (result.data.data.length === 0) {
							setIsRedirecting(true)
							router.replace('/shops/addShop?isFirstShop=true')
						} else if (shouldAutoRedirect && result.data.data.length === 1) {
							setSelectedShop(result.data.data[0].id)
							setIsGoingNext(true)
						} else if (
							shouldAutoRedirect &&
							storedShopId &&
							result.data.data.find((shop) => shop.id === storedShopId)
						) {
							setSelectedShop(storedShopId)
							setIsGoingNext(true)
						} else {
							setIsLoading(false)
						}
					} else {
						setIsLoading(false)
						ToastAndroid.show(
							loc.t('shops.fetchShopsError') || 'Failed to fetch shops',
							ToastAndroid.SHORT,
							ToastAndroid.CENTER
						)
					}
				} catch (error) {
					console.error('🚀 error : ', error)
					setIsLoading(false)
					ToastAndroid.show(
						loc.t('shops.fetchShopsError') || 'Failed to fetch shops',
						ToastAndroid.SHORT,
						ToastAndroid.CENTER
					)
				}
			}
			fetchShops()
		}, [shouldAutoRedirect])
	)

	const handleShopPress = (shop) => {
		setSelectedShop(shop.id)
	}
	const [isGoingNext, setIsGoingNext] = useState(false)

	useEffect(() => {
		if (isGoingNext) {
			handleGoPress()
		}
	}, [isGoingNext])

	const handleGoPress = async () => {
		if (selectedShop) {
			await SecureStore.setItemAsync('selectedShopId', selectedShop)

			setIsRedirecting(true)
			const shop = usrShops.find((shop) => shop.id === selectedShop)
			await SecureStore.setItemAsync('tenantID', String(shop.tenantID))

			// set axios header
			apiClient.defaults.headers.common['x-tenant-id'] = String(shop.tenantID)
			setAuthState((prev) => ({
				...prev,
				shopId: shop.id,
				tenantID: shop.tenantID,
				shopName: shop.shopName,
			}))

			//TODO: Protect routes
			if (
				shop.Subscription.length >= 0 &&
				shop.Subscription[0]?.status === 'ACTIVE'
			) {
				setAuthState((prev) => ({
					...prev,
					isSubscriptionValid: true,
				}))
				router.replace('/home')
			} else {
				router.replace('/home/subscriptionBuy/')
			}
		} else {
			ToastAndroid.show(
				loc.t('shops.selectShopAlert') || 'Please select a shop to proceed',
				ToastAndroid.SHORT,
				ToastAndroid.CENTER
			)
		}
	}

	const renderShopItem = ({ item }) => (
		<TouchableOpacity
			onPress={() => handleShopPress(item)}
			className={`mb-4 mx-4 rounded-lg overflow-hidden ${
				selectedShop === item.id ? 'border-2 border-blue-500' : 'border-0'
			}`}
		>
			<ImageBackground
				source={shopBackground}
				className="w-full h-16 justify-center items-center"
			>
				<View className="bg-white px-6 py-2 rounded-full">
					<Text className="text-blue-600 font-medium">{item.shopName}</Text>
				</View>
			</ImageBackground>
		</TouchableOpacity>
	)

	// Loading component with animated dots
	const LoadingComponent = () => (
		<View className="flex-1 justify-center items-center bg-white">
			<View className="items-center">
				{/* Main loading circle */}
				<ActivityIndicator size="large" color="#3B82F6" className="mb-4" />

				{/* Loading text with animated dots */}
				<View className="flex-row items-center">
					<Text className="text-lg text-gray-600 font-medium">
						{isRedirecting
							? loc.t('shops.redirecting')
							: loc.t('shops.loadingShops')}
					</Text>
					<View className="flex-row ml-1">
						<Animated.Text
							style={{ opacity: dot1Opacity }}
							className="text-lg text-gray-600 font-medium"
						>
							.
						</Animated.Text>
						<Animated.Text
							style={{ opacity: dot2Opacity }}
							className="text-lg text-gray-600 font-medium"
						>
							.
						</Animated.Text>
						<Animated.Text
							style={{ opacity: dot3Opacity }}
							className="text-lg text-gray-600 font-medium"
						>
							.
						</Animated.Text>
					</View>
				</View>
			</View>
		</View>
	)

	// Exit Confirmation Modal
	const ExitConfirmationModal = () => (
		<Modal
			animationType="fade"
			transparent={true}
			visible={exitModalVisible}
			onRequestClose={() => setExitModalVisible(false)}
		>
			<View className="flex-1 justify-center items-center bg-black/50">
				<View className="bg-white p-5 rounded-lg w-10/12">
					<Text className="text-xl font-bold text-center mb-4">
						{loc.t('shops.confirmExit')}
					</Text>
					<Text className="text-base text-center mb-6">
						{loc.t('shops.exitMessage')}
					</Text>

					<View className="flex-row justify-between">
						<TouchableOpacity
							className="bg-gray-300 p-3 rounded-md flex-1 mr-2"
							onPress={() => setExitModalVisible(false)}
						>
							<Text className="text-gray-800 text-center font-bold">
								{loc.t('shops.cancel')}
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							className="bg-blue-600 p-3 rounded-md flex-1 ml-2"
							onPress={handleExitApp}
						>
							<Text className="text-white text-center font-bold">
								{loc.t('shops.yes')}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	)

	// Show loading state when loading or redirecting
	if (isLoading || isRedirecting) {
		return (
			<View className="flex-1 bg-white">
				<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />
				<LoadingComponent />
			</View>
		)
	}

	return (
		<View className="flex-1 bg-white">
			<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />

			<View className="pt-10 pb-6 items-center">
				<Text className="text-2xl font-semibold text-gray-700">
					{loc.t('shops.selectShop')}
				</Text>
			</View>

			<View className="flex-1">
				<FlatList
					data={usrShops}
					renderItem={renderShopItem}
					keyExtractor={(item) => item.id.toString()}
					contentContainerStyle={{ paddingVertical: 12 }}
				/>
			</View>

			<View className="p-4 mb-4">
				<TouchableOpacity
					onPress={() => router.push('/shops/addShop')}
					className="items-center py-3 mb-4"
				>
					<Text className="text-blue-500 font-medium">
						{loc.t('shops.addShop')}
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					//onPress={handleGoPress}
					onPress={() => setIsGoingNext(true)}
					className="bg-blue-500 rounded-full py-3 items-center"
				>
					<Text className="text-white font-medium text-lg">
						{loc.t('shops.go')}
					</Text>
				</TouchableOpacity>
			</View>

			{/* Exit Confirmation Modal */}
			<ExitConfirmationModal />
		</View>
	)
}
