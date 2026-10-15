import React, { useMemo, useState, useEffect } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Modal,
	TouchableWithoutFeedback,
	BackHandler,
	KeyboardAvoidingView,
	Platform,
} from 'react-native'
import * as Yup from 'yup'
import { Formik } from 'formik'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { useProductOptions } from '../../hooks/useProductOptions'
import {
	displayLocalizedNumber,
	handleNumericInput,
} from '../../utils/numberInput'
import { numberTransform } from '../../utils/yupHelpers'
import { cleanString } from '../CleanString'
import { convertToEnglishNumbers } from '../translateNumber'
import { CloseModal, ErrorModal } from '../AlertModal.jsx'
import ProductFormSheet from './ProductFormSheet'

export default function QuickEntryForm({
	visible,
	initialValues = {},
	onSubmit,
	onClose,
	onDismiss,
	onEditFullForm,
	sheetRef,
}) {
	const { loc } = useLocalization()
	const { toEnglishNumbers } = useNumberTranslator()
	const { findMatchingUnit } = useProductOptions()

	const [showValidationModal, setShowValidationModal] = useState(false)
	const [showBarcodeModal, setShowBarcodeModal] = useState(false)
	const [pendingValues, setPendingValues] = useState(null)
	const [showCloseModal, setShowCloseModal] = useState(false)
	const [validationErrors, setValidationErrors] = useState([])
	const [showErrorModal, setShowErrorModal] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')

	const snapPoints = useMemo(() => ['90%'], [])

	const productName = initialValues.product?.productName || ''
	const variantName = initialValues.variant?.variantName || ''

	// Replicates productForm defaultValues construction
	const defaultValues = useMemo(
		() => ({
			name: initialValues.product?.productName || '',
			productImages: initialValues.product?.images || '',
			barcode: initialValues.product?.barcode || '',
			genericName: initialValues.product?.genericName || '',
			productID: initialValues.product?.id || '',
			category: initialValues.product?.category || 'OTHER',
			variantId: initialValues.variant?.id || '',
			measuringUnit:
				findMatchingUnit(initialValues.product?.measuringUnit) || 'Piece (pc)',
			variantName: initialValues.variant?.variantName || '',
			variantCode: initialValues.variant?.variantCode || '',
			packOf: initialValues.variant?.packOf || 1,
			lowStock: initialValues.variant?.lowStock || '',
			lowStockSMS:
				initialValues.variant?.lowStockSMS ||
				initialValues.variant?.lowStockSMAS ||
				false,
			notifyBeforeExp: initialValues.variant?.notifyBeforeExp || '',
			notifyAfterNotSold: initialValues.variant?.notifyAfterNotSold || '',
			lot: {
				stock: '',
				mrp: initialValues.lot?.mrp?.toString() || '',
				isMRPDefault: initialValues.lot?.isMRPDefault ?? true,
				retail: initialValues.lot?.retail?.toString() || '',
				includeVAT: initialValues.lot?.includeVAT ?? true,
				buyPrice: initialValues.lot?.buyPrice?.toString() || '',
				sellPrice: initialValues.lot?.sellPrice?.toString() || '',
				vat: initialValues.lot?.vat?.toString() || '',
				mfgDate: '',
				expDate: '',
				locationAtStore: initialValues.lot?.locationAtStore || '',
				note: initialValues.lot?.note || '',
			},
			supplierId: '',
		}),
		[initialValues, findMatchingUnit]
	)

	const quickEntryValidationSchema = useMemo(
		() =>
			Yup.object().shape({
				stock: Yup.number()
					.transform(numberTransform(toEnglishNumbers, undefined))
					.required(
						loc.t('productForm.errors.stockRequired') ||
							'Stock quantity is required'
					)
					.min(
						0,
						loc.t('productForm.errors.stockMin') || 'Stock must be 0 or greater'
					),
			}),
		[loc, toEnglishNumbers]
	)

	const validationSchema = useMemo(
		() =>
			Yup.object().shape({
				productID: Yup.string().optional(),
				variantId: Yup.string().optional(),
				name: Yup.string()
					.required(
						loc.t('productForm.errors.nameRequired') ||
							'Product name is required'
					)
					.min(1),
				category: Yup.string().required(
					loc.t('productForm.errors.categoryRequired') || 'Category is required'
				),
				barcode: Yup.string().optional(),
				genericName: Yup.string().optional(),
				measuringUnit: Yup.string().required(
					loc.t('productForm.errors.measuringUnitRequired') ||
						'Measuring unit is required'
				),
				variantName: Yup.string().required(
					loc.t('productForm.errors.variantNameRequired') ||
						'Variant name is required'
				),
				variantCode: Yup.string().optional(),
				packOf: Yup.number()
					.transform(numberTransform(toEnglishNumbers, 1))
					.integer()
					.min(1)
					.default(1),
				lowStock: Yup.number()
					.transform(numberTransform(toEnglishNumbers, undefined))
					.integer()
					.min(0)
					.optional(),
				lowStockSMS: Yup.boolean().optional(),
				notifyBeforeExp: Yup.number()
					.transform(numberTransform(toEnglishNumbers, undefined))
					.integer()
					.min(0)
					.optional(),
				notifyAfterNotSold: Yup.number()
					.transform(numberTransform(toEnglishNumbers, undefined))
					.integer()
					.min(0)
					.optional(),
				lot: Yup.object().shape({
					stock: Yup.number()
						.transform(numberTransform(toEnglishNumbers, undefined))
						.required(
							loc.t('productForm.errors.stockRequired') ||
								'Stock quantity is required'
						)
						.min(0),
					mrp: Yup.number()
						.transform(numberTransform(toEnglishNumbers, undefined))
						.required(
							loc.t('productForm.errors.mrpRequired') || 'MRP is required'
						)
						.min(0),
					isMRPDefault: Yup.boolean().default(true),
					retail: Yup.number()
						.transform(numberTransform(toEnglishNumbers, undefined))
						.required(
							loc.t('productForm.errors.retailRequired') ||
								'Retail price is required'
						)
						.min(0),
					includeVAT: Yup.boolean().default(true),
					buyPrice: Yup.number()
						.transform(numberTransform(toEnglishNumbers, undefined))
						.required(
							loc.t('productForm.errors.buyPriceRequired') ||
								'Buying price is required'
						)
						.min(0),
					sellPrice: Yup.number()
						.transform(numberTransform(toEnglishNumbers, undefined))
						.required(
							loc.t('productForm.errors.sellPriceRequired') ||
								'Selling price is required'
						)
						.min(0),
					vat: Yup.number()
						.transform(numberTransform(toEnglishNumbers, undefined))
						.min(0)
						.max(100)
						.optional(),
					mfgDate: Yup.string().optional(),
					expDate: Yup.string().optional(),
					locationAtStore: Yup.string().optional(),
					note: Yup.string().optional(),
				}),
				supplierId: Yup.string().nullable().optional(),
			}),
		[loc, toEnglishNumbers]
	)

	const trimFormData = (data, currentKey = '') => {
		if (typeof data === 'string') {
			if (currentKey === 'note') return data
			return cleanString(data)
		}
		if (Array.isArray(data)) return data.map((item) => trimFormData(item))
		if (data !== null && typeof data === 'object')
			return Object.entries(data).reduce((acc, [key, value]) => {
				acc[key] = trimFormData(value, key)
				return acc
			}, {})
		return data
	}

	const processFormSubmission = (values) => {
		const trimmedValues = trimFormData(values)
		const convertedValues = {
			...trimmedValues,
			variantCode: convertToEnglishNumbers(
				trimmedValues.variantCode?.toString() || ''
			),
			lot: {
				...trimmedValues.lot,
				stock:
					parseFloat(
						convertToEnglishNumbers(trimmedValues.lot.stock?.toString() || '0')
					) || 0,
				mrp:
					parseFloat(
						convertToEnglishNumbers(trimmedValues.lot.mrp?.toString() || '0')
					) || 0,
				retail:
					parseFloat(
						convertToEnglishNumbers(trimmedValues.lot.retail?.toString() || '0')
					) || 0,
				buyPrice:
					parseFloat(
						convertToEnglishNumbers(
							trimmedValues.lot.buyPrice?.toString() || '0'
						)
					) || 0,
				sellPrice:
					parseFloat(
						convertToEnglishNumbers(
							trimmedValues.lot.sellPrice?.toString() || '0'
						)
					) || 0,
				vat: trimmedValues.lot.vat
					? parseFloat(
							convertToEnglishNumbers(trimmedValues.lot.vat?.toString() || '0')
						)
					: undefined,
				mfgDate: convertToEnglishNumbers(trimmedValues.lot.mfgDate || ''),
				expDate: convertToEnglishNumbers(trimmedValues.lot.expDate || ''),
			},
			packOf:
				parseInt(
					convertToEnglishNumbers(trimmedValues.packOf?.toString() || '1')
				) || 1,
			lowStock: trimmedValues.lowStock
				? parseInt(
						convertToEnglishNumbers(trimmedValues.lowStock?.toString() || '0')
					)
				: undefined,
			notifyBeforeExp: trimmedValues.notifyBeforeExp
				? parseInt(
						convertToEnglishNumbers(
							trimmedValues.notifyBeforeExp?.toString() || '0'
						)
					)
				: undefined,
			notifyAfterNotSold: trimmedValues.notifyAfterNotSold
				? parseInt(
						convertToEnglishNumbers(
							trimmedValues.notifyAfterNotSold?.toString() || '0'
						)
					)
				: undefined,
		}
		const filteredTopLevel = Object.fromEntries(
			Object.entries(convertedValues).filter(
				([key, value]) => value !== '' && key !== 'lot'
			)
		)
		let filteredLot = {}
		if (convertedValues.lot && typeof convertedValues.lot === 'object')
			filteredLot = Object.fromEntries(
				Object.entries(convertedValues.lot).filter(
					([_, value]) => value !== '' && value !== undefined
				)
			)
		const filteredValues = {
			...filteredTopLevel,
			...(Object.keys(filteredLot).length > 0 && { lot: filteredLot }),
		}
		onSubmit(filteredValues)
	}

	const handleQuickEntrySubmit = async (stockValue) => {
		const englishStock =
			parseFloat(convertToEnglishNumbers(stockValue?.toString() || '0')) || 0
		const mergedValues = {
			...defaultValues,
			lot: { ...defaultValues.lot, stock: englishStock },
		}
		try {
			await validationSchema.validate(mergedValues, { abortEarly: false })
			if (!mergedValues.barcode || mergedValues.barcode.trim() === '') {
				setPendingValues(mergedValues)
				setShowBarcodeModal(true)
				return
			}
			processFormSubmission(mergedValues)
		} catch (error) {
			if (error.inner && Array.isArray(error.inner))
				setValidationErrors(
					error.inner.map((err) => ({ path: err.path, message: err.message }))
				)
			else
				setValidationErrors([
					{ path: error.path || 'unknown', message: error.message },
				])
			setShowValidationModal(true)
		}
	}

	const handleBarcodeConfirm = () => {
		setShowBarcodeModal(false)
		if (pendingValues) {
			processFormSubmission(pendingValues)
			setPendingValues(null)
		}
	}
	const handleBarcodeCancel = () => {
		setShowBarcodeModal(false)
		setPendingValues(null)
	}

	useEffect(() => {
		if (!visible) return
		const handler = BackHandler.addEventListener('hardwareBackPress', () => {
			setShowCloseModal(true)
			return true
		})
		return () => handler.remove()
	}, [visible])

	if (!visible) return null

	return (
		<>
			<ProductFormSheet
				ref={sheetRef}
				visible={visible}
				snapPoints={snapPoints}
				onClose={() => setShowCloseModal(true)}
				onDismiss={onDismiss}
				title={loc.t('productForm.modalTitle')}
			>
				<KeyboardAvoidingView
					style={styles.keyboardAvoidingView}
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
					keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
				>
					<BottomSheetScrollView
						showsVerticalScrollIndicator={false}
						// keep the fields and the buttons above the open keyboard
						bounces={true}
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={styles.scrollContent}
					>
						<Formik
							initialValues={{ stock: '' }}
							validationSchema={quickEntryValidationSchema}
							onSubmit={(values) => handleQuickEntrySubmit(values.stock)}
						>
							{({
								values,
								setFieldValue,
								handleSubmit: quickSubmit,
								errors,
								touched,
								handleBlur,
							}) => (
								<View style={styles.quickEntryContainer}>
									<View style={styles.fieldContainer}>
										<Text style={styles.overlayLabel}>
											{loc.t('productForm.productName')}
										</Text>
										<TextInput
											value={productName}
											editable={false}
											style={[styles.input, styles.disabledInput]}
											placeholderTextColor="rgba(0,0,0,0.54)"
										/>
									</View>
									<View style={styles.fieldContainer}>
										<Text style={styles.overlayLabel}>
											{loc.t('productForm.variantName')}
										</Text>
										<TextInput
											value={variantName}
											editable={false}
											style={[styles.input, styles.disabledInput]}
											placeholderTextColor="rgba(0,0,0,0.54)"
										/>
									</View>
									<View style={styles.fieldContainer}>
										<Text style={styles.overlayLabel}>
											{loc.t('productForm.quantity')} *
										</Text>
										<TextInput
											value={displayLocalizedNumber(values.stock)}
											onChangeText={(value) =>
												handleNumericInput(value, setFieldValue, 'stock')
											}
											onBlur={handleBlur('stock')}
											placeholder={loc.t('productForm.quantity')}
											placeholderTextColor="rgba(0,0,0,0.54)"
											keyboardType="numeric"
											style={styles.input}
											autoFocus
											returnKeyType="done"
											onSubmitEditing={quickSubmit}
										/>
										{errors.stock && touched.stock && (
											<Text style={styles.errorText}>{errors.stock}</Text>
										)}
									</View>
									<View style={styles.mandatoryNotice}>
										<Text style={styles.mandatoryText}>
											<Text style={styles.asterisk}>* </Text>
											{loc.t('productForm.mandatoryFieldsNotice')}
										</Text>
									</View>
									<View style={styles.quickEntryButtonContainer}>
										<TouchableOpacity
											style={[styles.quickEntryButton, styles.editButton]}
											onPress={onEditFullForm}
											activeOpacity={0.8}
										>
											<Text style={styles.editButtonText}>
												{loc.t('productForm.editDetails') || 'Edit'}
											</Text>
										</TouchableOpacity>
										<TouchableOpacity
											style={[styles.quickEntryButton, styles.saveButton]}
											onPress={quickSubmit}
											activeOpacity={0.8}
										>
											<Text style={styles.buttonText}>
												{loc.t('productForm.save')}
											</Text>
										</TouchableOpacity>
									</View>
								</View>
							)}
						</Formik>
					</BottomSheetScrollView>
				</KeyboardAvoidingView>
			</ProductFormSheet>

			<Modal
				visible={showValidationModal}
				transparent
				animationType="fade"
				onRequestClose={() => setShowValidationModal(false)}
			>
				<TouchableWithoutFeedback onPress={() => setShowValidationModal(false)}>
					<View style={styles.modalBackdrop}>
						<TouchableWithoutFeedback onPress={() => {}}>
							<View style={styles.alertModalContent}>
								<MaterialIcons
									name="warning"
									size={48}
									color="#EF4444"
									style={styles.alertIcon}
								/>
								<Text style={styles.alertTitle}>
									{loc.t('productForm.validationError') || 'Validation Error'}
								</Text>
								{validationErrors.length > 0 ? (
									<View style={styles.errorListContainer}>
										{validationErrors.map((error, index) => (
											<Text key={index} style={styles.alertSubtitle}>
												• {error.message}
											</Text>
										))}
									</View>
								) : (
									<Text style={styles.alertSubtitle}>
										{loc.t('productForm.fillAllMandatoryFields') ||
											'Please fill up all mandatory fields before saving.'}
									</Text>
								)}
								<View style={styles.singleButtonContainer}>
									<TouchableOpacity
										style={styles.alertOkayButton}
										onPress={() => setShowValidationModal(false)}
										activeOpacity={0.8}
									>
										<Text style={styles.alertOkayButtonText}>
											{loc.t('productForm.okay') || 'Okay'}
										</Text>
									</TouchableOpacity>
								</View>
							</View>
						</TouchableWithoutFeedback>
					</View>
				</TouchableWithoutFeedback>
			</Modal>

			<Modal
				visible={showBarcodeModal}
				transparent
				animationType="fade"
				onRequestClose={handleBarcodeCancel}
			>
				<TouchableWithoutFeedback onPress={handleBarcodeCancel}>
					<View style={styles.modalBackdrop}>
						<TouchableWithoutFeedback onPress={() => {}}>
							<View style={styles.alertModalContent}>
								<MaterialIcons
									name="warning"
									size={48}
									color="#F59E0B"
									style={styles.alertIcon}
								/>
								<Text style={styles.alertTitle}>
									{loc.t('productForm.barcodeWarning') || 'Barcode Warning'}
								</Text>
								<Text style={styles.alertSubtitle}>
									{loc.t('productForm.savingWithoutBarcode') ||
										'You are saving this product without a barcode. Do you want to proceed?'}
								</Text>
								<View style={styles.alertButtonContainer}>
									<TouchableOpacity
										style={styles.alertCancelButton}
										onPress={handleBarcodeCancel}
										activeOpacity={0.8}
									>
										<Text style={styles.alertCancelButtonText}>
											{loc.t('productForm.no') || 'No'}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={styles.alertConfirmButton}
										onPress={handleBarcodeConfirm}
										activeOpacity={0.8}
									>
										<Text style={styles.alertConfirmButtonText}>
											{loc.t('productForm.yes') || 'Yes'}
										</Text>
									</TouchableOpacity>
								</View>
							</View>
						</TouchableWithoutFeedback>
					</View>
				</TouchableWithoutFeedback>
			</Modal>

			<CloseModal
				visible={showCloseModal}
				title={loc.t('productForm.discardChanges') || 'Discard Changes'}
				subtitle={
					loc.t('productForm.sureToClose') || 'Are you sure you want to close?'
				}
				onClose={() => setShowCloseModal(false)}
				onConfirm={() => {
					setShowCloseModal(false)
					onClose()
				}}
			/>
			<ErrorModal
				visible={showErrorModal}
				title={loc.t('productForm.error') || 'Error'}
				subtitle={errorMessage}
				onClose={() => setShowErrorModal(false)}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	keyboardAvoidingView: { flex: 1 },
	scrollContent: { flexGrow: 1, paddingBottom: 40 },
	quickEntryContainer: { padding: 16, paddingTop: 8 },
	fieldContainer: { paddingTop: 8, marginBottom: 8 },
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
	input: {
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		fontSize: 16,
		color: '#333333',
		height: 44,
	},
	disabledInput: { backgroundColor: '#f5f5f5' },
	errorText: { color: '#ff0033', fontSize: 12, marginTop: 2, marginBottom: 4 },
	mandatoryNotice: { marginTop: 4, marginBottom: 8, paddingHorizontal: 4 },
	mandatoryText: {
		fontSize: 12,
		color: '#195FE1',
		textAlign: 'center',
		fontStyle: 'italic',
	},
	asterisk: { color: '#195FE1', fontWeight: 'bold' },
	quickEntryButtonContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 12,
		marginTop: 8,
		paddingHorizontal: 28,
		paddingBottom: 8,
	},
	quickEntryButton: {
		padding: 14,
		borderRadius: 24,
		width: '50%',
		alignItems: 'center',
	},
	editButton: {
		backgroundColor: '#FFFFFF',
		borderWidth: 1.5,
		borderColor: '#195FE1',
	},
	editButtonText: { color: '#195FE1', fontWeight: '600', fontSize: 16 },
	saveButton: { backgroundColor: '#195FE1' },
	buttonText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	alertModalContent: {
		backgroundColor: '#F0F8FF',
		borderRadius: 12,
		padding: 24,
		width: '100%',
		maxWidth: 340,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	alertIcon: { marginBottom: 16 },
	alertTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#1F2937',
		textAlign: 'center',
		marginBottom: 8,
	},
	alertSubtitle: {
		fontSize: 14,
		color: '#6B7280',
		textAlign: 'center',
		marginBottom: 24,
		lineHeight: 20,
	},
	errorListContainer: { width: '100%', marginBottom: 24, maxHeight: 300 },
	alertButtonContainer: { flexDirection: 'row', width: '100%', gap: 12 },
	singleButtonContainer: { width: '100%' },
	alertOkayButton: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 44,
		marginBottom: 12,
		backgroundColor: '#3B82F6',
	},
	alertOkayButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
	alertCancelButton: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 44,
		backgroundColor: '#6B7280',
	},
	alertCancelButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
	alertConfirmButton: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 44,
		backgroundColor: '#3B82F6',
	},
	alertConfirmButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
})
