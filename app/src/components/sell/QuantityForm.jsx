import {
	Modal,
	Text,
	View,
	TouchableOpacity,
	TextInput,
	Animated,
	Dimensions,
	StyleSheet,
	ToastAndroid,
} from 'react-native'
import { useEffect, useRef, useState } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { CloseModal } from '../AlertModal.jsx'

const { height: screenHeight } = Dimensions.get('window')

export default function QuantityForm({ lot, handleSubmit, cancelScanFlow }) {
	const slideAnim = useRef(new Animated.Value(screenHeight)).current
	const { loc } = useLocalization()
	const { translateNumber, translateAmount, toEnglishNumbers } =
		useNumberTranslator()

	// Form state
	const [formData, setFormData] = useState({
		quantity: translateNumber(lot.quantity?.toString()) || translateNumber('1'),
		discountPercentage:
			translateNumber(lot.discountPercentage?.toString()) ||
			translateNumber('0'),
		discountAmount:
			translateNumber(lot.discountAmount?.toString()) || translateNumber('0'),
		totalPrice: '',
		discountType: lot.discountType || 'PERCENTAGE',
	})

	const [showCloseModal, setShowCloseModal] = useState(false)

	useEffect(() => {
		// Start slide animation
		Animated.timing(slideAnim, {
			toValue: 0,
			duration: 300,
			useNativeDriver: true,
		}).start()

		// Calculate initial total price
		calculateTotalPrice(
			formData.quantity,
			formData.discountPercentage,
			formData.discountAmount,
			formData.discountType
		)
	}, [])

	const calculateTotalPrice = (
		quantity,
		discountPercentage,
		discountAmount,
		discountType
	) => {
		const quantityNum = Number(toEnglishNumbers(quantity)) || 0
		const discountPercentageNum =
			Number(toEnglishNumbers(discountPercentage)) || 0
		const discountAmountNum = Number(toEnglishNumbers(discountAmount)) || 0

		let calculatedPrice = quantityNum * lot.sellPrice

		if (discountType === 'PERCENTAGE') {
			calculatedPrice =
				calculatedPrice - (discountPercentageNum / 100) * calculatedPrice
		} else if (discountType === 'AMOUNT') {
			calculatedPrice = quantityNum * (lot.sellPrice - discountAmountNum)
		}

		setFormData((prev) => ({
			...prev,
			totalPrice: translateAmount(calculatedPrice.toFixed(2)),
		}))
	}

	const closeModal = () => {
		Animated.timing(slideAnim, {
			toValue: screenHeight,
			duration: 250,
			useNativeDriver: true,
		}).start(() => {
			cancelScanFlow()
		})
	}

	const handleBackdropPress = () => {
		setShowCloseModal(true)
	}

	const updateFormData = (field, value) => {
		const newFormData = { ...formData, [field]: value }
		setFormData(newFormData)

		// Recalculate total price when any field changes
		calculateTotalPrice(
			newFormData.quantity,
			newFormData.discountPercentage,
			newFormData.discountAmount,
			newFormData.discountType
		)
	}

	const handleQuantityChange = (value) => {
		const englishValue = toEnglishNumbers(value)
		const numericValue = Number(englishValue)
		const finalValue =
			numericValue > lot.stock ? lot.stock.toString() : englishValue
		updateFormData('quantity', translateNumber(finalValue))
	}

	const handleQuantityIncrease = () => {
		const currentQuantity = Number(toEnglishNumbers(formData.quantity)) || 0
		const newQuantity = currentQuantity + 1
		if (newQuantity <= lot.stock) {
			handleQuantityChange(translateNumber(newQuantity.toString()))
		}
	}

	const handleQuantityDecrease = () => {
		const currentQuantity = Number(toEnglishNumbers(formData.quantity)) || 0
		const newQuantity = Math.max(1, currentQuantity - 1)
		handleQuantityChange(translateNumber(newQuantity.toString()))
	}

	const handleDiscountPercentageChange = (value) => {
		const englishValue = toEnglishNumbers(value)
		const discountPercentageNum = Number(englishValue) || 0
		const quantityNum = Number(toEnglishNumbers(formData.quantity)) || 0

		// Calculate equivalent amount discount
		const equivalentAmount =
			(discountPercentageNum / 100) * quantityNum * lot.sellPrice

		setFormData((prev) => ({
			...prev,
			discountPercentage: translateNumber(englishValue),
			discountAmount: translateNumber(equivalentAmount.toFixed(2)),
		}))

		calculateTotalPrice(
			formData.quantity,
			translateNumber(englishValue),
			translateNumber(equivalentAmount.toFixed(2)),
			formData.discountType
		)
	}

	const handleDiscountAmountChange = (value) => {
		const englishValue = toEnglishNumbers(value)
		const discountAmountNum = Number(englishValue) || 0
		const quantityNum = Number(toEnglishNumbers(formData.quantity)) || 0
		const basePrice = quantityNum * lot.sellPrice

		// Calculate equivalent percentage discount
		const equivalentPercentage =
			basePrice > 0 ? (discountAmountNum / basePrice) * 100 : 0

		setFormData((prev) => ({
			...prev,
			discountAmount: translateNumber(englishValue),
			discountPercentage: translateNumber(equivalentPercentage.toFixed(2)),
		}))

		calculateTotalPrice(
			formData.quantity,
			translateNumber(equivalentPercentage.toFixed(2)),
			translateNumber(englishValue),
			formData.discountType
		)
	}

	const handleDiscountTypeChange = (type) => {
		setFormData((prev) => ({
			...prev,
			discountType: type,
		}))

		calculateTotalPrice(
			formData.quantity,
			formData.discountPercentage,
			formData.discountAmount,
			type
		)
	}

	const handleFormSubmit = () => {
		const quantityNum = Number(toEnglishNumbers(formData.quantity))

		if (quantityNum <= 0) {
			ToastAndroid.show(
				loc.t('quantityForm.validQuantityMessage') ||
					'Please enter a valid quantity',
				ToastAndroid.SHORT
			)
			return
		}

		if (quantityNum > lot.stock) {
			ToastAndroid.show(
				`${loc.t('quantityForm.onlyAvailable')} ${lot.stock} ${loc.t(
					'quantityForm.unitsInStock'
				)}` || `Only ${lot.stock} units available in stock`,
				ToastAndroid.SHORT
			)
			return
		}

		// Convert all values to English before submitting
		handleSubmit({
			quantity: toEnglishNumbers(formData.quantity),
			discountPercentage: toEnglishNumbers(formData.discountPercentage),
			discountAmount: toEnglishNumbers(formData.discountAmount),
			discountType: formData.discountType,
		})
	}

	return (
		<Modal
			transparent={true}
			visible={true}
			animationType="none"
			onRequestClose={handleBackdropPress}
		>
			<TouchableOpacity style={styles.backdrop} activeOpacity={1}>
				<View style={styles.modalContainer}>
					<Animated.ScrollView
						style={[
							styles.modalContent,
							{
								transform: [{ translateY: slideAnim }],
								maxHeight: screenHeight * 0.9,
							},
						]}
						onStartShouldSetResponder={() => true}
					>
						<View style={styles.container}>
							{/* Header */}
							<View style={styles.header}>
								<View>
									<Text style={styles.headerTitle}>
										{loc.t('quantityForm.addToCart')}
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

							{/* Product Information */}
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>
									{loc.t('quantityForm.productInformation')}
								</Text>

								<View style={styles.infoRow}>
									<View style={styles.infoItem}>
										<Text style={styles.infoLabel}>
											{loc.t('quantityForm.availableStock')}
										</Text>
										<Text style={styles.infoValue}>
											{translateNumber(lot.stock?.toString())}{' '}
											{loc.t('quantityForm.units')}
										</Text>
									</View>
									<View style={styles.infoItem}>
										<Text style={styles.infoLabel}>
											{loc.t('quantityForm.unitPrice')}
										</Text>
										<Text style={styles.infoValue}>
											{translateAmount(lot.sellPrice?.toString())}
										</Text>
									</View>
								</View>
							</View>

							{/* Quantity Section */}
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>
									{loc.t('quantityForm.quantity')}
								</Text>

								<View style={styles.quantityContainer}>
									<TouchableOpacity
										style={styles.quantityButton}
										onPress={handleQuantityDecrease}
										activeOpacity={0.7}
									>
										<MaterialIcons name="remove" size={20} color="#6592E5" />
									</TouchableOpacity>
									<TextInput
										style={styles.quantityInput}
										value={formData.quantity}
										onChangeText={handleQuantityChange}
										placeholder="1"
										placeholderTextColor="#888888"
										keyboardType="numeric"
									/>
									<TouchableOpacity
										style={styles.quantityButton}
										onPress={handleQuantityIncrease}
										activeOpacity={0.7}
									>
										<MaterialIcons name="add" size={20} color="#6592E5" />
									</TouchableOpacity>
								</View>
							</View>

							{/* Discount Section */}
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>
									{loc.t('quantityForm.discountOptions')}
								</Text>

								<View style={styles.discountTypeContainer}>
									<TouchableOpacity
										style={[
											styles.discountTypeButton,
											formData.discountType === 'PERCENTAGE' &&
												styles.activeDiscountType,
										]}
										onPress={() => handleDiscountTypeChange('PERCENTAGE')}
									>
										<Text
											style={[
												styles.discountTypeText,
												formData.discountType === 'PERCENTAGE' &&
													styles.activeDiscountTypeText,
											]}
										>
											{loc.t('quantityForm.percentage')}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[
											styles.discountTypeButton,
											formData.discountType === 'AMOUNT' &&
												styles.activeDiscountType,
										]}
										onPress={() => handleDiscountTypeChange('AMOUNT')}
									>
										<Text
											style={[
												styles.discountTypeText,
												formData.discountType === 'AMOUNT' &&
													styles.activeDiscountTypeText,
											]}
										>
											{loc.t('quantityForm.amount')}
										</Text>
									</TouchableOpacity>
								</View>

								<View style={styles.row}>
									<View style={styles.halfField}>
										<Text style={styles.label}>
											{loc.t('quantityForm.discountPercentage')}
										</Text>
										<TextInput
											style={[
												styles.input,
												formData.discountType !== 'PERCENTAGE' &&
													styles.disabledInput,
											]}
											value={formData.discountPercentage}
											onChangeText={handleDiscountPercentageChange}
											placeholder="0"
											placeholderTextColor="#888888"
											keyboardType="numeric"
											editable={formData.discountType === 'PERCENTAGE'}
										/>
									</View>
									<View style={styles.halfField}>
										<Text style={styles.label}>
											{loc.t('quantityForm.discountAmount')}
										</Text>
										<TextInput
											style={[
												styles.input,
												formData.discountType !== 'AMOUNT' &&
													styles.disabledInput,
											]}
											value={formData.discountAmount}
											onChangeText={handleDiscountAmountChange}
											placeholder="0"
											placeholderTextColor="#888888"
											keyboardType="numeric"
											editable={formData.discountType === 'AMOUNT'}
										/>
									</View>
								</View>
							</View>

							{/* Total Price Display */}
							<View style={styles.section}>
								<View style={styles.totalPriceContainer}>
									<Text style={styles.totalPriceLabel}>
										{loc.t('quantityForm.totalPrice')}
									</Text>
									<Text style={styles.totalPriceValue}>
										{formData.totalPrice}
									</Text>
								</View>
							</View>

							{/* Action Buttons */}
							<View style={styles.buttonContainer}>
								<TouchableOpacity
									style={[styles.button, styles.cancelButton]}
									onPress={closeModal}
									activeOpacity={0.8}
								>
									<Text style={styles.buttonText}>
										{loc.t('quantityForm.cancel')}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.button, styles.submitButton]}
									onPress={handleFormSubmit}
									activeOpacity={0.8}
								>
									<Text style={styles.buttonText}>
										{loc.t('quantityForm.addToCart')}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</Animated.ScrollView>
				</View>
			</TouchableOpacity>

			{/* Close Confirmation Modal */}
			<CloseModal
				visible={showCloseModal}
				title={loc.t('quantityForm.discardChanges') || 'Discard Changes'}
				subtitle={
					loc.t('quantityForm.sureToClose') || 'Are you sure you want to close?'
				}
				onClose={() => setShowCloseModal(false)}
				onConfirm={() => {
					setShowCloseModal(false)
					closeModal()
				}}
			/>
		</Modal>
	)
}

