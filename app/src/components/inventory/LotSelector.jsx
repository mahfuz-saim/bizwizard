import {
	View,
	Text,
	TouchableOpacity,
	TouchableWithoutFeedback,
	FlatList,
	Dimensions,
	StyleSheet,
	ToastAndroid,
	Switch,
	InteractionManager,
	Platform,
	BackHandler,
	KeyboardAvoidingView,
} from 'react-native'
import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { deleteLot, updateLot } from '../../controllers/product'
import useApi from '../../hooks/useApi'
import { Formik } from 'formik'
import * as Yup from 'yup'
import DateTimePicker from '@react-native-community/datetimepicker'
import {
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetBackdrop,
	BottomSheetFlatList,
	BottomSheetTextInput,
} from '@gorhom/bottom-sheet'

const { height: screenHeight } = Dimensions.get('window')

function LotSelector({
	lots,
	variant,
	handleLotSelection,
	handleCreateNewLot,
	cancelScanFlow,
	showCreate = true,
	showInfo = false,
	refreshOnChange = null,
	closeAfterUpdate = false,
}) {
	const bottomSheetModalRef = useRef(null)
	const [selectedLotInfo, setSelectedLotInfo] = useState(null)
	const [modalView, setModalView] = useState('list') // 'list', 'info', 'edit', 'delete'
	const [quantityAdjustMode, setQuantityAdjustMode] = useState(null) // 'add', 'delete', null
	const [tempQuantity, setTempQuantity] = useState('')
	const { loc } = useLocalization()
	const { translateNumber, translateAmount, toEnglishNumbers } =
		useNumberTranslator()
	const { fetchData } = useApi()

	// Validation schema for lot form (inside component to access loc and toEnglishNumbers)
	const lotValidationSchema = Yup.object().shape({
		stock: Yup.number()
			.transform((value, originalValue) => {
				if (
					originalValue === '' ||
					originalValue === null ||
					originalValue === undefined
				) {
					return undefined
				}
				const englishValue = toEnglishNumbers(String(originalValue))
				const parsed = parseFloat(englishValue)
				return isNaN(parsed) ? undefined : parsed
			})
			.required(
				loc.t('productForm.errors.stockRequired') ||
					'Stock quantity is required'
			)
			.min(
				0,
				loc.t('productForm.errors.stockMin') || 'Stock must be 0 or greater'
			),
		buyPrice: Yup.number()
			.transform((value, originalValue) => {
				if (
					originalValue === '' ||
					originalValue === null ||
					originalValue === undefined
				) {
					return undefined
				}
				const englishValue = toEnglishNumbers(String(originalValue))
				const parsed = parseFloat(englishValue)
				return isNaN(parsed) ? undefined : parsed
			})
			.required(
				loc.t('productForm.errors.buyPriceRequired') ||
					'Buying price is required'
			)
			.min(
				0,
				loc.t('productForm.errors.buyPriceMin') ||
					'Buying price must be 0 or greater'
			),
		sellPrice: Yup.number()
			.transform((value, originalValue) => {
				if (
					originalValue === '' ||
					originalValue === null ||
					originalValue === undefined
				) {
					return undefined
				}
				const englishValue = toEnglishNumbers(String(originalValue))
				const parsed = parseFloat(englishValue)
				return isNaN(parsed) ? undefined : parsed
			})
			.required(
				loc.t('productForm.errors.sellPriceRequired') ||
					'Selling price is required'
			)
			.min(
				0,
				loc.t('productForm.errors.sellPriceMin') ||
					'Selling price must be 0 or greater'
			),
		mrp: Yup.number()
			.transform((value, originalValue) => {
				if (
					originalValue === '' ||
					originalValue === null ||
					originalValue === undefined
				) {
					return undefined
				}
				const englishValue = toEnglishNumbers(String(originalValue))
				const parsed = parseFloat(englishValue)
				return isNaN(parsed) ? undefined : parsed
			})
			.required(loc.t('productForm.errors.mrpRequired') || 'MRP is required')
			.min(0, loc.t('productForm.errors.mrpMin') || 'MRP must be 0 or greater'),
		retail: Yup.number()
			.transform((value, originalValue) => {
				if (
					originalValue === '' ||
					originalValue === null ||
					originalValue === undefined
				) {
					return undefined
				}
				const englishValue = toEnglishNumbers(String(originalValue))
				const parsed = parseFloat(englishValue)
				return isNaN(parsed) ? undefined : parsed
			})
			.required(
				loc.t('productForm.errors.retailRequired') || 'Retail price is required'
			)
			.min(
				0,
				loc.t('productForm.errors.retailMin') ||
					'Retail price must be 0 or greater'
			),
		vat: Yup.number()
			.transform((value, originalValue) => {
				if (
					originalValue === '' ||
					originalValue === null ||
					originalValue === undefined
				) {
					return undefined
				}
				const englishValue = toEnglishNumbers(String(originalValue))
				const parsed = parseFloat(englishValue)
				return isNaN(parsed) ? undefined : parsed
			})
			.min(0, loc.t('productForm.errors.vatMin') || 'VAT must be 0 or greater')
			.max(100, loc.t('productForm.errors.vatMax') || 'VAT cannot exceed 100%')
			.optional(),
		includeVAT: Yup.boolean(),
		mfgDate: Yup.string(),
		expDate: Yup.string(),
		locationAtStore: Yup.string(),
		note: Yup.string(),
	})
	const [deleteForm, setDeleteForm] = useState({
		deletingQuantity: 'full',
		productQuantity: 0,
		reason: '',
		lossType: '',
		lossAmount: 0,
		lossPerUnit: 0,
		note: '',
	})
	const [showDeletingQuantityDropdown, setShowDeletingQuantityDropdown] =
		useState(false)
	const [showReasonDropdown, setShowReasonDropdown] = useState(false)
	const [showLossTypeDropdown, setShowLossTypeDropdown] = useState(false)
	const [stockValidationError, setStockValidationError] = useState('')
	const [lossAmountError, setLossAmountError] = useState('')
	const [productQuantityError, setProductQuantityError] = useState('')

	// DateTimePicker states
	const [showMfgDatePicker, setShowMfgDatePicker] = useState(false)
	const [showExpDatePicker, setShowExpDatePicker] = useState(false)
	const [tempMfgDate, setTempMfgDate] = useState(new Date())
	const [tempExpDate, setTempExpDate] = useState(new Date())
	const [selectedMfgDate, setSelectedMfgDate] = useState(null)
	const [selectedExpDate, setSelectedExpDate] = useState(null)

	// Ref to store Formik's setFieldValue
	const setFieldValueRef = useRef(null)

	// Deleting quantity options
	const deletingQuantityOptions = [
		{
			key: 'full',
			label: loc.t('lotSelector.fullQuantity') || 'Full Quantity',
		},
		{
			key: 'partial',
			label: loc.t('lotSelector.partialQuantity') || 'Partial Quantity',
		},
	]

	// Delete reason options
	const deleteReasonOptions = [
		{ key: 'DAMAGED', label: loc.t('lotSelector.reasonDamaged') },
		{ key: 'EXPIRED', label: loc.t('lotSelector.reasonExpired') },
		{ key: 'RETURNED', label: loc.t('lotSelector.reasonReturned') },
	]

	// Loss type options
	const lossTypeOptions = [
		{ key: 'NO_LOSS', label: loc.t('lotSelector.lossNone') },
		{ key: 'PARTIAL_LOSS', label: loc.t('lotSelector.lossPartial') },
		{ key: 'FULL_LOSS', label: loc.t('lotSelector.lossComplete') },
	]

	// Separate state for form data to prevent unnecessary re-renders
	const [lotFormData, setLotFormData] = useState({})
	const [originalLotFormData, setOriginalLotFormData] = useState({})

	// Refs to prevent stale closures
	const lotFormDataRef = useRef({})
	const isEditModeRef = useRef(false)
	const amountInputRef = useRef(null)
	const deleteReasonInputRef = useRef(null)

	// Snap points for bottom sheet
	const snapPoints = useMemo(() => {
		if (
			modalView === 'info' ||
			modalView === 'edit' ||
			modalView === 'delete'
		) {
			return ['85%', '95%']
		}
		return ['75%', '85%']
	}, [modalView])

	// Update edit mode ref when state changes
	useEffect(() => {
		isEditModeRef.current = modalView === 'edit'
	}, [modalView])

	// Validation helper for delete form
	const isDeleteFormValid = useCallback(() => {
		return (
			deleteForm.reason &&
			deleteForm.lossType &&
			!lossAmountError &&
			!productQuantityError &&
			deleteForm.productQuantity > 0
		)
	}, [
		deleteForm.reason,
		deleteForm.lossType,
		deleteForm.productQuantity,
		lossAmountError,
		productQuantityError,
	])

	// Open bottom sheet on mount
	useEffect(() => {
		const timer = setTimeout(() => {
			bottomSheetModalRef.current?.present()
		}, 50)

		return () => clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [showCreate, lots])

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
				if (modalView !== 'list') {
					if (modalView === 'edit') {
						cancelEditMode()
					} else if (modalView === 'delete') {
						cancelDeleteMode()
					} else if (modalView === 'info') {
						closeInfoModal()
					}
					return true
				}
				closeModal()
				return true
			}
		)

		return () => backHandler.remove()
	}, [modalView])

	// Render backdrop component
	const renderBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="none"
				onPress={() => {
					if (modalView === 'list') {
						closeModal()
					}
				}}
			/>
		),
		[modalView, closeModal]
	)

	// Memoize date formatting functions
	const formatDate = useCallback(
		(dateString) => {
			if (!dateString) return null
			const date = new Date(dateString)
			const formattedDate = date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			})
			return translateNumber(formattedDate)
		},
		[translateNumber]
	)

	const formatDateForDisplay = useCallback((dateString) => {
		if (!dateString) return ''
		const date = new Date(dateString)
		if (isNaN(date.getTime())) return ''

		const day = date.getDate().toString().padStart(2, '0')
		const month = (date.getMonth() + 1).toString().padStart(2, '0')
		const year = date.getFullYear()

		return `${day}-${month}-${year}`
	}, [])

	const formatDateForStorage = useCallback((dateString) => {
		if (!dateString) return ''

		// Check if it's already in ISO format
		if (dateString.includes('T') || dateString.length > 10) {
			return dateString
		}

		// Parse DD-MM-YYYY format
		const parts = dateString.split('-')
		if (parts.length === 3) {
			const [day, month, year] = parts
			const date = new Date(year, month - 1, day)
			if (!isNaN(date.getTime())) {
				return date.toISOString().split('T')[0]
			}
		}

		return dateString
	}, [])

	// Extract numeric date for API (removes slashes, converts DD/MM/YYYY to DDMMYYYY)
	const extractNumericDate = (dateString) => {
		return dateString.replace(/[^\d]/g, '')
	}

	// Date picker handlers
	const handleMfgDateChange = (event, selectedDate) => {
		setShowMfgDatePicker(false)

		if (event.type === 'dismissed' || !selectedDate) {
			return
		}

		setSelectedMfgDate(selectedDate)
		// Format date as DD/MM/YYYY for display
		const day = selectedDate.getDate().toString().padStart(2, '0')
		const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0')
		const year = selectedDate.getFullYear()
		const formattedDate = `${day}/${month}/${year}`

		// Use ref to update Formik value
		if (setFieldValueRef.current) {
			setFieldValueRef.current('mfgDate', formattedDate)
		}
	}

	const handleExpDateChange = (event, selectedDate) => {
		setShowExpDatePicker(false)

		if (event.type === 'dismissed' || !selectedDate) {
			return
		}

		setSelectedExpDate(selectedDate)
		// Format date as DD/MM/YYYY for display
		const day = selectedDate.getDate().toString().padStart(2, '0')
		const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0')
		const year = selectedDate.getFullYear()
		const formattedDate = `${day}/${month}/${year}`

		// Use ref to update Formik value
		if (setFieldValueRef.current) {
			setFieldValueRef.current('expDate', formattedDate)
		}
	}

	const openMfgDatePicker = () => {
		const initialDate = selectedMfgDate || new Date()
		setTempMfgDate(initialDate)
		setShowMfgDatePicker(true)
	}

	const openExpDatePicker = () => {
		const initialDate = selectedExpDate || new Date()
		setTempExpDate(initialDate)
		setShowExpDatePicker(true)
	}

	// Memoize date validation functions
	const isExpiringSoon = useCallback((expiryDate) => {
		if (!expiryDate) return false
		const today = new Date()
		const expiry = new Date(expiryDate)
		const diffTime = expiry - today
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
		return diffDays <= 30 && diffDays > 0
	}, [])

	const isExpired = useCallback((expiryDate) => {
		if (!expiryDate) return false
		const today = new Date()
		const expiry = new Date(expiryDate)
		return expiry < today
	}, [])

	// Stabilized form data update function with auto-calculation
	const updateLotFormDataInternal = useCallback(
		(field, value) => {
			setLotFormData((prevData) => {
				// Only update if value actually changed
				if (prevData[field] === value) {
					return prevData
				}

				const newData = { ...prevData, [field]: value }

				// Auto-calculate selling price when retail, vat, or includeVAT changes
				if (field === 'retail' || field === 'vat' || field === 'includeVAT') {
					const retailPrice =
						parseFloat(toEnglishNumbers(newData.retail || '0')) || 0
					const vatPercentage =
						parseFloat(toEnglishNumbers(newData.vat || '0')) || 0
					const isVatIncluded = newData.includeVAT || false

					let sellingPrice = retailPrice

					if (!isVatIncluded && vatPercentage > 0) {
						// VAT not included, add VAT to retail price
						sellingPrice = retailPrice + (retailPrice * vatPercentage) / 100
					}
					// If VAT is included, selling price equals retail price

					// Don't translate - just show the calculated value as is
					newData.sellPrice = sellingPrice.toString()
				}

				// Update ref immediately to prevent stale closures
				lotFormDataRef.current = newData
				return newData
			})
		},
		[toEnglishNumbers]
	)

	// Debounced version to prevent rapid re-renders during typing
	const updateLotFormData = useCallback(
		(field, value) => {
			// For immediate UI feedback
			updateLotFormDataInternal(field, value)
		},
		[updateLotFormDataInternal]
	)

	// Modal heights based on current view to prevent keyboard-related re-rendering
	const modalHeights = useMemo(() => {
		if (modalView === 'edit' || modalView === 'delete') {
			return {
				main: screenHeight * 0.5,
				scroll: screenHeight * 0.65,
			}
		} else {
			return {
				main: screenHeight * 0.9,
				scroll: screenHeight * 0.7,
			}
		}
	}, [modalView])

	const handleInfoPress = useCallback(
		(item, index) => {
			// Prevent opening info modal if already in edit mode
			if (isEditModeRef.current) {
				return
			}

			const lotData = {
				stock: item.stock?.toString() || '0',
				buyPrice: item.buyPrice?.toString() || '0',
				sellPrice: item.sellPrice?.toString() || '0',
				mrp: item.mrp?.toString() || '0',
				retail: item.retail?.toString() || '0',
				vat: item.vat?.toString() || '0',
				includeVAT: item.includeVAT || false,
				mfgDate: formatDateForDisplay(item.mfgDate) || '',
				expDate: formatDateForDisplay(item.expDate) || '',
				locationAtStore: item.locationAtStore || '',
				note: item.note || '',
			}

			// Auto-calculate selling price based on current values (without translation)
			const retailPrice =
				parseFloat(toEnglishNumbers(lotData.retail || '0')) || 0
			const vatPercentage =
				parseFloat(toEnglishNumbers(lotData.vat || '0')) || 0
			const isVatIncluded = lotData.includeVAT || false

			let sellingPrice = retailPrice
			if (!isVatIncluded && vatPercentage > 0) {
				sellingPrice = retailPrice + (retailPrice * vatPercentage) / 100
			}
			lotData.sellPrice = sellingPrice.toString()

			// Update ref immediately before state updates
			lotFormDataRef.current = lotData

			// React automatically batches these state updates in React 18+
			setSelectedLotInfo({ ...item, lotIndex: index + 1 })
			setLotFormData(lotData)
			setOriginalLotFormData(lotData)
			setModalView('info')
		},
		[formatDateForDisplay, toEnglishNumbers]
	)

	const closeInfoModal = useCallback(() => {
		setModalView('list')
		setSelectedLotInfo(null)
		setLotFormData({})
		setOriginalLotFormData({})
		setQuantityAdjustMode(null)
		setTempQuantity('')
		// Clear ref as well
		lotFormDataRef.current = {}
	}, [])

	// Quantity adjustment functions
	const startQuantityAdd = useCallback(() => {
		setQuantityAdjustMode('add')
		setTempQuantity('0')
	}, [])

	const startQuantityDelete = useCallback(() => {
		setQuantityAdjustMode('delete')
		setTempQuantity('0')
	}, [])

	const cancelQuantityAdjust = useCallback(() => {
		setQuantityAdjustMode(null)
		setTempQuantity('')
	}, [])

	const confirmQuantityAdjust = useCallback(async () => {
		if (!selectedLotInfo || !quantityAdjustMode) return

		const englishQuantity = toEnglishNumbers(tempQuantity)
		const adjustAmount = parseFloat(englishQuantity) || 0
		const currentStock = parseFloat(selectedLotInfo.stock) || 0

		let newStock
		if (quantityAdjustMode === 'add') {
			newStock = currentStock + adjustAmount
		} else {
			newStock = currentStock - adjustAmount
			if (newStock < 0) {
				ToastAndroid.show(
					loc.t('lotSelector.cannotDeleteMoreThanAvailable') ||
						'Cannot delete more than available stock',
					ToastAndroid.SHORT
				)
				return
			}
		}

		try {
			const response = await fetchData(updateLot, {
				id: selectedLotInfo.id,
				lotData: { stock: newStock },
			})

			if (response.success) {
				ToastAndroid.show(
					loc.t('lotSelector.lotUpdated') || 'Lot updated successfully',
					ToastAndroid.SHORT
				)

				// Update local state
				setSelectedLotInfo((prev) => ({ ...prev, stock: newStock }))

				// Cancel adjustment mode
				cancelQuantityAdjust()

				// Refresh if callback provided
				if (refreshOnChange) {
					refreshOnChange()
				}
			} else {
				ToastAndroid.show(
					response.message ||
						loc.t('lotSelector.updateFailed') ||
						'Update failed',
					ToastAndroid.SHORT
				)
			}
		} catch (error) {
			ToastAndroid.show(
				loc.t('lotSelector.updateError') || 'Error updating lot',
				ToastAndroid.SHORT
			)
		}
	}, [
		selectedLotInfo,
		quantityAdjustMode,
		tempQuantity,
		toEnglishNumbers,
		fetchData,
		loc,
		cancelQuantityAdjust,
		refreshOnChange,
	])

	// Consolidated edit mode functions to prevent multiple state updates
	const enableEditMode = useCallback(() => {
		setModalView('edit')
		setStockValidationError('') // Clear validation error when entering edit mode
	}, [])

	// Use effect to handle keyboard opening when edit mode changes
	useEffect(() => {
		if (modalView === 'edit' && amountInputRef.current) {
			InteractionManager.runAfterInteractions(() => {
				// Use requestAnimationFrame for better timing
				requestAnimationFrame(() => {
					if (amountInputRef.current) {
						// First ensure the input is focusable
						amountInputRef.current.focus()

						// If focus doesn't trigger keyboard, try manual approach
						setTimeout(() => {
							if (amountInputRef.current) {
								amountInputRef.current.blur()
								setTimeout(() => {
									amountInputRef.current?.focus()
								}, 50)
							}
						}, 100)
					}
				})
			})
		}
	}, [modalView])

	const cancelEditMode = useCallback(() => {
		// Batch state updates to prevent multiple re-renders
		setModalView('info')
		setStockValidationError('') // Clear validation error
		setLotFormData((prevData) => {
			const resetData = { ...originalLotFormData }
			// Update ref immediately to stay in sync
			lotFormDataRef.current = resetData
			return resetData
		})
	}, [originalLotFormData])

	// Delete mode functions
	const enableDeleteMode = useCallback(() => {
		setModalView('delete')
		const fullStock = selectedLotInfo?.stock || 0
		// Ensure fullStock is a valid number
		const validStock =
			typeof fullStock === 'number' && !isNaN(fullStock) ? fullStock : 0
		setDeleteForm({
			deletingQuantity: 'full',
			productQuantity: validStock,
			reason: '',
			lossType: '',
			lossAmount: 0,
			lossPerUnit: 0,
			note: '',
		})
		setShowDeletingQuantityDropdown(false)
		setShowReasonDropdown(false)
		setShowLossTypeDropdown(false)
		setLossAmountError('') // Clear error when entering delete mode
		setProductQuantityError('') // Clear product quantity error
	}, [selectedLotInfo])

	// Close all dropdowns in delete form
	const closeAllDeleteDropdowns = useCallback(() => {
		setShowDeletingQuantityDropdown(false)
		setShowReasonDropdown(false)
		setShowLossTypeDropdown(false)
	}, [])

	// Use effect to handle keyboard opening when delete mode changes
	useEffect(() => {
		if (modalView === 'delete' && deleteReasonInputRef.current) {
			InteractionManager.runAfterInteractions(() => {
				requestAnimationFrame(() => {
					if (deleteReasonInputRef.current) {
						deleteReasonInputRef.current.focus()
						setTimeout(() => {
							if (deleteReasonInputRef.current) {
								deleteReasonInputRef.current.blur()
								setTimeout(() => {
									deleteReasonInputRef.current?.focus()
								}, 50)
							}
						}, 100)
					}
				})
			})
		}
	}, [modalView])

	const cancelDeleteMode = useCallback(() => {
		setModalView('info')
		setDeleteForm({
			deletingQuantity: 'full',
			productQuantity: 0,
			reason: '',
			lossType: '',
			lossAmount: 0,
			lossPerUnit: 0,
			note: '',
		})
		setShowDeletingQuantityDropdown(false)
		setShowReasonDropdown(false)
		setShowLossTypeDropdown(false)
		setLossAmountError('') // Clear error when cancelling delete mode
		setProductQuantityError('') // Clear product quantity error
	}, [])

	// Handle lot deletion
	const handleLotDeletion = useCallback(async () => {
		if (!isDeleteFormValid()) {
			ToastAndroid.show(
				loc.t('lotSelector.fillRequiredFields') ||
					'Please fill in all required fields',
				ToastAndroid.SHORT
			)
			return
		}

		// Ensure stock is a valid positive integer
		const stockValue = parseInt(deleteForm.productQuantity, 10)
		if (isNaN(stockValue) || stockValue <= 0) {
			ToastAndroid.show(
				loc.t('lotSelector.invalidQuantity') || 'Invalid quantity value',
				ToastAndroid.SHORT
			)
			return
		}

		try {
			const payload = {
				reason: deleteForm.reason,
				lossType: deleteForm.lossType,
				lossAmount: deleteForm.lossAmount,
				stock: stockValue,
				note: deleteForm.note || undefined,
				lotId: selectedLotInfo?.id?.toString(),
			}
			const res = await fetchData(deleteLot, payload)
			if (res.success) {
				ToastAndroid.show(
					loc.t('lotSelector.deletionSuccess') || 'Lot deleted successfully',
					ToastAndroid.SHORT
				)
				setModalView('list')
				closeInfoModal()
				if (refreshOnChange) {
					await refreshOnChange(selectedLotInfo?.shopVariantId)
				}
			} else {
				ToastAndroid.show(
					loc.t('lotSelector.deletionFailure') || 'Failed to delete lot',
					ToastAndroid.SHORT
				)
			}
		} catch (e) {
			ToastAndroid.show(
				loc.t('lotSelector.deletionFailure') || 'Failed to delete lot',
				ToastAndroid.SHORT
			)
		}
	}, [
		deleteForm,
		selectedLotInfo,
		isDeleteFormValid,
		fetchData,
		closeInfoModal,
	])

	// Handle lot form submission with Formik
	const handleLotFormSubmit = useCallback(
		async (values, { setSubmitting }) => {
			try {
				// Validate stock amount - cannot be 0
				const stockValue = parseFloat(
					toEnglishNumbers(values.stock?.toString() || '0')
				)
				if (stockValue === 0) {
					setStockValidationError(
						loc.t('lotSelector.stockCannotBeZero') ||
							'Amount cannot be 0, please use delete option to delete a lot.'
					)
					setSubmitting(false)
					return
				}

				// Clear any previous error
				setStockValidationError('')

				const updateData = {}

				// Convert all values to English numbers before sending to API
				if (values.stock !== originalLotFormData.stock) {
					updateData.stock = parseFloat(
						toEnglishNumbers(values.stock?.toString() || '0')
					)
				}
				if (values.buyPrice !== originalLotFormData.buyPrice) {
					updateData.buyPrice = parseFloat(
						toEnglishNumbers(values.buyPrice?.toString() || '0')
					)
				}
				if (values.sellPrice !== originalLotFormData.sellPrice) {
					updateData.sellPrice = parseFloat(
						toEnglishNumbers(values.sellPrice?.toString() || '0')
					)
				}
				if (values.mrp !== originalLotFormData.mrp) {
					updateData.mrp = parseFloat(
						toEnglishNumbers(values.mrp?.toString() || '0')
					)
				}
				if (values.retail !== originalLotFormData.retail) {
					updateData.retail = parseFloat(
						toEnglishNumbers(values.retail?.toString() || '0')
					)
				}
				if (values.vat !== originalLotFormData.vat) {
					updateData.vat = parseFloat(
						toEnglishNumbers(values.vat?.toString() || '0')
					)
				}
				if (values.includeVAT !== originalLotFormData.includeVAT) {
					updateData.includeVAT = values.includeVAT
				}
				if (values.mfgDate !== originalLotFormData.mfgDate) {
					updateData.mfgDate = extractNumericDate(values.mfgDate)
				}
				if (values.expDate !== originalLotFormData.expDate) {
					updateData.expDate = extractNumericDate(values.expDate)
				}
				if (values.locationAtStore !== originalLotFormData.locationAtStore) {
					updateData.locationAtStore = values.locationAtStore
				}
				if (values.note !== originalLotFormData.note) {
					updateData.note = values.note
				}

				const result = await fetchData(updateLot, {
					id: selectedLotInfo?.id,
					lotData: updateData,
				})

				if (result?.success) {
					ToastAndroid.show(
						loc.t('lotSelector.lotUpdateSuccess') || 'Lot updated successfully',
						ToastAndroid.SHORT
					)

					//NOTE : call refresh func in parent to refresh lot list
					await refreshOnChange?.(result.data.shopVariantId)

					// Update original form data to reflect the changes
					setOriginalLotFormData({ ...values })

					// If closeAfterUpdate flag is set, close the main modal too
					if (closeAfterUpdate) {
						closeModal()
					} else {
						// Return to list view
						setModalView('list')
					}
				} else {
					ToastAndroid.show(
						loc.t('lotSelector.lotUpdateError') || 'Failed to update lot',
						ToastAndroid.SHORT
					)
				}
			} catch (error) {
				console.error('Error updating lot:', error)
				ToastAndroid.show(
					loc.t('lotSelector.lotUpdateError') || 'Failed to update lot',
					ToastAndroid.SHORT
				)
			} finally {
				setSubmitting(false)
			}
		},
		[
			selectedLotInfo?.id,
			originalLotFormData,
			toEnglishNumbers,
			formatDateForStorage,
			fetchData,
			loc,
		]
	)

	// Handle inline lot editing with optimized API call
	const handleInlineLotEdit = useCallback(async () => {
		try {
			const updateData = {}
			const currentFormData = lotFormDataRef.current

			// Compare with original values and include only changed ones
			// Convert all values to English numbers before sending to API
			if (currentFormData.stock !== originalLotFormData.stock) {
				updateData.stock = parseFloat(toEnglishNumbers(currentFormData.stock))
			}
			if (currentFormData.buyPrice !== originalLotFormData.buyPrice) {
				updateData.buyPrice = parseFloat(
					toEnglishNumbers(currentFormData.buyPrice)
				)
			}
			if (currentFormData.sellPrice !== originalLotFormData.sellPrice) {
				updateData.sellPrice = parseFloat(
					toEnglishNumbers(currentFormData.sellPrice)
				)
			}
			if (currentFormData.mrp !== originalLotFormData.mrp) {
				updateData.mrp = parseFloat(toEnglishNumbers(currentFormData.mrp))
			}
			if (currentFormData.retail !== originalLotFormData.retail) {
				updateData.retail = parseFloat(toEnglishNumbers(currentFormData.retail))
			}
			if (currentFormData.vat !== originalLotFormData.vat) {
				updateData.vat = parseFloat(toEnglishNumbers(currentFormData.vat))
			}
			if (currentFormData.includeVAT !== originalLotFormData.includeVAT) {
				updateData.includeVAT = currentFormData.includeVAT
			}
			if (currentFormData.mfgDate !== originalLotFormData.mfgDate) {
				updateData.mfgDate = formatDateForStorage(currentFormData.mfgDate)
			}
			if (currentFormData.expDate !== originalLotFormData.expDate) {
				updateData.expDate = formatDateForStorage(currentFormData.expDate)
			}
			if (
				currentFormData.locationAtStore !== originalLotFormData.locationAtStore
			) {
				updateData.locationAtStore = currentFormData.locationAtStore
			}
			if (currentFormData.note !== originalLotFormData.note) {
				updateData.note = currentFormData.note
			}

			const result = await fetchData(updateLot, {
				id: selectedLotInfo?.id,
				lotData: updateData,
			})

			if (result?.success) {
				ToastAndroid.show(
					loc.t('lotSelector.lotUpdateSuccess') || 'Lot updated successfully',
					ToastAndroid.SHORT
				)

				// Update original form data to reflect the changes
				setOriginalLotFormData({ ...currentFormData })

				// Return to info view
				setModalView('info')

				// Refresh lot data if callback provided
				if (refreshOnChange) {
					await refreshOnChange(selectedLotInfo?.shopVariantId)
				}
			} else {
				ToastAndroid.show(
					loc.t('lotSelector.lotUpdateError') || 'Failed to update lot',
					ToastAndroid.SHORT
				)
			}
		} catch (error) {
			console.error('Error updating lot:', error)
			ToastAndroid.show(
				loc.t('lotSelector.lotUpdateError') || 'Failed to update lot',
				ToastAndroid.SHORT
			)
		}
	}, [
		selectedLotInfo?.id,
		originalLotFormData,
		toEnglishNumbers,
		formatDateForStorage,
		fetchData,
		loc,
	])

	const computeAutoLossAmount = useCallback(
		(lot, lossTypeValue) => {
			if (!lot) return 0
			if (lossTypeValue === 'none') return 0
			if (lossTypeValue === 'complete') {
				return (lot.stock || 0) * (lot.buyPrice || 0)
			}
			return deleteForm.lossAmount
		},
		[deleteForm.lossAmount]
	)

	// Memoized lot item component
	const LotItem = memo(
		({ item, index }) => {
			const expiringSoon = isExpiringSoon(item.expDate)
			const expired = isExpired(item.expDate)

			return (
				<TouchableOpacity
					key={item.id}
					onPress={() => handleLotSelection(item)}
					style={styles.lotItemContainer}
					activeOpacity={0.7}
					disabled={false}
				>
					<View
						style={[
							styles.lotItem,
							(expiringSoon || expired) && styles.lotItemExpiring,
						]}
					>
						<View style={styles.lotHeader}>
							<Text style={styles.lotNumber}>
								{loc.t('lotSelector.lot')} {translateNumber(index + 1)}
							</Text>
							<View style={styles.headerRight}>
								<View
									style={[
										styles.quantityBadge,
										item.stock < 10 && styles.lowStockBadge,
									]}
								>
									<Text
										style={[
											styles.quantityText,
											item.stock < 10 && styles.lowStockText,
										]}
									>
										{translateNumber(item.stock)} {loc.t('lotSelector.units')}
									</Text>
								</View>
								<TouchableOpacity
									onPress={() => handleInfoPress(item, index)}
									style={styles.infoButton}
									activeOpacity={0.7}
									disabled={modalView === 'edit'}
								>
									<MaterialIcons
										name="info-outline"
										size={18}
										color="#6B7280"
									/>
								</TouchableOpacity>
							</View>
						</View>
						<View style={styles.lotDetails}>
							<View style={styles.buySellRow}>
								<Text style={styles.lotDetailText}>
									<Text style={styles.lotDetailLabel}>
										{loc.t('lotSelector.buy')}:
									</Text>{' '}
									{translateAmount(item.buyPrice)} |
									<Text style={styles.lotDetailLabel}>
										{' '}
										{loc.t('lotSelector.sell')}:
									</Text>{' '}
									{translateAmount(item.sellPrice)}
								</Text>
							</View>
							{item.expDate && (
								<Text style={styles.lotDetailText}>
									<Text style={styles.lotDetailLabel}>
										{loc.t('lotSelector.expiry')}:
									</Text>{' '}
									<Text
										style={
											expired
												? styles.expiredText
												: expiringSoon
													? styles.expiringText
													: null
										}
									>
										{formatDate(item.expDate)}
									</Text>
								</Text>
							)}
							{expired && (
								<Text style={styles.expiredWarningText}>
									❌ {loc.t('lotSelector.expired')}
								</Text>
							)}
							{expiringSoon && !expired && (
								<Text style={styles.warningText}>
									⚠️ {loc.t('lotSelector.expiringSoon')}
								</Text>
							)}
						</View>
					</View>
				</TouchableOpacity>
			)
		},
		(prevProps, nextProps) => {
			// Custom comparison to prevent unnecessary re-renders
			return (
				prevProps.item.id === nextProps.item.id &&
				prevProps.item.stock === nextProps.item.stock &&
				prevProps.item.buyPrice === nextProps.item.buyPrice &&
				prevProps.item.sellPrice === nextProps.item.sellPrice &&
				prevProps.item.expDate === nextProps.item.expDate &&
				prevProps.index === nextProps.index
			)
		}
	)

	// Render the appropriate modal content based on current view
	const renderModalContent = () => {
		if (modalView === 'list') {
			return (
				<>
					<View style={styles.handleContainer}>
						<View style={styles.handleBar} />
					</View>

					<View style={styles.header}>
						<View style={styles.headerTextContainer}>
							<Text
								style={styles.headerTitle}
								numberOfLines={1}
								ellipsizeMode="tail"
							>
								{loc.t('lotSelector.lotFor')}
							</Text>
							<Text
								style={styles.headerSubtitle}
								numberOfLines={2}
								ellipsizeMode="tail"
							>
								{loc.t('lotSelector.product')}:{' '}
								{variant?.name || loc.t('lotSelector.selectedVariant')}
								{'\n'}
								{loc.t('lotSelector.variant')}:{' '}
								{variant?.variantName || loc.t('lotSelector.selectedVariant')}
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

					<View style={styles.contentContainer}>
						{lots && lots.length > 0 ? (
							<FlatList
								data={lots}
								renderItem={renderLotItem}
								keyExtractor={keyExtractor}
								showsVerticalScrollIndicator={false}
								contentContainerStyle={styles.flatListContent}
								style={[styles.flatList, { maxHeight: screenHeight * 0.55 }]}
								removeClippedSubviews={true}
								maxToRenderPerBatch={10}
								windowSize={10}
								initialNumToRender={5}
								getItemLayout={(data, index) => ({
									length: 120,
									offset: 120 * index,
									index,
								})}
							/>
						) : (
							<View style={styles.emptyContainer}>
								<Text style={styles.emptyText}>
									{loc.t('lotSelector.noLotsAvailable')}
								</Text>
							</View>
						)}
						{showCreate && !showInfo && (
							<View style={styles.buttonContainer}>
								<TouchableOpacity
									onPress={closeModal}
									style={styles.cancelButton}
									activeOpacity={0.8}
								>
									<Text style={styles.cancelButtonText}>
										{loc.t('lotSelector.cancel')}
									</Text>
								</TouchableOpacity>

								<TouchableOpacity
									onPress={handleCreateNewLot}
									style={styles.createButton}
									activeOpacity={0.8}
								>
									<Text style={styles.createButtonText}>
										{loc.t('lotSelector.createNewLot')}
									</Text>
								</TouchableOpacity>
							</View>
						)}
					</View>
				</>
			)
		}

		// Info, Edit, or Delete view
		if (!selectedLotInfo) return null

		return (
			<>
				<View style={styles.handleContainer}>
					<View style={styles.handleBar} />
				</View>

				<View style={styles.header}>
					<View style={styles.headerTextContainer}>
						<Text style={styles.headerTitle}>
							{loc.t('lotSelector.lot')}{' '}
							{translateNumber(selectedLotInfo.lotIndex)}
						</Text>
					</View>
					<TouchableOpacity
						onPress={
							modalView === 'edit'
								? cancelEditMode
								: modalView === 'delete'
									? cancelDeleteMode
									: closeInfoModal
						}
						style={styles.closeButton}
						activeOpacity={0.7}
					>
						<MaterialIcons name="close" size={18} color="#6B7280" />
					</TouchableOpacity>
				</View>

				<View style={styles.contentContainer}>
					<Formik
						initialValues={{
							stock: lotFormData.stock || '',
							buyPrice: lotFormData.buyPrice || '',
							sellPrice: lotFormData.sellPrice || '',
							mrp: lotFormData.mrp || '',
							retail: lotFormData.retail || '',
							vat: lotFormData.vat || '',
							includeVAT: lotFormData.includeVAT || false,
							mfgDate: lotFormData.mfgDate || '',
							expDate: lotFormData.expDate || '',
							locationAtStore: lotFormData.locationAtStore || '',
							note: lotFormData.note || '',
						}}
						validationSchema={lotValidationSchema}
						onSubmit={handleLotFormSubmit}
						enableReinitialize={true}
					>
						{({
							handleChange,
							handleSubmit,
							values,
							errors,
							touched,
							setFieldValue,
							isSubmitting,
						}) => {
							// Store setFieldValue in ref for date picker access
							setFieldValueRef.current = setFieldValue

							// Auto-calculate selling price when retail, vat, or includeVAT changes
							const calculateSellingPrice = useCallback(() => {
								const retailPrice =
									parseFloat(toEnglishNumbers(values.retail || '0')) || 0
								const vatPercentage =
									parseFloat(toEnglishNumbers(values.vat || '0')) || 0
								const isVatIncluded = values.includeVAT || false

								let sellingPrice = retailPrice
								if (!isVatIncluded && vatPercentage > 0) {
									sellingPrice =
										retailPrice + (retailPrice * vatPercentage) / 100
								}

								setFieldValue('sellPrice', sellingPrice.toString())
							}, [
								values.retail,
								values.vat,
								values.includeVAT,
								setFieldValue,
								toEnglishNumbers,
							])

							// Auto-calculate when relevant fields change
							useEffect(() => {
								calculateSellingPrice()
							}, [
								values.retail,
								values.vat,
								values.includeVAT,
								calculateSellingPrice,
							])

							return (
								<>
									<BottomSheetScrollView
										style={{
											maxHeight: modalHeights.scroll,
											backgroundColor: '#F0F8FF',
										}}
										contentContainerStyle={{
											paddingHorizontal: 16,
											paddingBottom: 40,
										}}
										showsVerticalScrollIndicator={false}
										bounces={false}
										keyboardShouldPersistTaps="handled"
									>
										{modalView === 'delete' && (
											<TouchableWithoutFeedback
												onPress={closeAllDeleteDropdowns}
											>
												<View>
													{/* Row 1: Deleting Quantity and Product Quantity */}
													<View style={styles.infoRowContainer}>
														<View style={styles.infoHalfFieldContainer}>
															<Text style={styles.overlayLabel}>
																{loc.t('lotSelector.deletingQuantity') ||
																	'Deleting Quantity'}
																:
															</Text>
															<TouchableOpacity
																style={styles.infoInput}
																onPress={(e) => {
																	e.stopPropagation()
																	setShowDeletingQuantityDropdown(
																		!showDeletingQuantityDropdown
																	)
																}}
															>
																<View style={styles.dropdownButtonContent}>
																	<Text style={styles.dropdownText}>
																		{
																			deletingQuantityOptions.find(
																				(opt) =>
																					opt.key ===
																					deleteForm.deletingQuantity
																			)?.label
																		}
																	</Text>
																	<MaterialIcons
																		name="keyboard-arrow-down"
																		size={20}
																		color="#6B7280"
																	/>
																</View>
															</TouchableOpacity>
															{showDeletingQuantityDropdown && (
																<TouchableWithoutFeedback
																	onPress={(e) => e.stopPropagation()}
																>
																	<View style={styles.floatingDropdownMenu}>
																		{deletingQuantityOptions.map((option) => (
																			<TouchableOpacity
																				key={option.key}
																				style={styles.dropdownItem}
																				onPress={() => {
																					const fullStock =
																						selectedLotInfo?.stock || 0
																					setDeleteForm((prev) => ({
																						...prev,
																						deletingQuantity: option.key,
																						productQuantity:
																							option.key === 'full'
																								? fullStock
																								: 0,
																					}))
																					setShowDeletingQuantityDropdown(false)
																					setProductQuantityError('')
																				}}
																			>
																				<Text style={styles.dropdownItemText}>
																					{option.label}
																				</Text>
																			</TouchableOpacity>
																		))}
																	</View>
																</TouchableWithoutFeedback>
															)}
														</View>

														<View style={styles.infoHalfFieldContainer}>
															<Text style={styles.overlayLabel}>
																{loc.t('lotSelector.productQuantity') ||
																	'Product Quantity'}
																:
															</Text>
															<BottomSheetTextInput
																style={[
																	styles.infoInput,
																	deleteForm.deletingQuantity === 'full' &&
																		styles.infoDisabledInput,
																]}
																value={translateNumber(
																	deleteForm.productQuantity.toString()
																)}
																onChangeText={(text) => {
																	const englishNumber = toEnglishNumbers(text)
																	const parsedQuantity =
																		parseFloat(englishNumber)
																	const quantityValue = isNaN(parsedQuantity)
																		? 0
																		: parsedQuantity
																	const fullStock = selectedLotInfo?.stock || 0

																	// Validate quantity
																	if (quantityValue === 0) {
																		setProductQuantityError(
																			loc.t(
																				'lotSelector.quantityCannotBeZero'
																			) || 'Quantity cannot be 0'
																		)
																	} else if (quantityValue > fullStock) {
																		setProductQuantityError(
																			loc.t(
																				'lotSelector.quantityExceedsStock'
																			) ||
																				'Quantity cannot exceed current stock'
																		)
																	} else {
																		setProductQuantityError('')
																	}

																	// Update quantity and recalculate losses
																	setDeleteForm((prev) => {
																		const buyPrice =
																			selectedLotInfo?.buyPrice || 0
																		const newLossPerUnit = prev.lossPerUnit
																		const newLossAmount =
																			quantityValue * newLossPerUnit

																		return {
																			...prev,
																			productQuantity: quantityValue,
																			lossAmount: newLossAmount,
																		}
																	})
																}}
																placeholder="0"
																placeholderTextColor="rgba(0,0,0,0.54)"
																keyboardType="numeric"
																blurOnSubmit={false}
																returnKeyType="next"
																onFocus={closeAllDeleteDropdowns}
																editable={
																	deleteForm.deletingQuantity === 'partial'
																}
															/>
															{productQuantityError && (
																<Text style={styles.errorText}>
																	{productQuantityError}
																</Text>
															)}
														</View>
													</View>

													{/* Row 2: Delete Reason and Loss Type */}
													<View style={styles.infoRowContainer}>
														<View style={styles.infoHalfFieldContainer}>
															<Text style={styles.overlayLabel}>
																{loc.t('lotSelector.deleteReason')}:
															</Text>
															<TouchableOpacity
																style={styles.infoInput}
																onPress={(e) => {
																	e.stopPropagation()
																	setShowReasonDropdown(!showReasonDropdown)
																}}
															>
																<View style={styles.dropdownButtonContent}>
																	<Text
																		style={[
																			styles.dropdownText,
																			!deleteForm.reason &&
																				styles.placeholderText,
																		]}
																	>
																		{deleteForm.reason
																			? deleteReasonOptions.find(
																					(opt) => opt.key === deleteForm.reason
																				)?.label
																			: loc.t('lotSelector.selectReason')}
																	</Text>
																	<MaterialIcons
																		name="keyboard-arrow-down"
																		size={20}
																		color="#6B7280"
																	/>
																</View>
															</TouchableOpacity>
															{showReasonDropdown && (
																<TouchableWithoutFeedback
																	onPress={(e) => e.stopPropagation()}
																>
																	<View style={styles.floatingDropdownMenu}>
																		{deleteReasonOptions.map((option) => (
																			<TouchableOpacity
																				key={option.key}
																				style={styles.dropdownItem}
																				onPress={() => {
																					setDeleteForm((prev) => ({
																						...prev,
																						reason: option.key,
																					}))
																					setShowReasonDropdown(false)
																				}}
																			>
																				<Text style={styles.dropdownItemText}>
																					{option.label}
																				</Text>
																			</TouchableOpacity>
																		))}
																	</View>
																</TouchableWithoutFeedback>
															)}
														</View>

														<View style={styles.infoHalfFieldContainer}>
															<Text style={styles.overlayLabel}>
																{loc.t('lotSelector.lossType')}:
															</Text>
															<TouchableOpacity
																style={styles.infoInput}
																onPress={(e) => {
																	e.stopPropagation()
																	setShowLossTypeDropdown(!showLossTypeDropdown)
																}}
															>
																<View style={styles.dropdownButtonContent}>
																	<Text
																		style={[
																			styles.dropdownText,
																			!deleteForm.lossType &&
																				styles.placeholderText,
																		]}
																	>
																		{deleteForm.lossType
																			? lossTypeOptions.find(
																					(opt) =>
																						opt.key === deleteForm.lossType
																				)?.label
																			: loc.t('lotSelector.selectLossType')}
																	</Text>
																	<MaterialIcons
																		name="keyboard-arrow-down"
																		size={20}
																		color="#6B7280"
																	/>
																</View>
															</TouchableOpacity>
															{showLossTypeDropdown && (
																<TouchableWithoutFeedback
																	onPress={(e) => e.stopPropagation()}
																>
																	<View style={styles.floatingDropdownMenu}>
																		{lossTypeOptions.map((option) => (
																			<TouchableOpacity
																				key={option.key}
																				style={styles.dropdownItem}
																				onPress={() => {
																					const buyPrice =
																						selectedLotInfo?.buyPrice || 0
																					const quantity =
																						deleteForm.productQuantity

																					let newLossAmount = 0
																					let newLossPerUnit = 0

																					if (option.key === 'FULL_LOSS') {
																						newLossAmount = quantity * buyPrice
																						newLossPerUnit = buyPrice
																					} else if (option.key === 'NO_LOSS') {
																						newLossAmount = 0
																						newLossPerUnit = 0
																					}
																					// For PARTIAL_LOSS, keep current values

																					setDeleteForm((prev) => ({
																						...prev,
																						lossType: option.key,
																						lossAmount:
																							option.key === 'PARTIAL_LOSS'
																								? prev.lossAmount
																								: newLossAmount,
																						lossPerUnit:
																							option.key === 'PARTIAL_LOSS'
																								? prev.lossPerUnit
																								: newLossPerUnit,
																					}))
																					setShowLossTypeDropdown(false)
																					setLossAmountError('') // Clear error when changing loss type
																				}}
																			>
																				<Text style={styles.dropdownItemText}>
																					{option.label}
																				</Text>
																			</TouchableOpacity>
																		))}
																	</View>
																</TouchableWithoutFeedback>
															)}
														</View>
													</View>

													{/* Row: Loss Per Unit and Loss Amount */}
													<View style={styles.infoRowContainer}>
														<View style={styles.infoHalfFieldContainer}>
															<Text style={styles.overlayLabel}>
																{loc.t('lotSelector.lossPerUnit') ||
																	'Loss Per Unit'}
																:
															</Text>
															<BottomSheetTextInput
																style={[
																	styles.infoInput,
																	(deleteForm.lossType === 'NO_LOSS' ||
																		deleteForm.lossType === 'FULL_LOSS') &&
																		styles.infoDisabledInput,
																]}
																value={translateNumber(
																	deleteForm.lossPerUnit.toString()
																)}
																onChangeText={(text) => {
																	const englishNumber = toEnglishNumbers(text)
																	const parsedLossPerUnit =
																		parseFloat(englishNumber) || 0

																	// Calculate total loss amount from per unit
																	const totalLossAmount =
																		parsedLossPerUnit *
																		deleteForm.productQuantity

																	const buyPrice =
																		selectedLotInfo?.buyPrice || 0
																	const maxLossPerUnit = buyPrice

																	// Validate loss per unit
																	if (
																		deleteForm.lossType === 'PARTIAL_LOSS' &&
																		parsedLossPerUnit > maxLossPerUnit
																	) {
																		setLossAmountError(
																			loc.t(
																				'lotSelector.lossPerUnitExceedsBuyPrice'
																			) ||
																				'Loss per unit cannot exceed buy price'
																		)
																	} else {
																		setLossAmountError('')
																	}

																	setDeleteForm((prev) => ({
																		...prev,
																		lossPerUnit: parsedLossPerUnit,
																		lossAmount: totalLossAmount,
																	}))
																}}
																placeholder="0"
																placeholderTextColor="rgba(0,0,0,0.54)"
																keyboardType="numeric"
																blurOnSubmit={false}
																returnKeyType="next"
																onFocus={closeAllDeleteDropdowns}
																editable={
																	deleteForm.lossType === 'PARTIAL_LOSS'
																}
															/>
														</View>

														<View style={styles.infoHalfFieldContainer}>
															<Text style={styles.overlayLabel}>
																{loc.t('lotSelector.lossAmount')}:
															</Text>
															<BottomSheetTextInput
																style={[
																	styles.infoInput,
																	(deleteForm.lossType === 'NO_LOSS' ||
																		deleteForm.lossType === 'FULL_LOSS') &&
																		styles.infoDisabledInput,
																]}
																value={translateNumber(
																	deleteForm.lossAmount.toString()
																)}
																onChangeText={(text) => {
																	const englishNumber = toEnglishNumbers(text)
																	const parsedAmount =
																		parseFloat(englishNumber) || 0

																	// Calculate loss per unit from total amount
																	const lossPerUnit =
																		deleteForm.productQuantity > 0
																			? parsedAmount /
																				deleteForm.productQuantity
																			: 0

																	// Calculate max total loss based on buy price
																	const buyPrice =
																		selectedLotInfo?.buyPrice || 0
																	const maxTotalLoss =
																		buyPrice * deleteForm.productQuantity

																	// Validate for partial loss
																	if (deleteForm.lossType === 'PARTIAL_LOSS') {
																		if (parsedAmount < 0) {
																			setLossAmountError(
																				loc.t(
																					'lotSelector.lossAmountNegative'
																				) || 'Loss amount cannot be negative'
																			)
																		} else if (parsedAmount > maxTotalLoss) {
																			setLossAmountError(
																				loc.t(
																					'lotSelector.lossAmountExceedsTotal'
																				) ||
																					'Loss amount cannot exceed total buy price'
																			)
																		} else {
																			setLossAmountError('')
																		}
																	}

																	setDeleteForm((prev) => ({
																		...prev,
																		lossAmount: parsedAmount,
																		lossPerUnit: lossPerUnit,
																	}))
																}}
																placeholder="0"
																placeholderTextColor="rgba(0,0,0,0.54)"
																keyboardType="numeric"
																blurOnSubmit={false}
																returnKeyType="next"
																onFocus={closeAllDeleteDropdowns}
																editable={
																	deleteForm.lossType === 'PARTIAL_LOSS'
																}
															/>
														</View>
													</View>
													{lossAmountError && (
														<Text style={styles.errorText}>
															{lossAmountError}
														</Text>
													)}

													<View style={styles.infoFieldContainer}>
														<Text style={styles.overlayLabel}>
															{loc.t('lotSelector.note')}:
														</Text>
														<BottomSheetTextInput
															style={[
																styles.infoInput,
																{ height: 80, textAlignVertical: 'top' },
															]}
															value={deleteForm.note}
															onChangeText={(text) =>
																setDeleteForm((prev) => ({
																	...prev,
																	note: text,
																}))
															}
															placeholder={loc.t('lotSelector.enterNote')}
															placeholderTextColor="rgba(0,0,0,0.54)"
															multiline
															numberOfLines={3}
															blurOnSubmit={false}
															returnKeyType="done"
															onFocus={closeAllDeleteDropdowns}
														/>
													</View>
												</View>
											</TouchableWithoutFeedback>
										)}

										{modalView !== 'delete' && (
											<>
												{/* Total Quantity Display - Show when in quantity adjust mode */}
												{quantityAdjustMode && (
													<View style={styles.infoFieldContainer}>
														<Text style={styles.totalLabel}>
															{loc.t('lotSelector.totalQuantity')}:{' '}
															{translateNumber(
																quantityAdjustMode === 'add'
																	? parseFloat(selectedLotInfo?.stock || 0) +
																			parseFloat(
																				toEnglishNumbers(tempQuantity) || 0
																			)
																	: parseFloat(selectedLotInfo?.stock || 0) -
																			parseFloat(
																				toEnglishNumbers(tempQuantity) || 0
																			)
															)}{' '}
															{loc.t('lotSelector.units')}
														</Text>
													</View>
												)}

												{/* Row 1: Amount and Buy Price */}
												<View style={styles.infoRowContainer}>
													<View style={styles.infoHalfFieldContainer}>
														<Text style={styles.overlayLabel}>
															{quantityAdjustMode === 'add'
																? loc.t('lotSelector.addingAmount')
																: quantityAdjustMode === 'delete'
																	? loc.t('lotSelector.deletingAmount')
																	: loc.t('lotSelector.amount')}{' '}
															*
														</Text>
														<BottomSheetTextInput
															ref={amountInputRef}
															style={[
																styles.infoInput,
																styles.infoDisabledInput,
															]}
															value={values.stock}
															placeholder="0"
															placeholderTextColor="rgba(0,0,0,0.54)"
															keyboardType="numeric"
															editable={false}
															showSoftInputOnFocus={false}
															blurOnSubmit={false}
															returnKeyType="next"
														/>
														{touched.stock &&
															errors.stock &&
															!quantityAdjustMode && (
																<Text style={styles.errorText}>
																	{errors.stock}
																</Text>
															)}
													</View>

													<View style={styles.infoHalfFieldContainer}>
														<Text style={styles.overlayLabel}>
															{loc.t('lotSelector.buyPrice')} *
														</Text>
														<BottomSheetTextInput
															style={[
																styles.infoInput,
																styles.infoDisabledInput,
															]}
															value={values.buyPrice}
															placeholder="0"
															placeholderTextColor="rgba(0,0,0,0.54)"
															keyboardType="numeric"
															editable={false}
															blurOnSubmit={false}
															returnKeyType="next"
														/>
														{touched.buyPrice && errors.buyPrice && (
															<Text style={styles.errorText}>
																{errors.buyPrice}
															</Text>
														)}
													</View>
												</View>

												{/* Row 2: MRP and Retail */}
												<View style={styles.infoRowContainer}>
													<View style={styles.infoHalfFieldContainer}>
														<Text style={styles.overlayLabel}>
															{loc.t('lotSelector.mrp')} *
														</Text>
														<BottomSheetTextInput
															style={[
																styles.infoInput,
																modalView !== 'edit' &&
																	styles.infoDisabledInput,
															]}
															value={values.mrp}
															onChangeText={handleChange('mrp')}
															placeholder="0"
															placeholderTextColor="rgba(0,0,0,0.54)"
															keyboardType="numeric"
															editable={modalView === 'edit'}
															blurOnSubmit={false}
															returnKeyType="next"
														/>
														{touched.mrp && errors.mrp && (
															<Text style={styles.errorText}>{errors.mrp}</Text>
														)}
													</View>

													<View style={styles.infoHalfFieldContainer}>
														<Text style={styles.overlayLabel}>
															{loc.t('lotSelector.retail')}
														</Text>
														<BottomSheetTextInput
															style={[
																styles.infoInput,
																modalView !== 'edit' &&
																	styles.infoDisabledInput,
															]}
															value={values.retail}
															onChangeText={handleChange('retail')}
															placeholder="0"
															placeholderTextColor="rgba(0,0,0,0.54)"
															keyboardType="numeric"
															editable={modalView === 'edit'}
															blurOnSubmit={false}
															returnKeyType="next"
														/>
														{touched.retail && errors.retail && (
															<Text style={styles.errorText}>
																{errors.retail}
															</Text>
														)}
													</View>
												</View>

												{/* Row 3: VAT and Selling Price */}
												<View style={styles.infoRowContainer}>
													<View style={styles.infoHalfFieldContainer}>
														<Text style={styles.overlayLabel}>
															{loc.t('lotSelector.vat')} (%)
														</Text>
														<View style={styles.vatInputContainer}>
															<BottomSheetTextInput
																style={[
																	styles.infoInput,
																	styles.vatInputWithToggle,
																	modalView !== 'edit' &&
																		styles.infoDisabledInput,
																]}
																value={values.vat}
																onChangeText={handleChange('vat')}
																placeholder="0"
																placeholderTextColor="rgba(0,0,0,0.54)"
																keyboardType="numeric"
																editable={modalView === 'edit'}
																blurOnSubmit={false}
																returnKeyType="next"
															/>
															<View style={styles.vatToggleWrapper}>
																<Switch
																	value={values.includeVAT}
																	onValueChange={(value) =>
																		setFieldValue('includeVAT', value)
																	}
																	trackColor={{
																		false: '#d3d3d3',
																		true: '#195FE1',
																	}}
																	thumbColor={
																		values.includeVAT ? '#ffffff' : '#f4f3f4'
																	}
																	disabled={modalView !== 'edit'}
																	style={styles.vatToggleSwitch}
																/>
																<Text style={styles.vatToggleText}>
																	{loc.t('lotSelector.vatIncluded')}
																</Text>
															</View>
														</View>
														{touched.vat && errors.vat && (
															<Text style={styles.errorText}>{errors.vat}</Text>
														)}
													</View>

													<View style={styles.infoHalfFieldContainer}>
														<Text style={styles.overlayLabel}>
															{loc.t('lotSelector.sellPrice')} *
														</Text>
														<BottomSheetTextInput
															style={[
																styles.infoInput,
																styles.infoDisabledInput, // Always disabled since it's auto-calculated
															]}
															value={values.sellPrice}
															placeholder="0"
															placeholderTextColor="rgba(0,0,0,0.54)"
															keyboardType="numeric"
															editable={false} // Always read-only
															blurOnSubmit={false}
															returnKeyType="next"
														/>
														{touched.sellPrice && errors.sellPrice && (
															<Text style={styles.errorText}>
																{errors.sellPrice}
															</Text>
														)}
													</View>
												</View>

												{/* Row 4: Manufacturing Date and Expiry Date */}
												<View style={styles.infoRowContainer}>
													<View style={styles.infoHalfFieldContainer}>
														<Text style={styles.overlayLabel}>
															{loc.t('lotSelector.manufacturingDate')}
														</Text>
														<TouchableOpacity
															style={[
																styles.infoInput,
																modalView !== 'edit' &&
																	styles.infoDisabledInput,
															]}
															onPress={
																modalView === 'edit' ? openMfgDatePicker : null
															}
															disabled={modalView !== 'edit'}
														>
															<View style={styles.datePickerButton}>
																<Text
																	style={
																		values.mfgDate
																			? styles.datePickerText
																			: styles.datePickerPlaceholder
																	}
																>
																	{values.mfgDate || 'DD/MM/YYYY'}
																</Text>
																<Text fontSize={16}>📅</Text>
															</View>
														</TouchableOpacity>
													</View>

													<View style={styles.infoHalfFieldContainer}>
														<Text style={styles.overlayLabel}>
															{loc.t('lotSelector.expiryDate')}
														</Text>
														<TouchableOpacity
															style={[
																styles.infoInput,
																modalView !== 'edit' &&
																	styles.infoDisabledInput,
															]}
															onPress={
																modalView === 'edit' ? openExpDatePicker : null
															}
															disabled={modalView !== 'edit'}
														>
															<View style={styles.datePickerButton}>
																<Text
																	style={
																		values.expDate
																			? styles.datePickerText
																			: styles.datePickerPlaceholder
																	}
																>
																	{values.expDate || 'DD/MM/YYYY'}
																</Text>
																<Text fontSize={16}>📅</Text>
															</View>
														</TouchableOpacity>
													</View>
												</View>

												<View style={styles.infoFieldContainer}>
													<Text style={styles.overlayLabel}>
														{loc.t('lotSelector.storeLocation')}
													</Text>
													<BottomSheetTextInput
														style={[
															styles.infoInput,
															modalView !== 'edit' && styles.infoDisabledInput,
														]}
														value={values.locationAtStore}
														onChangeText={handleChange('locationAtStore')}
														placeholder={loc.t('lotSelector.enterLocation')}
														placeholderTextColor="rgba(0,0,0,0.54)"
														editable={modalView === 'edit'}
														blurOnSubmit={false}
														returnKeyType="next"
													/>
												</View>

												<View style={styles.infoFieldContainer}>
													<Text style={styles.overlayLabel}>
														{loc.t('lotSelector.note')}
													</Text>
													<BottomSheetTextInput
														style={[
															styles.infoInput,
															modalView !== 'edit' && styles.infoDisabledInput,
															{ height: 80, textAlignVertical: 'top' },
														]}
														value={values.note}
														onChangeText={handleChange('note')}
														placeholder={loc.t('lotSelector.enterNote')}
														placeholderTextColor="rgba(0,0,0,0.54)"
														multiline
														editable={modalView === 'edit'}
														blurOnSubmit={false}
														returnKeyType="done"
													/>
												</View>
											</>
										)}
									</BottomSheetScrollView>

									{/* Stock Validation Error */}
									{stockValidationError && modalView === 'edit' && (
										<View style={styles.errorMessageContainer}>
											<Text style={styles.errorMessageText}>
												{stockValidationError}
											</Text>
										</View>
									)}

									{/* Button Rows - Outside ScrollView for all modes */}
									{showCreate && (
										<View style={styles.infoModalButtonContainer}>
											{modalView === 'info' ? (
												<>
													<TouchableOpacity
														style={[
															styles.infoModalButton,
															styles.deleteButton,
														]}
														activeOpacity={0.7}
														onPress={enableDeleteMode}
													>
														<Text
															style={[
																styles.infoModalButtonText,
																styles.deleteButtonText,
															]}
														>
															{loc.t('lotSelector.delete')}
														</Text>
													</TouchableOpacity>

													<TouchableOpacity
														style={[styles.infoModalButton, styles.editButton]}
														activeOpacity={0.7}
														onPress={enableEditMode}
													>
														<Text
															style={[
																styles.infoModalButtonText,
																styles.editButtonText,
															]}
														>
															{loc.t('lotSelector.edit')}
														</Text>
													</TouchableOpacity>
												</>
											) : modalView === 'edit' ? (
												<>
													<TouchableOpacity
														style={[
															styles.infoModalButton,
															styles.infoModalCancelButton,
														]}
														activeOpacity={0.7}
														onPress={cancelEditMode}
													>
														<Text
															style={[
																styles.infoModalButtonText,
																styles.cancelButtonText,
															]}
														>
															{loc.t('lotSelector.cancel')}
														</Text>
													</TouchableOpacity>

													<TouchableOpacity
														style={[
															styles.infoModalButton,
															styles.updateButton,
														]}
														activeOpacity={0.7}
														onPress={handleSubmit}
														disabled={isSubmitting}
													>
														<Text
															style={[
																styles.infoModalButtonText,
																styles.updateButtonText,
															]}
														>
															{loc.t('lotSelector.update')}
														</Text>
													</TouchableOpacity>
												</>
											) : (
												<>
													<TouchableOpacity
														style={[
															styles.infoModalButton,
															styles.infoModalCancelButton,
														]}
														activeOpacity={0.7}
														onPress={cancelDeleteMode}
													>
														<Text
															style={[
																styles.infoModalButtonText,
																styles.cancelButtonText,
															]}
														>
															{loc.t('lotSelector.cancel')}
														</Text>
													</TouchableOpacity>

													<TouchableOpacity
														style={[
															styles.infoModalButton,
															styles.deleteButton,
														]}
														activeOpacity={0.7}
														onPress={handleLotDeletion}
														disabled={!isDeleteFormValid()}
													>
														<Text
															style={[
																styles.infoModalButtonText,
																styles.deleteButtonText,
															]}
														>
															{loc.t('lotSelector.confirmDelete')}
														</Text>
													</TouchableOpacity>
												</>
											)}
										</View>
									)}
								</>
							)
						}}
					</Formik>
				</View>
			</>
		)
	}

	// Render function for FlatList items
	const renderLotItem = useCallback(
		({ item, index }) => <LotItem item={item} index={index} />,
		[]
	)

	// Key extractor for FlatList
	const keyExtractor = useCallback((item) => item.id.toString(), [])

	return (
		<>
			<BottomSheetModal
				ref={bottomSheetModalRef}
				index={0}
				snapPoints={snapPoints}
				enablePanDownToClose={modalView === 'list'}
				enableDynamicSizing={false}
				backdropComponent={renderBackdrop}
				backgroundStyle={styles.bottomSheetBackground}
				handleIndicatorStyle={styles.handleIndicator}
				keyboardBehavior="interactive"
				android_keyboardInputMode="adjustResize"
				onDismiss={() => bottomSheetModalRef.current?.dismiss()}
			>
				<KeyboardAvoidingView
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
					style={{ flex: 1 }}
					keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
				>
					{renderModalContent()}
				</KeyboardAvoidingView>
			</BottomSheetModal>

			{/* Manufacturing Date Picker */}
			{showMfgDatePicker && (
				<DateTimePicker
					value={tempMfgDate}
					mode="date"
					display="default"
					onChange={handleMfgDateChange}
				/>
			)}

			{/* Expiry Date Picker */}
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

export default LotSelector

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		justifyContent: 'flex-end',
		minHeight: '50%',
	},
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF',
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
	},
	handleIndicator: {
		backgroundColor: '#195FE1',
		width: 40,
		height: 4,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		paddingHorizontal: 16,
		paddingTop: 8,
		paddingBottom: 8,
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
	contentContainer: {
		paddingHorizontal: 16,
		paddingBottom: 16,
		backgroundColor: '#F0F8FF',
	},
	flatList: {},
	flatListContent: {
		paddingBottom: 20,
	},
	emptyContainer: {
		alignItems: 'center',
		paddingVertical: 40,
	},
	emptyText: {
		color: '#195FE1',
		fontSize: 16,
		opacity: 0.7,
	},
	lotItemContainer: {
		marginBottom: 12,
	},
	lotItem: {
		backgroundColor: '#FFFFFF',
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderRadius: 12,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
		borderWidth: 1,
		borderColor: '#195FE1',
	},
	lotItemExpiring: {
		borderColor: '#DC2626',
		borderWidth: 2,
	},
	lotHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 8,
	},
	lotNumber: {
		fontSize: 18,
		fontWeight: '600',
		color: '#111827',
		flex: 1,
	},
	headerRight: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	quantityBadge: {
		backgroundColor: '#EFF6FF',
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 12,
	},
	lowStockBadge: {
		backgroundColor: '#FEF2F2',
	},
	quantityText: {
		color: '#2563EB',
		fontSize: 14,
		fontWeight: '500',
	},
	lowStockText: {
		color: '#DC2626',
	},
	infoButton: {
		width: 28,
		height: 28,
		backgroundColor: '#F3F4F6',
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
	lotDetails: {
		gap: 4,
	},
	lotDetailText: {
		color: '#6B7280',
		fontSize: 14,
	},
	lotDetailLabel: {
		fontWeight: '500',
	},
	buySellRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	expiringText: {
		color: '#DC2626',
		fontWeight: '600',
	},
	expiredText: {
		color: '#DC2626',
		fontWeight: '600',
	},
	warningText: {
		color: '#DC2626',
		fontSize: 12,
		fontWeight: '600',
		marginTop: 4,
	},
	expiredWarningText: {
		color: '#DC2626',
		fontSize: 12,
		fontWeight: '600',
		marginTop: 4,
	},
	buttonContainer: {
		marginTop: 4,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingBottom: 16,
		gap: 8,
	},
	createButton: {
		backgroundColor: '#195FE1',
		paddingVertical: 14,
		borderRadius: 8,
		flex: 1,
		alignItems: 'center',
	},
	createButtonText: {
		color: '#FFFFFF',
		textAlign: 'center',
		fontSize: 16,
		fontWeight: '600',
	},
	cancelButton: {
		backgroundColor: '#FFFFFF',
		paddingVertical: 14,
		borderRadius: 8,
		flex: 1,
		alignItems: 'center',
		borderWidth: 1,
		borderColor: '#195FE1',
	},
	cancelButtonText: {
		color: '#195FE1',
		textAlign: 'center',
		fontSize: 16,
		fontWeight: '600',
	},
	// Info Modal Styles
	infoModalContainer: {
		flex: 1,
		justifyContent: 'flex-end',
		minHeight: '50%',
	},
	infoBackdrop: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	infoModalContent: {
		backgroundColor: '#6592E5',
		width: '100%',
		borderTopLeftRadius: 25,
		borderTopRightRadius: 25,
		overflow: 'hidden',
		maxHeight: screenHeight * 0.9,
	},
	infoHandleContainer: {
		alignItems: 'center',
		paddingVertical: 12,
	},
	infoHandleBar: {
		width: 40,
		height: 4,
		backgroundColor: '#D1D5DB',
		borderRadius: 2,
	},
	infoHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		paddingHorizontal: 16,
		paddingBottom: 16,
	},
	infoHeaderTextContainer: {
		flex: 1,
		flexShrink: 1,
		marginRight: 8,
	},
	infoTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#FFFFFF',
		flexShrink: 1,
	},
	infoHeaderSubtitle: {
		fontSize: 14,
		color: '#E5E7EB',
		marginTop: 2,
		flexShrink: 1,
	},
	infoCloseButton: {
		width: 32,
		height: 32,
		backgroundColor: '#E5E7EB',
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	infoContentContainer: {
		// paddingHorizontal: 16,
		paddingBottom: 16,
	},
	infoModalScrollContent: {
		paddingHorizontal: 16,
		paddingBottom: 40,
		maxHeight: screenHeight * 0.7,
		backgroundColor: '#F0F8FF',
	},
	infoSection: {
		backgroundColor: '#F0F8FF',
		borderRadius: 12,
		padding: 16,
		marginBottom: 16,
	},
	infoSectionTitle: {
		fontWeight: '600',
		fontSize: 16,
		color: '#111827',
		marginBottom: 16,
	},
	infoFieldContainer: {
		marginBottom: 16,
		position: 'relative',
		paddingTop: 8,
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
	infoFieldLabel: {
		marginBottom: 6,
		fontSize: 14,
		color: '#195FE1',
		fontWeight: '500',
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
		color: '#111827',
	},
	datePickerButton: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 2,
	},
	datePickerText: {
		fontSize: 14,
		color: '#6B7280',
	},
	datePickerPlaceholder: {
		fontSize: 14,
		color: '#6B7280',
	},
	dropdownText: {
		fontSize: 14,
		color: '#111827',
	},
	dropdownButtonContent: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	placeholderText: {
		color: '#888888',
	},
	dropdownMenu: {
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#D1D5DB',
		marginTop: 4,
		elevation: 3,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		maxHeight: 200,
		zIndex: 1000,
	},
	floatingDropdownMenu: {
		position: 'absolute',
		top: 52,
		left: 0,
		right: 0,
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#D1D5DB',
		elevation: 5,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		maxHeight: 200,
		zIndex: 10000,
	},
	dropdownItem: {
		padding: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#F3F4F6',
	},
	dropdownItemText: {
		fontSize: 14,
		color: '#111827',
	},
	vatInputContainer: {
		position: 'relative',
	},
	vatInputWithToggle: {
		paddingRight: 70, // Make room for the toggle
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
	vatSwitchContainer: {
		marginBottom: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	infoCheckboxContainer: {
		gap: 12,
	},
	infoCheckboxItem: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#F9FAFB',
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	infoCheckboxTextContainer: {
		marginLeft: 12,
	},
	infoCheckboxLabel: {
		color: '#111827',
		fontSize: 16,
		fontWeight: '500',
	},
	infoContent: {
		padding: 20,
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#F3F4F6',
	},
	infoLabel: {
		fontSize: 14,
		fontWeight: '500',
		color: '#374151',
		flex: 1,
	},
	infoValue: {
		fontSize: 14,
		color: '#6B7280',
		flex: 1,
		textAlign: 'right',
	},
	infoModalButtonContainer: {
		paddingHorizontal: 16,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: 8,
		paddingBottom: 16,
		backgroundColor: '#F0F8FF',
	},
	infoModalButton: {
		flex: 1,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 48,
	},
	editButton: {
		backgroundColor: '#195FE1',
	},
	deleteButton: {
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#195FE1',
	},
	infoModalCancelButton: {
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#195FE1',
	},
	updateButton: {
		backgroundColor: '#195FE1',
	},
	backButtonFullWidth: {
		backgroundColor: '#195FE1',
		width: '100%',
		marginHorizontal: 16,
		marginBottom: 16,
		borderRadius: 8,
	},
	infoModalButtonText: {
		fontSize: 16,
		fontWeight: '600',
		textAlign: 'center',
	},
	backButtonText: {
		color: '#FFFFFF',
	},
	editButtonText: {
		color: '#FFFFFF',
	},
	deleteButtonText: {
		color: '#195FE1',
	},
	cancelButtonText: {
		fontSize: 16,
		fontWeight: '600',
		textAlign: 'center',
		color: '#195FE1',
	},
	updateButtonText: {
		color: '#FFFFFF',
	},
	errorMessageContainer: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		marginTop: 8,
		backgroundColor: '#FEE2E2',
		borderRadius: 8,
		marginHorizontal: 16,
	},
	errorMessageText: {
		color: '#DC2626',
		fontSize: 14,
		fontWeight: '500',
		textAlign: 'center',
	},
	errorText: {
		color: '#DC2626',
		fontSize: 12,
		marginTop: 4,
		marginLeft: 4,
	},
	totalLabel: {
		fontSize: 16,
		fontWeight: '600',
		color: '#195FE1',
		textAlign: 'center',
		marginBottom: 8,
		paddingVertical: 8,
		backgroundColor: '#F0F8FF',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#195FE1',
	},
	quantityInputWrapper: {
		position: 'relative',
	},
	quantityInputWithButtons: {
		paddingLeft: 42,
		paddingRight: 42,
		textAlign: 'center',
	},
	quantityButtonsContainer: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: '50%',
		transform: [{ translateY: -16 }],
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 4,
	},
	quantityButton: {
		width: 32,
		height: 32,
		borderRadius: 6,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'transparent',
	},
	addButton: {
		backgroundColor: 'transparent',
	},
	quantityDeleteButton: {
		backgroundColor: 'transparent',
	},
	confirmButton: {
		backgroundColor: 'transparent',
	},
	cancelAdjustButton: {
		backgroundColor: 'transparent',
	},
})
