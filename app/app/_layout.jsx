import { Slot } from 'expo-router'
import { AuthProvider } from '../src/context/AuthContext'
import { LocalizationProvider } from '../src/localization/localizationContext'
import { PermissionProvider } from '../src/context/PermissionContext'
import { PaperProvider } from 'react-native-paper'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SecureStore from 'expo-secure-store'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useLocalization } from '../src/localization/localizationContext'
import { useNumberTranslator } from '../src/hooks/useNumberTranslator'
import { statusBarColor, barStyleMode } from '../src/constants.js'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import {
	View,
	Text,
	Modal,
	TouchableOpacity,
	Dimensions,
	ScrollView,
	StatusBar,
} from 'react-native'
import { Ionicons, MaterialIcons } from '@expo/vector-icons'

//sqlite-drizzle
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator'
import { db, expo_sqlite } from '../db/client'
import migrations from '../drizzle/migrations'
import { useDrizzleStudio } from 'expo-drizzle-studio-plugin'

const { width } = Dimensions.get('window')
const { height: screenHeight } = Dimensions.get('window')

import {
	requestPermission,
	AuthorizationStatus,
	getToken,
	getMessaging,
	onMessage,
	setBackgroundMessageHandler,
} from '@react-native-firebase/messaging'
import useSync from '../src/hooks/useSync'
import { SyncProvider } from '../src/context/SyncContext'

// Inner component that can safely use localization
function LayoutContent() {
	const { handleSync } = useSync()
	const [modalVisible, setModalVisible] = useState(false)
	const [notificationData, setNotificationData] = useState(null)
	const { loc } = useLocalization()

	// Configure Expo Notifications
	useEffect(() => {
		// Set notification handler
		Notifications.setNotificationHandler({
			handleNotification: async () => ({
				shouldPlaySound: true,
				shouldSetBadge: false,
				shouldShowBanner: true,
				shouldShowList: true,
			}),
		})

		// Request notification permissions for Expo
		const requestNotificationPermissions = async () => {
			const { status } = await Notifications.requestPermissionsAsync()
			if (status !== 'granted') {
				console.log('Expo notification permission not granted')
			}
		}

		requestNotificationPermissions()
	}, [])

	// Get FCM Token
	useEffect(() => {
		async function getFcmToken() {
			const msg = getMessaging()
			const authStatus = await requestPermission(msg)
			const enabled =
				authStatus === AuthorizationStatus.AUTHORIZED ||
				authStatus === AuthorizationStatus.PROVISIONAL

			if (enabled) {
				const token = await getToken(msg)
				SecureStore.setItemAsync('fcmToken', token)
			} else {
				console.log('Notification permission not granted')
			}
		}

		getFcmToken()
	}, [])

	// Handle foreground notifications - SINGLE onMessage listener
	useEffect(() => {
		const msg = getMessaging()
		const unsubscribe = onMessage(msg, async (remoteMessage) => {
			const notificationData = JSON.parse(
				remoteMessage.data?.notificationData || '[]'
			)

			// notification data in remote msg
			if (remoteMessage.notification) {
				// Check if any item in the array is a LOW_STOCK_ALERT
				const lowStockAlerts = notificationData.filter(
					(item) => item?.dataType === 'LOW_STOCK_ALERT'
				)
				const hasLowStockAlert = lowStockAlerts.length > 0

				// Check if LOW_STOCK_ALERT has empty data array
				const hasEmptyLowStockData = lowStockAlerts.some(
					(alert) => !alert.data || alert.data.length === 0
				)

				// Don't show notification if it's a LOW_STOCK_ALERT with empty data
				if (hasLowStockAlert && hasEmptyLowStockData) {
					return
				}

				// Show modal for foreground notifications with parsed notification data
				setNotificationData({
					...remoteMessage,
					parsedData: notificationData,
				})

				// Add 2 second delay for LOW_STOCK_ALERT, show immediately for others
				if (hasLowStockAlert) {
					setTimeout(() => {
						setModalVisible(true)
					}, 2000)
				} else {
					setModalVisible(true)
				}

				//Show notification using Expo Notifications
				await Notifications.scheduleNotificationAsync({
					content: {
						title: remoteMessage.notification?.title || 'New Message',
						body: remoteMessage.notification?.body || 'You have a new message',
						data: notificationData || {},
					},
					trigger: null,
				})
			}

			for (const item of notificationData) {
				if (item.dataType === 'SYNC') {
					await handleSync(item.data)
				}
			}
		})

		return unsubscribe
	}, [handleSync])

	// Handle background notifications
	useEffect(() => {
		// Set background message handler
		//
		const msg = getMessaging()
		const unsubscribe = setBackgroundMessageHandler(
			msg,
			async (remoteMessage) => {
				return null
				//console.log('🚀 Background notification received:', remoteMessage)
				//NOTE: expo notifications handles the rest
			}
		)
		return unsubscribe
	}, [])

	// Handle deep linking for widget
	useEffect(() => {
		const handleDeepLink = (url) => {
			if (!url) return
			const parsedUrl = Linking.parse(url)
			if (
				parsedUrl.hostname === 'home' &&
				parsedUrl.pathname === '/transactions/sell'
			) {
				setTimeout(() => {
					router.push('/home/transactions/sell')
				}, 1000)
			}
		}

		// Handle deep link when app is opened from widget
		const getInitialURL = async () => {
			const initialUrl = await Linking.getInitialURL()
			if (initialUrl) {
				handleDeepLink(initialUrl)
			}
		}

		// Handle deep link when app is already running
		const subscription = Linking.addEventListener('url', (event) => {
			handleDeepLink(event.url)
		})

		getInitialURL()

		return () => {
			subscription?.remove()
		}
	}, [])

	// Stable onClose so the memoized modal doesn't re-render when other state changes
	const handleCloseModal = useCallback(() => {
		setModalVisible(false)
	}, [])

	return (
		<>
			<Slot />
			{/* Modal placed outside of Slot */}
			<NotificationModal
				visible={modalVisible}
				onClose={handleCloseModal}
				notification={notificationData}
				loc={loc}
			/>
		</>
	)
}

