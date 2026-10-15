import {
	Text,
	View,
	Modal,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
	BackHandler,
	TextInput,
} from 'react-native'
import { CameraView } from 'expo-camera'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import {
	useCameraPermission,
	CameraPermissionProvider,
} from '../context/PermissionContext'
import OCRProcessor from './ocrProcessor'
import { useRef, useEffect, useState } from 'react'
import { useLocalization } from '../localization/localizationContext'
import { MaterialCommunityIcons } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')

// Mount the camera permission provider only while the scanner is open so
// useCameraPermissions() doesn't run for the rest of the app.
export default function barCodeScanner(props) {
	if (!props?.isVisible) return null
	return (
		<CameraPermissionProvider>
			<BarCodeScannerInner {...props} />
		</CameraPermissionProvider>
	)
}

function BarCodeScannerInner(props) {
	const { cameraPermission, getCameraPermission } = useCameraPermission()
	const { isVisible, setIsVisible, handleBarCodeScan, handleOCRData } = props
	const cameraRef = useRef(null)
	const { loc } = useLocalization()
	const [permissionChecked, setPermissionChecked] = useState(false)
	const [isManualMode, setIsManualMode] = useState(false)
	const [manualBarcode, setManualBarcode] = useState('')

	const focusHeight = 200
	const focusWidth = width * 0.9
	const focusTop = (height - focusHeight) / 2 - focusHeight / 4
	const focusLeft = (width - focusWidth) / 2

	// Check camera permission when scanner becomes visible
	useEffect(() => {
		if (isVisible && !cameraPermission?.granted) {
			checkAndRequestPermission()
		}
	}, [isVisible])

	// Reset to automatic mode when scanner opens
	useEffect(() => {
		if (isVisible) {
			setIsManualMode(false)
			setManualBarcode('')
		}
	}, [isVisible])

	const checkAndRequestPermission = async () => {
		try {
			await getCameraPermission()
			setPermissionChecked(true)
		} catch (error) {
			console.error('Error requesting camera permission:', error)
			setPermissionChecked(true)
		}
	}

	useEffect(() => {
		const backAction = () => {
			if (isVisible) {
				setIsVisible(false)
				return true
			}
			return false
		}

		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			backAction
		)

		return () => backHandler.remove()
	}, [isVisible, setIsVisible])

	// Handle capture button press for OCR
	const handleCapture = async () => {
		try {
			if (cameraRef.current) {
				const photo = await cameraRef.current.takePictureAsync({
					quality: 1.0,
					base64: false,
				})

				// Calculate crop area based on focus rectangle
				const imageToScreenRatioX = photo.width / width
				const imageToScreenRatioY = photo.height / height

				const cropX = focusLeft * imageToScreenRatioX
				const cropY = focusTop * imageToScreenRatioY
				const cropWidth = focusWidth * imageToScreenRatioX
				const cropHeight = focusHeight * imageToScreenRatioY

				// Crop the image to the focus rectangle area
				const croppedImage = await manipulateAsync(
					photo.uri,
					[
						{
							crop: {
								originX: Math.round(cropX),
								originY: Math.round(cropY),
								width: Math.round(cropWidth),
								height: Math.round(cropHeight),
							},
						},
					],
					{ compress: 0.8, format: SaveFormat.JPEG }
				)

				// Process OCR on the cropped image
				const ocrResult = await OCRProcessor.extractTextFromImage(
					croppedImage.uri
				)

				// Only console log the texts within the focus area
				const detectedTexts = ocrResult.extractedTexts
					.map((t) => t.text.trim())
					.filter((t) => t.length > 1) // Remove single character texts
					.filter((t) => !/^\d+$/.test(t)) // Remove texts that are only numbers
					.filter((t) => t.length > 0)
				handleOCRData(detectedTexts)
			}
		} catch (error) {
			console.error('Error capturing/processing image:', error)
		}
	}

	const handleToggleMode = () => {
		if (isManualMode) {
			// Switching back to detect mode
			setManualBarcode('')
		}
		setIsManualMode(!isManualMode)
	}

	const handleSubmitManualBarcode = () => {
		if (manualBarcode.trim()) {
			handleBarCodeScan(manualBarcode.trim())
			setIsVisible(false)
			setManualBarcode('')
			setIsManualMode(false)
		}
	}

	// If permission is not granted and we've checked, close the scanner
	// The system permission dialog will have been shown by PermissionContext
	useEffect(() => {
		if (permissionChecked && !cameraPermission?.granted) {
			setIsVisible(false)
		}
	}, [permissionChecked, cameraPermission?.granted])

	// Only render camera view if permission is granted, otherwise return null
	if (!cameraPermission?.granted) {
		return null
	}

	return (
		<Modal animationType="none" visible={isVisible}>
			<View style={styles.container}>
				{/* Full screen camera */}
				<CameraView
					ref={cameraRef}
					facing="back"
					style={styles.camera}
					barcodeScannerSettings={{
						barcodeTypes: isManualMode ? [] : ['*'],
					}}
					onBarcodeScanned={
						isManualMode
							? undefined
							: (data) => {
									handleBarCodeScan(data.data)
									setIsVisible(false)
								}
					}
				>
					{/* Dark overlay with transparent focus area */}
					{isManualMode ? (
						// Full dark overlay for manual mode
						<View style={styles.fullDarkOverlay} />
					) : (
						// Focus area overlay for detect mode
						<View style={styles.overlay}>
							{/* Top overlay */}
							<View style={[styles.overlaySection, { height: focusTop }]} />

							{/* Middle section with focus area */}
							<View style={[styles.middleSection, { height: focusHeight }]}>
								<View style={[styles.overlaySection, { width: focusLeft }]} />

								{/* Focus area with corner indicators only */}
								<View
									style={[
										styles.focusArea,
										{ width: focusWidth, height: focusHeight },
									]}
								>
									{/* Corner indicators */}
									<View style={styles.topLeftCorner} />
									<View style={styles.topRightCorner} />
									<View style={styles.bottomLeftCorner} />
									<View style={styles.bottomRightCorner} />
								</View>

								<View
									style={[
										styles.overlaySection,
										{ width: width - focusLeft - focusWidth },
									]}
								/>
							</View>

							{/* Bottom overlay */}
							<View style={[styles.overlaySection, { flex: 1 }]} />
						</View>
					)}

					{/* Back button at top corner */}
					<View style={styles.backButtonContainer}>
						<TouchableOpacity
							style={styles.backButton}
							onPress={() => setIsVisible(false)}
						>
							<Text style={styles.backButtonText}>✕</Text>
						</TouchableOpacity>
					</View>

					{/* Instructions text */}
					<View style={styles.instructionContainer}>
						{isManualMode ? (
							<Text style={styles.instructionText} numberOfLines={1}>
								{loc.t('barCodeScanner.typeManually') ||
									'Type barcode manually'}
							</Text>
						) : (
							<>
								<Text style={styles.instructionText} numberOfLines={1}>
									{loc.t('barCodeScanner.barcodeAutoDetected')}
								</Text>
								<Text style={styles.instructionText}>
									{loc.t('barCodeScanner.textPositionedForOCR')}
								</Text>
							</>
						)}
					</View>

					{/* Capture button centered at bottom - only show in detect mode */}
					{!isManualMode && (
						<View style={styles.buttonContainer}>
							<TouchableOpacity
								style={styles.captureButton}
								onPress={handleCapture}
							>
								<View style={styles.captureButtonInner} />
							</TouchableOpacity>
						</View>
					)}

					{/* Manual Input Section */}
					<View style={styles.manualInputContainer}>
						<View style={styles.inputWrapper}>
							<TextInput
								style={[
									styles.barcodeInput,
									!isManualMode && styles.barcodeInputDisabled,
								]}
								value={isManualMode ? manualBarcode : ''}
								onChangeText={setManualBarcode}
								placeholder={
									isManualMode
										? loc.t('barCodeScanner.enterBarcode') || 'Enter barcode'
										: loc.t('barCodeScanner.detectingAutomatically') ||
											'Detecting automatically'
								}
								placeholderTextColor={isManualMode ? '#999' : '#fff'}
								editable={isManualMode}
								keyboardType="numeric"
								returnKeyType="done"
								onSubmitEditing={handleSubmitManualBarcode}
							/>
							{isManualMode && manualBarcode.trim().length > 0 && (
								<TouchableOpacity
									style={styles.submitButton}
									onPress={handleSubmitManualBarcode}
								>
									<MaterialCommunityIcons
										name="arrow-right"
										size={24}
										color="#fff"
									/>
								</TouchableOpacity>
							)}
						</View>
						<TouchableOpacity
							style={styles.modeButton}
							onPress={handleToggleMode}
						>
							<Text style={styles.modeButtonText}>
								{isManualMode
									? loc.t('barCodeScanner.detect') || 'Detect'
									: loc.t('barCodeScanner.manual') || 'Manual'}
							</Text>
						</TouchableOpacity>
					</View>
				</CameraView>
			</View>
		</Modal>
	)
}

