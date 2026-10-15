import {
	Text,
	View,
	TouchableOpacity,
	StyleSheet,
	KeyboardAvoidingView,
	Platform,
	BackHandler,
	Keyboard,
	Dimensions,
} from 'react-native'
import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { usePermission } from '../../context/PermissionContext'
import { Formik, FormikProps } from 'formik'
import * as Yup from 'yup'
import { cleanString } from '../CleanString'
import * as Contacts from 'expo-contacts'
import { CloseModal, ErrorModal } from '../AlertModal'
import {
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetBackdrop,
	BottomSheetTextInput,
	BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface CustomerFormValues {
	name: string
	number: string
	address: string
}

interface CustomerFormProps {
	visible: boolean
	onClose: () => void
	handleSubmit: (values: CustomerFormValues) => void
	initialValues?: CustomerFormValues
}

export default function CustomerForm(props: CustomerFormProps) {
	const { loc } = useLocalization()
	const { toEnglishNumbers } = useNumberTranslator()
	const { getContactsPermission } = usePermission()
	const insets = useSafeAreaInsets()

	// Validation schema
	const validationSchema: Yup.ObjectSchema<CustomerFormValues> =
		Yup.object().shape({
			name: Yup.string()
				.required(
					loc.t('customer.customerForm.errors.nameRequired') ||
						'Customer name is required'
				)
				.max(
					25,
					loc.t('customer.customerForm.errors.nameMax') ||
						'Customer name cannot be more than 25 characters'
				),
			number: Yup.string()
				.transform((value, originalValue) => {
					// Convert Bangla numbers to English
					return toEnglishNumbers(String(originalValue || ''))
				})
				.required(
					loc.t('customer.customerForm.errors.numberRequired') ||
						'Phone number is required'
				)
				.test(
					'starts-with-01',
					loc.t('customer.customerForm.errors.numberStartsWith01') ||
						'Phone number must start with 01',
					function (value) {
						if (!value) return false
						const englishNumber = toEnglishNumbers(value)
						return englishNumber.startsWith('01')
					}
				)
				.test(
					'is-11-digits',
					loc.t('customer.customerForm.errors.numberLength') ||
						'Phone number must be exactly 11 digits',
					function (value) {
						if (!value) return false
						const englishNumber = toEnglishNumbers(value)
						return englishNumber.length === 11 && /^\d{11}$/.test(englishNumber)
					}
				),
			address: Yup.string()
				.required(
					loc.t('customer.customerForm.errors.addressRequired') ||
						'Address is required'
				)
				.min(
					1,
					loc.t('customer.customerForm.errors.addressMin') ||
						'Address cannot be empty'
				),
		})

	const { handleSubmit, visible, onClose } = props
	const [isFormValid, setIsFormValid] = useState<boolean>(false)
	const [currentFormValues, setCurrentFormValues] =
		useState<CustomerFormValues>({
			name: '',
			number: '',
			address: '',
		})
	const [showCloseModal, setShowCloseModal] = useState<boolean>(false)
	const [showErrorModal, setShowErrorModal] = useState<boolean>(false)
	const [errorMessage, setErrorMessage] = useState<string>('')
	const [formikRef, setFormikRef] =
		useState<FormikProps<CustomerFormValues> | null>(null)

	// Bottom Sheet Modal ref (instead of BottomSheet)
	const bottomSheetModalRef = useRef<BottomSheetModal>(null)

	// Snap points for bottom sheet - optimized for form content
	const snapPoints = useMemo(() => ['65%', '85%'], [])

	const formatPhoneInput = useCallback((text: string): string => {
		const englishDigits = '0123456789'
		const bengaliDigits = '০১২৩৪৫৬৭৮৯'
		const validChars = englishDigits + bengaliDigits

		const filtered = text
			.split('')
			.filter((char) => validChars.includes(char))
			.join('')

		// Limit to 11 digits
		return filtered.slice(0, 11)
	}, [])

	const normalizePhoneNumber = useCallback((phoneNumber: string): string => {
		// Remove all non-digit characters
		let cleaned = phoneNumber.replace(/\D/g, '')

		// Handle +880 or 880 prefix
		if (cleaned.startsWith('880')) {
			cleaned = '0' + cleaned.substring(3)
		}

		// Ensure it starts with 0 and is 11 digits
		if (!cleaned.startsWith('0')) {
			cleaned = '0' + cleaned
		}

		// Limit to 11 digits
		return cleaned.slice(0, 11)
	}, [])

	const handleImportFromContacts = useCallback(async () => {
		try {
			// Request permission
			const permission = await getContactsPermission()

			if (!permission.granted) {
				// Only show error if user can't ask again (permission permanently denied)
				if (!permission.canAskAgain) {
					setErrorMessage(
						loc.t('customer.customerForm.contactsPermissionDenied') ||
							'Contacts permission is required to import contacts'
					)
					setShowErrorModal(true)
				}
				return
			}

			// Open contact picker
			const contact = await Contacts.presentContactPickerAsync()

			if (contact) {
				// Extract contact information
				const name = contact.name || ''

				// Get phone number (first available)
				let phoneNumber = ''
				if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
					phoneNumber = normalizePhoneNumber(
						contact.phoneNumbers[0].number || ''
					)
				}

				// Get address (first available)
				let address = ''
				if (contact.addresses && contact.addresses.length > 0) {
					const addr = contact.addresses[0]
					const addressParts = [
						addr.street,
						addr.city,
						addr.region,
						addr.postalCode,
						addr.country,
					].filter(Boolean)
					address = addressParts.join(', ')
				}

				// Set values in formik
				if (formikRef) {
					formikRef.setFieldValue('name', name)
					formikRef.setFieldValue('number', phoneNumber)
					formikRef.setFieldValue('address', address)
				}
			}
		} catch (error) {
			console.error('Error importing contact:', error)
			setErrorMessage(
				loc.t('customer.customerForm.failedToImportContact') ||
					'Failed to import contact'
			)
			setShowErrorModal(true)
		}
	}, [getContactsPermission, normalizePhoneNumber, formikRef, loc])

	const closeModal = useCallback(() => {
		bottomSheetModalRef.current?.dismiss()
		// Small delay before calling onClose to let animation finish
		setTimeout(() => {
			onClose()
		}, 150)
	}, [onClose])

	// Programmatic expand/snapping to avoid gap
	const expandToTop = useCallback(() => {
		try {
			const lastIndex = Math.max(0, snapPoints.length - 1)
			if (bottomSheetModalRef.current?.snapToIndex) {
				bottomSheetModalRef.current?.snapToIndex(lastIndex)
			} else {
				bottomSheetModalRef.current?.expand?.()
			}
		} catch (e) {
			// fallback
			bottomSheetModalRef.current?.expand?.()
		}
	}, [snapPoints])

	// Open/close bottom sheet based on visible prop
	useEffect(() => {
		if (visible) {
			// Small delay to ensure proper mounting
			const timer = setTimeout(() => {
				bottomSheetModalRef.current?.present()
			}, 50)
			return () => clearTimeout(timer)
		} else {
			bottomSheetModalRef.current?.dismiss()
		}
	}, [visible])

	const hasFormData = useCallback((values: CustomerFormValues): boolean => {
		return Boolean(
			values?.name?.trim() || values?.number?.trim() || values?.address?.trim()
		)
	}, [])

	const handleCloseWithConfirmation = useCallback(
		(formValues: CustomerFormValues = currentFormValues): void => {
			if (!hasFormData(formValues)) {
				closeModal()
				return
			}

			setShowCloseModal(true)
		},
		[closeModal, hasFormData, currentFormValues]
	)

	const handleHardwareBackPress = useCallback((): boolean => {
		handleCloseWithConfirmation()
		return true
	}, [handleCloseWithConfirmation])

	useEffect(() => {
		if (!visible) return

		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			handleHardwareBackPress
		)

		return () => backHandler.remove()
	}, [visible, handleHardwareBackPress])

	// Render backdrop component
	const renderBackdrop = useCallback(
		(props: BottomSheetBackdropProps) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="none"
				onPress={() => handleCloseWithConfirmation()}
			/>
		),
		[handleCloseWithConfirmation]
	)

	// Handle sheet changes
	const handleSheetChanges = useCallback(
		(index: number): void => {
			if (index === -1) {
				// Only trigger close confirmation if we have form data
				if (hasFormData(currentFormValues)) {
					handleCloseWithConfirmation()
				} else {
					onClose()
				}
			}
		},
		[handleCloseWithConfirmation, hasFormData, currentFormValues, onClose]
	)

	const handleFormSubmit = useCallback(
		(values: CustomerFormValues): void => {
			const processedValues: CustomerFormValues = {
				name: cleanString(values.name || ''),
				address: cleanString(values.address || ''),
				number: toEnglishNumbers(cleanString(values.number || '')),
			}

			handleSubmit(processedValues)
			closeModal()
		},
		[handleSubmit, closeModal, toEnglishNumbers]
	)

	const validateForm = useCallback(
		(values: CustomerFormValues): boolean => {
			const isNameValid = values.name?.trim().length > 0
			const isAddressValid = values.address?.trim().length > 0

			const numberValue = toEnglishNumbers(values.number?.trim() || '')
			const isNumberValid =
				numberValue.length === 11 && /^\d{11}$/.test(numberValue)

			return isNameValid && isAddressValid && isNumberValid
		},
		[toEnglishNumbers]
	)

	// Keyboard listeners: expand the sheet when keyboard shows
	useEffect(() => {
		const showSub = Keyboard.addListener('keyboardDidShow', () => {
			expandToTop()
		})

		return () => {
			showSub.remove()
		}
	}, [expandToTop])

	// Don't render if not visible to avoid mounting issues
	if (!visible) return null

	// compute max dynamic content size as 90% of window height (adjust if needed)
	const maxDynamicContentSize = Math.round(
		Dimensions.get('window').height * 0.9
	)

	return (
		<>
			<BottomSheetModal
				ref={bottomSheetModalRef}
				snapPoints={snapPoints}
				enablePanDownToClose={false}
				backdropComponent={renderBackdrop}
				onChange={handleSheetChanges}
				keyboardBehavior={Platform.OS === 'ios' ? 'extend' : 'interactive'}
				keyboardBlurBehavior="restore"
				android_keyboardInputMode="adjustResize"
				enableDynamicSizing={true}
				maxDynamicContentSize={maxDynamicContentSize}
				bottomInset={insets.bottom}
				backgroundStyle={styles.bottomSheetBackground}
				handleIndicatorStyle={styles.handleIndicator}
			>
				<View style={styles.headerContainer}>
					{/* Header */}
					<View style={styles.header}>
						<View>
							<Text style={styles.headerTitle}>
								{loc.t('customer.customerForm.addCustomer') || 'Add Customer'}
							</Text>
						</View>
						<TouchableOpacity
							onPress={() => handleCloseWithConfirmation()}
							style={styles.closeButton}
							activeOpacity={0.7}
						>
							<MaterialIcons name="close" size={16} color="#6B7280" />
						</TouchableOpacity>
					</View>
				</View>

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
						<View style={styles.container}>
							<Formik
								initialValues={{
									name: '',
									number: '',
									address: '',
								}}
								validationSchema={validationSchema}
								onSubmit={handleFormSubmit}
								enableReinitialize={true}
							>
								{(formikProps: FormikProps<CustomerFormValues>) => {
									const { errors, touched } = formikProps

									useEffect(() => {
										setIsFormValid(validateForm(formikProps.values))
										setCurrentFormValues(formikProps.values)
										setFormikRef(formikProps)
									}, [formikProps.values, validateForm])

									return (
										<>
											{/* Customer Details Section */}
											<View style={styles.section}>
												{/* Name Field */}
												<View style={styles.fieldContainer}>
													<Text style={styles.overlayLabel}>
														{loc.t('customer.customerForm.name')} *
													</Text>
													<BottomSheetTextInput
														style={styles.input}
														placeholder={loc.t(
															'customer.customerForm.namePlaceholder'
														)}
														placeholderTextColor={'rgba(0,0,0,0.54)'}
														value={formikProps.values.name}
														onChangeText={formikProps.handleChange('name')}
														onBlur={formikProps.handleBlur('name')}
														onFocus={() => expandToTop()}
														returnKeyType="next"
													/>
													{touched.name && errors.name && (
														<Text style={styles.errorText}>
															{String(errors.name)}
														</Text>
													)}
												</View>

												{/* Number Field */}
												<View style={styles.fieldContainer}>
													<Text style={styles.overlayLabel}>
														{loc.t('customer.customerForm.number')} *
													</Text>
													<BottomSheetTextInput
														style={styles.input}
														placeholder={loc.t(
															'customer.customerForm.numberPlaceholder'
														)}
														placeholderTextColor={'rgba(0,0,0,0.54)'}
														value={formikProps.values.number}
														onChangeText={(text) => {
															const formattedText = formatPhoneInput(text)
															formikProps.handleChange('number')(formattedText)
														}}
														onBlur={formikProps.handleBlur('number')}
														keyboardType="phone-pad"
														onFocus={() => expandToTop()}
														returnKeyType="next"
													/>
													{touched.number && errors.number && (
														<Text style={styles.errorText}>
															{String(errors.number)}
														</Text>
													)}
												</View>

												{/* Address Field */}
												<View style={styles.fieldContainer}>
													<Text style={styles.overlayLabel}>
														{loc.t('customer.customerForm.address')} *
													</Text>
													<BottomSheetTextInput
														style={[styles.input, styles.textArea]}
														placeholder={loc.t(
															'customer.customerForm.addressPlaceholder'
														)}
														placeholderTextColor={'rgba(0,0,0,0.54)'}
														value={formikProps.values.address}
														onChangeText={formikProps.handleChange('address')}
														onBlur={formikProps.handleBlur('address')}
														multiline
														numberOfLines={3}
														textAlignVertical="top"
														onFocus={() => expandToTop()}
													/>
													{touched.address && errors.address && (
														<Text style={styles.errorText}>
															{String(errors.address)}
														</Text>
													)}
												</View>
											</View>

											{/* Action Buttons */}
											<View style={styles.buttonContainer}>
												<TouchableOpacity
													style={styles.importButton}
													onPress={handleImportFromContacts}
													activeOpacity={0.7}
												>
													<MaterialIcons
														name="contacts"
														size={20}
														color="#195FE1"
													/>
													<Text style={styles.importButtonText}>
														{loc.t(
															'customer.customerForm.importFromContacts'
														) || 'Import from Contacts'}
													</Text>
												</TouchableOpacity>

												<TouchableOpacity
													style={[
														styles.button,
														isFormValid
															? styles.submitButton
															: styles.disabledButton,
													]}
													onPress={
														isFormValid
															? () => formikProps.handleSubmit()
															: undefined
													}
													activeOpacity={isFormValid ? 0.8 : 1}
													disabled={!isFormValid}
												>
													<Text
														style={[
															isFormValid
																? styles.submitButtonText
																: styles.disabledButtonText,
														]}
													>
														{loc.t('customer.customerForm.addCustomer') ||
															'Add Customer'}
													</Text>
												</TouchableOpacity>
											</View>
										</>
									)
								}}
							</Formik>
						</View>
					</BottomSheetScrollView>
				</KeyboardAvoidingView>
			</BottomSheetModal>

			{/* Close Confirmation Modal */}
			<CloseModal
				visible={showCloseModal}
				onClose={() => setShowCloseModal(false)}
				onConfirm={() => {
					setShowCloseModal(false)
					closeModal()
				}}
				title={loc.t('customer.customerForm.discardChanges') || undefined}
				subtitle={
					loc.t('customer.customerForm.sureToClose') ||
					'Are you sure you want to close without saving?'
				}
			/>

			{/* Error Modal */}
			<ErrorModal
				visible={showErrorModal}
				title={loc.t('customer.customerForm.error') || 'Error'}
				subtitle={errorMessage}
				onClose={() => setShowErrorModal(false)}
			/>
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
		paddingBottom: 20,
	},
	container: {
		padding: 16,
		paddingTop: 0,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#195FE1', // using requested primary color for header text
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
	},
	fieldContainer: {
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
	},
	textArea: {
		minHeight: 80,
		paddingTop: 12,
		textAlignVertical: 'top',
	},
	buttonContainer: {
		flexDirection: 'column',
		justifyContent: 'center',
		gap: 12,
		marginTop: 0,
		paddingBottom: 8,
		paddingHorizontal: 12,
	},
	button: {
		padding: 12,
		borderRadius: 24,
		width: '100%',
		alignItems: 'center',
	},
	importButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		padding: 12,
		borderRadius: 24,
		width: '100%',
		backgroundColor: 'transparent',
	},
	importButtonText: {
		color: '#195FE1',
		fontWeight: '600',
		fontSize: 16,
	},
	cancelButton: {
		backgroundColor: 'transparent',
		borderWidth: 1,
		borderColor: '#195FE1',
	},
	submitButton: {
		backgroundColor: '#195FE1',
	},
	disabledButton: {
		backgroundColor: 'transparent',
		borderWidth: 1,
		borderColor: '#195FE1',
	},
	cancelButtonText: {
		color: '#195FE1',
		fontWeight: '500',
		fontSize: 16,
	},
	submitButtonText: {
		color: '#ffffff',
		fontWeight: '500',
		fontSize: 16,
	},
	disabledButtonText: {
		color: '#195FE1',
		fontWeight: '500',
		fontSize: 16,
	},
	errorText: {
		color: '#ff0033',
		fontSize: 12,
		marginTop: 4,
		marginLeft: 4,
	},
})
