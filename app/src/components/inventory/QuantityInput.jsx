import {
	View,
	Text,
	TouchableOpacity,
	Dimensions,
	StyleSheet,
	Switch,
	BackHandler,
} from 'react-native'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import {
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetBackdrop,
	BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { ErrorModal } from '../AlertModal'
import DateTimePicker from '@react-native-community/datetimepicker'

const { height: screenHeight } = Dimensions.get('window')

export default function LotUpdateForm({
	lot,
	variant,
	handleLotUpdate,
	cancelScanFlow,
}) {
	const bottomSheetModalRef = useRef(null)
	const { loc } = useLocalization()
	const { translateNumber, toEnglishNumbers } = useNumberTranslator()

	// Snap points for bottom sheet
	const snapPoints = useMemo(() => ['85%', '95%'], [])
	// Form state
	const [formData, setFormData] = useState({
		availableQuantity: lot?.stock?.toString() || '0',
		buyingQuantity: '0',
		mrp: lot?.mrp?.toString() || '',
		retail: lot?.retail?.toString() || '',
		buyPrice: lot?.buyPrice?.toString() || '',
		sellPrice: lot?.sellPrice?.toString() || '',
		vat: lot?.vat?.toString() || '',
		mfgDate: lot?.mfgDate ? formatDateForInput(lot.mfgDate) : '',
		expDate: lot?.expDate ? formatDateForInput(lot.expDate) : '',
		locationAtStore: lot?.locationAtStore || '',
		note: lot?.note || '',
		includeVAT: lot?.includeVAT || false,
		isMRPDefault: lot?.isMRPDefault || false,
	})

	// Modal state
	const [showErrorModal, setShowErrorModal] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')

	// DateTimePicker states
	const [showMfgDatePicker, setShowMfgDatePicker] = useState(false)
	const [showExpDatePicker, setShowExpDatePicker] = useState(false)
	const [tempMfgDate, setTempMfgDate] = useState(new Date())
	const [tempExpDate, setTempExpDate] = useState(new Date())

	// Open bottom sheet on mount
	useEffect(() => {
		const timer = setTimeout(() => {
			bottomSheetModalRef.current?.present()
		}, 50)
		return () => clearTimeout(timer)
	}, [])

	const closeModal = useCallback(() => {
		bottomSheetModalRef.current?.dismiss()
		setTimeout(() => {
			cancelScanFlow()
		}, 150)
	}, [cancelScanFlow])

	// Handle hardware back button
	useEffect(() => {
		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			() => {
				closeModal()
				return true
			}
		)
		return () => backHandler.remove()
	}, [closeModal])

	// Render backdrop component
	const renderBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="close"
				onPress={closeModal}
			/>
		),
		[closeModal]
	)

	// Calculate sell price based on retail and VAT
	useEffect(() => {
		const sellPrice = calculateSellPrice(
			formData.retail,
			formData.vat,
			formData.includeVAT
		)
		if (sellPrice !== formData.sellPrice) {
			setFormData((prev) => ({ ...prev, sellPrice: sellPrice.toString() }))
		}
	}, [formData.retail, formData.vat, formData.includeVAT])

	const calculateSellPrice = (retail, vat, includeVAT) => {
		if (!retail) return ''

		// Convert to English numbers for calculation
		const englishRetail = toEnglishNumbers(retail)
		const englishVat = toEnglishNumbers(vat)

		const retailNum = parseFloat(englishRetail)
		const vatNum = parseFloat(englishVat) || 0

		if (includeVAT && vatNum > 0) {
			return (retailNum * (1 + vatNum / 100)).toFixed(2)
		}
		return retailNum.toFixed(2)
	}

	const updateFormData = (field, value) => {
		// For numeric fields, allow Bengali input but store as is for display
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}))
	}

	// Helper function to convert form data to English numbers for backend
	const convertFormDataToEnglish = (data) => {
		const numericFields = [
			'availableQuantity',
			'buyingQuantity',
			'mrp',
			'retail',
			'buyPrice',
			'sellPrice',
			'vat',
		]

		const convertedData = { ...data }
		numericFields.forEach((field) => {
			if (convertedData[field]) {
				convertedData[field] = toEnglishNumbers(convertedData[field])
			}
		})

		return convertedData
	}

	const validateForm = () => {
		const errors = []

		// Convert to English numbers for validation
		const englishData = convertFormDataToEnglish(formData)

		const availableQty = parseFloat(englishData.availableQuantity) || 0
		const buyingQty = parseFloat(englishData.buyingQuantity) || 0

		if (availableQty < 0) {
			errors.push(loc.t('lotUpdate.availableQuantityNegative'))
		}

		if (buyingQty < 0) {
			errors.push(loc.t('lotUpdate.buyingQuantityNegative'))
		}

		if (
			englishData.mrp &&
			(isNaN(englishData.mrp) || parseFloat(englishData.mrp) <= 0)
		) {
			errors.push(loc.t('lotUpdate.mrpValidation'))
		}

		if (
			englishData.retail &&
			(isNaN(englishData.retail) || parseFloat(englishData.retail) <= 0)
		) {
			errors.push(loc.t('lotUpdate.retailValidation'))
		}

		if (
			englishData.buyPrice &&
			(isNaN(englishData.buyPrice) || parseFloat(englishData.buyPrice) <= 0)
		) {
			errors.push(loc.t('lotUpdate.buyPriceValidation'))
		}

		if (
			englishData.vat &&
			(isNaN(englishData.vat) || parseFloat(englishData.vat) < 0)
		) {
			errors.push(loc.t('lotUpdate.vatValidation'))
		}

		return errors
	}

	const handleSubmit = () => {
		const errors = validateForm()

		if (errors.length > 0) {
			setErrorMessage(errors.join('\n'))
			setShowErrorModal(true)
			return
		}

		// Convert to English numbers for processing
		const englishData = convertFormDataToEnglish(formData)

		// Calculate total amount (available + buying)
		const availableQty = parseFloat(englishData.availableQuantity) || 0
		const buyingQty = parseFloat(englishData.buyingQuantity) || 0
		const totalAmount = availableQty + buyingQty

		// Prepare data for submission - only include changed fields
		const updatedData = {}

		// Always include the new total amount
		updatedData.stock = totalAmount

		// Compare with original values and include only changed ones (using English numbers)
		if (englishData.mrp !== (lot?.mrp?.toString() || '')) {
			updatedData.mrp = englishData.mrp ? parseFloat(englishData.mrp) : null
		}
		if (englishData.retail !== (lot?.retail?.toString() || '')) {
			updatedData.retail = englishData.retail
				? parseFloat(englishData.retail)
				: null
		}
		if (englishData.buyPrice !== (lot?.buyPrice?.toString() || '')) {
			updatedData.buyPrice = englishData.buyPrice
				? parseFloat(englishData.buyPrice)
				: null
		}
		if (englishData.sellPrice !== (lot?.sellPrice?.toString() || '')) {
			updatedData.sellPrice = englishData.sellPrice
				? parseFloat(englishData.sellPrice)
				: null
		}
		if (englishData.vat !== (lot?.vat?.toString() || '')) {
			updatedData.vat = englishData.vat ? parseFloat(englishData.vat) : 0
		}
		if (
			formData.mfgDate !== (lot?.mfgDate ? formatDateForInput(lot.mfgDate) : '')
		) {
			updatedData.mfgDate = formData.mfgDate
				? new Date(formData.mfgDate).toISOString()
				: null
		}
		if (
			formData.expDate !== (lot?.expDate ? formatDateForInput(lot.expDate) : '')
		) {
			updatedData.expDate = formData.expDate
				? new Date(formData.expDate).toISOString()
				: null
		}
		if (formData.locationAtStore !== (lot?.locationAtStore || '')) {
			updatedData.locationAtStore = formData.locationAtStore || null
		}
		if (formData.note !== (lot?.note || '')) {
			updatedData.note = formData.note || null
		}
		if (formData.includeVAT !== lot?.includeVAT) {
			updatedData.includeVAT = formData.includeVAT
		}
		if (formData.isMRPDefault !== lot?.isMRPDefault) {
			updatedData.isMRPDefault = formData.isMRPDefault
		}

		const submissionData = {
			id: lot.id,
			lotData: updatedData,
		}

		handleLotUpdate(submissionData)
	}

	function formatDateForInput(dateString) {
		if (!dateString) return ''
		const date = new Date(dateString)
		return date.toISOString().split('T')[0] // Returns YYYY-MM-DD format
	}

	const formatDisplayDate = (dateString) => {
		if (!dateString) return loc.t('lotUpdate.notSet')
		const date = new Date(dateString)
		const formattedDate = date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		})
		return translateNumber(formattedDate)
	}

	// Date picker handlers
	const handleMfgDateChange = (event, selectedDate) => {
		setShowMfgDatePicker(false)

		if (event.type === 'dismissed' || !selectedDate) {
			return
		}

		// Format date as YYYY-MM-DD for storage
		const year = selectedDate.getFullYear()
		const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0')
		const day = selectedDate.getDate().toString().padStart(2, '0')
		const formattedDate = `${year}-${month}-${day}`

		updateFormData('mfgDate', formattedDate)
	}

	const handleExpDateChange = (event, selectedDate) => {
		setShowExpDatePicker(false)

		if (event.type === 'dismissed' || !selectedDate) {
			return
		}

		// Format date as YYYY-MM-DD for storage
		const year = selectedDate.getFullYear()
		const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0')
		const day = selectedDate.getDate().toString().padStart(2, '0')
		const formattedDate = `${year}-${month}-${day}`

		updateFormData('expDate', formattedDate)
	}

	const openMfgDatePicker = () => {
		const initialDate = formData.mfgDate
			? new Date(formData.mfgDate)
			: new Date()
		setTempMfgDate(initialDate)
		setShowMfgDatePicker(true)
	}

	const openExpDatePicker = () => {
		const initialDate = formData.expDate
			? new Date(formData.expDate)
			: new Date()
		setTempExpDate(initialDate)
		setShowExpDatePicker(true)
	}

	// Calculate total quantity for display
	const getTotalQuantity = () => {
		// Convert to English numbers for calculation
		const englishData = convertFormDataToEnglish(formData)
		const available = parseFloat(englishData.availableQuantity) || 0
		const buying = parseFloat(englishData.buyingQuantity) || 0
		const total = available + buying
		// Return localized number for display
		return translateNumber(total)
	}

	return (
		<>
			<BottomSheetModal
				ref={bottomSheetModalRef}
				index={0}
				snapPoints={snapPoints}
				enablePanDownToClose={true}
				enableDynamicSizing={false}
				backdropComponent={renderBackdrop}
				backgroundStyle={styles.bottomSheetBackground}
				handleIndicatorStyle={styles.handleIndicator}
				keyboardBehavior="interactive"
				android_keyboardInputMode="adjustResize"
				onDismiss={closeModal}
			>
				<View style={styles.header}>
					<View style={styles.headerTextContainer}>
						<Text style={styles.headerTitle}>
							{loc.t('lotUpdate.updateLot')}
						</Text>
						<Text style={styles.headerSubtitle}>
							{variant?.name || loc.t('lotSelector.selectedVariant')}
						</Text>
					</View>
					<TouchableOpacity
						onPress={closeModal}
						style={styles.closeButton}
						activeOpacity={0.7}
					>
						<MaterialIcons name="close" size={18} color="#6B7280" />
					</TouchableOpacity>
				</View>

				<BottomSheetScrollView
					style={styles.scrollView}
					contentContainerStyle={styles.scrollViewContent}
					showsVerticalScrollIndicator={false}
				>
					{/* Total Quantity Display */}
					<View style={styles.infoFieldContainer}>
						<Text style={styles.totalLabel}>
							{loc.t('lotUpdate.totalQuantity')}: {getTotalQuantity()}{' '}
							{loc.t('lotUpdate.units')}
						</Text>
					</View>

					{/* Buying Amount & Buying Price */}
					<View style={styles.infoRowContainer}>
						<View style={styles.infoHalfFieldContainer}>
							<Text style={styles.overlayLabel}>
								{loc.t('lotUpdate.buyingQuantity')}
							</Text>
							<BottomSheetTextInput
								style={styles.infoInput}
								value={formData.buyingQuantity}
								onChangeText={(value) =>
									updateFormData('buyingQuantity', value)
								}
								placeholder="0"
								placeholderTextColor="rgba(0,0,0,0.54)"
								keyboardType="numeric"
							/>
						</View>
						<View style={styles.infoHalfFieldContainer}>
							<Text style={styles.overlayLabel}>
								{loc.t('lotSelector.buyPrice')}
							</Text>
							<BottomSheetTextInput
								style={styles.infoInput}
								value={formData.buyPrice}
								onChangeText={(value) => updateFormData('buyPrice', value)}
								placeholder="0.0"
								placeholderTextColor="rgba(0,0,0,0.54)"
								keyboardType="numeric"
							/>
						</View>
					</View>

					{/* MRP & Retail */}
					<View style={styles.infoRowContainer}>
						<View style={styles.infoHalfFieldContainer}>
							<Text style={styles.overlayLabel}>
								{loc.t('lotSelector.mrp')}
							</Text>
							<BottomSheetTextInput
								style={styles.infoInput}
								value={formData.mrp}
								onChangeText={(value) => updateFormData('mrp', value)}
								placeholder="0.0"
								placeholderTextColor="rgba(0,0,0,0.54)"
								keyboardType="numeric"
							/>
						</View>
						<View style={styles.infoHalfFieldContainer}>
							<Text style={styles.overlayLabel}>
								{loc.t('lotSelector.retail')}
							</Text>
							<BottomSheetTextInput
								style={styles.infoInput}
								value={formData.retail}
								onChangeText={(value) => updateFormData('retail', value)}
								placeholder="0.0"
								placeholderTextColor="rgba(0,0,0,0.54)"
								keyboardType="numeric"
							/>
						</View>
					</View>

					{/* VAT & Selling Price */}
					<View style={styles.infoRowContainer}>
						<View style={styles.infoHalfFieldContainer}>
							<Text style={styles.overlayLabel}>
								{loc.t('lotSelector.vat')} (%)
							</Text>
							<View style={styles.vatInputContainer}>
								<BottomSheetTextInput
									style={[styles.infoInput, styles.vatInputWithToggle]}
									value={formData.vat}
									onChangeText={(value) => updateFormData('vat', value)}
									placeholder="0"
									placeholderTextColor="rgba(0,0,0,0.54)"
									keyboardType="numeric"
								/>
								<View style={styles.vatToggleWrapper}>
									<Switch
										value={formData.includeVAT}
										onValueChange={(value) =>
											updateFormData('includeVAT', value)
										}
										trackColor={{ false: '#d3d3d3', true: '#195FE1' }}
										thumbColor={formData.includeVAT ? '#ffffff' : '#f4f3f4'}
										style={styles.vatToggleSwitch}
									/>
									<Text style={styles.vatToggleText}>
										{loc.t('lotSelector.vatIncluded')}
									</Text>
								</View>
							</View>
						</View>
						<View style={styles.infoHalfFieldContainer}>
							<Text style={styles.overlayLabel}>
								{loc.t('lotSelector.sellPrice')}
							</Text>
							<BottomSheetTextInput
								style={[styles.infoInput, styles.infoDisabledInput]}
								value={formData.sellPrice}
								editable={false}
								placeholder="0.0"
								placeholderTextColor="rgba(0,0,0,0.54)"
							/>
						</View>
					</View>

					{/* Manufacturing & Expiry Date */}
					<View style={styles.infoRowContainer}>
						<View style={styles.infoHalfFieldContainer}>
							<Text style={styles.overlayLabel}>
								{loc.t('lotSelector.manufacturingDate')}
							</Text>
							<TouchableOpacity
								style={styles.infoInput}
								onPress={openMfgDatePicker}
								activeOpacity={0.7}
							>
								<View style={styles.datePickerButton}>
									<Text
										style={
											formData.mfgDate
												? styles.datePickerText
												: styles.datePickerPlaceholder
										}
									>
										{formData.mfgDate
											? formatDisplayDate(formData.mfgDate)
											: loc.t('lotUpdate.dateFormat')}
									</Text>
									<Text style={{ fontSize: 16 }}>📅</Text>
								</View>
							</TouchableOpacity>
						</View>
						<View style={styles.infoHalfFieldContainer}>
							<Text style={styles.overlayLabel}>
								{loc.t('lotSelector.expiryDate')}
							</Text>
							<TouchableOpacity
								style={styles.infoInput}
								onPress={openExpDatePicker}
								activeOpacity={0.7}
							>
								<View style={styles.datePickerButton}>
									<Text
										style={
											formData.expDate
												? styles.datePickerText
												: styles.datePickerPlaceholder
										}
									>
										{formData.expDate
											? formatDisplayDate(formData.expDate)
											: loc.t('lotUpdate.dateFormat')}
									</Text>
									<Text style={{ fontSize: 16 }}>📅</Text>
								</View>
							</TouchableOpacity>
						</View>
					</View>

					{/* Location */}
					<View style={styles.infoFieldContainer}>
						<Text style={styles.overlayLabel}>
							{loc.t('lotUpdate.locationAtStore')}
						</Text>
						<BottomSheetTextInput
							style={styles.infoInput}
							value={formData.locationAtStore}
							onChangeText={(value) => updateFormData('locationAtStore', value)}
							placeholder={loc.t('lotUpdate.locationPlaceholder')}
							placeholderTextColor="rgba(0,0,0,0.54)"
						/>
					</View>

					{/* Note */}
					<View style={styles.infoFieldContainer}>
						<Text style={styles.overlayLabel}>{loc.t('lotSelector.note')}</Text>
						<BottomSheetTextInput
							style={[styles.infoInput, styles.multilineInput]}
							value={formData.note}
							onChangeText={(value) => updateFormData('note', value)}
							placeholder={loc.t('lotUpdate.notesPlaceholder')}
							placeholderTextColor="rgba(0,0,0,0.54)"
							multiline={true}
							numberOfLines={3}
						/>
					</View>

					<View style={styles.buttonContainer}>
						<TouchableOpacity
							style={[styles.button, styles.saveButton]}
							onPress={handleSubmit}
							activeOpacity={0.8}
						>
							<Text style={styles.saveButtonText}>
								{loc.t('lotUpdate.updateLot')}
							</Text>
						</TouchableOpacity>
					</View>
				</BottomSheetScrollView>
			</BottomSheetModal>

			<ErrorModal
				visible={showErrorModal}
				onClose={() => setShowErrorModal(false)}
				title={loc.t('lotUpdate.validationError')}
				subtitle={errorMessage}
			/>

			{showMfgDatePicker && (
				<DateTimePicker
					value={tempMfgDate}
					mode="date"
					display="default"
					onChange={handleMfgDateChange}
				/>
			)}

			{showExpDatePicker && (
				<DateTimePicker
					value={tempExpDate}
					mode="date"
					display="default"
					onChange={handleExpDateChange}
				/>
			)}
		</>
	)
}