// ...existing styles...
const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	camera: {
		flex: 1,
	},
	overlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	overlaySection: {
		backgroundColor: 'rgba(0, 0, 0, 0.6)',
	},
	fullDarkOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0, 0, 0, 0.6)',
	},
	middleSection: {
		flexDirection: 'row',
	},
	focusArea: {
		position: 'relative',
		// No border, just transparent area for corners
	},
	topLeftCorner: {
		position: 'absolute',
		top: -2,
		left: -2,
		width: 30,
		height: 30,
		borderTopWidth: 4,
		borderLeftWidth: 4,
		borderColor: '#FFFFFF',
	},
	topRightCorner: {
		position: 'absolute',
		top: -2,
		right: -2,
		width: 30,
		height: 30,
		borderTopWidth: 4,
		borderRightWidth: 4,
		borderColor: '#FFFFFF',
	},
	bottomLeftCorner: {
		position: 'absolute',
		bottom: -2,
		left: -2,
		width: 30,
		height: 30,
		borderBottomWidth: 4,
		borderLeftWidth: 4,
		borderColor: '#FFFFFF',
	},
	bottomRightCorner: {
		position: 'absolute',
		bottom: -2,
		right: -2,
		width: 30,
		height: 30,
		borderBottomWidth: 4,
		borderRightWidth: 4,
		borderColor: '#FFFFFF',
	},
	backButtonContainer: {
		position: 'absolute',
		top: 20,
		right: 20,
		zIndex: 10,
	},
	backButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: 'rgba(0, 0, 0, 0.6)',
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 2,
		borderColor: 'rgba(255, 255, 255, 0.8)',
	},
	backButtonText: {
		color: '#fff',
		fontSize: 18,
		fontWeight: 'bold',
	},
	instructionContainer: {
		position: 'absolute',
		top: height * 0.1, // Position higher above the scan area
		left: 0,
		right: 0,
		alignItems: 'center',
	},
	instructionText: {
		color: '#fff',
		fontSize: 15,
		fontWeight: '500',
		textAlign: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.8)',
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 20,
		lineHeight: 20,
		maxWidth: width * 0.9,
	},
	buttonContainer: {
		position: 'absolute',
		bottom: 150,
		left: 0,
		right: 0,
		alignItems: 'center',
		justifyContent: 'center',
	},
	manualInputContainer: {
		position: 'absolute',
		bottom: 50,
		left: 20,
		right: 20,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	inputWrapper: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.7)',
		borderRadius: 12,
		paddingHorizontal: 16,
		borderWidth: 2,
		borderColor: 'rgba(255, 255, 255, 0.3)',
	},
	barcodeInput: {
		flex: 1,
		height: 50,
		fontSize: 16,
		color: '#fff',
		fontWeight: '500',
	},
	barcodeInputDisabled: {
		color: '#fff',
	},
	submitButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: '#007AFF',
		justifyContent: 'center',
		alignItems: 'center',
		marginLeft: 8,
	},
	modeButton: {
		backgroundColor: 'rgba(0, 0, 0, 0.7)',
		paddingHorizontal: 20,
		paddingVertical: 14,
		borderRadius: 12,
		borderWidth: 2,
		borderColor: 'rgba(255, 255, 255, 0.3)',
		minWidth: 80,
		alignItems: 'center',
	},
	modeButtonText: {
		color: '#fff',
		fontSize: 15,
		fontWeight: '600',
	},
	captureButton: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: 'rgba(255, 255, 255, 0.9)',
		justifyContent: 'center',
		alignItems: 'center',
		elevation: 5,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		borderWidth: 4,
		borderColor: '#fff',
	},
	captureButtonInner: {
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: '#007AFF',
	},
	permissionContainer: {
		flex: 1,
		backgroundColor: '#f5f5f5',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	permissionContent: {
		backgroundColor: '#fff',
		padding: 30,
		borderRadius: 15,
		alignItems: 'center',
		elevation: 5,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		minWidth: width * 0.8,
	},
	permissionText: {
		fontSize: 18,
		fontWeight: '600',
		color: '#333',
		marginBottom: 20,
		textAlign: 'center',
	},
	permissionButton: {
		backgroundColor: '#007AFF',
		paddingHorizontal: 30,
		paddingVertical: 12,
		borderRadius: 8,
		marginBottom: 15,
	},
	permissionButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '600',
	},
	closeButton: {
		backgroundColor: '#f0f0f0',
		paddingHorizontal: 30,
		paddingVertical: 12,
		borderRadius: 8,
	},
	closeButtonText: {
		color: '#666',
		fontSize: 16,
		fontWeight: '500',
	},
})
