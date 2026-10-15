import React, { useEffect, useRef } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Animated,
	Dimensions,
	StyleSheet,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'

const { width } = Dimensions.get('window')

export default function PaymentPage() {
	const params = useLocalSearchParams()
	const status = params.status || 'failed'
	const { loc } = useLocalization()

	// Animation refs
	const scaleAnim = useRef(new Animated.Value(0)).current
	const fadeAnim = useRef(new Animated.Value(0)).current
	const slideAnim = useRef(new Animated.Value(30)).current

	useEffect(() => {
		// Start animations when component mounts
		Animated.sequence([
			Animated.timing(scaleAnim, {
				toValue: 1,
				duration: 800,
				useNativeDriver: true,
			}),
			Animated.parallel([
				Animated.timing(fadeAnim, {
					toValue: 1,
					duration: 600,
					useNativeDriver: true,
				}),
				Animated.timing(slideAnim, {
					toValue: 0,
					duration: 600,
					useNativeDriver: true,
				}),
			]),
		]).start()
	}, [status])

	const getStatusConfig = () => {
		switch (status) {
			case 'success':
				return {
					icon: 'checkmark-circle',
					color: '#10B981',
					bgColor: '#ECFDF5',
					title: loc.t('payment.success') || 'Payment Successful',
					message:
						loc.t('payment.creditsPurchasedSuccessfully') ||
						'Credits have been added to your account successfully.',
					buttonText: loc.t('payment.goHome') || 'Go to Home',
					buttonColor: '#177DFF',
				}
			case 'failed':
				return {
					icon: 'close-circle',
					color: '#EF4444',
					bgColor: '#FEF2F2',
					title: loc.t('payment.failed') || 'Payment Failed',
					message:
						loc.t('payment.paymentFailed') ||
						'Your payment could not be processed. Please try again.',
					buttonText: loc.t('payment.tryAgain') || 'Try Again',
					buttonColor: '#EF4444',
				}
			case 'cancelled':
				return {
					icon: 'warning',
					color: '#F59E0B',
					bgColor: '#FFFBEB',
					title: loc.t('payment.cancelled') || 'Payment Cancelled',
					message:
						loc.t('payment.paymentCancelled') ||
						'Your payment has been cancelled.',
					buttonText: loc.t('payment.goHome') || 'Go to Home',
					buttonColor: '#F59E0B',
				}
			default:
				return {
					icon: 'help-circle',
					color: '#6B7280',
					bgColor: '#F9FAFB',
					title: 'Unknown Status',
					message:
						'We could not determine your payment status. Please contact support.',
					buttonText: 'Contact Support',
					buttonColor: '#6B7280',
				}
		}
	}

	const config = getStatusConfig()

	const handleGoBack = () => {
		router.push('/home')
	}

	const handleMainAction = () => {
		if (status === 'success') {
			router.push('/home')
		} else if (status === 'failed') {
			router.push('/home/message/credit')
		} else if (status === 'cancelled') {
			router.push('/home/message/credit')
		}
	}

	return (
		<View className="flex-1 bg-white">
			{/* Main content */}
			<View className="flex-1 items-center justify-center px-8">
				{/* Status icon with animation */}
				<Animated.View
					style={{
						transform: [{ scale: scaleAnim }],
					}}
					className="mb-8"
				>
					<View
						className="w-32 h-32 rounded-full items-center justify-center shadow-lg"
						style={{ backgroundColor: config.bgColor }}
					>
						<Ionicons name={config.icon} size={64} color={config.color} />
					</View>
				</Animated.View>

				{/* Title and message with animation */}
				<Animated.View
					style={{
						opacity: fadeAnim,
						transform: [{ translateY: slideAnim }],
					}}
					className="items-center mb-12"
				>
					<Text className="text-3xl font-bold text-gray-900 mb-4 text-center">
						{config.title}
					</Text>
					<Text className="text-base text-gray-600 text-center leading-6 max-w-sm">
						{config.message}
					</Text>
				</Animated.View>

				{/* Action buttons with animation */}
				<Animated.View
					style={{
						opacity: fadeAnim,
						transform: [{ translateY: slideAnim }],
					}}
					className="w-full max-w-sm space-y-4"
				>
					{/* Main action button */}
					<TouchableOpacity
						onPress={handleMainAction}
						className="w-full py-4 px-6 rounded-xl items-center shadow-sm"
						style={{ backgroundColor: config.buttonColor }}
						activeOpacity={0.8}
					>
						<Text className="text-white text-lg font-semibold">
							{config.buttonText}
						</Text>
					</TouchableOpacity>

					{/* Help text for failed */}
					{status === 'failed' && (
						<View className="mt-6 p-4 bg-red-50 rounded-xl">
							<Text className="text-sm text-red-800 text-center">
								⚠️{' '}
								{loc.t('payment.checkPaymentMethodNote') ||
									'Please check your payment method and try again.'}
							</Text>
						</View>
					)}
				</Animated.View>
			</View>

			{/* Bottom decorative elements */}
			<View className="absolute bottom-0 left-0 right-0 h-32">
				<View className="flex-1 bg-gradient-to-t from-gray-50 to-transparent opacity-50" />
			</View>
		</View>
	)
}