export default function TestLayout() {
	//sqlite-drizzle
	const { success, error } = useMigrations(db, migrations)
	useDrizzleStudio(expo_sqlite)

	if (error) {
		return (
			<View>
				<Text>Migration error: {error.message}</Text>
			</View>
		)
	}
	if (!success) {
		return (
			<View>
				<Text>Migration is in progress...</Text>
			</View>
		)
	}
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<LocalizationProvider>
					<PermissionProvider>
						<AuthProvider>
							<SyncProvider>
								<PaperProvider>
									<BottomSheetModalProvider>
										<StatusBar
											backgroundColor={statusBarColor}
											barStyle={barStyleMode}
										/>
										<LayoutContent />
									</BottomSheetModalProvider>
								</PaperProvider>
							</SyncProvider>
						</AuthProvider>
					</PermissionProvider>
				</LocalizationProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	)
}

const NotificationModal = memo(({ visible, onClose, notification, loc }) => {
	const { translateNumber } = useNumberTranslator()

	if (!notification) return null

	const formatTime = (timestamp) => {
		return new Date(timestamp).toLocaleString()
	}

	// Check if notification data contains low stock alerts
	const parsedDataArray = notification.parsedData || []
	const lowStockAlerts = Array.isArray(parsedDataArray)
		? parsedDataArray.filter((item) => item?.dataType === 'LOW_STOCK_ALERT')
		: []
	const isLowStockAlert = lowStockAlerts.length > 0

	const getNotificationTitle = useCallback(() => {
		if (isLowStockAlert) {
			return loc?.t('notifications.lowStockAlert') || 'Low Stock Alert'
		}
		return (
			notification.notification?.title ||
			loc?.t('notifications.noTitle') ||
			'No Title'
		)
	}, [isLowStockAlert, loc, notification])

	const renderBody = useMemo(() => {
		if (isLowStockAlert) {
			return (
				<View>
					{lowStockAlerts.map((alert, index) => {
						const stockItems = alert.data || []
						return stockItems.map((stockData, itemIndex) => (
							<View
								key={`${index}-${itemIndex}`}
								className={`p-4 bg-gray-50 rounded-lg ${
									index > 0 || itemIndex > 0 ? 'mt-3' : ''
								}`}
							>
								{/* Product Name */}
								<View className="mb-2">
									<Text className="text-xs text-gray-500 mb-1">
										{loc?.t('notifications.productName') || 'Product Name'}:
									</Text>
									<Text className="text-sm text-gray-900 font-semibold">
										{stockData.productName}{' '}
										{stockData.variantName && (
											<Text className="text-gray-600 font-normal">
												[{stockData.variantName}]
											</Text>
										)}
									</Text>
								</View>

								{/* Stock Info Row */}
								<View className="flex-row justify-between items-center">
									<View className="flex-1 mr-2">
										<Text className="text-xs text-gray-500 mb-1">
											{loc?.t('notifications.currentStock') || 'Current Stock'}
										</Text>
										<Text className="text-sm text-gray-900 font-medium">
											{translateNumber(stockData.currentStock)}
										</Text>
									</View>
									<View className="flex-1 ml-2">
										<Text className="text-xs text-gray-500 mb-1">
											{loc?.t('notifications.lowStockThreshold') || 'Threshold'}
										</Text>
										<Text className="text-sm text-gray-900 font-medium">
											{translateNumber(stockData.notifyAt)}
										</Text>
									</View>
								</View>
							</View>
						))
					})}
				</View>
			)
		}

		// Default notification body
		return (
			<Text className="text-base text-gray-700 leading-6">
				{notification.notification?.body ||
					loc?.t('notifications.noMessage') ||
					'No Message'}
			</Text>
		)
	}, [isLowStockAlert, lowStockAlerts, loc, translateNumber, notification])

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<View className="flex-1 bg-black/50 justify-center items-center px-5">
				<View
					className="bg-white rounded-2xl shadow-2xl"
					style={{
						width: Math.min(width - 40, 400),
						maxHeight: screenHeight * 0.6,
					}}
				>
					{/* Header */}
					<View className="flex-row justify-between items-center p-5 border-b border-gray-200">
						<View className="flex-row items-center flex-1 mr-2">
							<Ionicons
								name={isLowStockAlert ? 'warning' : 'notifications'}
								size={24}
								color={isLowStockAlert ? '#F59E0B' : '#195FE1'}
							/>
							<Text
								className="ml-2 text-lg font-semibold text-gray-900"
								numberOfLines={1}
								ellipsizeMode="tail"
							>
								{isLowStockAlert
									? getNotificationTitle()
									: loc?.t('notifications.newNotification') ||
										'New Notification'}
							</Text>
						</View>
						<TouchableOpacity onPress={onClose} className="p-1">
							<MaterialIcons name="close" size={24} color="#6B7280" />
						</TouchableOpacity>
					</View>

					{/* Content - Scrollable */}
					<ScrollView
						className="p-5"
						showsVerticalScrollIndicator={true}
						bounces={false}
					>
						{/* Title */}
						<View className="mb-4">
							{isLowStockAlert && (
								<Text className="text-sm text-gray-600 mt-1">
									{translateNumber(
										lowStockAlerts.reduce(
											(total, alert) => total + (alert.data?.length || 0),
											0
										)
									)}{' '}
									{loc?.t('notifications.itemsLowStock') ||
										'item(s) low in stock'}
								</Text>
							)}
						</View>

						{/* Body - Scrollable */}
						<View className="mb-4">{renderBody}</View>
						{/* Time */}
						<View className="flex-row items-center">
							<MaterialIcons name="access-time" size={16} color="#6B7280" />
							<Text className="ml-1.5 text-sm text-gray-500">
								{formatTime(notification.sentTime)}
							</Text>
						</View>
					</ScrollView>

					{/* Actions */}
					<View className="p-5 border-t border-gray-200">
						<TouchableOpacity
							onPress={onClose}
							className="bg-[#195FE1] py-3 rounded-lg items-center"
						>
							<Text className="text-white text-base font-semibold">
								{loc?.t('common.okay') || 'Okay'}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	)
})
