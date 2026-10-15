import {
	View,
	Text,
	TouchableOpacity,
	TextInput,
	StyleSheet,
	ScrollView,
	Switch,
	ToastAndroid,
	StatusBar,
	BackHandler,
} from 'react-native'
import { useEffect, useState } from 'react'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import useApi from '../../../../../src/hooks/useApi.jsx'
import LotSelector from '../../../../../src/components/inventory/LotSelector.jsx'
import VariantAnalytics from '../../../../../src/components/inventory/VariantAnalytics.jsx'
import {
	CloseModal,
	ErrorModal,
} from '../../../../../src/components/AlertModal.jsx'
import { useLocalSearchParams, router } from 'expo-router'
import {
	getAllLotsFromVariant,
	updateProduct,
	getProductByVariantId,
} from '../../../../../src/controllers/product.js'

export default function ProductUpdateForm() {
	const params = useLocalSearchParams()
	const { loc } = useLocalization()
	const { translateNumber, toEnglishNumbers } = useNumberTranslator()
	const { fetchData } = useApi()
	const [productLots, setProductLots] = useState([])
	const [lotSelectorVisible, setLotSelectorVisible] = useState(false)
	const [isEditMode, setIsEditMode] = useState(false)
	const [showCloseModal, setShowCloseModal] = useState(false)
	const [showErrorModal, setShowErrorModal] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')

	// Track original form data for change detection
	const [originalFormData, setOriginalFormData] = useState({})

	const parseProduct = () => {
		if (params.productData) {
			try {
				return JSON.parse(params.productData)
			} catch (error) {
				console.error('Error parsing productData:', error)
				return {}
			}
		}
		return {}
	}

	const [product, setProduct] = useState(parseProduct())

	// Update product when params change
	useEffect(() => {
		const parsedProduct = parseProduct()
		if (parsedProduct && parsedProduct.id) {
			setProduct(parsedProduct)
			// Reset edit mode when switching products
			setIsEditMode(false)
		}
	}, [params.productData])

	const fetchUpdatedProductData = async (variantId) => {
		const res = await fetchData(getProductByVariantId, {
			variantId: variantId,
			includeLot: false,
			includeProduct: false,
		})
		if (res?.success) {
			setProduct((prev) => res.data)
		}

		// Refetch lots after product data is updated
		await refetchLots(variantId)
	}

	const refetchLots = async (variantId) => {
		try {
			const lotsRes = await fetchData(getAllLotsFromVariant, variantId)
			if (lotsRes && lotsRes.success) {
				setProductLots(lotsRes.data || [])
			} else {
				setProductLots([])
			}
		} catch (err) {
			console.error('🚨 Error refetching lots:', err)
		}
	}

	// Form state
	const [formData, setFormData] = useState({
		name: product?.name || '',
		variantName: product?.variantName || '',
		variantCode: product?.variantCode || '',
		packOf:
			translateNumber(product?.packOf?.toString()) || translateNumber('1'),
		lowStock:
			translateNumber(product?.lowStock?.toString()) || translateNumber('0'),
		notifyAfterNotSold:
			translateNumber(product?.notifyAfterNotSold?.toString()) ||
			translateNumber('30'),
		notifyBeforeExp:
			translateNumber(product?.notifyBeforeExp?.toString()) ||
			translateNumber('7'),
		lowStockSMS: product?.lowStockSMS || false,
	})

	// Update formData when product changes (from fetchUpdatedProductData or params change)
	useEffect(() => {
		if (product && product.id) {
			const updatedFormData = {
				name: product?.name || '',
				variantName: product?.variantName || '',
				variantCode: product?.variantCode || '',
				packOf:
					translateNumber(product?.packOf?.toString()) || translateNumber('1'),
				lowStock:
					translateNumber(product?.lowStock?.toString()) ||
					translateNumber('0'),
				notifyAfterNotSold:
					translateNumber(product?.notifyAfterNotSold?.toString()) ||
					translateNumber('30'),
				notifyBeforeExp:
					translateNumber(product?.notifyBeforeExp?.toString()) ||
					translateNumber('7'),
				lowStockSMS: product?.lowStockSMS || false,
			}
			setFormData(updatedFormData)
			setOriginalFormData(updatedFormData)
		}
	}, [product, translateNumber])

	// Handle hardware back button
	useEffect(() => {
		const handleHardwareBackPress = () => {
			// If lot selector is open, close it
			if (lotSelectorVisible) {
				setLotSelectorVisible(false)
				return true
			}

			// If close confirmation modal is open, close it
			if (showCloseModal) {
				setShowCloseModal(false)
				return true
			}

			// If error modal is open, close it
			if (showErrorModal) {
				setShowErrorModal(false)
				return true
			}

			// If in edit mode with unsaved changes, show discard confirmation
			if (isEditMode) {
				if (hasFormChanged()) {
					setShowCloseModal(true)
				} else {
					setIsEditMode(false)
				}
				return true
			}

			// Default: let the system handle back navigation naturally
			return false // ← Changed from router.navigate + return true
		}

		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			handleHardwareBackPress
		)

		return () => backHandler.remove()
	}, [
		isEditMode,
		formData,
		originalFormData,
		lotSelectorVisible,
		showCloseModal,
		showErrorModal,
	])

	const handleProductUpdate = async (updatedData) => {
		try {
			const res = await fetchData(updateProduct, updatedData)

			if (res.success) {
				ToastAndroid.show(
					loc.t('inventory.details.productUpdatedSuccess'),
					ToastAndroid.SHORT
				)
				// Update product state with the changes
				setProduct((prev) => ({
					...prev,
					...updatedData.data,
				}))
				// Reset to view mode after successful update
				setIsEditMode(false)
				// Update original form data to reflect the changes
				setOriginalFormData({ ...formData })
			} else {
				ToastAndroid.show(
					loc.t('inventory.details.productUpdateError'),
					ToastAndroid.SHORT
				)
			}
		} catch (err) {
			console.error('Error updating product:', err)
			ToastAndroid.show(
				loc.t('inventory.details.productUpdateError'),
				ToastAndroid.SHORT
			)
		}
	}

	const updateFormData = (field, value) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}))
	}

	const hasFormChanged = () => {
		return JSON.stringify(formData) !== JSON.stringify(originalFormData)
	}

	const handleShowLots = async () => {
		try {
			const lotsRes = await fetchData(getAllLotsFromVariant, product.id)

			if (lotsRes && lotsRes.success) {
				setProductLots(lotsRes.data || [])
			} else {
				setProductLots([])
			}
			setLotSelectorVisible(true)
		} catch (err) {
			console.error('🚨 Error fetching lots:', err)
			ToastAndroid.show('Error fetching lots!', ToastAndroid.SHORT)
			setProductLots([])
			setLotSelectorVisible(true)
		}
	}

	const validateForm = () => {
		const errors = []

		if (!formData.name.trim()) {
			errors.push(loc.t('quantityUpdate.productNameRequired'))
		}

		if (!formData.variantName.trim()) {
			errors.push(loc.t('quantityUpdate.variantNameRequired'))
		}

		// Variant code is optional - no validation required

		const packOf = parseFloat(toEnglishNumbers(formData.packOf))
		if (isNaN(packOf) || packOf <= 0) {
			errors.push(loc.t('quantityUpdate.packSizeValidation'))
		}

		const lowStock = parseFloat(toEnglishNumbers(formData.lowStock))
		if (isNaN(lowStock) || lowStock < 0) {
			errors.push(loc.t('quantityUpdate.lowStockValidation'))
		}

		const notifyDays = parseFloat(toEnglishNumbers(formData.notifyAfterNotSold))
		if (isNaN(notifyDays) || notifyDays < 0) {
			errors.push(loc.t('quantityUpdate.notifyDaysValidation'))
		}

		const expiryDays = parseFloat(toEnglishNumbers(formData.notifyBeforeExp))
		if (isNaN(expiryDays) || expiryDays < 0) {
			errors.push(loc.t('quantityUpdate.notifyBeforeExpiryMin'))
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

		// Prepare data for submission - only include changed fields
		const updatedData = {}

		// Compare with original values and include only changed ones
		if (formData.name !== product?.name) {
			updatedData.name = formData.name.trim()
		}
		if (formData.variantName !== product?.variantName) {
			updatedData.variantName = formData.variantName.trim()
		}
		if (formData.variantCode !== product?.variantCode) {
			updatedData.variantCode = formData.variantCode.trim()
		}
		if (formData.packOf !== translateNumber(product?.packOf?.toString())) {
			updatedData.packOf = parseFloat(toEnglishNumbers(formData.packOf))
		}
		if (formData.lowStock !== translateNumber(product?.lowStock?.toString())) {
			updatedData.lowStock = parseFloat(toEnglishNumbers(formData.lowStock))
		}
		if (
			formData.notifyAfterNotSold !==
			translateNumber(product?.notifyAfterNotSold?.toString())
		) {
			updatedData.notifyAfterNotSold = parseFloat(
				toEnglishNumbers(formData.notifyAfterNotSold)
			)
		}
		if (
			formData.notifyBeforeExp !==
			translateNumber(product?.notifyBeforeExp?.toString())
		) {
			updatedData.notifyBeforeExp = parseFloat(
				toEnglishNumbers(formData.notifyBeforeExp)
			)
		}
		if (formData.lowStockSMS !== product?.lowStockSMS) {
			updatedData.lowStockSMS = formData.lowStockSMS
		}

		const submissionData = {
			id: product.id,
			data: updatedData,
		}

		handleProductUpdate(submissionData)
	}

	return (
		<View style={styles.container}>
			<StatusBar backgroundColor="#6592E5" barStyle="light-content" />
			{/* Main Content */}
			<ScrollView
				style={styles.scrollContainer}
				contentContainerStyle={styles.scrollContentContainer}
				showsVerticalScrollIndicator={true}
				keyboardShouldPersistTaps="handled"
				bounces={true}
			>
				<View style={styles.content}>
					<View style={styles.fieldContainer}>
						<Text style={styles.label}>
							{loc.t('quantityUpdate.productName')}
						</Text>
						<TextInput
							style={[styles.input, !isEditMode && styles.disabledInput]}
							value={formData.name}
							onChangeText={(value) => updateFormData('name', value)}
							placeholder={loc.t('quantityUpdate.enterProductName')}
							placeholderTextColor="#888888"
							editable={isEditMode}
						/>
					</View>

					<View style={styles.rowContainer}>
						<View style={styles.halfFieldContainer}>
							<Text style={styles.label}>
								{loc.t('quantityUpdate.variantName')}
							</Text>
							<TextInput
								style={[styles.input, !isEditMode && styles.disabledInput]}
								value={formData.variantName}
								onChangeText={(value) => updateFormData('variantName', value)}
								placeholder={loc.t('quantityUpdate.enterVariantName')}
								placeholderTextColor="#888888"
								editable={isEditMode}
							/>
						</View>

						<View style={styles.halfFieldContainer}>
							<Text style={styles.label}>
								{loc.t('quantityUpdate.variantCode')}
							</Text>
							<TextInput
								style={[styles.input, !isEditMode && styles.disabledInput]}
								value={formData.variantCode}
								onChangeText={(value) => {
									// Only allow numeric input
									const numericValue = value.replace(/[^0-9]/g, '')
									updateFormData('variantCode', numericValue)
								}}
								placeholder={loc.t('quantityUpdate.enterVariantCode')}
								placeholderTextColor="#888888"
								keyboardType="numeric"
								editable={isEditMode}
							/>
						</View>
					</View>

					<View style={styles.rowContainer}>
						<View style={styles.halfFieldContainer}>
							<Text style={styles.label}>
								{loc.t('quantityUpdate.totalStock')}
							</Text>
							<TextInput
								style={[styles.input, styles.disabledInput]}
								value={translateNumber(
									product?.totalProducts?.toString() || '0'
								)}
								editable={false}
							/>
						</View>

						<View style={styles.halfFieldContainer}>
							<Text style={styles.label}>
								{loc.t('quantityUpdate.packSize')}
							</Text>
							<TextInput
								style={[styles.input, !isEditMode && styles.disabledInput]}
								value={formData.packOf}
								onChangeText={(value) => updateFormData('packOf', value)}
								placeholder="1"
								placeholderTextColor="#888888"
								keyboardType="numeric"
								editable={isEditMode}
							/>
						</View>
					</View>

					<View style={styles.rowContainer}>
						<View style={styles.halfFieldContainer}>
							<Text style={styles.label}>
								{loc.t('quantityUpdate.lowStockAlertLevel')}
							</Text>
							<TextInput
								style={[styles.input, !isEditMode && styles.disabledInput]}
								value={formData.lowStock}
								onChangeText={(value) => updateFormData('lowStock', value)}
								placeholder="0"
								placeholderTextColor="#888888"
								keyboardType="numeric"
								editable={isEditMode}
							/>
						</View>

						<View style={styles.halfFieldContainer}>
							<Text style={styles.label}>
								{loc.t('quantityUpdate.lowStockSMS')}
							</Text>
							{isEditMode ? (
								<View style={[styles.input, styles.switchContainer]}>
									<Switch
										value={formData.lowStockSMS}
										onValueChange={(value) =>
											updateFormData('lowStockSMS', value)
										}
										trackColor={{ false: '#d3d3d3', true: '#195FE1' }}
										thumbColor={formData.lowStockSMS ? '#ffffff' : '#f4f3f4'}
									/>
								</View>
							) : (
								<View
									style={[
										styles.input,
										styles.disabledInput,
										styles.switchContainer,
									]}
								>
									<Text style={styles.switchText}>
										{formData.lowStockSMS
											? loc.t('quantityUpdate.on')
											: loc.t('quantityUpdate.off')}
									</Text>
								</View>
							)}
						</View>
					</View>

					<View style={styles.fieldContainer}>
						<Text style={styles.label}>
							{loc.t('quantityUpdate.notifyAfterNotSoldDays')}
						</Text>
						<TextInput
							style={[styles.input, !isEditMode && styles.disabledInput]}
							value={formData.notifyAfterNotSold}
							onChangeText={(value) =>
								updateFormData('notifyAfterNotSold', value)
							}
							placeholder="30"
							placeholderTextColor="#888888"
							keyboardType="numeric"
							editable={isEditMode}
						/>
					</View>

					<View style={styles.fieldContainer}>
						<Text style={styles.label}>
							{loc.t('quantityUpdate.notifyBeforeExpiry')}
						</Text>
						<TextInput
							style={[styles.input, !isEditMode && styles.disabledInput]}
							value={formData.notifyBeforeExp}
							onChangeText={(value) => updateFormData('notifyBeforeExp', value)}
							placeholder="7"
							placeholderTextColor="#888888"
							keyboardType="numeric"
							editable={isEditMode}
						/>
					</View>
				</View>

				{/* Analytics Component */}
				<VariantAnalytics product={product} key={product?.id} />

				{/* Static Action Buttons */}
				<View style={styles.staticButtonContainer}>
					{!isEditMode ? (
						<>
							<TouchableOpacity
								onPress={() => handleShowLots()}
								style={[styles.button, styles.showLotsButton]}
							>
								<Text style={styles.buttonText}>
									{loc.t('quantityUpdate.showLots')}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.button, styles.editButton]}
								onPress={() => setIsEditMode(true)}
							>
								<Text style={styles.editButtonText}>
									{loc.t('quantityUpdate.edit')}
								</Text>
							</TouchableOpacity>
						</>
					) : (
						<>
							<TouchableOpacity
								style={[styles.button, styles.cancelButton]}
								onPress={() => setIsEditMode(false)}
							>
								<Text style={styles.cancelButtonText}>
									{loc.t('quantityUpdate.cancel')}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.button, styles.saveButton]}
								onPress={handleSubmit}
								activeOpacity={0.8}
							>
								<Text style={styles.buttonText}>
									{loc.t('quantityUpdate.update')}
								</Text>
							</TouchableOpacity>
						</>
					)}
				</View>
			</ScrollView>

			{lotSelectorVisible && (
				<LotSelector
					lots={productLots}
					variant={product}
					handleLotSelection={(lot) => {
						setLotSelectorVisible(false)
					}}
					cancelScanFlow={() => setLotSelectorVisible(false)}
					showInfo={true}
					refreshOnChange={fetchUpdatedProductData}
					closeAfterUpdate={true}
				/>
			)}

			{/* Close Confirmation Modal */}
			<CloseModal
				visible={showCloseModal}
				title={loc.t('quantityUpdate.discardChanges') || 'Discard Changes'}
				subtitle={
					loc.t('quantityUpdate.sureToClose') ||
					'Are you sure you want to close?'
				}
				onClose={() => setShowCloseModal(false)}
				onConfirm={() => {
					setShowCloseModal(false)
					router.back() // ← Changed from router.navigate('/home/inventory/details')
				}}
			/>
			{/* Error Modal */}
			<ErrorModal
				visible={showErrorModal}
				title={loc.t('quantityUpdate.validationError') || 'Validation Error'}
				subtitle={errorMessage}
				onClose={() => setShowErrorModal(false)}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F0F8FF',
	},
	header: {
		backgroundColor: '#6592E5',
		paddingTop: 40,
		paddingBottom: 16,
		paddingHorizontal: 16,
	},
	headerContent: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	backButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 12,
	},
	headerTitleContainer: {
		flex: 1,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#FFFFFF',
	},
	scrollContainer: {
		flex: 1,
	},
	scrollContentContainer: {
		flexGrow: 1,
		paddingBottom: 4,
	},
	content: {
		padding: 16,
	},
	fieldContainer: {
		marginBottom: 16,
		position: 'relative',
		paddingTop: 8,
	},
	rowContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 16,
		gap: 8,
	},
	halfFieldContainer: {
		flex: 1,
		position: 'relative',
		paddingTop: 8,
	},
	label: {
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
	input: {
		padding: 12,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		borderRadius: 8,
		backgroundColor: '#FFFFFF',
		fontSize: 16,
		color: '#111827',
		minHeight: 44,
	},
	disabledInput: {
		backgroundColor: '#F3F4F6',
		color: '#000000',
	},
	switchContainer: {
		justifyContent: 'center',
		alignItems: 'flex-start',
	},
	switchText: {
		fontSize: 16,
		color: '#111827',
		fontWeight: '500',
	},
	infoCard: {
		backgroundColor: '#F9FAFB',
		padding: 16,
		borderRadius: 8,
		marginBottom: 16,
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	infoTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#111827',
		marginBottom: 12,
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	infoLabel: {
		color: '#6B7280',
		fontSize: 14,
	},
	infoValue: {
		color: '#111827',
		fontSize: 14,
		fontWeight: '500',
	},
	checkboxContainer: {
		gap: 12,
	},
	checkboxItem: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		padding: 12,
	},
	checkboxTextContainer: {
		marginLeft: 12,
		flex: 1,
	},
	checkboxLabel: {
		color: '#111827',
		fontSize: 16,
		fontWeight: '500',
	},
	checkboxDescription: {
		color: '#6B7280',
		fontSize: 12,
		marginTop: 2,
	},
	staticButtonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
		paddingHorizontal: 16,
	},
	button: {
		padding: 14,
		borderRadius: 8,
		flex: 1,
		alignItems: 'center',
	},
	editButton: {
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#195FE1',
	},
	cancelButton: {
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#195FE1',
	},
	saveButton: {
		backgroundColor: '#3B82F6',
	},
	showLotsButton: {
		backgroundColor: '#195FE1',
	},
	buttonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 16,
	},
	cancelButtonText: {
		color: '#195FE1',
		fontWeight: '600',
		fontSize: 16,
	},
	editButtonText: {
		color: '#195FE1',
		fontWeight: '600',
		fontSize: 16,
	},
})
