import React, { useEffect, useRef, useState } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Animated,
	Dimensions,
	Modal,
	StyleSheet,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Updates from 'expo-updates'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'

const { width } = Dimensions.get('window')

export default function PaymentStatusPage() {
	const params = useLocalSearchParams()
	const status = params.status || 'failed'
	const paymentType = params.paymentType // Get payment type from params
	const { loc } = useLocalization()

	// Success modal state - show only for successful subscription purchases
	const [showSuccessModal, setShowSuccessModal] = useState(false)

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

		// Show success modal after animations complete for subscription purchases
		if (status === 'success' && paymentType === 'SUBSCRIPTION') {
			setTimeout(() => {
				setShowSuccessModal(true)
			}, 1500) // Show modal after animations complete
		}
	}, [status, paymentType])

	const getStatusConfig = () => {
		switch (status) {
			case 'success':
				return {
					icon: 'checkmark-circle',
					color: '#10B981',
					bgColor: '#ECFDF5',
					title: loc.t('payment.success'),
					message: loc.t('payment.paymentCompletedSuccessfully'),
					buttonText: loc.t('payment.goHome'),
					buttonColor: '#177DFF',
				}
			case 'failed':
				return {
					icon: 'close-circle',
					color: '#EF4444',
					bgColor: '#FEF2F2',
					title: loc.t('payment.failed'),
					message: loc.t('payment.paymentFailed'),
					buttonText: loc.t('payment.tryAgain'),
					buttonColor: '#EF4444',
				}
			case 'cancelled':
				return {
					icon: 'warning',
					color: '#F59E0B',
					bgColor: '#FFFBEB',
					title: loc.t('payment.cancelled'),
					message: loc.t('payment.paymentCancelled'),
					buttonText: loc.t('payment.goHome'),
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

	const restartApp = async () => {
		try {
			await Updates.reloadAsync() // This restarts the app
		} catch (e) {
			console.error('Error restarting app:', e)
		}
	}

	const handleMainAction = () => {
		// Placeholder navigation - update based on status
		if (status === 'success') {
			router.push('/profile')
		} else if (status === 'failed') {
			router.push('/home/subscriptionBuy/')
		} else if (status === 'cancelled') {
			router.push('/home/subscriptionBuy/')
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

					{/* Help text for success */}
					{status === 'success' && (
						<View className="mt-6 p-4 bg-blue-50 rounded-xl">
							<Text className="text-sm text-blue-800 text-center">
								💡 {loc.t('payment.confirmationEmailNote')}
							</Text>
						</View>
					)}

					{/* Help text for failed */}
					{status === 'failed' && (
						<View className="mt-6 p-4 bg-red-50 rounded-xl">
							<Text className="text-sm text-red-800 text-center">
								⚠️ {loc.t('payment.checkPaymentMethodNote')}
							</Text>
						</View>
					)}
				</Animated.View>
			</View>

			{/* Bottom decorative elements */}
			<View className="absolute bottom-0 left-0 right-0 h-32">
				<View className="flex-1 bg-gradient-to-t from-gray-50 to-transparent opacity-50" />
			</View>

			{/* Success Modal for Subscription Purchase */}
			<Modal
				visible={showSuccessModal}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowSuccessModal(false)}
			>
				<View style={modalStyles.modalOverlay}>
					<View style={modalStyles.successModalContainer}>
						<View style={modalStyles.successIconContainer}>
							<Text style={modalStyles.successIcon}>✅</Text>
						</View>
						<Text style={modalStyles.successTitle}>
							{loc.t('subscriptionBuy.successTitle') ||
								'Subscription Purchased Successfully!'}
						</Text>
						<Text style={modalStyles.successMessage}>
							{loc.t('subscriptionBuy.successMessage') ||
								'Your subscription has been activated. Please restart the app to continue with full access.'}
						</Text>
						<TouchableOpacity
							style={modalStyles.restartButton}
							onPress={restartApp}
							activeOpacity={0.8}
						>
							<Text style={modalStyles.restartButtonText}>
								{loc.t('subscriptionBuy.restartButton') || 'Restart App'}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		</View>
	)
}

const modalStyles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	successModalContainer: {
		backgroundColor: '#F0F8FF',
		borderRadius: 12,
		padding: 24,
		width: '100%',
		maxWidth: 340,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	successIconContainer: {
		marginBottom: 16,
	},
	successIcon: {
		fontSize: 48,
	},
	successTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#1F2937',
		textAlign: 'center',
		marginBottom: 8,
	},
	successMessage: {
		fontSize: 14,
		color: '#6B7280',
		textAlign: 'center',
		marginBottom: 24,
		lineHeight: 20,
	},
	restartButton: {
		backgroundColor: '#177DFF',
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 44,
	},
	restartButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
})
