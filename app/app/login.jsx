import { router } from 'expo-router'
import {
	Text,
	View,
	TouchableOpacity,
	StatusBar,
	TextInput,
	Image,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	BackHandler,
	ToastAndroid,
	Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../src/context/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { useLocalization } from '../src/localization/localizationContext'
import * as Yup from 'yup'
import { statusBarColor, barStyleMode } from '../src/constants'
// import { getLatestVersion } from '../src/controllers/app'
import { ErrorModal } from '../src/components/AlertModal'
import HelpModal from '../src/components/HelpModal'
import useSMSRetriever from '@ebrimasamba/react-native-sms-retriever'
import Analytics from '../src/firebase/analytics'

export default function login() {
	const { loc, changeLocale } = useLocalization()
	const { getOTP, verifyOTP, registerFCMToken } = useAuth()
	const [phoneNumber, setPhoneNumber] = useState('')
	const [phoneNumberError, setPhoneNumberError] = useState(false)
	const [otp, setOtp] = useState(['', '', '', ''])
	const [showOtpScreen, setShowOtpScreen] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [isKeyboardVisible, setKeyboardVisible] = useState(false)
	const [resendDisabled, setResendDisabled] = useState(false)
	const [resendTimer, setResendTimer] = useState(120)
	const [showResendButton, setShowResendButton] = useState(false)
	const [showUpdateModal, setShowUpdateModal] = useState(false)
	const [showNetworkErrorModal, setShowNetworkErrorModal] = useState(false)
	const [showHelpModal, setShowHelpModal] = useState(false)
	const inputRefs = useRef([])
	const { authState, getStoredPhoneNumber } = useAuth()
	const { startListening, smsCode } = useSMSRetriever()

	useEffect(() => {
		Analytics.phoneInputStarted().catch((error) => {
			console.error('🚨 Analytics phone input start error:', error)
		})
	}, [])

	useEffect(() => {
		if (showOtpScreen) {
			startListening().catch((e) => console.log(e))
		}
	}, [showOtpScreen])

	useEffect(() => {
		if (smsCode) {
			let code = null
			const match = smsCode.match(/verification\s+code\s+is\s*(\d{4})/i)
			if (match && match[1]) {
				code = match[1]
			} else if (/^\d{4}$/.test(smsCode.trim())) {
				code = smsCode.trim()
			} else {
				// Fallback for just finding a 4-digit code if the pattern doesn't match exactly
				const codeMatch = smsCode.match(/\b(\d{4})\b/)
				if (codeMatch) {
					code = codeMatch[1]
				}
			}

			if (code) {
				setOtp(code.split(''))
				setTimeout(() => {
					handleVerifyOTP(code)
				}, 500)
			}
		}
	}, [smsCode])

	useEffect(() => {
		const fn = async () => {
			const storedPhoneNumber = await getStoredPhoneNumber()
			if (storedPhoneNumber) {
				setPhoneNumber(storedPhoneNumber)
			}
		}
		fn()
	}, [])

	const phoneSchema = Yup.string()
		.matches(/^[0-9]+$/, 'wrongPhoneNumberError')
		.required()

	useEffect(() => {
		const checkAuth = async () => {
			const isAuthorized = authState?.authenticated
			if (isAuthorized) {
				await registerFCMToken()

				router.replace(`/shops?autoRedirect=true`)
			}
		}
		checkAuth()
	}, [authState])
	useEffect(() => {
		const keyboardDidShowListener = Keyboard.addListener(
			'keyboardDidShow',
			() => {
				setKeyboardVisible(true)
			}
		)
		const keyboardDidHideListener = Keyboard.addListener(
			'keyboardDidHide',
			() => {
				setKeyboardVisible(false)
			}
		)

		return () => {
			keyboardDidHideListener.remove()
			keyboardDidShowListener.remove()
		}
	}, [])

	useEffect(() => {
		let interval
		if (resendDisabled && resendTimer > 0) {
			interval = setInterval(() => {
				setResendTimer((prevTimer) => prevTimer - 1)
			}, 1000)
		} else if (resendTimer === 0) {
			setResendDisabled(false)
			setShowResendButton(true)
			setResendTimer(120)
		}

		return () => clearInterval(interval)
	}, [resendDisabled, resendTimer])

	useEffect(() => {
		if (showOtpScreen) {
			const timer = setTimeout(() => {
				setShowResendButton(true)
			}, 120000) // 2 minutes
			return () => clearTimeout(timer)
		}
	}, [showOtpScreen])

	const handlePhoneNumberChange = (text) => {
		setPhoneNumber(text)

		try {
			phoneSchema.validateSync(text)
			setPhoneNumberError(false)
		} catch (error) {
			if (text) {
				setPhoneNumberError(true)
			} else {
				setPhoneNumberError(false)
			}
		}
	}

	const handleGetOTP = async () => {
		try {
			await phoneSchema.validate(phoneNumber)
			setPhoneNumberError(false)

			setIsLoading(true)
			try {
				const result = await getOTP({ phoneNumber })
				if (!result.success) {
					throw new Error('OTP request failed')
				}
				try {
					await Analytics.otpSent()
				} catch (error) {
					console.error('🚨 Analytics otp sent error:', error)
				}

				setTimeout(() => {
					if (1) {
						//result.success
						setShowOtpScreen(true)
						setResendDisabled(true)
						setShowResendButton(false)
						setResendTimer(120)
					} else {
						ToastAndroid.show(
							result.message ||
								loc.t('login.generalError') ||
								'Failed to send OTP',
							ToastAndroid.SHORT
						)
					}
					setIsLoading(false)
				}, 200)
			} catch (error) {
				console.error('🚨 OTP request error:', error)
				ToastAndroid.show(
					loc.t('login.generalError') || 'An error occurred. Please try again.',
					ToastAndroid.SHORT
				)
				setIsLoading(false)
			}
		} catch (error) {
			setPhoneNumberError(true)
		}
	}

	const handleResendOTP = async () => {
		setResendDisabled(true)
		setShowResendButton(false)
		setOtp(['', '', '', ''])
		try {
			const result = await getOTP({ phoneNumber })
		} catch (error) {
			console.error('🚨 OTP resend error:', error)
			ToastAndroid.show(
				loc.t('login.generalError') ||
					'Failed to resend OTP. Please try again.',
				ToastAndroid.SHORT
			)
		}
	}

	const handleOtpChange = (text, index) => {
		const formattedText = text.replace(/[^0-9]/g, '')

		// Handle pasting a full 4-digit OTP
		if (formattedText.length === 4) {
			const otpArray = formattedText.split('')
			setOtp(otpArray)
			// Focus on the last input
			if (inputRefs.current[3]) {
				inputRefs.current[3].focus()
			}
			return
		}

		const newOtp = [...otp]
		newOtp[index] = formattedText

		setOtp(newOtp)

		if (formattedText && index < 3) {
			inputRefs.current[index + 1].focus()
		}

		if (formattedText) {
			let nextEmptyIndex = -1
			for (let i = 0; i < 4; i++) {
				if (!newOtp[i] && i !== index) {
					nextEmptyIndex = i
					break
				}
			}

			if (nextEmptyIndex === -1 && index < 3) {
				inputRefs.current[3].focus()
			}
		}
	}

	const handleKeyPress = (e, index) => {
		if (e.nativeEvent.key === 'Backspace') {
			if (otp[index]) {
				const newOtp = [...otp]
				newOtp[index] = ''
				setOtp(newOtp)
			} else if (index > 0) {
				const newOtp = [...otp]
				newOtp[index - 1] = ''
				setOtp(newOtp)
				inputRefs.current[index - 1].focus()
			}
		}
	}

	const handleVerifyOTP = async (otpOverride) => {
		const otpValue =
			typeof otpOverride === 'string' ? otpOverride : otp.join('')

		setIsLoading(true)
		try {
			const result = await verifyOTP({
				number: phoneNumber,
				otp: parseInt(otpValue),
			})

			if (result.success && result.data.isOtpVerified) {
				try {
					await Analytics.otpVerified()
					if (result.data?.isExists) {
						await Analytics.login()
					} else {
						await Analytics.signUp()
					}
				} catch (error) {
					console.error('🚨 Analytics otp verified error:', error)
				}
				await registerFCMToken()
				if (!result.data.isExists) {
					router.replace('/registerPage')
				}
			} else {
				//TODO: localization
				//ToastAndroid.show(loc.t('login.error'), loc.t('login.invalidOtp'))
				ToastAndroid.show(
					result.message ||
						loc.t('login.invalidOtp') ||
						'Invalid OTP. Please try again.',
					ToastAndroid.SHORT
				)
			}
		} catch (error) {
			console.error('🚨 OTP verification error:', error)
			ToastAndroid.show(
				loc.t('login.generalError') || 'Verification failed. Please try again.',
				ToastAndroid.SHORT
			)
		} finally {
			setIsLoading(false)
		}
	}

	const toggleLanguage = () => {
		const newLocale = loc.locale === 'bn' ? 'en' : 'bn'
		changeLocale(newLocale)
	}

	const PillButton = ({ onPress, label }) => (
		<TouchableOpacity
			onPress={onPress}
			className="px-3 py-2 bg-[#195fe1d0] rounded-full"
		>
			<Text className="text-white font-medium">{label}</Text>
		</TouchableOpacity>
	)

	const LanguageToggle = () => (
		<PillButton
			onPress={toggleLanguage}
			label={loc.locale === 'bn' ? 'English' : 'বাংলা'}
		/>
	)

	const HelpButton = () => (
		<PillButton
			onPress={() => setShowHelpModal(true)}
			label={loc.t('login.help')}
		/>
	)

	const TopBar = () => (
		<View className="flex-row items-center justify-between px-6 pt-2 pb-6 bg-bgColor">
			<HelpButton />
			<LanguageToggle />
		</View>
	)

	const renderPhoneScreen = () => (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			className="flex-1"
			keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
		>
			<SafeAreaView className="flex-1 bg-bgColor">
				<View
					className={`flex-1 px-6 ${isKeyboardVisible ? 'justify-start' : 'justify-between'}`}
				>
					<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />
					<TopBar />
					{!isKeyboardVisible && <View className="h-16" />}
					<View className="items-center">
						<Image
							source={require('../assets/bebsapati-logo.png')}
							style={{
								width: 225,
								height: 150,
							}}
							resizeMode="contain"
						/>
					</View>
					<View
						className={`items-center w-full ${isKeyboardVisible ? 'mt-2' : 'justify-center flex-1'}`}
					>
						<View className="w-full">
							<TextInput
								value={phoneNumber}
								onChangeText={handlePhoneNumberChange}
								placeholder={loc.t('login.enterPhoneNumber')}
								placeholderTextColor="#A0A0A0"
								keyboardType="phone-pad"
								maxLength={11}
								className="border-b border-textField p-2 mb-2 text-center text-lg"
								autoFocus={true}
							/>

							{phoneNumberError ? (
								<Text className="text-errorText text-center mb-8">
									{loc.t('login.wrongPhoneNumberError')}
								</Text>
							) : (
								<View className="mb-12" />
							)}

							<TouchableOpacity
								onPress={handleGetOTP}
								disabled={
									phoneNumber.length !== 11 || isLoading || phoneNumberError
								}
								activeOpacity={0.8}
								className={`p-4 rounded-full ${
									phoneNumber.length === 11 && !isLoading && !phoneNumberError
										? 'bg-btnPrimary'
										: 'bg-btnFaded'
								}`}
							>
								<Text className="text-btnText text-center text-lg font-medium">
									{isLoading ? loc.t('login.sending') : loc.t('login.getOTP')}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
					{!isKeyboardVisible && <View className="h-16" />}
				</View>
			</SafeAreaView>
		</KeyboardAvoidingView>
	)

	const renderOtpScreen = () => (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			className="flex-1"
			keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
		>
			<SafeAreaView className="flex-1 bg-bgColor">
				<View
					className={`flex-1 px-6 ${isKeyboardVisible ? 'justify-start' : 'justify-between'}`}
				>
					<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />
					<TopBar />
					{!isKeyboardVisible && <View className="h-16" />}
					<View className="items-center">
						<Image
							source={require('../assets/bebsapati-logo.png')}
							style={{
								width: 225,
								height: 150,
							}}
							resizeMode="contain"
						/>
					</View>
					<View
						className={`items-center w-full ${isKeyboardVisible ? 'mt-2' : 'justify-center flex-1'}`}
					>
						<View className="w-full">
							{!isKeyboardVisible && (
								<>
									<Text className="text-2xl font-medium text-gray-700 text-center">
										{loc.t('login.otpVerification')}
									</Text>
									<Text className="text-gray-500 text-center my-4">
										{loc.t('login.enterOtpSentTo')} {phoneNumber}
									</Text>
								</>
							)}

							<View className="flex-row justify-center space-x-4 my-6">
								{[0, 1, 2, 3].map((index) => (
									<View key={`otp-container-${index}`} className="w-12">
										<TextInput
											key={`otp-${index}`}
											ref={(ref) => (inputRefs.current[index] = ref)}
											value={otp[index]}
											onChangeText={(text) => handleOtpChange(text, index)}
											onKeyPress={(e) => handleKeyPress(e, index)}
											keyboardType="number-pad"
											maxLength={4}
											className="w-12 h-12 text-center text-xl font-medium"
										/>
										<View className="h-0.5 bg-textField w-10 mx-auto mt-1" />
									</View>
								))}
							</View>

							{showResendButton && (
								<View className="flex-row justify-center my-4">
									<Text className="text-gray-500">
										{loc.t('login.didntReceiveOtp')}{' '}
									</Text>
									<TouchableOpacity
										onPress={handleResendOTP}
										disabled={resendDisabled}
									>
										<Text className="text-btnPrimary font-medium">
											{loc.t('login.resendOtp')}
										</Text>
									</TouchableOpacity>
								</View>
							)}

							{resendDisabled && !showResendButton && (
								<Text className="text-gray-500 text-center my-4">
									{loc.t('login.resendOtpIn')} {Math.floor(resendTimer / 60)}:
									{(resendTimer % 60).toString().padStart(2, '0')}
								</Text>
							)}

							<TouchableOpacity
								onPress={handleVerifyOTP}
								disabled={otp.join('').length < 4 || isLoading}
								className={`w-full p-4 rounded-full mt-8 ${
									otp.join('').length >= 4 && !isLoading
										? 'bg-btnPrimary'
										: 'bg-btnFaded'
								}`}
							>
								<Text className="text-btnText text-center text-lg font-medium">
									{isLoading ? loc.t('login.verifying') : loc.t('login.verify')}
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={() => {
									setShowOtpScreen(false)
									setOtp(['', '', '', ''])
									setResendTimer(120)
									setResendDisabled(false)
									setShowResendButton(false)
								}}
								className="mt-4"
							>
								<Text className="text-btnPrimary text-center">
									{loc.t('login.backToPhone')}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
					{!isKeyboardVisible && <View className="h-16" />}
				</View>
			</SafeAreaView>
		</KeyboardAvoidingView>
	)

	// DISABLED: Force-update check removed — users may use older versions (was: compare local EXPO_PUBLIC_APP_VERSION vs remote getLatestVersion and force modal + exit)
	// useFocusEffect(
	// 	useCallback(() => {
	// 		const getAppVersion = async () => {
	// 			try {
	// 				const localVersion = process.env.EXPO_PUBLIC_APP_VERSION
	// 				const remoteVersion = await getLatestVersion()
	// 				if (
	// 					remoteVersion &&
	// 					localVersion &&
	// 					remoteVersion.data.version !== localVersion
	// 				) {
	// 					setShowUpdateModal(true)
	// 				}
	// 			} catch (error) {
	// 				setShowNetworkErrorModal(true)
	// 			}
	// 		}
	// 		getAppVersion()
	// 	}, [])
	// )

	return (
		<View className="flex-1 bg-bgColor">
			{showOtpScreen ? renderOtpScreen() : renderPhoneScreen()}

			{/* Help Modal */}
			<HelpModal
				visible={showHelpModal}
				onClose={() => setShowHelpModal(false)}
			/>

			{/* Update Required Modal */}
			<ErrorModal
				visible={showUpdateModal}
				onClose={async () => {
					const playStoreUrl =
						'https://play.google.com/store/apps/details?id=com.bebsapati.com'
					try {
						const supported = await Linking.canOpenURL(playStoreUrl)
						if (supported) {
							await Linking.openURL(playStoreUrl)
						} else {
							ToastAndroid.show(
								loc.t('login.cannotOpenPlayStore') || 'Cannot open Play Store',
								ToastAndroid.SHORT
							)
						}
					} catch (error) {
						console.error('Error opening Play Store:', error)
						ToastAndroid.show(
							loc.t('login.errorOpeningPlayStore') ||
								'Error opening Play Store',
							ToastAndroid.SHORT
						)
					}
					setShowUpdateModal(false)
					BackHandler.exitApp()
				}}
				title={loc.t('login.updateRequired') || 'Update Required'}
				subtitle={
					loc.t('login.updateMessage') ||
					'Please update the app to continue using it.'
				}
			/>

			{/* Network Error Modal */}
			<ErrorModal
				visible={showNetworkErrorModal}
				onClose={() => {
					setShowNetworkErrorModal(false)
					BackHandler.exitApp()
				}}
				title={loc.t('login.updateNetError') || 'Network Error'}
				subtitle={
					loc.t('login.updateNetErrMsg') ||
					'Unable to check for updates. Please check your internet connection.'
				}
			/>
		</View>
	)
}
