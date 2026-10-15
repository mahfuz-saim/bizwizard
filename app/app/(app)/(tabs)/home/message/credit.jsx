import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	ToastAndroid,
	TextInput,
	ActivityIndicator,
} from 'react-native'
import * as Linking from 'expo-linking'
import BouncyCheckbox from 'react-native-bouncy-checkbox'
import { ErrorModal } from '../../../../../src/components/AlertModal.jsx'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import { paymentInit } from '../../../../../src/controllers/payment'
import useApi from '../../../../../src/hooks/useApi.jsx'
import { getShopInfo } from '../../../../../src/controllers/shop'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { number } from 'yup'

export default function CreditPage() {
	const { loc } = useLocalization()
	const { translateNumber, translateAmount, prepareReceiptData } =
		useNumberTranslator()
	const [creditAmount, setCreditAmount] = useState(20) // Minimum 20 credits
	const [agreedToTerms, setAgreedToTerms] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [shopInfo, setShopInfo] = useState(null)
	const [isLoadingShopInfo, setIsLoadingShopInfo] = useState(true)
	const [showErrorModal, setShowErrorModal] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')
	const { fetchData } = useApi()

	const CREDIT_PRICE = 0.5 // 0.5 taka per credit
	const MIN_CREDITS = 20 // Minimum 20 credits

	// Predefined credit amounts for quick selection
	const quickAmounts = [20, 50, 100, 200, 500, 1000]

	// Fetch shop info on component mount
	useEffect(() => {
		fetchShopInfo()
	}, [])

	const fetchShopInfo = async () => {
		try {
			setIsLoadingShopInfo(true)
			const response = await fetchData(getShopInfo, {})

			if (response && response.success && response.data) {
				setShopInfo(response.data)
			}
		} catch (error) {
			console.error('Error fetching shop info:', error)
			ToastAndroid.show(
				loc.t('credit.errorFetchingShopInfo') ||
					'Failed to fetch shop information',
				ToastAndroid.SHORT
			)
		} finally {
			setIsLoadingShopInfo(false)
		}
	}

	const openLink = async (url) => {
		try {
			const supported = await Linking.canOpenURL(url)
			if (supported) {
				await Linking.openURL(url)
			} else {
				ToastAndroid.show(
					loc.t('credit.cannotOpenUrl') || 'Cannot open this URL',
					ToastAndroid.SHORT
				)
			}
		} catch (error) {
			ToastAndroid.show(
				loc.t('credit.errorOccurred') || 'An error occurred',
				ToastAndroid.SHORT
			)
		}
	}

	const handleCreditAmountChange = (amount) => {
		// Convert Bengali numbers to English for processing
		const englishAmount = amount.replace(/[০-৯]/g, (match) => {
			const bengaliDigits = '০১২৩৪৫৬৭৮৯'
			return bengaliDigits.indexOf(match).toString()
		})

		const numAmount = parseInt(englishAmount) || 0
		if (numAmount >= MIN_CREDITS) {
			setCreditAmount(numAmount)
		} else if (englishAmount === '' || englishAmount === '0') {
			setCreditAmount('')
		}
	}

	const selectQuickAmount = (amount) => {
		setCreditAmount(amount)
	}

	const calculateTotal = () => {
		return (creditAmount || 0) * CREDIT_PRICE
	}

	const handlePayment = async () => {
		if (!agreedToTerms) {
			ToastAndroid.show(
				loc.t('credit.pleaseAgreeTerms') ||
					'Please agree to terms and conditions',
				ToastAndroid.LONG
			)
			return
		}

		if (!creditAmount || creditAmount < MIN_CREDITS) {
			ToastAndroid.show(
				loc.t('credit.minimumCredits', { min: MIN_CREDITS }) ||
					`Minimum ${MIN_CREDITS} credits required`,
				ToastAndroid.LONG
			)
			return
		}

		setIsLoading(true)

		try {
			const successUrl = Linking.createURL('/home/message/paymentPage', {
				queryParams: { status: 'success' },
			})

			const failUrl = Linking.createURL('/home/message/paymentPage', {
				queryParams: { status: 'failed' },
			})

			const cancelUrl = Linking.createURL('/home/message/paymentPage', {
				queryParams: { status: 'cancelled' },
			})

			const params = {
				total_amount: calculateTotal(),
				success_url: successUrl,
				fail_url: failUrl,
				cancel_url: cancelUrl,
				paymentType: 'CREDIT',
				creditAmount: creditAmount,
			}

			// Prepare data for backend (ensure English numbers)
			const backendParams = prepareReceiptData(params)
			backendParams.total_amount = parseFloat(backendParams.total_amount)

			const response = await fetchData(paymentInit, backendParams)

			if (response.success) {
				// Open URL in browser
				const paymentUrl = response.data
				Linking.openURL(paymentUrl)
			} else {
				ToastAndroid.show(
					loc.t('credit.paymentInitFailed') || 'Payment initialization failed',
					ToastAndroid.LONG
				)
			}
		} catch (error) {
			console.error('Payment initialization error:', error)
			ToastAndroid.show(
				loc.t('credit.paymentInitFailed') || 'Payment initialization failed',
				ToastAndroid.LONG
			)
		} finally {
			setIsLoading(false)
		}
	}

	// Show loading state while fetching shop info
	if (isLoadingShopInfo) {
		return (
			<View className="flex-1 bg-blue-50 justify-center items-center">
				<ActivityIndicator size="large" color="#2563EB" />
				<Text className="mt-4 text-gray-600">
					{loc.t('credit.loadingShopInfo') || 'Loading shop information...'}
				</Text>
			</View>
		)
	}

	return (
		<>
			<ScrollView className="flex-1 bg-blue-50">
				<View className="p-5">
					{/* Credit Amount Selection */}
					<View className="mb-6">
						<Text className="text-lg font-semibold text-gray-700 mb-3">
							{loc.t('credit.selectAmount') || 'Select Credit Amount'}
						</Text>

						{/* Quick Amount Buttons */}
						<Text className="text-sm text-gray-600 mb-3">
							{loc.t('credit.quickSelection') || 'Quick Selection:'}
						</Text>
						<View className="flex-row flex-wrap mb-4">
							{quickAmounts.map((amount) => (
								<TouchableOpacity
									key={amount}
									onPress={() => selectQuickAmount(amount)}
									className={`px-4 py-2 rounded-lg mr-2 mb-2 ${
										creditAmount === amount
											? 'bg-blue-500'
											: 'bg-gray-100 border border-gray-300'
									}`}
								>
									<Text
										className={`font-medium ${
											creditAmount === amount ? 'text-white' : 'text-gray-700'
										}`}
									>
										{translateNumber(amount)}{' '}
										{loc.t('credit.credits') || 'Credits'}
									</Text>
								</TouchableOpacity>
							))}
						</View>

						{/* Custom Amount Input */}
						<Text className="text-sm text-gray-600 mb-2">
							{loc.t('credit.customAmount') || 'Or enter custom amount:'}
						</Text>
						<View className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4">
							<View className="bg-white border border-gray-300 rounded-lg px-2 py-1 mb-2 mx-12">
								<TextInput
									className="text-base text-gray-800 text-center"
									placeholder={
										loc.t('credit.enterAmount') || 'Enter credit amount'
									}
									placeholderTextColor="#9CA3AF"
									value={creditAmount ? translateNumber(creditAmount) : ''}
									onChangeText={handleCreditAmountChange}
									keyboardType="numeric"
									maxLength={6}
								/>
							</View>
							<Text className="text-sm text-gray-500 text-center mt-1">
								{loc.t('credit.minimumNote', {
									min: translateNumber(MIN_CREDITS),
								}) ||
									`Minimum ${translateNumber(MIN_CREDITS)} credits required`}
							</Text>
							<View className="flex-row justify-center items-center pt-3">
								<Text className="text-lg text-gray-800 font-medium">
									{translateNumber(creditAmount || 0)}{' '}
									{loc.t('credit.credits') || 'Credits'}
								</Text>
								<Text className="text-lg text-gray-800 font-medium mx-3">
									=
								</Text>
								<Text className="text-xl font-bold text-blue-600">
									{translateAmount(calculateTotal())}
								</Text>
							</View>
						</View>
					</View>

					{/* Credit Info */}
					<View className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 mb-6">
						<Text className="text-sm text-yellow-800 font-medium mb-2">
							{loc.t('credit.creditInfo') || 'Credit Information:'}
						</Text>
						<Text className="text-sm text-yellow-700">
							•{' '}
							{loc.t('credit.creditUsage') ||
								'Credits are used to send SMS messages'}
						</Text>
						<Text className="text-sm text-yellow-700">
							• {loc.t('credit.creditExpiry') || 'Credits do not expire'}
						</Text>
						<Text className="text-sm text-yellow-700">
							• {loc.t('credit.creditRefund') || 'Credits are non-refundable'}
						</Text>
					</View>

					{/* Terms and Conditions */}
					<View className="mb-6">
						<BouncyCheckbox
							size={24}
							fillColor="#2563EB"
							unfillColor="transparent"
							text=""
							iconStyle={{
								borderColor: agreedToTerms ? '#2563EB' : '#9CA3AF',
								borderRadius: 6,
							}}
							innerIconStyle={{ borderWidth: 2, borderRadius: 6 }}
							isChecked={agreedToTerms}
							onPress={() => setAgreedToTerms(!agreedToTerms)}
							textComponent={
								<View className="flex-1 ml-3">
									<View className="flex-row flex-wrap">
										<Text className="text-sm text-gray-600 leading-6">
											{loc.t('credit.agreeToTermsPrefix') ||
												'I agree to the'}{' '}
										</Text>
										<TouchableOpacity
											onPress={() =>
												openLink('https://develofirm.com/privacy-policy')
											}
										>
											<Text className="text-blue-500 underline text-sm">
												{loc.t('credit.privacyPolicy') || 'Privacy Policy'}
											</Text>
										</TouchableOpacity>
										<Text className="text-sm text-gray-600">, </Text>
										<TouchableOpacity
											onPress={() =>
												openLink('https://develofirm.com/terms-of-service')
											}
										>
											<Text className="text-blue-500 underline text-sm">
												{loc.t('credit.termsAndConditions') ||
													'Terms & Conditions'}
											</Text>
										</TouchableOpacity>
										<Text className="text-sm text-gray-600">
											{' '}
											{loc.t('credit.and') || 'and'}{' '}
										</Text>
										<TouchableOpacity
											onPress={() =>
												openLink('https://develofirm.com/refund-policy')
											}
										>
											<Text className="text-blue-500 underline text-sm">
												{loc.t('credit.refundPolicy') || 'Refund Policy'}
											</Text>
										</TouchableOpacity>
									</View>
								</View>
							}
						/>
					</View>

					{/* Buy Button */}
					<TouchableOpacity
						onPress={handlePayment}
						disabled={
							!agreedToTerms ||
							isLoading ||
							!creditAmount ||
							creditAmount < MIN_CREDITS
						}
						className="rounded-xl p-4"
						style={[
							agreedToTerms && !isLoading && creditAmount >= MIN_CREDITS
								? {
										backgroundColor: '#2563EB',
										shadowColor: '#2563EB',
										shadowOffset: { width: 0, height: 4 },
										shadowOpacity: 0.3,
										shadowRadius: 8,
										elevation: 8,
									}
								: {
										backgroundColor: '#D1D5DB',
									},
						]}
					>
						<Text
							className={`text-lg font-bold text-center ${
								agreedToTerms && !isLoading && creditAmount >= MIN_CREDITS
									? 'text-white'
									: 'text-gray-500'
							}`}
						>
							{isLoading
								? loc.t('credit.processing') || 'Processing...'
								: loc.t('credit.buyCreditsButton') || 'Buy Credits'}
						</Text>
					</TouchableOpacity>
				</View>
			</ScrollView>

			<ErrorModal
				visible={showErrorModal}
				message={errorMessage}
				onClose={() => setShowErrorModal(false)}
			/>
		</>
	)
}
