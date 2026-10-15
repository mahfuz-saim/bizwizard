import {
	View,
	Text,
	Modal,
	TouchableOpacity,
	TextInput,
	Dimensions,
	StyleSheet,
	KeyboardAvoidingView,
	Platform,
} from 'react-native'
import { useState } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import * as Yup from 'yup'

export default function BarCodeInput({ handleInputSubmit, cancelScanFlow }) {
	const [barcodeInput, setBarcodeInput] = useState('')
	const [validationError, setValidationError] = useState('')
	const { loc } = useLocalization()
	const { toEnglishNumbers } = useNumberTranslator()

	const barcodeSchema = Yup.object().shape({
		barcode: Yup.string().matches(
			/^[0-9০-৯]*$/,
			loc.t('barcodeInput.onlyNumbersAllowed')
		),
	})

	const closeModal = () => {
		cancelScanFlow()
	}

	const handleBackdropPress = () => {
		closeModal()
	}

	const handleBarcodeInputChange = async (text) => {
		// Allow the user to see the text as they type (including Bengali digits)
		setBarcodeInput(text)

		// Validate the input
		try {
			await barcodeSchema.validate({ barcode: text })
			setValidationError('')
		} catch (error) {
			setValidationError(error.message)
		}
	}

	const handleNext = () => {
		// Convert Bengali digits to English before submitting
		const englishBarcode = barcodeInput.trim()
			? toEnglishNumbers(barcodeInput.trim())
			: null
		handleInputSubmit(englishBarcode)
	}

	return (
		<Modal
			transparent={true}
			visible={true}
			animationType="none"
			onRequestClose={closeModal}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
				style={{ flex: 1 }}
				keyboardVerticalOffset={0}
			>
				<View style={styles.modalContainer}>
					{/* Backdrop */}
					<TouchableOpacity
						style={styles.backdrop}
						activeOpacity={1}
						onPress={handleBackdropPress}
					/>

					{/* Modal Content */}
					<View style={styles.modalContent}>
						{/* Handle bar */}
						<View style={styles.handleContainer}>
							<View style={styles.handleBar} />
						</View>

						{/* Header */}
						<View style={styles.header}>
							<Text style={styles.headerTitle}>
								{loc.t('barcodeInput.manualInput')}
							</Text>
							<TouchableOpacity
								onPress={closeModal}
								style={styles.closeButton}
								activeOpacity={0.7}
							>
								<MaterialIcons name="close" size={18} color="#6B7280" />
							</TouchableOpacity>
						</View>

						{/* Content */}
						<View style={styles.contentContainer}>
							<View style={styles.inputSection}>
								<Text style={styles.inputLabel}>
									{loc.t('barcodeInput.enterBarcode')}{' '}
									<Text style={styles.optionalText}>
										({loc.t('barcodeInput.optional')})
									</Text>
								</Text>
								<View style={styles.inputContainer}>
									<MaterialIcons
										name="qr-code-scanner"
										size={20}
										color="#6B7280"
										style={styles.inputIcon}
									/>
									<TextInput
										style={styles.textInput}
										onChangeText={handleBarcodeInputChange}
										value={barcodeInput}
										placeholder={loc.t('barcodeInput.placeholder')}
										placeholderTextColor="#9CA3AF"
										autoFocus={true}
										keyboardType="numeric"
										returnKeyType="done"
										onSubmitEditing={handleNext}
									/>
									{barcodeInput.length > 0 && (
										<TouchableOpacity
											onPress={() => {
												setBarcodeInput('')
												setValidationError('')
											}}
											style={styles.clearButton}
										>
											<MaterialIcons name="clear" size={20} color="#6B7280" />
										</TouchableOpacity>
									)}
								</View>
								{validationError ? (
									<Text style={styles.errorText}>{validationError}</Text>
								) : (
									<Text style={styles.helperText}>
										{loc.t('barcodeInput.helperText')}
									</Text>
								)}
							</View>

							<View style={styles.buttonContainer}>
								<TouchableOpacity
									onPress={closeModal}
									style={styles.cancelButton}
									activeOpacity={0.7}
								>
									<Text style={styles.cancelButtonText}>
										{loc.t('barcodeInput.cancel')}
									</Text>
								</TouchableOpacity>

								<TouchableOpacity
									onPress={handleNext}
									style={styles.nextButton}
									activeOpacity={0.8}
								>
									<Text style={styles.nextButtonText}>
										{loc.t('barcodeInput.next')}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	)
}

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		justifyContent: 'flex-end',
	},
	backdrop: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	modalContent: {
		backgroundColor: '#6592E5',
		width: '100%',
		borderTopLeftRadius: 25,
		borderTopRightRadius: 25,
		overflow: 'hidden',
	},
	handleContainer: {
		alignItems: 'center',
		paddingVertical: 12,
	},
	handleBar: {
		width: 40,
		height: 4,
		backgroundColor: '#D1D5DB',
		borderRadius: 2,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 24,
		paddingBottom: 16,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#FFFFFF',
	},
	closeButton: {
		width: 32,
		height: 32,
		backgroundColor: '#E5E7EB',
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	contentContainer: {
		paddingHorizontal: 24,
		paddingBottom: 24,
	},
	inputSection: {
		paddingTop: 16,
	},
	inputLabel: {
		fontSize: 16,
		fontWeight: '600',
		color: '#111827',
		marginBottom: 8,
	},
	optionalText: {
		color: '#6B7280',
		fontWeight: '400',
		fontSize: 14,
	},
	inputContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 4,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
		borderWidth: 1,
		borderColor: '#E5E7EB',
		marginBottom: 8,
	},
	inputIcon: {
		marginRight: 12,
	},
	textInput: {
		flex: 1,
		fontSize: 16,
		color: '#111827',
		paddingVertical: 16,
	},
	clearButton: {
		padding: 4,
		marginLeft: 8,
	},
	helperText: {
		fontSize: 14,
		color: '#6B7280',
	},
	errorText: {
		fontSize: 14,
		color: '#EF4444',
		marginTop: 0,
	},
	buttonContainer: {
		flexDirection: 'row',
		gap: 12,
		marginTop: 16,
	},
	nextButton: {
		flex: 1,
		backgroundColor: '#2563EB',
		paddingVertical: 16,
		paddingHorizontal: 24,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#2563EB',
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
	},
	nextButtonText: {
		color: '#FFFFFF',
		fontSize: 18,
		fontWeight: '600',
	},
	cancelButton: {
		flex: 1,
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#D1D5DB',
		paddingVertical: 16,
		paddingHorizontal: 24,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
	},
	cancelButtonText: {
		color: '#374151',
		textAlign: 'center',
		fontSize: 18,
		fontWeight: '500',
	},
})
