import {
	Text,
	View,
	TouchableOpacity,
	StyleSheet,
	Switch,
	KeyboardAvoidingView,
	Platform,
	Keyboard,
	BackHandler,
} from 'react-native'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { getAllCustomer, addCustomer } from '../../controllers/customer'
import useApi from '../../hooks/useApi'
import { Dropdown } from 'react-native-element-dropdown'
import CustomerForm from '../customer/customerForm'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { CloseModal, ErrorModal } from '../AlertModal.jsx'
import { getShopInfo } from '../../controllers/shop'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useRouter } from 'expo-router'
import {
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetBackdrop,
	BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function SummaryPage({
	handleSubmit,
	handleDraft,
	cancelFlow,
	selectedCustomerId = null,
	totalAmount = 0,
}) {
	const { loc } = useLocalization()
	const { translateNumber, toEnglishNumbers } = useNumberTranslator()
	const [finalAmount, setFinalAmount] = useState(0)
	const { fetchData } = useApi()
	const router = useRouter()
	const insets = useSafeAreaInsets()

	// Bottom Sheet Modal ref
	const bottomSheetModalRef = useRef(null)

	// Snap points for bottom sheet
	const snapPoints = useMemo(() => ['95%', '95%'], [])

	const [discountForm, setDiscountForm] = useState({
		discountAmount: translateNumber('0'),
		discountPercentage: translateNumber('0'),
		discountType: 'PERCENTAGE',
	})

	const [customers, setCustomers] = useState([])
	const [selectedCustomer, setSelectedCustomer] = useState(null)
	const [isFocus, setIsFocus] = useState(false)

	// New state variables
	const [sendSMS, setSendSMS] = useState(false)
	const [paymentStatus, setPaymentStatus] = useState('PAID')
	const [paidAmount, setPaidAmount] = useState(translateNumber('0'))
	const [showInfoTooltip, setShowInfoTooltip] = useState(false)
	const [showCloseModal, setShowCloseModal] = useState(false)
	const [showErrorModal, setShowErrorModal] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isDrafting, setIsDrafting] = useState(false)
	const [shopInfo, setShopInfo] = useState(null)
	const [visible, setVisible] = useState(true)
	const [showCustomerForm, setShowCustomerForm] = useState(false)
	const [validationErrors, setValidationErrors] = useState({
		discountAmount: '',
		discountPercentage: '',
		paidAmount: '',
	})

	// Expand to top snap point
	const expandToTop = useCallback(() => {
		try {
			const lastIndex = Math.max(0, snapPoints.length - 1)
			if (bottomSheetModalRef.current?.snapToIndex) {
				bottomSheetModalRef.current?.snapToIndex(lastIndex)
			} else {
				bottomSheetModalRef.current?.expand?.()
			}
		} catch (e) {
			bottomSheetModalRef.current?.expand?.()
		}
	}, [snapPoints])

	useEffect(() => {
		customers.forEach((item) => {
			if (item?.userID === selectedCustomerId) {
				setSelectedCustomer(item)
			}
		})
	}, [customers])

	// Update SMS toggle when customer changes
	useEffect(() => {
		if (!selectedCustomer || selectedCustomer === null) {
			setSendSMS(false)
		}
	}, [selectedCustomer])

	// Update paid amount when total amount or payment status changes
	useEffect(() => {
		if (paymentStatus === 'PAID') {
			setPaidAmount(translateNumber(totalAmount.toString()))
		} else {
			setPaidAmount(translateNumber('0'))
		}
	}, [totalAmount, paymentStatus, translateNumber])

	useEffect(() => {
		let calculatedAmount = totalAmount

		if (discountForm.discountType === 'PERCENTAGE') {
			const discountPercentage =
				parseFloat(toEnglishNumbers(discountForm.discountPercentage)) || 0
			if (discountPercentage > 0) {
				calculatedAmount =
					totalAmount - (totalAmount * discountPercentage) / 100
			}
		} else if (discountForm.discountType === 'AMOUNT') {
			const discountAmount =
				parseFloat(toEnglishNumbers(discountForm.discountAmount)) || 0
			if (discountAmount > 0) {
				calculatedAmount = totalAmount - discountAmount
			}
		}

		// Ensure final amount is not negative
		calculatedAmount = Math.max(calculatedAmount, 0)
		setFinalAmount(calculatedAmount)
	}, [
		totalAmount,
		discountForm.discountAmount,
		discountForm.discountPercentage,
		discountForm.discountType,
		toEnglishNumbers,
	])

	useEffect(() => {
		fetchShopInfo()
	}, [])

	const fetchShopInfo = async () => {
		try {
			const response = await fetchData(getShopInfo, {})

			if (response && response.success && response.data) {
				setShopInfo(response.data)
			}
		} catch (error) {
			console.error('Error fetching shop info:', error)
		}
	}

	useEffect(() => {
		if (paymentStatus === 'PAID') {
			setPaidAmount(translateNumber(finalAmount.toString()))
		} else {
			setPaidAmount(translateNumber('0'))
		}
	}, [finalAmount, paymentStatus, translateNumber])

	const getCustomers = async () => {
		try {
			const res = await fetchData(getAllCustomer, {})
			if (res.success) {
				const customerList = [
					{ name: loc.t('summaryPage.walkInCustomer'), buyerID: null },
					{
						name: loc.t('summaryPage.createNewCustomer'),
						buyerID: 'CREATE_NEW',
					},
					...res.data.data,
				]
				setCustomers(customerList)
				setSelectedCustomer(null)
			} else {
				setErrorMessage(
					res.message || loc.t('summaryPage.failedToFetchCustomers')
				)
				setShowErrorModal(true)
			}
		} catch (error) {
			console.error('Error fetching customers:', error)
			setErrorMessage(loc.t('summaryPage.failedToFetchCustomers'))
			setShowErrorModal(true)
		}
	}

	useEffect(() => {
		getCustomers()
	}, [])

	// Open bottom sheet on mount
	useEffect(() => {
		if (visible && !showCustomerForm) {
			const timer = setTimeout(() => {
				bottomSheetModalRef.current?.present()
			}, 50)
			return () => clearTimeout(timer)
		} else {
			bottomSheetModalRef.current?.dismiss()
		}
	}, [visible, showCustomerForm])

	// Keyboard listeners
	useEffect(() => {
		const showSub = Keyboard.addListener('keyboardDidShow', () => {
			expandToTop()
		})

		return () => {
			showSub.remove()
		}
	}, [expandToTop])

	// Hardware back button handler
	useEffect(() => {
		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			() => {
				if (visible) {
					setShowCloseModal(true)
					return true // Prevent default back button behavior
				}
				return false // Let default behavior happen
			}
		)

		return () => backHandler.remove()
	}, [visible])

	const closeModal = useCallback(() => {
		bottomSheetModalRef.current?.dismiss()
		setTimeout(() => {
			cancelFlow()
		}, 150)
	}, [cancelFlow])

	const handleBackdropPress = () => {
		setShowCloseModal(true)
	}

	// Render backdrop component
	const renderBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="none"
				onPress={() => handleBackdropPress()}
			/>
		),
		[]
	)

	// Handle sheet changes
	const handleSheetChanges = useCallback(
		(index) => {
			if (index === -1) {
				cancelFlow()
			}
		},
		[cancelFlow]
	)

	const handleDiscountPercentageChange = (value) => {
		// Convert to English for processing but keep original characters for display
		const englishValue = toEnglishNumbers(value)
		// Remove leading zeros and handle empty input
		let cleanedValue = englishValue.replace(/^0+/, '') || '0'

		// If user is actively typing and the value is just "0", clear it
		if (
			englishValue !== '0' &&
			cleanedValue === '0' &&
			englishValue.length > 0
		) {
			cleanedValue = ''
		}

		// Validate discount percentage
		const numValue = parseFloat(cleanedValue) || 0
		if (numValue > 100) {
			setValidationErrors((prev) => ({
				...prev,
				discountPercentage: loc.t(
					'summaryPage.discountPercentageCannotExceed100'
				),
			}))
		} else {
			setValidationErrors((prev) => ({ ...prev, discountPercentage: '' }))
		}

		// Store the Bengali version for display
		setDiscountForm((prev) => ({
			...prev,
			discountPercentage: translateNumber(cleanedValue),
		}))
	}

	const handleDiscountAmountChange = (value) => {
		// Convert to English for processing but keep original characters for display
		const englishValue = toEnglishNumbers(value)
		// Remove leading zeros and handle empty input
		let cleanedValue = englishValue.replace(/^0+/, '') || '0'

		// If user is actively typing and the value is just "0", clear it
		if (
			englishValue !== '0' &&
			cleanedValue === '0' &&
			englishValue.length > 0
		) {
			cleanedValue = ''
		}

		// Validate discount amount
		const numValue = parseFloat(cleanedValue) || 0
		if (numValue > totalAmount) {
			setValidationErrors((prev) => ({
				...prev,
				discountAmount: loc.t('summaryPage.discountCannotExceedTotal'),
			}))
		} else {
			setValidationErrors((prev) => ({ ...prev, discountAmount: '' }))
		}

		// Store the Bengali version for display
		setDiscountForm((prev) => ({
			...prev,
			discountAmount: translateNumber(cleanedValue),
		}))
	}
	const handleDiscountTypeChange = (type) => {
		setDiscountForm((prev) => ({
			...prev,
			discountType: type,
		}))
	}

	const handlePaidAmountChange = (value) => {
		// Convert to English for processing but keep original characters for display
		const englishValue = toEnglishNumbers(value)
		// Remove leading zeros and handle empty input
		let cleanedValue = englishValue.replace(/^0+/, '') || '0'

		// If user is actively typing and the value is just "0", clear it
		if (
			englishValue !== '0' &&
			cleanedValue === '0' &&
			englishValue.length > 0
		) {
			cleanedValue = ''
		}

		// Validate paid amount
		const numValue = parseFloat(cleanedValue) || 0
		if (numValue > finalAmount) {
			setValidationErrors((prev) => ({
				...prev,
				paidAmount: loc.t('summaryPage.paidAmountCannotExceedTotal'),
			}))
		} else {
			setValidationErrors((prev) => ({ ...prev, paidAmount: '' }))
		}

		// Store the Bengali version for display
		setPaidAmount(translateNumber(cleanedValue))
	}

	const handleInfoPress = () => {
		setShowInfoTooltip(true)
		setTimeout(() => {
			setShowInfoTooltip(false)
		}, 2000)
	}

	const handleFormSubmit = () => {
		setIsSubmitting(true)

		// Convert discount form to English numbers before submitting
		const processedDiscountForm = {
			discountAmount: toEnglishNumbers(discountForm.discountAmount),
			discountPercentage: toEnglishNumbers(discountForm.discountPercentage),
			discountType: discountForm.discountType,
		}

		const txnInfo = {
			isDraft: false,
			sendSMS,
			status: paymentStatus,
			paidAmount: parseFloat(toEnglishNumbers(paidAmount)) || 0,
		}
		handleSubmit(processedDiscountForm, selectedCustomer, txnInfo)
		// Keep the loading state until modal closes (parent component handles closing)
	}

	const handleCreditPress = () => {
		router.push('/home/message/credit')
	}

	const handleDraftSubmit = () => {
		setIsDrafting(true)

		// Convert discount form to English numbers before submitting
		const processedDiscountForm = {
			discountAmount: toEnglishNumbers(discountForm.discountAmount),
			discountPercentage: toEnglishNumbers(discountForm.discountPercentage),
			discountType: discountForm.discountType,
		}

		const txnInfo = {
			isDraft: true,
			sendSMS,
			status: paymentStatus,
			paidAmount: parseFloat(toEnglishNumbers(paidAmount)) || 0,
		}
		handleDraft(processedDiscountForm, selectedCustomer, txnInfo)
		// Keep the loading state until modal closes (parent component handles closing)
	}

	const handleOpenCustomerForm = useCallback(() => {
		setShowCustomerForm(true)
	}, [])

	const handleCloseCustomerForm = useCallback(() => {
		setShowCustomerForm(false)
	}, [])

	const handleAddCustomer = useCallback(
		async (data) => {
			const payload = {
				name: data.name,
				number: data.number,
				address: data.address,
			}

			try {
				const res = await fetchData(addCustomer, { payload: payload })
				if (res.success === true) {
					// Refresh customer list
					await getCustomers()
					// Select the newly created customer
					if (res.data && res.data.buyerID) {
						setSelectedCustomer(res.data.buyerID)
					}
				} else {
					setErrorMessage(
						res.message || loc.t('summaryPage.failedToAddCustomer')
					)
					setShowErrorModal(true)
				}
			} catch (error) {
				console.error('Error adding customer:', error)
				setErrorMessage(loc.t('summaryPage.failedToAddCustomer'))
				setShowErrorModal(true)
			}
		},
		[fetchData, getCustomers, loc]
	)

	// Custom render for dropdown items
	const renderDropdownItem = useCallback(
		(item) => {
			// First item: render walk-in and create new side by side
			if (item.value === null) {
				return (
					<View style={styles.dropdownFirstRow}>
						<TouchableOpacity
							style={[
								styles.walkInButtonDropdown,
								selectedCustomer === null && styles.walkInButtonActive,
							]}
							onPress={() => {
								setSelectedCustomer(null)
								setIsFocus(false)
							}}
							activeOpacity={0.7}
						>
							<MaterialIcons
								name="person-outline"
								size={16}
								color={selectedCustomer === null ? '#FFFFFF' : '#195FE1'}
							/>
							<Text
								style={[
									styles.walkInButtonText,
									selectedCustomer === null && styles.walkInButtonTextActive,
								]}
							>
								{loc.t('summaryPage.walkInCustomer')}
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.createCustomerButtonDropdown}
							onPress={() => {
								handleOpenCustomerForm()
								setIsFocus(false)
							}}
							activeOpacity={0.7}
						>
							<MaterialIcons name="person-add" size={16} color="#3CB043" />
							<Text style={styles.createCustomerButtonText}>
								{loc.t('summaryPage.createNewCustomer')}
							</Text>
						</TouchableOpacity>
					</View>
				)
			}

			// Skip rendering the CREATE_NEW item as it's part of the first row
			if (item.value === 'CREATE_NEW') {
				return null
			}

			// Regular customer items
			return (
				<View style={styles.dropdownItem}>
					<Text style={styles.itemTextStyle}>{item.label}</Text>
				</View>
			)
		},
		[selectedCustomer, handleOpenCustomerForm, loc]
	)

	const isWalkInCustomer = selectedCustomer === null

	// Check if there are any validation errors
	const hasValidationErrors = Object.values(validationErrors).some(
		(error) => error !== ''
	)

	if (!visible) return null

	return (
		<>
			{!showCustomerForm && (
				<BottomSheetModal
					ref={bottomSheetModalRef}
					snapPoints={snapPoints}
					enablePanDownToClose={false}
					backdropComponent={renderBackdrop}
					keyboardBehavior="interactive"
					keyboardBlurBehavior="restore"
					android_keyboardInputMode="adjustResize"
					backgroundStyle={styles.bottomSheetBackground}
					handleIndicatorStyle={styles.handleIndicator}
					enableDynamicSizing={false}
				>
					{/* Fixed Header */}
					<View style={styles.headerContainer}>
						<View style={styles.header}>
							<View>
								<Text style={styles.headerTitle}>
									{loc.t('summaryPage.orderSummary')}
								</Text>
							</View>
							<TouchableOpacity
								onPress={closeModal}
								style={styles.closeButton}
								activeOpacity={0.7}
							>
								<MaterialIcons name="close" size={16} color="#6B7280" />
							</TouchableOpacity>
						</View>
					</View>

					{/* Scrollable Content */}
					<KeyboardAvoidingView
						style={styles.keyboardAvoidingView}
						behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
						keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
					>
						<BottomSheetScrollView
							showsVerticalScrollIndicator={false}
							bounces={true}
							keyboardShouldPersistTaps="handled"
							contentContainerStyle={styles.scrollContent}
						>
							{/* Total Cart Amount Section */}
							<View style={styles.totalAmountSection}>
								<View style={styles.totalAmountCard}>
									<View style={styles.totalAmountRow}>
										<Text style={styles.totalAmountLabel}>
											{loc.t('summaryPage.totalCartAmount')}:
										</Text>
										{finalAmount < totalAmount ? (
											<View style={styles.amountWithDiscountContainer}>
												<Text style={styles.originalAmountStrikethrough}>
													৳ {translateNumber(totalAmount.toFixed(2))}
												</Text>
												<Text style={styles.discountedAmountValue}>
													৳ {translateNumber(finalAmount.toFixed(2))}
												</Text>
											</View>
										) : (
											<Text style={styles.totalAmountValue}>
												৳ {translateNumber(totalAmount.toFixed(2))}
											</Text>
										)}
									</View>
								</View>
							</View>

							{/* Customer Selection Section */}
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>
									{loc.t('summaryPage.customerSelection')}
								</Text>
								<View style={styles.fieldContainer}>
									<Dropdown
										data={customers.map((customer) => ({
											label: customer.name,
											value: customer.buyerID,
											searchableText: `${customer.name} -  ${
												customer.number || ''
											}`,
										}))}
										search
										maxHeight={300}
										labelField="label"
										valueField="value"
										searchField="searchableText"
										placeholder={
											!isFocus ? loc.t('summaryPage.walkInCustomer') : '...'
										}
										placeholderTextColor="#888888"
										searchPlaceholder={loc.t('summaryPage.searchCustomers')}
										value={selectedCustomer}
										onFocus={() => setIsFocus(true)}
										onBlur={() => setIsFocus(false)}
										onChange={(item) => {
											// Only handle regular customer selection here
											// Walk-in and Create New are handled in renderItem
											if (item.value !== null && item.value !== 'CREATE_NEW') {
												setSelectedCustomer(item.value)
												setIsFocus(false)
											}
										}}
										renderItem={renderDropdownItem}
										style={styles.dropdown}
										placeholderStyle={styles.placeholderStyle}
										selectedTextStyle={styles.selectedTextStyle}
										inputSearchStyle={styles.inputSearchStyle}
										itemTextStyle={styles.itemTextStyle}
										containerStyle={styles.dropdownListContainer}
									/>
								</View>

								{/* SMS Toggle and Credit Display */}
								<View style={styles.smsSection}>
									<View style={styles.smsToggleContainer}>
										<View style={styles.smsLeftSection}>
											<Text style={styles.smsToggleLabel}>
												{loc.t('summaryPage.sendReceiptSMS')}
											</Text>
											{/* Credit Display - Only show when customer is selected */}
											{!isWalkInCustomer && (
												<TouchableOpacity
													onPress={handleCreditPress}
													style={styles.creditContainerInline}
													activeOpacity={0.7}
												>
													<MaterialCommunityIcons
														name="wallet"
														size={16}
														color="#F59E0B"
													/>
													<Text style={styles.creditAmountInline}>
														{translateNumber(shopInfo?.credit || 0)}
													</Text>
													<MaterialIcons
														name="add-circle-outline"
														size={16}
														color="#3CB043"
													/>
												</TouchableOpacity>
											)}
										</View>
										<Switch
											value={sendSMS}
											onValueChange={setSendSMS}
											disabled={
												isWalkInCustomer || (shopInfo?.credit || 0) === 0
											}
											trackColor={{ false: '#767577', true: '#195FE1' }}
											thumbColor={sendSMS ? '#FFFFFF' : '#f4f3f4'}
											style={[
												styles.smsToggle,
												(isWalkInCustomer || (shopInfo?.credit || 0) === 0) &&
													styles.disabledToggle,
											]}
										/>
									</View>
								</View>
							</View>

							{/* Total Cart Discount Section */}
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>
									{loc.t('summaryPage.totalCartDiscount')}
								</Text>

								<View style={styles.discountTypeContainer}>
									<TouchableOpacity
										style={[
											styles.discountTypeButton,
											discountForm.discountType === 'PERCENTAGE' &&
												styles.activeDiscountType,
										]}
										onPress={() => handleDiscountTypeChange('PERCENTAGE')}
									>
										<Text
											style={[
												styles.discountTypeText,
												discountForm.discountType === 'PERCENTAGE' &&
													styles.activeDiscountTypeText,
											]}
										>
											{loc.t('summaryPage.percentage')}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[
											styles.discountTypeButton,
											discountForm.discountType === 'AMOUNT' &&
												styles.activeDiscountType,
										]}
										onPress={() => handleDiscountTypeChange('AMOUNT')}
									>
										<Text
											style={[
												styles.discountTypeText,
												discountForm.discountType === 'AMOUNT' &&
													styles.activeDiscountTypeText,
											]}
										>
											{loc.t('summaryPage.amount')}
										</Text>
									</TouchableOpacity>
								</View>

								<View style={styles.row}>
									<View style={styles.halfField}>
										<Text style={styles.overlayLabel}>
											{loc.t('summaryPage.discountPercentage')}
										</Text>
										<BottomSheetTextInput
											style={[
												styles.input,
												discountForm.discountType !== 'PERCENTAGE' &&
													styles.disabledInput,
											]}
											value={discountForm.discountPercentage}
											onChangeText={handleDiscountPercentageChange}
											onFocus={() => expandToTop()}
											placeholder={translateNumber('0')}
											placeholderTextColor="#888888"
											keyboardType="numeric"
											editable={discountForm.discountType === 'PERCENTAGE'}
										/>
										{validationErrors.discountPercentage && (
											<Text style={styles.errorText}>
												{validationErrors.discountPercentage}
											</Text>
										)}
									</View>
									<View style={styles.halfField}>
										<Text style={styles.overlayLabel}>
											{loc.t('summaryPage.discountAmount')}
										</Text>
										<BottomSheetTextInput
											style={[
												styles.input,
												discountForm.discountType !== 'AMOUNT' &&
													styles.disabledInput,
											]}
											value={discountForm.discountAmount}
											onChangeText={handleDiscountAmountChange}
											onFocus={() => expandToTop()}
											placeholder={translateNumber('0')}
											placeholderTextColor="#888888"
											keyboardType="numeric"
											editable={discountForm.discountType === 'AMOUNT'}
										/>
										{validationErrors.discountAmount && (
											<Text style={styles.errorText}>
												{validationErrors.discountAmount}
											</Text>
										)}
									</View>
								</View>
							</View>

							{/* Payment Status Section */}
							<View style={styles.section}>
								<View style={styles.paymentHeaderContainer}>
									<Text style={styles.sectionTitle}>
										{loc.t('summaryPage.paymentStatus')}
									</Text>
									{isWalkInCustomer && (
										<View style={styles.infoContainer}>
											<TouchableOpacity onPress={handleInfoPress}>
												<MaterialIcons
													name="info-outline"
													size={16}
													color="#195FE1"
												/>
											</TouchableOpacity>
											{showInfoTooltip && (
												<View style={styles.tooltip}>
													<Text style={styles.tooltipText}>
														{loc.t('summaryPage.selectCustomerFirst')}
													</Text>
												</View>
											)}
										</View>
									)}
								</View>

								<View style={styles.paymentRow}>
									<View style={styles.paymentTypeSection}>
										<View style={styles.paymentTypeContainer}>
											<TouchableOpacity
												style={[
													styles.paymentTypeButton,
													paymentStatus === 'PAID' && styles.activePaymentType,
												]}
												onPress={() => setPaymentStatus('PAID')}
											>
												<Text
													style={[
														styles.paymentTypeText,
														paymentStatus === 'PAID' &&
															styles.activePaymentTypeText,
													]}
												>
													{loc.t('summaryPage.paid')}
												</Text>
											</TouchableOpacity>
											<TouchableOpacity
												style={[
													styles.paymentTypeButton,
													paymentStatus === 'UNPAID' &&
														styles.activePaymentType,
													isWalkInCustomer && styles.disabledPaymentButton,
												]}
												onPress={() =>
													!isWalkInCustomer && setPaymentStatus('UNPAID')
												}
												disabled={isWalkInCustomer}
											>
												<Text
													style={[
														styles.paymentTypeText,
														paymentStatus === 'UNPAID' &&
															styles.activePaymentTypeText,
														isWalkInCustomer && styles.disabledPaymentText,
													]}
												>
													{loc.t('summaryPage.unpaid')}
												</Text>
											</TouchableOpacity>
										</View>
									</View>

									<View style={styles.amountSection}>
										<Text style={styles.overlayLabel}>
											{loc.t('summaryPage.paidAmount')}
										</Text>
										<BottomSheetTextInput
											style={[
												styles.input,
												paymentStatus === 'PAID' && styles.disabledInput,
											]}
											value={paidAmount}
											onChangeText={handlePaidAmountChange}
											onFocus={() => {
												expandToTop()
												if (paidAmount === translateNumber('0')) {
													setPaidAmount('')
												}
											}}
											onBlur={() => {
												if (paidAmount === '') {
													setPaidAmount(translateNumber('0'))
												}
											}}
											placeholder={translateNumber('0')}
											placeholderTextColor="#888888"
											keyboardType="numeric"
											editable={paymentStatus === 'UNPAID'}
										/>
										{validationErrors.paidAmount && (
											<Text style={styles.errorText}>
												{validationErrors.paidAmount}
											</Text>
										)}
									</View>
								</View>
								{/* Action Buttons - Fixed */}
								<View style={styles.buttonContainer}>
									<TouchableOpacity
										style={[
											styles.button,
											styles.draftButton,
											(isDrafting || hasValidationErrors) &&
												styles.buttonDisabled,
										]}
										onPress={handleDraftSubmit}
										activeOpacity={0.8}
										disabled={isDrafting || isSubmitting || hasValidationErrors}
									>
										<Text style={styles.buttonText}>
											{isDrafting
												? loc.t('summaryPage.saving')
												: loc.t('summaryPage.draft')}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[
											styles.button,
											styles.submitButton,
											(isSubmitting || hasValidationErrors) &&
												styles.buttonDisabled,
										]}
										onPress={handleFormSubmit}
										activeOpacity={0.8}
										disabled={isDrafting || isSubmitting || hasValidationErrors}
									>
										<Text style={styles.buttonText}>
											{isSubmitting
												? loc.t('summaryPage.selling')
												: loc.t('summaryPage.receipt')}
										</Text>
									</TouchableOpacity>
								</View>
							</View>
						</BottomSheetScrollView>
					</KeyboardAvoidingView>
				</BottomSheetModal>
			)}

			{/* Close Confirmation Modal */}
			<CloseModal
				visible={showCloseModal}
				title={loc.t('summaryPage.discardChanges') || 'Discard Changes'}
				subtitle={
					loc.t('summaryPage.sureToClose') || 'Are you sure you want to close?'
				}
				onClose={() => setShowCloseModal(false)}
				onConfirm={() => {
					setShowCloseModal(false)
					closeModal()
				}}
			/>

			{/* Error Modal */}
			<ErrorModal
				visible={showErrorModal}
				title={loc.t('summaryPage.error') || 'Error'}
				subtitle={errorMessage}
				onClose={() => setShowErrorModal(false)}
			/>

			{/* Customer Form */}
			{showCustomerForm && (
				<CustomerForm
					visible={showCustomerForm}
					onClose={handleCloseCustomerForm}
					handleSubmit={handleAddCustomer}
				/>
			)}
		</>
	)
}

