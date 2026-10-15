import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Switch,
	StyleSheet,
	TouchableWithoutFeedback,
	KeyboardAvoidingView,
	Platform,
	BackHandler,
	Modal,
} from 'react-native'
import * as Yup from 'yup'
import { Formik, useField } from 'formik'
import { Dropdown } from 'react-native-element-dropdown'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { useProductOptions } from '../../hooks/useProductOptions'
import { useSuppliers } from '../../hooks/useSuppliers'
import { cleanString } from '../CleanString'
import { CloseModal, ErrorModal } from '../AlertModal.jsx'
import DateTimePicker from '@react-native-community/datetimepicker'
import {
	convertToEnglishNumbers,
	convertToBengaliNumbers,
} from '../translateNumber'
import {
	displayLocalizedNumber,
	handleNumericInput,
} from '../../utils/numberInput'
import { numberTransform } from '../../utils/yupHelpers'
import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import ProductFormSheet from './ProductFormSheet'

const AVATAR_COLORS = [
	'#1f2937',
	'#7c2d12',
	'#be123c',
	'#a21caf',
	'#7c3aed',
	'#2563eb',
	'#0891b2',
	'#059669',
	'#ca8a04',
	'#dc2626',
	'#9333ea',
	'#0d9488',
]
function getAvatarColor(name) {
	let h = 0
	for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
	return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

// Parse a stored "DD/MM/YYYY" string back into a Date object for the
// DateTimePicker. Returns null on bad input so the picker can fall back to now.
function parseStoredDate(dateString) {
	if (!dateString || typeof dateString !== 'string') return null
	const match = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
	if (!match) return null
	const day = parseInt(match[1], 10)
	const month = parseInt(match[2], 10) - 1
	const year = parseInt(match[3], 10)
	if (isNaN(day) || isNaN(month) || isNaN(year) || month < 0 || month > 11)
		return null
	const d = new Date(year, month, day)
	return isNaN(d.getTime()) ? null : d
}

// Inner Formik-aware date field. Uses useField so setValue is stable.
// Does NOT render the DateTimePicker itself — instead it asks the parent
// (via the openPicker prop) to show the picker at the root of
// FullProductForm, OUTSIDE the bottom sheet. The bottom sheet's pan/tap
// gesture handlers otherwise intercept the picker wheel gestures on
// Android, which made the picker always return today's date.
function DateField({ name, label, formatDateDisplayLocal, minDate, maxDate, openPicker }) {
	const [field, meta] = useField({ name })
	const stored = parseStoredDate(field.value)
	const showError = meta.touched && !!meta.error
	const requestOpen = () => {
		openPicker({
			name,
			initialDate: stored || new Date(),
			minDate: minDate || null,
			maxDate: maxDate || null,
		})
	}
	return (
		<View style={styles.halfField}>
			<Text style={styles.overlayLabel}>{label}</Text>
			<TouchableOpacity
				style={[styles.input, styles.datePickerButton]}
				onPress={requestOpen}
			>
				<Text
					style={
						field.value ? styles.datePickerText : styles.datePickerPlaceholder
					}
				>
					{formatDateDisplayLocal(field.value)}
				</Text>
				<Text style={styles.calendarIcon}>📅</Text>
			</TouchableOpacity>
			{showError && <Text style={styles.errorText}>{meta.error}</Text>}
		</View>
	)
}

// Bridge component that lives inside the Formik tree and registers a
// setter callback with the parent. The parent can then call the setter
// (from the root-level DateTimePicker's onChange) to write back into
// whichever Formik field is active. We register one setter per active
// field name.
function FormikFieldSetter({ fieldName, registerSetter }) {
	const [, , helpers] = useField({ name: fieldName })
	useEffect(() => {
		registerSetter(fieldName, helpers.setValue)
		return () => registerSetter(fieldName, null)
	}, [fieldName, helpers, registerSetter])
	return null
}

export default function FullProductForm({
	visible,
	initialValues = {},
	onSubmit,
	onClose,
	onDismiss,
	sheetRef,
}) {
	const { loc } = useLocalization()
	const { toEnglishNumbers } = useNumberTranslator()
	const { findMatchingUnit } = useProductOptions()
	const { suppliers: allSuppliers, error: supplierError } = useSuppliers()

	const [isSupplierFocus, setIsSupplierFocus] = useState(false)
	const [showValidationModal, setShowValidationModal] = useState(false)
	const [showBarcodeModal, setShowBarcodeModal] = useState(false)
	const [pendingValues, setPendingValues] = useState(null)
	const [showCloseModal, setShowCloseModal] = useState(false)
	const [showErrorModal, setShowErrorModal] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')
	const [validationErrors, setValidationErrors] = useState([])

	// Date picker state. The picker is rendered at the ROOT of this
	// component (sibling to <ProductFormSheet>), not inside the bottom
	// sheet. Otherwise the sheet's gesture handlers intercept touches
	// on the picker wheels on Android and the picker always reports
	// "today".
	const [activePicker, setActivePicker] = useState(null)
	const fieldSettersRef = useRef({})
	const registerSetter = useCallback((fieldName, setter) => {
		if (setter) fieldSettersRef.current[fieldName] = setter
		else delete fieldSettersRef.current[fieldName]
	}, [])
	const openPicker = useCallback((req) => setActivePicker(req), [])
	const closePicker = useCallback(() => setActivePicker(null), [])
	const handlePickerChange = useCallback(
		(event, selectedDate) => {
			if (event?.type === 'dismissed' || !selectedDate) {
				closePicker()
				return
			}
			const day = selectedDate.getDate().toString().padStart(2, '0')
			const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0')
			const year = selectedDate.getFullYear()
			const formattedDate = `${day}/${month}/${year}`
			const setter = fieldSettersRef.current[activePicker?.name]
			if (setter) {
				setter(formattedDate, true)
			}
			closePicker()
		},
		[activePicker, closePicker]
	)

	useEffect(() => {
		if (!visible) return
		const handler = BackHandler.addEventListener('hardwareBackPress', () => {
			setShowCloseModal(true)
			return true
		})
		return () => handler.remove()
	}, [visible])

	const snapPoints = useMemo(() => ['95%'], [])

	const validateDate = (dateString) => {
		if (!dateString) return true
		const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/
		const match = dateString.match(dateRegex)
		if (!match) return false
		const [, day, month, year] = match
		const dayNum = parseInt(day, 10)
		const monthNum = parseInt(month, 10)
		const yearNum = parseInt(year, 10)
		if (monthNum < 1 || monthNum > 12) return false
		const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
		if (dayNum < 1 || dayNum > daysInMonth) return false
		return true
	}

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
				notSoldSMS: Yup.boolean().optional(),
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
					mfgDate: Yup.string()
						.test(
							'is-valid-date',
							loc.t('productForm.errors.invalidMfgDate') || 'Invalid',
							function (value) {
								if (!value || value.trim() === '') return true
								return validateDate(value)
							}
						)
						.test(
							'not-future-date',
							loc.t('productForm.errors.mfgDateFuture') || 'Mfg future',
							function (value) {
								if (!value || value.trim() === '') return true
								const [day, month, year] = value.split('/').map(Number)
								const mfgDateObj = new Date(year, month - 1, day)
								const today = new Date()
								today.setHours(0, 0, 0, 0)
								return mfgDateObj <= today
							}
						)
						.optional(),
					expDate: Yup.string()
						.test(
							'is-valid-date',
							loc.t('productForm.errors.invalidExpDate') || 'Invalid',
							function (value) {
								if (!value || value.trim() === '') return true
								return validateDate(value)
							}
						)
						.test(
							'expiry-after-manufacturing',
							loc.t('productForm.errors.expiryBeforeMfg') || 'Exp before mfg',
							function (value) {
								const { mfgDate } = this.parent
								if (!value || !mfgDate) return true
								const parseDateDMY = (dateStr) => {
									const [day, month, year] = dateStr.split('/').map(Number)
									return new Date(year, month - 1, day)
								}
								return parseDateDMY(value) > parseDateDMY(mfgDate)
							}
						)
						.optional(),
					locationAtStore: Yup.string().optional(),
					note: Yup.string().optional(),
				}),
				supplierId: Yup.string().nullable().optional(),
			}),
		[loc, toEnglishNumbers]
	)

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
			lowStockSMS: initialValues.variant?.lowStockSMS || false,
			notifyBeforeExp: initialValues.variant?.notifyBeforeExp || '',
			notifyAfterNotSold: initialValues.variant?.notifyAfterNotSold || '',
			notSoldSMS: initialValues.variant?.notSoldSMS || false,
			lot: {
				stock: '',
				mrp: initialValues.lot?.mrp?.toString() || '',
				isMRPDefault: initialValues.lot?.isMRPDefault ?? true,
				retail: initialValues.lot?.retail?.toString() || '',
				includeVAT: initialValues.lot?.includeVAT ?? true,
				buyPrice: initialValues.lot?.buyPrice?.toString() || '',
				sellPrice: initialValues.lot?.sellPrice?.toString() || '',
				vat: initialValues.lot?.vat?.toString() || '',
				mfgDate: initialValues.lot?.mfgDate
					? (() => {
							try {
								const d = new Date(initialValues.lot.mfgDate)
								if (isNaN(d.getTime())) return ''
								return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
							} catch (e) {
								return ''
							}
						})()
					: '',
				expDate: initialValues.lot?.expDate
					? (() => {
							try {
								const d = new Date(initialValues.lot.expDate)
								if (isNaN(d.getTime())) return ''
								return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
							} catch (e) {
								return ''
							}
						})()
					: '',
				locationAtStore: initialValues.lot?.locationAtStore || '',
				note: initialValues.lot?.note || '',
			},
			supplierId: '',
		}),
		[initialValues, findMatchingUnit]
	)

	const formInitialValues = defaultValues

	const formatDateDisplayLocal = (dateString) => {
		if (!dateString) return loc.t('productForm.selectDate') || 'Select Date'
		const parts = dateString.split('/')
		if (parts.length === 3) {
			const day = convertToBengaliNumbers(parts[0])
			const month = convertToBengaliNumbers(parts[1])
			const year = convertToBengaliNumbers(parts[2])
			return `${day}/${month}/${year}`
		}
		return dateString
	}
	const calculateSellPrice = (retail, vat, includeVAT) => {
		if (!retail) return ''
		const retailNum = parseFloat(retail)
		const vatNum = parseFloat(vat) || 0
		let finalPrice = retailNum
		if (includeVAT && vatNum > 0) finalPrice = retailNum * (1 + vatNum / 100)
		return Math.round(finalPrice * 100) / 100
	}
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
	const handleSubmit = async (values) => {
		try {
			await validationSchema.validate(values, { abortEarly: false })
			if (!values.barcode || values.barcode.trim() === '') {
				setPendingValues(values)
				setShowBarcodeModal(true)
				return
			}
			processFormSubmission(values)
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
				mfgDate: trimmedValues.lot.mfgDate || '',
				expDate: trimmedValues.lot.expDate || '',
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
			notSoldSMS: trimmedValues.notSoldSMS || false,
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
		if (supplierError) {
			setErrorMessage(supplierError)
			setShowErrorModal(true)
		}
	}, [supplierError])

	if (!visible) return null

	const headerProductName =
		defaultValues.name || loc.t('productForm.productName')
	const headerVariantName = defaultValues.variantName
	const headerGenericName = defaultValues.genericName
	const avatarLetter = headerProductName
		? headerProductName.charAt(0).toUpperCase()
		: '?'
	const avatarBg = getAvatarColor(headerProductName || 'product')

	return (
		<>
			<ProductFormSheet
				ref={sheetRef}
				visible={visible}
				snapPoints={snapPoints}
				onClose={() => setShowCloseModal(true)}
				onDismiss={onDismiss}
				title={loc.t('productForm.modalTitle')}
				subtitle={
					headerProductName
						? `${headerProductName}${headerVariantName ? ` [${headerVariantName}]` : ''}`
						: undefined
				}
			>
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
						<Formik
							initialValues={formInitialValues}
							validationSchema={validationSchema}
							onSubmit={handleSubmit}
						>
							{({
								values,
								handleChange,
								handleSubmit: submitForm,
								validateForm,
								setFieldValue,
								errors,
								touched,
								handleBlur,
							}) => {
								const renderError = (fieldName) => {
									const error = errors[fieldName] || errors.lot?.[fieldName]
									const touch = touched[fieldName] || touched.lot?.[fieldName]
									if (error && touch)
										return <Text style={styles.errorText}>{error}</Text>
									return null
								}
								return (
									<View style={styles.container}>
										<View style={styles.detailsSection}>
											{/* Register Formik field setters so the root-level
											    DateTimePicker can write back to whichever
											    date field is active. */}
											<FormikFieldSetter
												fieldName="lot.mfgDate"
												registerSetter={registerSetter}
											/>
											<FormikFieldSetter
												fieldName="lot.expDate"
												registerSetter={registerSetter}
											/>
											<View style={styles.fieldContainer}>
												<Text style={styles.overlayLabel}>
													{loc.t('productForm.supplier')}
												</Text>
												<Dropdown
													data={[
														{
															label: loc.t('productForm.none') || 'None',
															value: null,
															searchableText: '',
														},
														...allSuppliers.map((supplier) => ({
															label: supplier.supplierName,
															value: supplier.supplierId,
															searchableText: `${supplier.supplierName} - ${supplier.number}`,
														})),
													]}
													search
													maxHeight={300}
													labelField="label"
													valueField="value"
													searchField="searchableText"
													placeholder={
														!isSupplierFocus
															? loc.t('productForm.selectSupplier')
															: '...'
													}
													searchPlaceholder={loc.t(
														'productForm.searchSuppliers'
													)}
													value={values.supplierId}
													onFocus={() => setIsSupplierFocus(true)}
													onBlur={() => setIsSupplierFocus(false)}
													onChange={(item) => {
														setFieldValue('supplierId', item.value)
														setIsSupplierFocus(false)
													}}
													style={styles.dropdown}
													placeholderStyle={styles.placeholderStyle}
													selectedTextStyle={styles.selectedTextStyle}
													inputSearchStyle={styles.inputSearchStyle}
													containerStyle={styles.dropdownListContainer}
												/>
											</View>
											<View style={styles.row}>
												<View style={styles.halfField}>
													<Text style={styles.overlayLabel}>
														{loc.t('productForm.buyingPrice')} *
													</Text>
													<TextInput
														placeholder="0.0"
														placeholderTextColor="rgba(0,0,0,0.54)"
														value={displayLocalizedNumber(values.lot.buyPrice)}
														onChangeText={(value) =>
															handleNumericInput(
																value,
																setFieldValue,
																'lot.buyPrice'
															)
														}
														onBlur={handleBlur('lot.buyPrice')}
														keyboardType="numeric"
														style={styles.input}
													/>
													{renderError('buyPrice')}
												</View>
												<View style={styles.halfField}>
													<Text style={styles.overlayLabel}>
														{loc.t('productForm.quantity')} *
													</Text>
													<TextInput
														value={displayLocalizedNumber(values.lot.stock)}
														onChangeText={(value) =>
															handleNumericInput(
																value,
																setFieldValue,
																'lot.stock'
															)
														}
														onBlur={handleBlur('lot.stock')}
														placeholder={loc.t('productForm.quantity')}
														placeholderTextColor="rgba(0,0,0,0.54)"
														keyboardType="numeric"
														style={styles.input}
													/>
													{renderError('stock')}
												</View>
											</View>
											<View style={styles.row}>
												<View style={styles.halfField}>
													<Text style={styles.overlayLabel}>
														{loc.t('productForm.mrp')} *
													</Text>
													<TextInput
														placeholder="0.0"
														placeholderTextColor="rgba(0,0,0,0.54)"
														value={displayLocalizedNumber(values.lot.mrp)}
														onChangeText={(value) =>
															handleNumericInput(
																value,
																setFieldValue,
																'lot.mrp'
															)
														}
														onBlur={handleBlur('lot.mrp')}
														keyboardType="numeric"
														style={styles.input}
													/>
													{renderError('mrp')}
												</View>
												<View style={styles.halfField}>
													<Text style={styles.overlayLabel}>
														{loc.t('productForm.retail')} *
													</Text>
													<TextInput
														placeholder="0.0"
														placeholderTextColor="rgba(0,0,0,0.54)"
														value={displayLocalizedNumber(values.lot.retail)}
														onChangeText={(text) => {
															const englishValue = convertToEnglishNumbers(text)
															setFieldValue('lot.retail', englishValue)
															const sellPrice = calculateSellPrice(
																englishValue,
																values.lot.vat,
																values.lot.includeVAT
															)
															setFieldValue('lot.sellPrice', sellPrice)
														}}
														onBlur={handleBlur('lot.retail')}
														keyboardType="numeric"
														style={styles.input}
													/>
													{renderError('retail')}
												</View>
											</View>
											<View style={styles.row}>
												<View style={styles.halfField}>
													<Text style={styles.overlayLabel}>
														{loc.t('productForm.vat')}
													</Text>
													<TextInput
														placeholder="0"
														placeholderTextColor="rgba(0,0,0,0.54)"
														value={displayLocalizedNumber(values.lot.vat)}
														onChangeText={(text) => {
															const englishValue = convertToEnglishNumbers(text)
															setFieldValue('lot.vat', englishValue)
															const sellPrice = calculateSellPrice(
																values.lot.retail,
																englishValue,
																values.lot.includeVAT
															)
															setFieldValue('lot.sellPrice', sellPrice)
														}}
														onBlur={handleBlur('lot.vat')}
														keyboardType="numeric"
														style={styles.input}
													/>
												</View>
												<View style={styles.halfField}>
													<Text style={styles.overlayLabel}>
														{loc.t('productForm.sellPriceCalculated')}
													</Text>
													<TextInput
														placeholder="0.0"
														placeholderTextColor="rgba(0,0,0,0.54)"
														value={displayLocalizedNumber(values.lot.sellPrice)}
														editable={false}
														style={[styles.input, styles.disabledInput]}
													/>
													{renderError('sellPrice')}
												</View>
											</View>
											<View style={styles.checkboxRow}>
												<View style={styles.checkboxItem}>
													<Switch
														value={values.lot.includeVAT}
														onValueChange={(value) => {
															setFieldValue('lot.includeVAT', value)
															const sellPrice = calculateSellPrice(
																values.lot.retail,
																values.lot.vat,
																value
															)
															setFieldValue('lot.sellPrice', sellPrice)
														}}
													/>
													<Text style={styles.checkboxLabel}>
														{loc.t('productForm.includeVAT')}
													</Text>
												</View>
												<View style={styles.checkboxItem}>
													<Switch
														value={values.lot.isMRPDefault}
														onValueChange={(value) =>
															setFieldValue('lot.isMRPDefault', value)
														}
													/>
													<Text style={styles.checkboxLabel}>
														{loc.t('productForm.defaultPrice')}
													</Text>
												</View>
											</View>

											<View style={styles.divider} />

											<View style={styles.row}>
												<DateField
													name="lot.mfgDate"
													label={loc.t('productForm.manufactureDate')}
													formatDateDisplayLocal={formatDateDisplayLocal}
													maxDate={new Date()}
													openPicker={openPicker}
												/>
												<DateField
													name="lot.expDate"
													label={loc.t('productForm.expiryDate')}
													formatDateDisplayLocal={formatDateDisplayLocal}
													minDate={new Date()}
													openPicker={openPicker}
												/>
											</View>
											<View style={styles.fieldContainer}>
												<Text style={styles.overlayLabel}>
													{loc.t('productForm.productLocation')}
												</Text>
												<TextInput
													placeholder={loc.t('productForm.location')}
													placeholderTextColor="rgba(0,0,0,0.54)"
													value={values.lot.locationAtStore}
													onChangeText={handleChange('lot.locationAtStore')}
													style={styles.input}
												/>
											</View>
											<View style={styles.fieldContainer}>
												<Text style={styles.overlayLabel}>
													{loc.t('productForm.note')}
												</Text>
												<TextInput
													placeholder={loc.t('productForm.additionalNotes')}
													placeholderTextColor="rgba(0,0,0,0.54)"
													value={values.lot.note}
													onChangeText={handleChange('lot.note')}
													multiline
													numberOfLines={3}
													style={[styles.input, styles.multilineInput]}
												/>
											</View>
										</View>

										<View style={styles.mandatoryNotice}>
											<Text style={styles.mandatoryText}>
												<Text style={styles.asterisk}>* </Text>
												{loc.t('productForm.mandatoryFieldsNotice')}
											</Text>
										</View>
										<View style={styles.buttonContainer}>
											<TouchableOpacity
												style={[styles.button, styles.saveButton]}
												onPress={async () => {
													const errors = await validateForm()
													if (Object.keys(errors).length) {
														setShowValidationModal(true)
													} else {
														submitForm()
													}
												}}
											>
												<Text style={styles.buttonText}>
													{loc.t('productForm.save')}
												</Text>
											</TouchableOpacity>
										</View>
									</View>
								)
							}}
						</Formik>
					</BottomSheetScrollView>
				</KeyboardAvoidingView>
			</ProductFormSheet>

			{/* Root-level DateTimePicker. Rendered OUTSIDE the bottom sheet
			    so its native dialog is not intercepted by the sheet's
			    gesture handlers. Driven by activePicker state; writes back
			    to Formik via the registered setter for the active field. */}
			{activePicker && (
				<DateTimePicker
					value={activePicker.initialDate}
					mode="date"
					display="default"
					onChange={handlePickerChange}
					{...(activePicker.minDate
						? { minimumDate: activePicker.minDate }
						: {})}
					{...(activePicker.maxDate
						? { maximumDate: activePicker.maxDate }
						: {})}
				/>
			)}

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
	container: { padding: 16, paddingTop: 8 },
	productInfoCard: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		padding: 12,
		marginHorizontal: 12,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: 'rgba(0,0,0,0.06)',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.06,
		shadowRadius: 3,
		elevation: 2,
	},
	productInfoLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
		gap: 10,
	},
	avatar: {
		width: 42,
		height: 42,
		borderRadius: 21,
		alignItems: 'center',
		justifyContent: 'center',
	},
	avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
	productInfoTexts: { flex: 1 },
	productInfoName: { fontSize: 16, fontWeight: '700', color: '#111827' },
	productInfoVariant: {
		fontSize: 13,
		fontWeight: '600',
		color: '#374151',
		marginTop: 2,
	},
	productInfoGeneric: {
		fontSize: 12,
		color: '#6B7280',
		fontStyle: 'italic',
		marginTop: 1,
	},
	sectionHeading: {
		fontSize: 13,
		fontWeight: '700',
		color: '#6B7280',
		textTransform: 'uppercase',
		letterSpacing: 0.5,
		marginHorizontal: 12,
		marginBottom: 6,
		marginTop: 4,
	},
	section: {
		paddingHorizontal: 12,
		paddingTop: 8,
		paddingBottom: 0,
		borderRadius: 8,
	},
	detailsSection: {
		paddingHorizontal: 12,
		paddingTop: 0,
		paddingBottom: 0,
		borderRadius: 8,
		marginBottom: 8,
	},
	row: { flexDirection: 'row', gap: 8, marginBottom: 0 },
	fieldContainer: { paddingTop: 8, marginBottom: 8 },
	halfField: { flex: 1, paddingTop: 8, marginBottom: 8 },
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
	datePickerButton: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 8,
	},
	datePickerText: { fontSize: 14, color: '#333' },
	datePickerPlaceholder: { fontSize: 14, color: 'rgba(0,0,0,0.54)' },
	calendarIcon: { fontSize: 16 },
	disabledInput: { backgroundColor: '#f5f5f5' },
	multilineInput: {
		textAlignVertical: 'top',
		minHeight: 80,
		paddingTop: 12,
		height: undefined,
	},
	dropdown: {
		height: 44,
		paddingHorizontal: 16,
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
	},
	placeholderStyle: { fontSize: 16, color: 'rgba(0,0,0,0.54)' },
	selectedTextStyle: { fontSize: 16, color: '#333' },
	inputSearchStyle: { height: 44, fontSize: 16 },
	dropdownListContainer: {
		borderRadius: 8,
		borderColor: 'rgba(0, 0, 0, 0.54)',
	},
	checkboxRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	checkboxItem: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 8,
		flex: 1,
	},
	checkboxLabel: {
		marginLeft: 8,
		color: '#195FE1',
		fontSize: 14,
		fontWeight: '500',
	},
	divider: {
		height: 1,
		backgroundColor: 'rgba(0,0,0,0.06)',
		marginVertical: 10,
		marginHorizontal: 4,
	},
	mandatoryNotice: { marginTop: 4, marginBottom: 8, paddingHorizontal: 4 },
	mandatoryText: {
		fontSize: 12,
		color: '#195FE1',
		textAlign: 'center',
		fontStyle: 'italic',
	},
	asterisk: { color: '#195FE1', fontWeight: 'bold' },
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		marginTop: 8,
		paddingHorizontal: 28,
		paddingBottom: 8,
	},
	button: {
		padding: 14,
		borderRadius: 24,
		width: '100%',
		alignItems: 'center',
	},
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
	errorText: { color: '#ff0033', fontSize: 12, marginTop: 2, marginBottom: 4 },
})
