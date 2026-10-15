import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
	Modal,
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
	ScrollView,
	ToastAndroid,
	ActivityIndicator,
} from 'react-native'
import * as Yup from 'yup'
import { Formik } from 'formik'
import { Feather } from '@expo/vector-icons'
import { Dropdown } from 'react-native-element-dropdown'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { cleanString } from '../CleanString.js'
import { CloseModal, ErrorModal } from '../AlertModal.jsx'
import ProductSearchInput from './ProductSearchInput.jsx'
import barCodeScanner from '../barCodeScanner.jsx'
import useApi from '../../hooks/useApi.jsx'
import { getProductFromInventoryDatabase } from '../../controllers/product.js'
import { localProductController } from '../../controllers/offline/product.js'

// barCodeScanner's default export is lowercase, alias it so JSX treats it as a component
const BarcodeScannerModal = barCodeScanner
import {
	convertToEnglishNumbers,
	convertToBengaliNumbers,
} from '../translateNumber.js'
import {
	displayLocalizedNumber,
	handleNumericInput,
	handleDigitsOnly,
} from '../../utils/numberInput'
import { numberTransform } from '../../utils/yupHelpers'
import {
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetBackdrop,
} from '@gorhom/bottom-sheet'

// Props: initialProduct: {id, barcode, productName, measuringUnit, genericName, category} | null
// handleSubmit(payload): { name, category, measuringUnit, barcode, genericName, productID?, variants[] }
// closeForm()
const ProductVariantForm = React.forwardRef(function ProductVariantForm(
	{ initialProduct = null, handleSubmit, closeForm, visible = true },
	ref
) {
	const { loc } = useLocalization()
	const { toEnglishNumbers } = useNumberTranslator()
	const [isFocus, setIsFocus] = useState(false)
	const [isCategoryFocus, setIsCategoryFocus] = useState(false)
	const [showValidationModal, setShowValidationModal] = useState(false)
	const [showCloseModal, setShowCloseModal] = useState(false)
	const [validationErrors, setValidationErrors] = useState([])
	// Barcode scanning + device catalog search
	const [isScannerVisible, setIsScannerVisible] = useState(false)
	const [isScanLookupRunning, setIsScanLookupRunning] = useState(false)
	const { fetchData } = useApi()
	// "Has variant?" — off by default: a single default variant is still created
	const [hasVariant, setHasVariant] = useState(false)
	// true while the product/generic search results box is on screen
	const [searchDropdownOpen, setSearchDropdownOpen] = useState(false)

	const unitOptions = useMemo(
		() => [
			{ key: 'bag', label: loc.t('productForm.bag'), value: 'Bag' },
			{ key: 'barrel', label: loc.t('productForm.barrel'), value: 'Barrel' },
			{ key: 'bottle', label: loc.t('productForm.bottle'), value: 'Bottle' },
			{ key: 'box', label: loc.t('productForm.box'), value: 'Box (box)' },
			{ key: 'carton', label: loc.t('productForm.carton'), value: 'Carton' },
			{ key: 'dozen', label: loc.t('productForm.dozen'), value: 'Dozen (doz)' },
			{ key: 'feet', label: loc.t('productForm.feet'), value: 'Feet (ft)' },
			{ key: 'meter', label: loc.t('productForm.meter'), value: 'Meter (m)' },
			{ key: 'yard', label: loc.t('productForm.yard'), value: 'Yard' },
			{
				key: 'kilogram',
				label: loc.t('productForm.kilogram'),
				value: 'Kilogram (kg)',
			},
			{ key: 'roll', label: loc.t('productForm.roll'), value: 'Roll' },
			{ key: 'gram', label: loc.t('productForm.gram'), value: 'Gram (g)' },
			{ key: 'litre', label: loc.t('productForm.litre'), value: 'Litre (L)' },
			{
				key: 'millilitre',
				label: loc.t('productForm.millilitre'),
				value: 'Millilitre (mL)',
			},
			{ key: 'piece', label: loc.t('productForm.piece'), value: 'Piece (pc)' },
			{
				key: 'squareFeet',
				label: loc.t('productForm.squareFeet'),
				value: 'Square feet (sq ft)',
			},
			{
				key: 'squareMeter',
				label: loc.t('productForm.squareMeter'),
				value: 'Square meter (sq m)',
			},
			{
				key: 'squareYard',
				label: loc.t('productForm.squareYard'),
				value: 'Square yard (sq yd)',
			},
			{ key: 'ton', label: loc.t('productForm.ton'), value: 'Ton' },
		],
		[loc]
	)

	const categoryOptions = useMemo(() => {
		const opts = []
		const categoryData = loc.t('productForm.category')
		if (categoryData && typeof categoryData === 'object') {
			for (const [key, value] of Object.entries(categoryData)) {
				opts.push({ key, label: value, value: key })
			}
		}
		if (opts.length === 0) {
			// fallback if translation missing
			opts.push({ key: 'OTHER', label: 'Other', value: 'OTHER' })
		}
		return opts
	}, [loc])

	// Resolves a raw measuring unit coming from the catalog to one of the dropdown values
	const resolveUnitValue = useCallback(
		(unit) => {
			if (!unit) return ''
			const mu = String(unit).toLowerCase()
			const matched = unitOptions.find(
				(u) =>
					u.value.toLowerCase().includes(mu) ||
					mu.includes(u.value.toLowerCase())
			)
			return matched?.value || ''
		},
		[unitOptions]
	)

	const findMatchingUnit = useCallback(
		() => resolveUnitValue(initialProduct?.measuringUnit),
		[initialProduct, resolveUnitValue]
	)

	// Fills the whole product section from a catalog row (pre-saved products on the device)
	const applyProductToForm = useCallback(
		(product, formikHelpers = {}) => {
			const { setFieldValue, setFieldTouched } = formikHelpers
			if (!product || !setFieldValue) return
			const productName = product.productName || product.name || ''
			setFieldValue('productID', product.id || '')
			setFieldValue('name', productName)
			if (product.barcode) setFieldValue('barcode', String(product.barcode))
			setFieldValue('genericName', product.genericName || '')
			const matchedUnit = resolveUnitValue(product.measuringUnit)
			if (matchedUnit) setFieldValue('measuringUnit', matchedUnit)
			if (product.category) setFieldValue('category', product.category)
			// clear stale validation state for the fields that were just filled
			setFieldTouched?.('name', false)
			setFieldTouched?.('measuringUnit', false)
			setFieldTouched?.('category', false)
		},
		[resolveUnitValue]
	)

	// Device catalog searches (drizzle cache) — read only, no network, no writes.
	// The mode is passed explicitly ('read') like every other local call in the app.
	const searchProductsByName = useCallback(async (term) => {
		try {
			// no limit: every match is fetched, the dropdown pages them for rendering
			const res = await localProductController.searchInventoryByName(
				{ searchTerm: term },
				'read'
			)
			return res?.success && Array.isArray(res.data) ? res.data : []
		} catch (error) {
			console.log('searchProductsByName error', error?.message)
			return []
		}
	}, [])

	const searchProductsByGenericName = useCallback(async (term) => {
		try {
			// no limit: every match is fetched, the dropdown pages them for rendering
			const res = await localProductController.searchInventoryByGenericName(
				{ searchTerm: term },
				'read'
			)
			return res?.success && Array.isArray(res.data) ? res.data : []
		} catch (error) {
			console.log('searchProductsByGenericName error', error?.message)
			return []
		}
	}, [])

	// Selecting a suggestion is the only thing that updates the form fields
	const handleCatalogProductSelect = useCallback(
		(product, formikHelpers) => {
			applyProductToForm(product, formikHelpers)
			ToastAndroid.show(
				loc.t('productForm.productInfoLoaded') || 'Product info loaded',
				ToastAndroid.SHORT
			)
		},
		[applyProductToForm, loc]
	)

	const showToast = useCallback(
		(key, fallback) => {
			ToastAndroid.show(loc.t(key) || fallback, ToastAndroid.SHORT)
		},
		[loc]
	)

	// Scanned barcode: fill everything when it exists in the saved catalog,
	// otherwise just keep the scanned code so the user can type their own info.
	const handleBarcodeScan = useCallback(
		async (barcode, formikHelpers) => {
			setIsScannerVisible(false)
			const code = String(barcode || '').trim()
			if (!code) return
			const { setFieldValue } = formikHelpers || {}
			setFieldValue?.('barcode', code)
			setIsScanLookupRunning(true)
			try {
				const res = await fetchData(
					getProductFromInventoryDatabase,
					{ barcode: code },
					localProductController.getProductFromInventoryDatabase,
					'read'
				)
				if (res?.success && res?.data) {
					const { variants, ...product } = res.data
					product.barcode = product.barcode || code
					applyProductToForm(product, formikHelpers)
					ToastAndroid.show(
						loc.t('productForm.productInfoLoaded') || 'Product info loaded',
						ToastAndroid.SHORT
					)
				} else {
					ToastAndroid.show(
						loc.t('productForm.scannedProductNotSaved') ||
							'Barcode not in saved products — enter your own name',
						ToastAndroid.LONG
					)
				}
			} catch (error) {
				console.log('handleBarcodeScan error', error?.message)
				showToast('productForm.scannedProductNotSaved', 'Product not found')
			} finally {
				setIsScanLookupRunning(false)
			}
		},
		[fetchData, applyProductToForm, loc, showToast]
	)

	const snapPoints = useMemo(() => ['95%'], [])

	const validationSchema = useMemo(
		() =>
			Yup.object().shape({
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
				variants: Yup.array()
					.of(
						Yup.object().shape({
							variantName: Yup.string().optional(),
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
						})
					)
					.min(1, 'At least one variant is required'),
			}),
		[loc, toEnglishNumbers]
	)

	const defaultValues = useMemo(
		() => ({
			productID: initialProduct?.id || '',
			name: initialProduct?.productName || '',
			barcode: initialProduct?.barcode || '',
			genericName: initialProduct?.genericName || '',
			category: initialProduct?.category || 'OTHER',
			measuringUnit: findMatchingUnit() || 'Piece (pc)',
			variants: [
				{
					variantName: '',
					variantCode: '',
					packOf: '1',
					lowStock: '',
					lowStockSMS: false,
					notifyBeforeExp: '',
					notifyAfterNotSold: '',
					notSoldSMS: false,
				},
			],
		}),
		[initialProduct, findMatchingUnit]
	)

	const isBarcodeEditable = !initialProduct?.barcode

	const trimFormData = (data, currentKey = '') => {
		if (typeof data === 'string') {
			if (currentKey === 'note') return data
			return cleanString(data)
		}
		if (Array.isArray(data)) return data.map((item) => trimFormData(item))
		if (data !== null && typeof data === 'object') {
			return Object.entries(data).reduce((acc, [key, value]) => {
				acc[key] = trimFormData(value, key)
				return acc
			}, {})
		}
		return data
	}

	const closeModal = useCallback(() => {
		ref.current?.dismiss()
		setTimeout(() => {
			closeForm()
		}, 150)
	}, [closeForm, ref])

	useEffect(() => {
		if (!visible) return
		const timer = setTimeout(() => {
			ref.current?.present()
		}, 50)
		return () => clearTimeout(timer)
	}, [visible, ref])

	useEffect(() => {
		if (!visible) {
			ref.current?.dismiss()
		}
	}, [visible, ref])

	useEffect(() => {
		if (!visible) return
		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			() => {
				setShowCloseModal(true)
				return true
			}
		)
		return () => backHandler.remove()
	}, [visible])

	const renderBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="none"
				onPress={() => setShowCloseModal(true)}
			/>
		),
		[]
	)

	if (!visible) return null

	const handleValidationModalClose = () => setShowValidationModal(false)

	const rawHint = loc.t('inventory.add.catalogHint')
	const hintText =
		rawHint && !rawHint.includes('missing') && !rawHint.includes('[missing')
			? rawHint
			: 'Create product + variants. Stock will be added later via Buy Product.'

	return (
		<>
			<BottomSheetModal
				ref={ref}
				snapPoints={snapPoints}
				enablePanDownToClose={false}
				backdropComponent={renderBackdrop}
				// The content panning gesture wraps all of the sheet content in an RNGH
				// Pan. gorhom only lets its own scrollable coexist with that pan (it wraps
				// that one in Gesture.Native + simultaneousWithExternalGesture), so the pan
				// cancels the touch stream of any other scroll view inside the sheet: the
				// search results list could never scroll. This has to stay constant -
				// gorhom swaps the content wrapper component when the flag changes, which
				// would remount the whole form. The sheet stays draggable by its handle.
				enableContentPanningGesture={false}
				// expand to the maximum snap point while the keyboard is open
				keyboardBehavior="extend"
				keyboardBlurBehavior="restore"
				android_keyboardInputMode="adjustResize"
				backgroundStyle={styles.bottomSheetBackground}
				handleIndicatorStyle={styles.handleIndicator}
				enableDynamicSizing={false}
				onDismiss={closeModal}
			>
				<View style={styles.headerContainer}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalHeaderTitle}>
							{loc.t('productForm.modalTitle') || 'Product Form'}
						</Text>
						<TouchableOpacity
							onPress={() => setShowCloseModal(true)}
							style={styles.infoCloseButton}
							activeOpacity={0.7}
						>
							<MaterialIcons name="close" size={16} color="#6B7280" />
						</TouchableOpacity>
					</View>
					<Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
						{hintText}
					</Text>
				</View>

				<KeyboardAvoidingView
					style={styles.keyboardAvoidingView}
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
					keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
				>
					<BottomSheetScrollView
						showsVerticalScrollIndicator={false}
						bounces={true}
						nestedScrollEnabled
						// On Android a react native scroll view takes part in no nested scroll
						// protocol (ReactScrollView implements neither NestedScrollingChild nor
						// NestedScrollingParent, and nestedScrollEnabled maps to a no-op), so this
						// parent would intercept the drag and the results list would never move.
						// While the results box is open this scroll view is switched off so the
						// list receives the gesture.
						scrollEnabled={!searchDropdownOpen}
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={styles.scrollContent}
					>
						<Formik
							initialValues={defaultValues}
							validationSchema={validationSchema}
							enableReinitialize
							onSubmit={async (values) => {
								try {
									await validationSchema.validate(values, { abortEarly: false })
									const trimmed = trimFormData(values)
									const payload = {
										productID: trimmed.productID || undefined,
										name: trimmed.name,
										category: trimmed.category,
										measuringUnit: trimmed.measuringUnit,
										barcode:
											trimmed.barcode && trimmed.barcode.trim() !== ''
												? convertToEnglishNumbers(trimmed.barcode.trim())
												: undefined,
										genericName: trimmed.genericName || undefined,
										variants: trimmed.variants
											.map((v) => {
												const isOnlyVariant = trimmed.variants.length === 1
												const fallbackName =
													loc.t('productForm.defaultVariantName') || 'Default'
												const rawName =
													v.variantName && v.variantName.trim() !== ''
														? v.variantName
														: isOnlyVariant
															? fallbackName
															: v.variantName
												return {
													variantName: rawName,
													variantCode:
														v.variantCode && v.variantCode.trim() !== ''
															? convertToEnglishNumbers(v.variantCode.trim())
															: undefined,
													packOf: v.packOf
														? parseInt(
																convertToEnglishNumbers(v.packOf.toString())
															) || 1
														: 1,
													lowStock: v.lowStock
														? parseInt(
																convertToEnglishNumbers(v.lowStock.toString())
															)
														: undefined,
													lowStockSMS: v.lowStockSMS || false,
													notifyBeforeExp: v.notifyBeforeExp
														? parseInt(
																convertToEnglishNumbers(
																	v.notifyBeforeExp.toString()
																)
															)
														: undefined,
													notSoldSMS: v.notSoldSMS || false,
													notifyAfterNotSold: v.notifyAfterNotSold
														? parseInt(
																convertToEnglishNumbers(
																	v.notifyAfterNotSold.toString()
																)
															)
														: undefined,
												}
											})
											.filter(Boolean),
									}
									// filter empty variantCode strings already done
									handleSubmit(payload)
								} catch (error) {
									if (error.inner && Array.isArray(error.inner)) {
										setValidationErrors(
											error.inner.map((err) => ({
												path: err.path,
												message: err.message,
											}))
										)
									} else {
										setValidationErrors([
											{ path: error.path || 'unknown', message: error.message },
										])
									}
									setShowValidationModal(true)
								}
							}}
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
								setFieldTouched,
							}) => {
								const renderError = (fieldName) => {
									// fieldName may be nested like variants[0].variantName
									const parts = fieldName.split('.')
									let err = errors
									let touch = touched
									for (const p of parts) {
										// handle array index like variants[0]
										const m = p.match(/(\w+)\[(\d+)\]/)
										if (m) {
											const arr = m[1]
											const idx = parseInt(m[2])
											err = err?.[arr]?.[idx]
											touch = touch?.[arr]?.[idx]
										} else {
											err = err?.[p]
											touch = touch?.[p]
										}
									}
									if (err && touch) {
										return (
											<Text style={styles.errorText}>
												{typeof err === 'string'
													? err
													: err?.variantName || JSON.stringify(err)}
											</Text>
										)
									}
									return null
								}
								// Text captured from the camera (OCR) — only used when the name is still empty
								const handleOCRData = (texts = []) => {
									setIsScannerVisible(false)
									const detected = (texts || [])
										.map((text) => String(text || '').trim())
										.find((text) => text.length > 1)
									if (!detected) return
									if (String(values.name || '').trim()) return
									setFieldValue('name', detected)
									ToastAndroid.show(
										loc.t('productForm.nameCapturedFromPhoto') ||
											'Name captured from the photo',
										ToastAndroid.SHORT
									)
								}

								return (
									<View style={styles.container}>
										<View style={styles.productInfoSection}>
											<View style={styles.fieldContainer}>
												<ProductSearchInput
													label={loc.t('productForm.productName') + ' *'}
													onDropdownVisibilityChange={setSearchDropdownOpen}
													value={values.name}
													onChangeText={(text) => setFieldValue('name', text)}
													onBlur={() => handleBlur('name')}
													placeholder={
														loc.t('productForm.searchProductByName') ||
														'Type product name to search saved products'
													}
													searchFn={searchProductsByName}
													onSelect={(product) =>
														handleCatalogProductSelect(product, {
															setFieldValue,
															setFieldTouched,
														})
													}
												/>
												{errors.name && touched.name && (
													<Text style={styles.errorText}>{errors.name}</Text>
												)}
											</View>
											<View style={styles.fieldContainer}>
												<Text style={styles.overlayLabel}>
													{loc.t('productForm.productBarcode')}
												</Text>
												<View style={styles.barcodeRow}>
													<TextInput
														value={values.barcode}
														onChangeText={handleChange('barcode')}
														onBlur={handleBlur('barcode')}
														placeholder={loc.t('productForm.productBarcode')}
														placeholderTextColor="rgba(0,0,0,0.54)"
														keyboardType="numeric"
														style={[
															styles.input,
															styles.barcodeInput,
															!isBarcodeEditable && styles.disabledInput,
														]}
														editable={isBarcodeEditable}
													/>
													<TouchableOpacity
														style={styles.scanButton}
														onPress={() => setIsScannerVisible(true)}
														activeOpacity={0.7}
														disabled={isScanLookupRunning}
														accessibilityLabel={
															loc.t('productForm.scanBarcode') || 'Scan barcode'
														}
													>
														{isScanLookupRunning ? (
															<ActivityIndicator size="small" color="#195FE1" />
														) : (
															<MaterialIcons
																name="photo-camera"
																size={22}
																color="#195FE1"
															/>
														)}
													</TouchableOpacity>
												</View>
												{errors.barcode && touched.barcode && (
													<Text style={styles.errorText}>{errors.barcode}</Text>
												)}
											</View>
											<View style={styles.fieldContainer}>
												<ProductSearchInput
													label={
														loc.t('productForm.genericName') || 'Generic Name'
													}
													onDropdownVisibilityChange={setSearchDropdownOpen}
													value={values.genericName}
													onChangeText={(text) =>
														setFieldValue('genericName', text)
													}
													onBlur={() => handleBlur('genericName')}
													placeholder={
														loc.t('productForm.searchByGenericName') ||
														'Type generic name to see matching products'
													}
													searchFn={searchProductsByGenericName}
													onSelect={(product) =>
														handleCatalogProductSelect(product, {
															setFieldValue,
															setFieldTouched,
														})
													}
												/>
											</View>
											<View style={styles.row}>
												<View style={styles.halfField}>
													<Text style={styles.overlayLabel}>
														{loc.t('productForm.unit')} *
													</Text>
													<Dropdown
														data={unitOptions}
														search
														maxHeight={300}
														labelField="label"
														valueField="value"
														placeholder={
															!isFocus
																? loc.t('productForm.unit') + ' *'
																: '...'
														}
														searchPlaceholder={loc.t('productForm.search')}
														value={values.measuringUnit}
														onFocus={() => setIsFocus(true)}
														onBlur={() => {
															setIsFocus(false)
															setFieldTouched('measuringUnit', true)
														}}
														onChange={(item) => {
															setFieldValue('measuringUnit', item.value)
															setIsFocus(false)
														}}
														style={styles.dropdown}
														placeholderStyle={styles.placeholderStyle}
														selectedTextStyle={styles.selectedTextStyle}
														inputSearchStyle={styles.inputSearchStyle}
														containerStyle={styles.dropdownListContainer}
													/>
													{errors.measuringUnit && touched.measuringUnit && (
														<Text style={styles.errorText}>
															{errors.measuringUnit}
														</Text>
													)}
												</View>
												<View style={styles.halfField}>
													<Text style={styles.overlayLabel}>
														{loc.t('productForm.categoryLabel')} *
													</Text>
													<Dropdown
														data={categoryOptions}
														search
														maxHeight={300}
														labelField="label"
														valueField="value"
														placeholder={
															!isCategoryFocus
																? loc.t('productForm.categoryLabel') + ' *'
																: '...'
														}
														searchPlaceholder={loc.t(
															'productForm.searchCategory'
														)}
														value={values.category}
														onFocus={() => setIsCategoryFocus(true)}
														onBlur={() => {
															setIsCategoryFocus(false)
															setFieldTouched('category', true)
														}}
														onChange={(item) => {
															setFieldValue('category', item.value)
															setIsCategoryFocus(false)
														}}
														style={styles.dropdown}
														placeholderStyle={styles.placeholderStyle}
														selectedTextStyle={styles.selectedTextStyle}
														inputSearchStyle={styles.inputSearchStyle}
														containerStyle={styles.dropdownListContainer}
													/>
													{errors.category && touched.category && (
														<Text style={styles.errorText}>
															{errors.category}
														</Text>
													)}
												</View>
											</View>
											{/* Has variant? — asked once the product info above is filled */}
											<View style={styles.variantToggleRow}>
												<View style={styles.variantToggleInfo}>
													<Text style={styles.variantToggleLabel}>
														{loc.t('productForm.hasVariant') || 'Has variant?'}
													</Text>
												</View>
												<Switch
													value={hasVariant}
													onValueChange={(value) => {
														setHasVariant(value)
														if (!value) {
															// back to one default variant, without name/code
															const [firstVariant] = values.variants
															setFieldValue('variants', [
																{
																	...(firstVariant || {}),
																	variantName: '',
																	variantCode: '',
																},
															])
														}
													}}
													trackColor={{ false: '#767577', true: '#195FE1' }}
													thumbColor="#ffffff"
												/>
											</View>
										</View>

										{/* Variants section */}
										<View style={styles.section}>
											<Text style={styles.sectionTitle}>
												{hasVariant
													? (loc.t('inventory.add.variants') || 'Variants') +
														' *'
													: loc.t('productForm.variantOptions') ||
														'Variant Options'}
											</Text>
											{values.variants.map((variant, idx) => (
												<View key={idx} style={styles.variantCard}>
													{hasVariant && values.variants.length > 1 && (
														<View style={styles.variantHeader}>
															<TouchableOpacity
																onPress={() => {
																	const next = [...values.variants]
																	next.splice(idx, 1)
																	setFieldValue('variants', next)
																}}
																style={styles.removeBtn}
															>
																<MaterialIcons
																	name="delete-outline"
																	size={18}
																	color="#DC2626"
																/>
																<Text style={styles.removeBtnText}>
																	{loc.t('common.remove') || 'Remove'}
																</Text>
															</TouchableOpacity>
														</View>
													)}
													{hasVariant && (
														<View style={styles.fieldContainer}>
															<Text style={styles.overlayLabel}>
																{loc.t('productForm.variantName')}
																{values.variants.length > 1 ? ' *' : ''}
															</Text>
															<TextInput
																placeholder={loc.t(
																	'productForm.variantNamePlaceholder'
																)}
																placeholderTextColor="rgba(0,0,0,0.54)"
																value={variant.variantName}
																onChangeText={(t) =>
																	setFieldValue(
																		`variants[${idx}].variantName`,
																		t
																	)
																}
																onBlur={handleBlur(
																	`variants[${idx}].variantName`
																)}
																style={styles.input}
															/>
															{renderError(`variants[${idx}].variantName`)}
														</View>
													)}
													{hasVariant && (
														<View style={styles.fieldContainer}>
															<Text style={styles.overlayLabel}>
																{loc.t('productForm.variantCode')}
															</Text>
															<TextInput
																value={displayLocalizedNumber(
																	variant.variantCode
																)}
																onChangeText={(value) =>
																	handleNumericInput(
																		value,
																		setFieldValue,
																		`variants[${idx}].variantCode`
																	)
																}
																onBlur={handleBlur(
																	`variants[${idx}].variantCode`
																)}
																placeholder={loc.t(
																	'productForm.variantCodePlaceholder'
																)}
																placeholderTextColor="rgba(0,0,0,0.54)"
																keyboardType="numeric"
																style={styles.input}
															/>
														</View>
													)}
													<View style={styles.fieldContainer}>
														<Text style={styles.overlayLabel}>
															{loc.t('productForm.notifyBeforeExpiry') ||
																'Notify Before Expiry (days)'}
														</Text>
														<TextInput
															placeholder={loc.t('productForm.days') || 'days'}
															placeholderTextColor="rgba(0,0,0,0.54)"
															value={displayLocalizedNumber(
																variant.notifyBeforeExp
															)}
															onChangeText={(value) =>
																handleDigitsOnly(
																	value,
																	setFieldValue,
																	`variants[${idx}].notifyBeforeExp`
																)
															}
															keyboardType="numeric"
															style={styles.input}
														/>
													</View>
													<View style={styles.fieldContainer}>
														<Text style={styles.overlayLabel}>
															{loc.t('productForm.lowStockAlert')}
														</Text>
														<TextInput
															placeholder={loc.t(
																'productForm.lowStockPlaceholder'
															)}
															placeholderTextColor="rgba(0,0,0,0.54)"
															value={displayLocalizedNumber(variant.lowStock)}
															onChangeText={(value) =>
																handleDigitsOnly(
																	value,
																	setFieldValue,
																	`variants[${idx}].lowStock`
																)
															}
															keyboardType="numeric"
															style={styles.input}
														/>
													</View>
													<View style={styles.fieldContainer}>
														<Text style={styles.overlayLabel}>
															{loc.t('productForm.notifyIfNotSold') ||
																'Notify After Not Sold (days)'}
														</Text>
														<TextInput
															placeholder={loc.t('productForm.days') || 'days'}
															placeholderTextColor="rgba(0,0,0,0.54)"
															value={displayLocalizedNumber(
																variant.notifyAfterNotSold
															)}
															onChangeText={(value) =>
																handleDigitsOnly(
																	value,
																	setFieldValue,
																	`variants[${idx}].notifyAfterNotSold`
																)
															}
															keyboardType="numeric"
															style={styles.input}
														/>
													</View>
													<View style={styles.fieldContainer}>
														<View
															style={{
																flexDirection: 'row',
																alignItems: 'center',
																gap: 8,
															}}
														>
															<Switch
																value={!!variant.lowStockSMS}
																onValueChange={(value) =>
																	setFieldValue(
																		`variants[${idx}].lowStockSMS`,
																		value
																	)
																}
																trackColor={{
																	false: '#767577',
																	true: '#195FE1',
																}}
																thumbColor="#ffffff"
															/>
															<Text
																style={{
																	color: '#195FE1',
																	fontSize: 14,
																	fontWeight: '500',
																}}
															>
																{loc.t('productForm.sendSMSOnLowStock') ||
																	'Send SMS on low stock'}
															</Text>
														</View>
													</View>
													<View style={styles.fieldContainer}>
														<View
															style={{
																flexDirection: 'row',
																alignItems: 'center',
																gap: 8,
															}}
														>
															<Switch
																value={!!variant.notSoldSMS}
																onValueChange={(value) =>
																	setFieldValue(
																		`variants[${idx}].notSoldSMS`,
																		value
																	)
																}
																trackColor={{
																	false: '#767577',
																	true: '#195FE1',
																}}
																thumbColor="#ffffff"
															/>
															<Text
																style={{
																	color: '#195FE1',
																	fontSize: 14,
																	fontWeight: '500',
																}}
															>
																{(() => {
																	const v = loc.t(
																		'productForm.notifyIfNotSoldSMS'
																	)
																	if (v && !String(v).includes('missing'))
																		return v
																	const a = loc.t(
																		'productForm.sendSMSIfNotSold'
																	)
																	if (a && !String(a).includes('missing'))
																		return a
																	return (
																		loc.t('quantityUpdate.notSoldSMS') ||
																		'Send SMS if not sold'
																	)
																})()}
															</Text>
														</View>
													</View>
												</View>
											))}
											{hasVariant && (
												<TouchableOpacity
													style={styles.addVariantBtn}
													onPress={() => {
														const next = [
															...values.variants,
															{
																variantName: '',
																variantCode: '',
																packOf: '1',
																lowStock: '',
																lowStockSMS: false,
																notifyBeforeExp: '',
																notifyAfterNotSold: '',
																notSoldSMS: false,
															},
														]
														setFieldValue('variants', next)
													}}
													activeOpacity={0.8}
												>
													<Feather name="plus" size={16} color="#195FE1" />
													<Text style={styles.addVariantBtnText}>
														{loc.t('inventory.add.addMoreVariants') ||
															'Add More Variants'}
													</Text>
												</TouchableOpacity>
											)}
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
														// collect nested errors for modal
														const flat = []
														if (errors.name)
															flat.push({ path: 'name', message: errors.name })
														if (errors.category)
															flat.push({
																path: 'category',
																message: errors.category,
															})
														if (errors.measuringUnit)
															flat.push({
																path: 'measuringUnit',
																message: errors.measuringUnit,
															})
														if (errors.variants) {
															errors.variants.forEach((ve, i) => {
																if (ve && ve.variantName)
																	flat.push({
																		path: `variants[${i}].variantName`,
																		message: ve.variantName,
																	})
															})
															if (typeof errors.variants === 'string')
																flat.push({
																	path: 'variants',
																	message: errors.variants,
																})
														}
														if (flat.length) {
															setValidationErrors(flat)
															setShowValidationModal(true)
															return
														}
													}
													submitForm()
												}}
											>
												<Text style={styles.buttonText}>
													{loc.t('productForm.save') || 'Save'}
												</Text>
											</TouchableOpacity>
										</View>
										{/* Barcode scanner — reuses the shared camera component */}
										<BarcodeScannerModal
											isVisible={isScannerVisible}
											setIsVisible={setIsScannerVisible}
											handleBarCodeScan={(code) =>
												handleBarcodeScan(code, {
													setFieldValue,
													setFieldTouched,
												})
											}
											handleOCRData={handleOCRData}
										/>
									</View>
								)
							}}
						</Formik>
					</BottomSheetScrollView>
				</KeyboardAvoidingView>
			</BottomSheetModal>

			<Modal
				visible={showValidationModal}
				transparent={true}
				animationType="fade"
				onRequestClose={handleValidationModalClose}
			>
				<TouchableWithoutFeedback onPress={handleValidationModalClose}>
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
										onPress={handleValidationModalClose}
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

			<CloseModal
				visible={showCloseModal}
				title={loc.t('productForm.discardChanges') || 'Discard Changes'}
				subtitle={
					loc.t('productForm.sureToClose') || 'Are you sure you want to close?'
				}
				onClose={() => setShowCloseModal(false)}
				onConfirm={() => {
					setShowCloseModal(false)
					closeForm()
				}}
			/>
		</>
	)
})