const styles = StyleSheet.create({
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF', // AliceBlue as requested
		borderTopLeftRadius: 25,
		borderTopRightRadius: 25,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: -2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	handleIndicator: {
		backgroundColor: '#195FE1',
		width: 30,
		height: 3,
		borderRadius: 2,
	},
	headerContainer: {
		backgroundColor: '#F0F8FF',
		paddingHorizontal: 16,
		paddingBottom: 16,
		borderBottomWidth: 2,
		borderBottomColor: 'rgba(0,0,0,0.08)',
	},
	keyboardAvoidingView: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingBottom: 40,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#195FE1', // Primary color for header
	},
	closeButton: {
		width: 28,
		height: 28,
		backgroundColor: '#E5E7EB',
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
	section: {
		padding: 12,
		borderRadius: 8,
		marginBottom: 2,
	},
	sectionTitle: {
		fontWeight: '600',
		fontSize: 16,
		color: '#195FE1',
		marginBottom: 8,
		textAlign: 'center',
	},
	fieldContainer: {
		marginBottom: 8,
		position: 'relative',
		paddingTop: 0,
	},
	overlayLabel: {
		position: 'absolute',
		top: 0,
		left: 12,
		backgroundColor: '#F0F8FF',
		paddingHorizontal: 6,
		fontSize: 12,
		color: '#195FE1',
		fontWeight: '600',
		zIndex: 10,
		borderRadius: 8,
	},
	dropdown: {
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	placeholderStyle: {
		fontSize: 16,
		color: '#6592E5',
		fontWeight: '500',
	},
	selectedTextStyle: {
		fontSize: 12,
		color: '#333333',
		fontWeight: '600',
	},
	inputSearchStyle: {
		height: 40,
		fontSize: 12,
		paddingHorizontal: 6,
		color: '#333333',
	},
	itemTextStyle: {
		fontSize: 12,
		color: '#333333',
	},
	dropdownListContainer: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		marginTop: 4,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 4,
		},
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 8,
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	dropdownFirstRow: {
		flexDirection: 'row',
		gap: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
	},
	walkInButtonDropdown: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingVertical: 10,
		paddingHorizontal: 12,
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: '#195FE1',
	},
	walkInButtonActive: {
		backgroundColor: '#195FE1',
	},
	walkInButtonText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#195FE1',
	},
	walkInButtonTextActive: {
		color: '#FFFFFF',
	},
	createCustomerButtonDropdown: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingVertical: 10,
		paddingHorizontal: 12,
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: '#3CB043',
	},
	createCustomerButtonText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#3CB043',
	},
	dropdownItem: {
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	// SMS Toggle Styles
	smsToggleContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 4,
		paddingHorizontal: 4,
	},
	smsLeftSection: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	smsToggleLabel: {
		fontSize: 14,
		color: '#195FE1',
		fontWeight: '500',
	},
	smsToggle: {
		transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
	},
	disabledToggle: {
		opacity: 0.5,
	},
	creditContainerInline: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(25, 95, 225, 0.1)',
		borderRadius: 6,
		paddingVertical: 4,
		paddingHorizontal: 8,
		gap: 4,
	},
	creditAmountInline: {
		fontSize: 14,
		color: '#195FE1',
		fontWeight: '700',
	},
	// Payment Status Styles
	paymentHeaderContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		position: 'relative',
		marginBottom: 8,
	},
	infoContainer: {
		position: 'absolute',
		right: 0,
	},
	tooltip: {
		position: 'absolute',
		right: 20,
		top: -5,
		backgroundColor: 'rgba(0, 0, 0, 0.8)',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 4,
		minWidth: 120,
	},
	tooltipText: {
		color: '#FFFFFF',
		fontSize: 12,
		textAlign: 'center',
	},
	paymentRow: {
		flexDirection: 'row',
		gap: 12,
		alignItems: 'center',
	},
	paymentTypeSection: {
		flex: 1,
		paddingTop: 8,
	},
	paymentTypeContainer: {
		flexDirection: 'row',
		backgroundColor: 'rgba(25, 95, 225, 0.1)',
		borderRadius: 8,
		padding: 4,
		height: 44,
	},
	paymentTypeButton: {
		flex: 1,
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 6,
		alignItems: 'center',
	},
	activePaymentType: {
		backgroundColor: '#195FE1',
	},
	disabledPaymentButton: {
		opacity: 0.5,
	},
	paymentTypeText: {
		fontSize: 14,
		fontWeight: '500',
		color: '#195FE1',
	},
	activePaymentTypeText: {
		color: '#FFFFFF',
	},
	disabledPaymentText: {
		color: '#CCCCCC',
	},
	amountSection: {
		flex: 1,
		position: 'relative',
		paddingTop: 8,
	},
	amountContainer: {
		marginBottom: 4,
		width: '50%',
		alignSelf: 'center',
		position: 'relative',
		paddingTop: 8,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
	},
	halfField: {
		flex: 1,
		position: 'relative',
		paddingTop: 8,
	},
	input: {
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		fontSize: 16,
		color: '#333333',
		minHeight: 44,
		textAlign: 'center',
	},
	disabledInput: {
		backgroundColor: '#f5f5f5',
		color: '#999',
	},
	discountTypeContainer: {
		flexDirection: 'row',
		marginBottom: 16,
		backgroundColor: 'rgba(25, 95, 225, 0.1)',
		borderRadius: 8,
		padding: 4,
	},
	discountTypeButton: {
		flex: 1,
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 6,
		alignItems: 'center',
	},
	activeDiscountType: {
		backgroundColor: '#195FE1',
	},
	discountTypeText: {
		fontSize: 14,
		fontWeight: '500',
		color: '#195FE1',
	},
	activeDiscountTypeText: {
		color: '#FFFFFF',
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		gap: 8,
		padding: 16,
		paddingBottom: 8,
		backgroundColor: '#F0F8FF',
	},
	button: {
		padding: 12,
		borderRadius: 8,
		width: '40%',
		alignItems: 'center',
	},
	draftButton: {
		backgroundColor: '#FFA500',
	},
	submitButton: {
		backgroundColor: '#195FE1',
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonText: {
		color: '#ffffff',
		fontWeight: '500',
		fontSize: 16,
	},
	totalAmountSection: {
		paddingHorizontal: 12,
		paddingTop: 8,
		paddingBottom: 12,
	},
	totalAmountCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 8,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
		borderWidth: 2,
		borderColor: '#195FE1',
	},
	totalAmountRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		width: '100%',
		gap: 12,
	},
	totalAmountLabel: {
		fontSize: 16,
		color: '#6B7280',
		fontWeight: '600',
	},
	totalAmountValue: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#195FE1',
	},
	amountWithDiscountContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	originalAmountStrikethrough: {
		fontSize: 14,
		fontWeight: '600',
		color: '#9CA3AF',
		textDecorationLine: 'line-through',
	},
	discountedAmountValue: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#10B981',
	},
	errorText: {
		fontSize: 11,
		color: '#EF4444',
		marginTop: 4,
		marginLeft: 4,
		fontWeight: '500',
	},
})