const styles = StyleSheet.create({
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF',
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
	},
	handleContainer: {
		alignItems: 'center',
		paddingVertical: 12,
	},
	handleIndicator: {
		backgroundColor: '#195FE1',
		width: 40,
		height: 4,
	},
	scrollView: {
		flex: 1,
		backgroundColor: '#F0F8FF',
	},
	scrollViewContent: {
		paddingHorizontal: 28,
		paddingBottom: 40,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		paddingHorizontal: 16,
		paddingTop: 8,
		paddingBottom: 16,
		backgroundColor: '#F0F8FF',
		borderBottomWidth: 2,
		borderBottomColor: 'rgba(0, 0, 0, 0.08)',
		marginBottom: 8,
	},
	headerTextContainer: {
		flex: 1,
		flexShrink: 1,
		marginRight: 8,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#195FE1',
		flexShrink: 1,
	},
	headerSubtitle: {
		fontSize: 14,
		color: '#195FE1',
		opacity: 0.8,
		marginTop: 2,
		flexShrink: 1,
	},
	closeButton: {
		width: 32,
		height: 32,
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.1)',
	},
	infoRowContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 16,
		gap: 8,
	},
	infoHalfFieldContainer: {
		flex: 1,
		position: 'relative',
		paddingTop: 8,
	},
	infoFieldContainer: {
		marginBottom: 16,
		position: 'relative',
		paddingTop: 8,
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
	infoInput: {
		padding: 12,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		borderRadius: 8,
		backgroundColor: '#FFFFFF',
		fontSize: 16,
		color: '#111827',
		minHeight: 44,
	},
	infoDisabledInput: {
		backgroundColor: '#F3F4F6',
		color: '#6B7280',
	},
	multilineInput: {
		minHeight: 80,
		textAlignVertical: 'top',
		paddingTop: 12,
	},
	totalLabel: {
		fontSize: 16,
		fontWeight: '600',
		color: '#111827',
		textAlign: 'center',
		backgroundColor: '#FFFFFF',
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
	},
	switchContainer: {
		height: 44,
		justifyContent: 'center',
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		borderRadius: 8,
		backgroundColor: '#FFFFFF',
	},
	dateHelper: {
		fontSize: 12,
		color: '#6B7280',
		marginTop: 4,
		marginLeft: 4,
		fontStyle: 'italic',
	},
	datePickerButton: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	datePickerText: {
		fontSize: 16,
		color: '#111827',
	},
	datePickerPlaceholder: {
		fontSize: 16,
		color: '#888888',
	},
	vatInputContainer: {
		position: 'relative',
	},
	vatInputWithToggle: {
		paddingRight: 70,
	},
	vatToggleWrapper: {
		position: 'absolute',
		right: 8,
		top: 4,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 2,
	},
	vatToggleSwitch: {
		transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
	},
	vatToggleText: {
		fontSize: 9,
		color: '#6B7280',
		fontWeight: '500',
		textAlign: 'center',
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		paddingBottom: 16,
		backgroundColor: '#F0F8FF',
	},
	button: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 48,
	},
	saveButton: {
		backgroundColor: '#195FE1',
	},
	saveButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
})