export default ProductVariantForm

const styles = StyleSheet.create({
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF',
		borderTopLeftRadius: 25,
		borderTopRightRadius: 25,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -2 },
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
	keyboardAvoidingView: { flex: 1 },
	scrollContent: { flexGrow: 1, paddingBottom: 40 },
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
	},
	modalHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#195FE1' },
	infoCloseButton: {
		width: 28,
		height: 28,
		backgroundColor: '#E5E7EB',
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
	container: { padding: 16, paddingTop: 8 },
	section: {
		paddingHorizontal: 12,
		paddingTop: 8,
		paddingBottom: 0,
		borderRadius: 8,
	},
	// keeps the product-search suggestions above the sections below
	productInfoSection: {
		paddingHorizontal: 12,
		paddingTop: 8,
		paddingBottom: 0,
		borderRadius: 8,
		zIndex: 30,
	},
	row: { flexDirection: 'row', gap: 8, marginBottom: 0 },
	fieldContainer: { paddingTop: 10, marginBottom: 8 },
	halfField: { flex: 1, paddingTop: 10, marginBottom: 8 },
	overlayLabel: {
		position: 'absolute',
		top: 0,
		left: 12,
		backgroundColor: '#F0F8FF',
		paddingHorizontal: 6,
		fontSize: 11,
		lineHeight: 13,
		color: '#195FE1',
		fontWeight: '600',
		zIndex: 10,
		borderRadius: 6,
		maxWidth: '90%',
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
	barcodeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	barcodeInput: { flex: 1 },
	scanButton: {
		width: 44,
		height: 44,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		backgroundColor: '#FFFFFF',
		alignItems: 'center',
		justifyContent: 'center',
	},
	variantToggleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
		paddingTop: 12,
		marginTop: 4,
		borderTopWidth: 1,
		borderTopColor: 'rgba(25, 95, 225, 0.12)',
	},
	variantToggleInfo: { flex: 1 },
	variantToggleLabel: {
		fontSize: 14,
		fontWeight: '600',
		color: '#195FE1',
	},
	variantToggleHint: {
		fontSize: 11,
		color: '#6B7280',
		marginTop: 2,
		lineHeight: 14,
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
	sectionTitle: {
		fontWeight: '600',
		fontSize: 16,
		color: '#195FE1',
		marginBottom: 8,
	},
	variantCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		padding: 12,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: 'rgba(0,0,0,0.08)',
	},
	variantHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 4,
	},
	variantTitle: { fontSize: 14, fontWeight: '700', color: '#1F2937' },
	removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
	removeBtnText: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
	addVariantBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		padding: 12,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#195FE1',
		borderStyle: 'dashed',
		backgroundColor: '#EFF6FF',
	},
	addVariantBtnText: { color: '#195FE1', fontWeight: '600', fontSize: 14 },
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
	errorText: { color: '#ff0033', fontSize: 12, marginTop: 2, marginBottom: 4 },
})