const styles = StyleSheet.create({
	backdrop: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	modalContainer: {
		flex: 1,
		justifyContent: 'flex-end',
	},
	modalContent: {
		backgroundColor: '#6592E5',
		width: '100%',
		borderTopLeftRadius: 25,
		borderTopRightRadius: 25,
		overflow: 'hidden',
	},
	container: {
		padding: 16,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 20,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#FFFFFF',
	},
	headerSubtitle: {
		fontSize: 14,
		color: '#E5E7EB',
		marginTop: 2,
	},
	closeButton: {
		width: 32,
		height: 32,
		backgroundColor: '#E5E7EB',
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	section: {
		padding: 12,
		borderRadius: 8,
		marginBottom: 2,
	},
	sectionTitle: {
		fontWeight: '500',
		fontSize: 16,
		color: '#ffffff',
		marginBottom: 8,
		textAlign: 'center',
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	infoItem: {
		flex: 1,
		alignItems: 'center',
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
		padding: 12,
		borderRadius: 8,
		marginHorizontal: 4,
	},
	infoLabel: {
		fontSize: 12,
		color: '#E5E7EB',
		marginBottom: 4,
	},
	infoValue: {
		fontSize: 16,
		fontWeight: 'bold',
		color: '#FFFFFF',
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	fieldContainer: {
		marginBottom: 2,
	},
	quantityContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 2,
	},
	quantityButton: {
		width: 40,
		height: 40,
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		marginHorizontal: 8,
	},
	quantityInput: {
		width: 100,
		padding: 12,
		borderWidth: 1,
		borderColor: '#d3d3d3',
		borderRadius: 8,
		backgroundColor: '#F0F8FF',
		fontSize: 16,
		color: '#333',
		textAlign: 'center',
	},
	halfField: {
		flex: 1,
		marginRight: 8,
		marginBottom: 2,
	},
	label: {
		marginBottom: 4,
		fontSize: 14,
		color: '#ffffff',
	},
	input: {
		padding: 12,
		borderWidth: 1,
		borderColor: '#d3d3d3',
		borderRadius: 8,
		backgroundColor: '#F0F8FF',
		fontSize: 16,
		color: '#333',
	},
	disabledInput: {
		backgroundColor: '#f5f5f5',
		color: '#999',
	},
	discountTypeContainer: {
		flexDirection: 'row',
		marginBottom: 16,
		backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
		backgroundColor: '#FFFFFF',
	},
	discountTypeText: {
		fontSize: 14,
		fontWeight: '500',
		color: '#FFFFFF',
	},
	activeDiscountTypeText: {
		color: '#6592E5',
	},
	totalPriceContainer: {
		backgroundColor: 'rgba(255, 255, 255, 0.15)',
		padding: 16,
		borderRadius: 12,
		alignItems: 'center',
	},
	totalPriceLabel: {
		fontSize: 16,
		color: '#E5E7EB',
		marginBottom: 4,
	},
	totalPriceValue: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#FFFFFF',
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		gap: 8,
		marginTop: 16,
	},
	button: {
		padding: 12,
		borderRadius: 24,
		width: '40%',
		alignItems: 'center',
	},
	cancelButton: {
		backgroundColor: '#ff0033',
	},
	submitButton: {
		backgroundColor: '#195FE1',
	},
	buttonText: {
		color: '#ffffff',
		fontWeight: '500',
		fontSize: 16,
	},
})
