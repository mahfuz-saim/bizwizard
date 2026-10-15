import { router } from 'expo-router'
import {
	View,
	Text,
	TouchableOpacity,
	TextInput,
	StatusBar,
	ScrollView,
	ImageBackground,
	Modal,
	BackHandler,
	ActivityIndicator,
	Linking,
	ToastAndroid,
} from 'react-native'
import { useLocalization } from '../src/localization/localizationContext'
import { Formik } from 'formik'
import { useAuth } from '../src/context/AuthContext'
import { useState, useEffect } from 'react'
import { statusBarColor, barStyleMode } from '../src/constants'
import * as Yup from 'yup'
import DateTimePicker from '@react-native-community/datetimepicker'
import { cleanString } from '../src/components/CleanString'

export default function RegisterPage() {
	const { loc } = useLocalization()
	const { registerUser, verifyReferral } = useAuth()
	const [isLoading, setIsLoading] = useState(false)
	const [termsAccepted, setTermsAccepted] = useState(true)
	const [termsModalVisible, setTermsModalVisible] = useState(false)
	const [exitModalVisible, setExitModalVisible] = useState(false)
	const [showUserTypeSelection, setShowUserTypeSelection] = useState(true)
	const [userType, setUserType] = useState(null)
	const [referralCode, setReferralCode] = useState('')
	const [isReferralValid, setIsReferralValid] = useState(false)
	const [isVerifying, setIsVerifying] = useState(false)
	const [showDatePicker, setShowDatePicker] = useState(false)
	const [selectedDate, setSelectedDate] = useState(null)

	// Helper function to convert date to DD/MM/YYYY string for API
	const formatDateForAPI = (date) => {
		if (!date) return ''
		const day = String(date.getDate()).padStart(2, '0')
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const year = date.getFullYear()
		return `${day}/${month}/${year}`
	}

	// Date picker handler
	const handleDateChange = (event, selectedDateValue, setFieldValue) => {
		setShowDatePicker(false)

		if (event.type === 'dismissed' || !selectedDateValue) {
			return
		}

		setSelectedDate(selectedDateValue)
		const formattedDate = formatDateForAPI(selectedDateValue)
		setFieldValue('dob', formattedDate)
	}

	// Get maximum date (yesterday - birth date must be in the past)
	const getMaximumDate = () => {
		const yesterday = new Date()
		yesterday.setDate(yesterday.getDate() - 1)
		return yesterday
	}

	// Get minimum date (100 years ago)
	const getMinimumDate = () => {
		const date = new Date()
		date.setFullYear(date.getFullYear() - 100)
		return date
	}

	const RegisterSchema = Yup.object().shape({
		name: Yup.string().required(loc.t('register.nameRequired')),
		email:
			userType === 'owner'
				? Yup.string()
						.email(loc.t('register.emailInvalid'))
						.required(loc.t('register.emailRequired'))
				: Yup.string().nullable().notRequired(),
		dob: Yup.string()
			.required(loc.t('register.dobRequired'))
			.matches(
				/^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/,
				loc.t('register.dobFormat')
			),
		address: Yup.string().required(loc.t('register.addressRequired')),
	})

	useEffect(() => {
		const backAction = () => {
			if (!showUserTypeSelection) {
				setShowUserTypeSelection(true)
				return true
			}
			setExitModalVisible(true)
			return true
		}

		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			backAction
		)

		return () => backHandler.remove()
	}, [showUserTypeSelection])

	const handleExitApp = () => {
		setExitModalVisible(false)
		BackHandler.exitApp()
	}

	const handleUserTypeSelect = (type) => {
		setUserType(type)
	}

	const handleNext = () => {
		if (!userType) {
			ToastAndroid.show(
				loc.t('register.selectUserType') || 'Please select a user type',
				ToastAndroid.SHORT
			)
			return
		}
		setShowUserTypeSelection(false)
	}

	const handleVerifyReferral = async () => {
		if (referralCode.length !== 6) {
			return
		}

		setIsVerifying(true)
		try {
			const result = await verifyReferral(referralCode)
			if (result && result.success) {
				setIsReferralValid(true)
				ToastAndroid.show(
					loc.t('register.referralVerified') ||
						'Referral code verified successfully',
					ToastAndroid.SHORT
				)
			} else {
				setIsReferralValid(false)
				ToastAndroid.show(
					loc.t('register.invalidReferral') || 'Invalid referral code',
					ToastAndroid.SHORT
				)
			}
		} catch (error) {
			console.error('🚨 Referral verification error:', error)
			setIsReferralValid(false)
			ToastAndroid.show(
				loc.t('register.referralVerificationFailed') ||
					'Referral verification failed',
				ToastAndroid.SHORT
			)
		} finally {
			setIsVerifying(false)
		}
	}

	const handleRegisterUser = async (values) => {
		if (!termsAccepted) {
			ToastAndroid.show(
				loc.t('register.termsRequired') || 'Please accept terms and conditions',
				ToastAndroid.SHORT
			)
			return
		}

		setIsLoading(true)
		try {
			const cleanedData = {
				...values,
				name: cleanString(values.name || ''),
				address: cleanString(values.address || ''),
				email:
					userType === 'owner' ? cleanString(values.email || '') : values.email,
			}

			// Create a copy of values to avoid mutating the original
			const formData = { ...cleanedData }

			if (userType === 'employee') {
				delete formData.email
			}

			const funcParams = { data: formData, userType }

			if (userType === 'owner' && referralCode && isReferralValid) {
				funcParams.referralCode = referralCode
			}

			const result = await registerUser(funcParams)
			const token = result?.data?.accessToken
			const base64Url = token.split('.')[1]
			const decodedToken = JSON.parse(atob(base64Url))

			if (decodedToken.role != 'OWNER') {
				router.replace('/shops/joinShop')
				return
			}
			if (result.success === true) {
				setIsLoading(false)
				router.replace('/shops')
			} else {
				ToastAndroid.show(
					result.message ||
						loc.t('register.generalError') ||
						'Registration failed',
					ToastAndroid.LONG
				)
				router.replace('/')
			}
		} catch (error) {
			console.error('🚨 Registration error:', error)
			ToastAndroid.show(
				loc.t('register.generalError') ||
					'Registration failed. Please try again.',
				ToastAndroid.LONG
			)
		} finally {
			setIsLoading(false)
		}
	}

	const handleSubmit = async (values) => {
		if (userType === 'owner') {
			await handleRegisterUser(values)
		} else {
			await handleRegisterUser(values)
		}
	}

	const isSignUpDisabled = (values) => {
		const basicFieldsValid =
			userType === 'owner'
				? !values.name ||
					!values.email ||
					!values.dob ||
					!values.address ||
					!termsAccepted
				: !values.name || !values.dob || !values.address || !termsAccepted

		if (userType === 'owner' && referralCode.length > 0) {
			return basicFieldsValid || !isReferralValid
		}

		return basicFieldsValid
	}

	const TermsModal = () => (
		<Modal
			animationType="fade"
			transparent={true}
			visible={termsModalVisible}
			onRequestClose={() => setTermsModalVisible(false)}
		>
			<View className="flex-1 justify-center items-center bg-black/25">
				<View
					className="p-5 rounded-lg w-11/12 h-4/5"
					style={{ backgroundColor: '#FFFFFF' }}
				>
					<View className="flex-row justify-between items-center mb-4">
						<Text className="text-xl font-bold" style={{ color: '#000000' }}>
							{loc.t('register.termsAndPolicy')}
						</Text>
						<TouchableOpacity onPress={() => setTermsModalVisible(false)}>
							<Text className="text-2xl" style={{ color: '#000000' }}>
								×
							</Text>
						</TouchableOpacity>
					</View>

					<ScrollView className="flex-1">
						<Text
							className="text-base mb-4 font-bold"
							style={{ color: '#000000' }}
						>
							1. {loc.t('register.termsOfService')}
						</Text>
						<Text className="text-sm mb-3" style={{ color: '#000000' }}>
							{loc.t('register.termsWelcome')}
						</Text>

						<Text
							className="text-base mb-4 font-bold"
							style={{ color: '#000000' }}
						>
							2. {loc.t('register.userAccounts')}
						</Text>
						<Text className="text-sm mb-3" style={{ color: '#000000' }}>
							{loc.t('register.accountsDescription')}
						</Text>

						<Text
							className="text-base mb-4 font-bold"
							style={{ color: '#000000' }}
						>
							3. {loc.t('register.privacyPolicy')}
						</Text>
						<Text className="text-sm mb-3" style={{ color: '#000000' }}>
							{loc.t('register.privacyDescription')}
						</Text>

						<Text
							className="text-base mb-4 font-bold"
							style={{ color: '#000000' }}
						>
							4. {loc.t('register.userConduct')}
						</Text>
						<Text className="text-sm mb-3" style={{ color: '#000000' }}>
							{loc.t('register.conductDescription')}
						</Text>

						<Text
							className="text-base mb-4 font-bold"
							style={{ color: '#000000' }}
						>
							5. {loc.t('register.contentOwnership')}
						</Text>
						<Text className="text-sm mb-3" style={{ color: '#000000' }}>
							{loc.t('register.ownershipDescription')}
						</Text>

						<Text
							className="text-base mb-4 font-bold"
							style={{ color: '#000000' }}
						>
							6. {loc.t('register.termination')}
						</Text>
						<Text className="text-sm mb-3" style={{ color: '#000000' }}>
							{loc.t('register.terminationDescription')}
						</Text>

						<Text
							className="text-base mb-4 font-bold"
							style={{ color: '#000000' }}
						>
							7. {loc.t('register.limitationOfLiability')}
						</Text>
						<Text className="text-sm mb-3" style={{ color: '#000000' }}>
							{loc.t('register.liabilityDescription')}
						</Text>

						<Text
							className="text-base mb-4 font-bold"
							style={{ color: '#000000' }}
						>
							8. {loc.t('register.changesToTerms')}
						</Text>
						<Text className="text-sm mb-3" style={{ color: '#000000' }}>
							{loc.t('register.changesDescription')}
						</Text>
					</ScrollView>

					<TouchableOpacity
						className="bg-blue-600 p-3 rounded-md mt-4"
						onPress={() => {
							setTermsAccepted(true)
							setTermsModalVisible(false)
						}}
					>
						<Text className="text-white text-center font-bold">
							{loc.t('register.iAccept')}
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	)

	const ExitConfirmationModal = () => (
		<Modal
			animationType="fade"
			transparent={true}
			visible={exitModalVisible}
			onRequestClose={() => setExitModalVisible(false)}
		>
			<View className="flex-1 justify-center items-center bg-black/50">
				<View
					className="p-5 rounded-lg w-10/12"
					style={{ backgroundColor: '#FFFFFF' }}
				>
					<Text
						className="text-xl font-bold text-center mb-4"
						style={{ color: '#000000' }}
					>
						{loc.t('exit.confirmExit')}
					</Text>
					<Text
						className="text-base text-center mb-6"
						style={{ color: '#000000' }}
					>
						{loc.t('exit.exitMessage')}
					</Text>

					<View className="flex-row justify-between">
						<TouchableOpacity
							className="p-3 rounded-md flex-1 mr-2"
							style={{ backgroundColor: '#D1D5DB' }}
							onPress={() => setExitModalVisible(false)}
						>
							<Text
								className="text-center font-bold"
								style={{ color: '#374151' }}
							>
								{loc.t('exit.cancel')}
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							className="p-3 rounded-md flex-1 ml-2"
							style={{ backgroundColor: '#2563EB' }}
							onPress={handleExitApp}
						>
							<Text
								className="text-center font-bold"
								style={{ color: '#FFFFFF' }}
							>
								{loc.t('exit.yes')}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	)

	return (
		<ImageBackground
			source={require('../assets/register-illustration.png')}
			style={{ width: '100%', height: '100%' }}
		>
			<View className="flex-1 bg-black/60">
				<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />
				<TermsModal />
				<ExitConfirmationModal />

				{showUserTypeSelection ? (
					<View className="flex-1 justify-center items-center px-6">
						<Text className="text-3xl font-semibold text-gray-100 text-center mb-8">
							{loc.t('register.userTypeQuestion')}
						</Text>

						{/* Owner Button */}
						<TouchableOpacity
							className={`w-full mb-4 ${
								userType === 'owner' ? 'opacity-100' : 'opacity-70'
							}`}
							onPress={() => handleUserTypeSelect('owner')}
						>
							<ImageBackground
								source={require('../assets/owner-select-button.png')}
								className="w-full h-24 rounded-lg overflow-hidden"
								resizeMode="cover"
							>
								<View className="flex-1 justify-center items-center">
									<View className="bg-white/80 px-4 py-2 rounded-lg">
										<Text className="text-xl font-bold text-blue-600 text-center">
											{loc.t('register.owner')}
										</Text>
									</View>
								</View>
							</ImageBackground>
						</TouchableOpacity>

						{/* Employee Button */}
						<TouchableOpacity
							className={`w-full mb-8 ${
								userType === 'employee' ? 'opacity-100' : 'opacity-70'
							}`}
							onPress={() => handleUserTypeSelect('employee')}
						>
							<ImageBackground
								source={require('../assets/employee-select-button.png')}
								className="w-full h-24 rounded-lg overflow-hidden"
								resizeMode="cover"
							>
								<View className="flex-1 justify-center items-center">
									<View className="bg-white/80 px-4 py-2 rounded-lg">
										<Text className="text-xl font-bold text-blue-600 text-center">
											{loc.t('register.employee')}
										</Text>
									</View>
								</View>
							</ImageBackground>
						</TouchableOpacity>

						{/* Next Button */}
						<TouchableOpacity
							onPress={handleNext}
							className="bg-blue-600 p-4 rounded-full w-full"
						>
							<Text className="text-white text-center font-bold text-lg">
								{loc.t('register.next')}
							</Text>
						</TouchableOpacity>
					</View>
				) : (
					<ScrollView contentContainerStyle={{ flexGrow: 1 }}>
						<View className="flex-1 py-12 px-6">
							<Text className="text-3xl font-semibold text-gray-100 text-center mb-8">
								{userType === 'owner'
									? loc.t('register.createOwnerAccount')
									: loc.t('register.createEmployeeAccount')}
							</Text>

							<Formik
								initialValues={{
									name: '',
									email: '',
									dob: '',
									address: '',
								}}
								validationSchema={RegisterSchema}
								onSubmit={handleSubmit}
								enableReinitialize
							>
								{({
									handleChange,
									handleSubmit,
									values,
									errors,
									touched,
									setFieldValue,
								}) => (
									<View>
										<Text
											className="font-medium mb-1"
											style={{ color: '#F3F4F6' }}
										>
											{loc.t('register.name')} *
										</Text>
										<TextInput
											value={values.name}
											onChangeText={handleChange('name')}
											placeholder={loc.t('register.namePlaceholder')}
											placeholderTextColor="#A0A0A0"
											className="border rounded p-3 mb-4"
											style={{
												borderColor: '#D1D5DB',
												backgroundColor: '#FFFFFF',
												color: '#000000',
											}}
										/>
										{touched.name && errors.name && (
											<Text className="text-red-500 mb-2">{errors.name}</Text>
										)}

										{/* Email Field - Only for Owners */}
										{userType === 'owner' && (
											<>
												<Text
													className="font-medium mb-1"
													style={{ color: '#F3F4F6' }}
												>
													{loc.t('register.email')} *
												</Text>
												<TextInput
													value={values.email}
													onChangeText={handleChange('email')}
													placeholder={loc.t('register.emailPlaceholder')}
													placeholderTextColor="#A0A0A0"
													className="border rounded p-3 mb-4"
													style={{
														borderColor: '#D1D5DB',
														backgroundColor: '#FFFFFF',
														color: '#000000',
													}}
													keyboardType="email-address"
													autoCapitalize="none"
												/>
												{touched.email && errors.email && (
													<Text className="text-red-500 mb-2">
														{errors.email}
													</Text>
												)}
											</>
										)}

										<Text
											className="font-medium mb-1"
											style={{ color: '#F3F4F6' }}
										>
											{loc.t('register.dateOfBirth')} *
										</Text>
										<TouchableOpacity
											onPress={() => setShowDatePicker(true)}
											className="border rounded p-3 mb-4 flex-row justify-between"
											style={{
												borderColor: '#D1D5DB',
												backgroundColor: '#FFFFFF',
											}}
										>
											<Text
												style={{
													color: values.dob ? '#000000' : '#A0A0A0',
												}}
											>
												{values.dob || 'DD/MM/YYYY'}
											</Text>
											<Text className="text-blue-600 text-lg">📅</Text>
										</TouchableOpacity>
										{touched.dob && errors.dob && (
											<Text className="text-red-500 mb-2">{errors.dob}</Text>
										)}

										<Text
											className="font-medium mb-1"
											style={{ color: '#F3F4F6' }}
										>
											{loc.t('register.address')} *
										</Text>
										<TextInput
											value={values.address}
											onChangeText={handleChange('address')}
											placeholder={loc.t('register.addressPlaceholder')}
											placeholderTextColor="#A0A0A0"
											className="border rounded p-3 mb-6"
											style={{
												borderColor: '#D1D5DB',
												backgroundColor: '#FFFFFF',
												color: '#000000',
											}}
										/>
										{touched.address && errors.address && (
											<Text className="text-red-500 mb-2">
												{errors.address}
											</Text>
										)}

										{/* Referral Code Field for Owner */}
										{userType === 'owner' && (
											<>
												<Text
													className="font-medium mb-1"
													style={{ color: '#F3F4F6' }}
												>
													{loc.t('register.referralCode')}
												</Text>
												<View className="flex-row mb-6">
													<TextInput
														value={referralCode}
														onChangeText={(text) => {
															setReferralCode(text)
															setIsReferralValid(false) // Reset validation on change
														}}
														placeholder={loc.t('register.referralPlaceholder')}
														placeholderTextColor="#A0A0A0"
														className="border rounded p-3 flex-1 mr-2"
														style={{
															borderColor: '#D1D5DB',
															backgroundColor: '#FFFFFF',
															color: '#000000',
														}}
														keyboardType="numeric"
														maxLength={6}
													/>
													<TouchableOpacity
														onPress={handleVerifyReferral}
														disabled={referralCode.length !== 6 || isVerifying}
														className="p-3 rounded-md w-20 items-center justify-center"
														style={{
															backgroundColor:
																referralCode.length === 6 && !isVerifying
																	? '#2563EB'
																	: '#93C5FD',
														}}
													>
														{isVerifying ? (
															<ActivityIndicator size="small" color="#FFFFFF" />
														) : (
															<Text
																className="text-center font-medium"
																style={{ color: '#FFFFFF' }}
															>
																{loc.t('register.verify')}
															</Text>
														)}
													</TouchableOpacity>
												</View>
												{isReferralValid && (
													<Text
														className="mb-4 mt-0"
														style={{ color: '#10B981' }}
													>
														{loc.t('register.referralValid')}
													</Text>
												)}
											</>
										)}

										<View className="flex-row items-center mb-6">
											<TouchableOpacity
												onPress={() => setTermsAccepted(!termsAccepted)}
												className="w-5 h-5 border rounded mr-2 flex items-center justify-center"
												style={{
													borderColor: '#9CA3AF',
													backgroundColor: termsAccepted
														? '#4169E1'
														: 'transparent',
												}}
											>
												{termsAccepted && (
													<Text
														className="font-bold"
														style={{ color: '#FFFFFF' }}
													>
														✓
													</Text>
												)}
											</TouchableOpacity>
											<Text style={{ color: '#F3F4F6' }}>
												{loc.t('register.acceptPrefix')} {/* <Text */}
												{/* 	className="text-blue-600" */}
												{/* 	onPress={() => */}
												{/* 		Linking.openURL('https://example.com/terms') */}
												{/* 	} */}
												{/* > */}
												{/* 	{loc.t('register.termsAndPolicyLink')} */}
												{/* </Text> */}
												<Text className="text-sm">
													<Text
														className="underline"
														style={{ color: '#3B82F6' }}
														onPress={() =>
															Linking.openURL(
																'https://bebsapati.com/terms-conditions'
															)
														}
													>
														{loc.t('shops.form.terms') || 'terms'}
													</Text>
													<Text style={{ color: '#F3F4F6' }}>
														{' '}
														{loc.t('register.and')}{' '}
													</Text>
													<Text
														className="underline"
														style={{ color: '#3B82F6' }}
														onPress={() =>
															Linking.openURL(
																'https://bebsapati.com/privacy-policy'
															)
														}
													>
														{loc.t('shops.form.policy') || 'policy'}
													</Text>
													.
												</Text>
												.
											</Text>
										</View>

										<TouchableOpacity
											onPress={handleSubmit}
											disabled={isLoading || isSignUpDisabled(values)}
											className="p-4 rounded-full"
											style={{
												backgroundColor: isSignUpDisabled(values)
													? '#93C5FD'
													: '#2563EB',
											}}
										>
											<Text
												className="text-center font-bold text-lg"
												style={{ color: '#FFFFFF' }}
											>
												{isLoading
													? loc.t('register.signingUp')
													: loc.t('register.signUp')}
											</Text>
										</TouchableOpacity>

										{/* Date Picker */}
										{showDatePicker && (
											<DateTimePicker
												value={selectedDate || new Date()}
												mode="date"
												display="default"
												onChange={(event, date) =>
													handleDateChange(event, date, setFieldValue)
												}
												maximumDate={getMaximumDate()}
												minimumDate={getMinimumDate()}
											/>
										)}
									</View>
								)}
							</Formik>
						</View>
					</ScrollView>
				)}
			</View>
		</ImageBackground>
	)
}
