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
import { cleanString } from '../CleanString'
import { Formik, FormikProps } from 'formik'
import * as Yup from 'yup'
import { CloseModal } from '../AlertModal'
import {
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetBackdrop,
	BottomSheetTextInput,
	BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface SupplierFormValues {
	name: string
	number: string
	company: string
	comment: string
}

interface SupplierFormProps {
	visible: boolean
	onClose: () => void
	handleSubmit: (values: SupplierFormValues) => void
	initialValues?: SupplierFormValues
}

export default function SupplierForm(props: SupplierFormProps) {
	const { loc } = useLocalization()
	const { toEnglishNumbers } = useNumberTranslator()
	const insets = useSafeAreaInsets()

	// Validation schema
	const validationSchema: Yup.ObjectSchema<SupplierFormValues> =
		Yup.object().shape({
			name: Yup.string()
				.required(
					loc.t('supplier.supplierForm.errors.nameRequired') ||
						'Supplier name is required'
				)
				.max(
					25,
					loc.t('supplier.supplierForm.errors.nameMax') ||
						'Supplier name cannot be more than 25 characters'
				),
			company: Yup.string()
				.required(
					loc.t('supplier.supplierForm.errors.companyRequired') ||
						'Company is required'
				)
				.min(
					1,
					loc.t('supplier.supplierForm.errors.companyMin') ||
						'Company cannot be empty'
				),
			number: Yup.string()
				.transform((value, originalValue) => {
					// Convert Bangla numbers to English
					return toEnglishNumbers(String(originalValue || ''))
				})
				.required(
					loc.t('supplier.supplierForm.errors.numberRequired') ||
						'Phone number is required'
				)
				.test(
					'starts-with-01',
					loc.t('supplier.supplierForm.errors.numberStartsWith01') ||
						'Phone number must start with 01',
					function (value) {
						if (!value) return false
						const englishNumber = toEnglishNumbers(value)
						return englishNumber.startsWith('01')
					}
				)
				.test(
					'is-11-digits',
					loc.t('supplier.supplierForm.errors.numberLength') ||
						'Phone number must be exactly 11 digits',
					function (value) {
						if (!value) return false
						const englishNumber = toEnglishNumbers(value)
						return englishNumber.length === 11 && /^\d{11}$/.test(englishNumber)
					}
				),
			comment: Yup.string().optional(),
		})

	const { handleSubmit, visible, onClose } = props
	const [isFormValid, setIsFormValid] = useState<boolean>(false)
	const [currentFormValues, setCurrentFormValues] =
		useState<SupplierFormValues>({
			name: '',
			number: '',
			company: '',
			comment: '',
		})
	const [showCloseModal, setShowCloseModal] = useState<boolean>(false)

	// Bottom Sheet Modal ref
	const bottomSheetModalRef = useRef<BottomSheetModal>(null)

	// Snap points for bottom sheet - optimized for form content
	const snapPoints = useMemo(() => ['75%', '90%'], [])

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

	const hasFormData = useCallback((values: SupplierFormValues): boolean => {
		return Boolean(
			values?.name?.trim() ||
			values?.number?.trim() ||
			values?.company?.trim() ||
			values?.comment?.trim()
		)
	}, [])

	const handleCloseWithConfirmation = useCallback(
		(formValues: SupplierFormValues = currentFormValues): void => {
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
		(values: SupplierFormValues): void => {
			const processedValues: SupplierFormValues = {
				name: cleanString(values.name || ''),
				company: cleanString(values.company || ''),
				number: toEnglishNumbers(cleanString(values.number || '')),
				comment: cleanString(values.comment || ''),
			}

			handleSubmit(processedValues)
			closeModal()
		},
		[handleSubmit, closeModal, toEnglishNumbers]
	)

	const validateForm = useCallback(
		(values: SupplierFormValues): boolean => {
			const isNameValid = values.name?.trim().length > 0
			const isCompanyValid = values.company?.trim().length > 0

			const numberValue = toEnglishNumbers(values.number?.trim() || '')
			const isNumberValid =
				numberValue.length === 11 && /^\d{11}$/.test(numberValue)

			return isNameValid && isCompanyValid && isNumberValid
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
								{loc.t('supplier.supplierForm.addSupplier') || 'Add Supplier'}
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
									company: '',
									comment: '',
								}}
								validationSchema={validationSchema}
								onSubmit={handleFormSubmit}
								enableReinitialize={true}
							>
								{(formikProps: FormikProps<SupplierFormValues>) => {
									const { errors, touched } = formikProps

									useEffect(() => {
										setIsFormValid(validateForm(formikProps.values))
										setCurrentFormValues(formikProps.values)
									}, [formikProps.values, validateForm])

									return (
										<>
											{/* Supplier Details Section */}
											<View style={styles.section}>
												{/* Name Field */}
												<View style={styles.fieldContainer}>
													<Text style={styles.overlayLabel}>
														{loc.t('supplier.supplierForm.name') ||
															'Supplier Name'}{' '}
														*
													</Text>
													<BottomSheetTextInput
														style={styles.input}
														placeholder={
															loc.t('supplier.supplierForm.namePlaceholder') ||
															'Enter supplier name'
														}
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

												{/* Company Field */}
												<View style={styles.fieldContainer}>
													<Text style={styles.overlayLabel}>
														{loc.t('supplier.supplierForm.company') ||
															'Company'}{' '}
														*
													</Text>
													<BottomSheetTextInput
														style={styles.input}
														placeholder={
															loc.t(
																'supplier.supplierForm.companyPlaceholder'
															) || 'Enter company name'
														}
														placeholderTextColor={'rgba(0,0,0,0.54)'}
														value={formikProps.values.company}
														onChangeText={formikProps.handleChange('company')}
														onBlur={formikProps.handleBlur('company')}
														onFocus={() => expandToTop()}
														returnKeyType="next"
													/>
													{touched.company && errors.company && (
														<Text style={styles.errorText}>
															{String(errors.company)}
														</Text>
													)}
												</View>

												{/* Number Field */}
												<View style={styles.fieldContainer}>
													<Text style={styles.overlayLabel}>
														{loc.t('supplier.supplierForm.number') ||
															'Phone Number'}{' '}
														*
													</Text>
													<BottomSheetTextInput
														style={styles.input}
														placeholder={
															loc.t(
																'supplier.supplierForm.numberPlaceholder'
															) || 'Enter phone number'
														}
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

												{/* Comment Field */}
												<View style={styles.fieldContainer}>
													<Text style={styles.overlayLabel}>
														{loc.t('supplier.supplierForm.comment') ||
															'Comment'}
													</Text>
													<BottomSheetTextInput
														style={[styles.input, styles.textArea]}
														placeholder={
															loc.t(
																'supplier.supplierForm.commentPlaceholder'
															) || 'Enter additional comments (optional)'
														}
														placeholderTextColor={'rgba(0,0,0,0.54)'}
														value={formikProps.values.comment}
														onChangeText={formikProps.handleChange('comment')}
														onBlur={formikProps.handleBlur('comment')}
														multiline
														numberOfLines={3}
														textAlignVertical="top"
														onFocus={() => expandToTop()}
													/>
												</View>
											</View>

											{/* Action Buttons */}
											<View style={styles.buttonContainer}>
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
														{loc.t('supplier.supplierForm.addSupplier') ||
															'Add Supplier'}
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
				title={loc.t('supplier.supplierForm.discardChanges') || undefined}
				subtitle={
					loc.t('supplier.supplierForm.sureToClose') ||
					'Are you sure you want to close without saving?'
				}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF', // AliceBlue
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
		color: '#195FE1',
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
		flexDirection: 'row',
		justifyContent: 'center',
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
	submitButton: {
		backgroundColor: '#195FE1',
	},
	disabledButton: {
		backgroundColor: 'transparent',
		borderWidth: 1,
		borderColor: '#195FE1',
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
