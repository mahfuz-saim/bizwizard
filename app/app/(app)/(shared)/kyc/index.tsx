import React, { useState, useMemo, useEffect } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	TextInput,
	ScrollView,
	Platform,
	Image,
	Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { Formik } from 'formik'
import * as Yup from 'yup'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useRouter } from 'expo-router'
import { useLocalization } from '../../../../src/localization/localizationContext'
import useApi from '@/src/hooks/useApi'
import { kycController } from '@/src/controllers/kyc'
import { cleanString } from '@/src/components/CleanString'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'

export enum IdType {
	PASSPORT = 'PASSPORT',
	DRIVERS_LICENSE = 'DRIVERS_LICENSE',
	NATIONAL_ID = 'NATIONAL_ID',
	BIRTH_CERTIFICATE = 'BIRTH_CERTIFICATE',
	OTHER = 'OTHER',
}

export interface IKycInput {
	firstName: string
	lastName: string
	dateOfBirth: Date
	nationality: string
	address: string
	idType: IdType
	idNumber: string
	documents: {
		documentFront: string
		documentBack: string
		selfie: string
	}
}

const KycPage: React.FC = () => {
	const router = useRouter()
	const { loc } = useLocalization()
	const [showDatePicker, setShowDatePicker] = useState(false)
	const [showIdTypePicker, setShowIdTypePicker] = useState(false)
	const [kycStatus, setKycStatus] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [showForm, setShowForm] = useState(false)
	const { fetchData } = useApi()

	useEffect(() => {
		const loadKYCStatus = async () => {
			setLoading(true)
			const result = await fetchData(kycController.getKYCStatus, {})
			if (result?.data) {
				setKycStatus(result.data)
			} else {
				setShowForm(true)
			}
			setLoading(false)
		}
		loadKYCStatus()
	}, [])

	const kycValidationSchema = useMemo(
		() =>
			Yup.object().shape({
				firstName: Yup.string()
					.required(loc.t('kyc.validation.firstNameRequired'))
					.min(2, loc.t('kyc.validation.firstNameMin')),
				lastName: Yup.string()
					.required(loc.t('kyc.validation.lastNameRequired'))
					.min(2, loc.t('kyc.validation.lastNameMin')),
				dateOfBirth: Yup.date()
					.required(loc.t('kyc.validation.dateOfBirthRequired'))
					.max(new Date(), loc.t('kyc.validation.dateOfBirthFuture'))
					.test(
						'age',
						loc.t('kyc.validation.ageRequirement'),
						function (value) {
							if (!value) return false
							const today = new Date()
							const birthDate = new Date(value)
							const age = today.getFullYear() - birthDate.getFullYear()
							const monthDiff = today.getMonth() - birthDate.getMonth()
							if (
								monthDiff < 0 ||
								(monthDiff === 0 && today.getDate() < birthDate.getDate())
							) {
								return age - 1 >= 18
							}
							return age >= 18
						}
					),
				nationality: Yup.string().required(
					loc.t('kyc.validation.nationalityRequired')
				),
				address: Yup.string()
					.required(loc.t('kyc.validation.addressRequired'))
					.min(10, loc.t('kyc.validation.addressMin')),
				idType: Yup.string()
					.required(loc.t('kyc.validation.idTypeRequired'))
					.oneOf(Object.values(IdType), loc.t('kyc.validation.invalidIdType')),
				idNumber: Yup.string()
					.required(loc.t('kyc.validation.idNumberRequired'))
					.min(5, loc.t('kyc.validation.idNumberMin')),
				documents: Yup.object().shape({
					documentFront: Yup.string().required(
						loc.t('kyc.validation.documentFrontRequired')
					),
					documentBack: Yup.string().required(
						loc.t('kyc.validation.documentBackRequired')
					),
					selfie: Yup.string().required(loc.t('kyc.validation.selfieRequired')),
				}),
			}),
		[loc]
	)

	const idTypeLabels: Record<IdType, string> = useMemo(
		() => ({
			[IdType.PASSPORT]: loc.t('kyc.idTypes.PASSPORT'),
			[IdType.DRIVERS_LICENSE]: loc.t('kyc.idTypes.DRIVERS_LICENSE'),
			[IdType.NATIONAL_ID]: loc.t('kyc.idTypes.NATIONAL_ID'),
			[IdType.BIRTH_CERTIFICATE]: loc.t('kyc.idTypes.BIRTH_CERTIFICATE'),
			[IdType.OTHER]: loc.t('kyc.idTypes.OTHER'),
		}),
		[loc]
	)

	const initialValues: IKycInput = {
		firstName: '',
		lastName: '',
		dateOfBirth: new Date(2000, 0, 1),
		nationality: 'Bangladeshi',
		address: '',
		idType: IdType.NATIONAL_ID,
		idNumber: '',
		documents: {
			documentFront: '',
			documentBack: '',
			selfie: '',
		},
	}

	// IMAGE COMPRESSION QUALITY - Adjust this value (0.0 to 1.0) to change compression
	// 0.7 = ~50-70% size reduction while maintaining readability
	const IMAGE_COMPRESSION_QUALITY = 0.7

	const pickImage = async (
		setFieldValue: (field: string, value: any) => void,
		fieldName: string,
		aspect: [number, number] = [4, 3]
	) => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
		if (status !== 'granted') {
			Alert.alert(
				loc.t('kyc.permissions.title'),
				loc.t('kyc.permissions.gallery')
			)
			return
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			allowsEditing: true,
			aspect: aspect,
			quality: 1,
		})

		if (!result.canceled && result.assets[0]) {
			const compressedImage = await ImageManipulator.manipulateAsync(
				result.assets[0].uri,
				[{ resize: { width: 1024 } }],
				{
					compress: IMAGE_COMPRESSION_QUALITY,
					format: ImageManipulator.SaveFormat.JPEG,
				}
			)
			setFieldValue(fieldName, compressedImage.uri)
		}
	}

	const takePhoto = async (
		setFieldValue: (field: string, value: any) => void,
		fieldName: string,
		aspect: [number, number] = [4, 3]
	) => {
		const { status } = await ImagePicker.requestCameraPermissionsAsync()
		if (status !== 'granted') {
			Alert.alert(
				loc.t('kyc.permissions.title'),
				loc.t('kyc.permissions.camera')
			)
			return
		}

		const result = await ImagePicker.launchCameraAsync({
			allowsEditing: true,
			aspect: aspect,
			quality: 1,
		})

		if (!result.canceled && result.assets[0]) {
			const compressedImage = await ImageManipulator.manipulateAsync(
				result.assets[0].uri,
				[{ resize: { width: 1024 } }],
				{
					compress: IMAGE_COMPRESSION_QUALITY,
					format: ImageManipulator.SaveFormat.JPEG,
				}
			)
			setFieldValue(fieldName, compressedImage.uri)
		}
	}

	const showImagePickerOptions = (
		setFieldValue: (field: string, value: any) => void,
		fieldName: string,
		aspect: [number, number] = [4, 3]
	) => {
		Alert.alert(loc.t('kyc.selectImage'), loc.t('kyc.selectImageDescription'), [
			{
				text: loc.t('kyc.camera'),
				onPress: () => takePhoto(setFieldValue, fieldName, aspect),
			},
			{
				text: loc.t('kyc.gallery'),
				onPress: () => pickImage(setFieldValue, fieldName, aspect),
			},
			{
				text: loc.t('kyc.cancel'),
				style: 'cancel',
			},
		])
	}

	const handleSubmit = async (values: IKycInput) => {
		const cleanedValues: IKycInput = {
			...values,
			firstName: cleanString(values.firstName || ''),
			lastName: cleanString(values.lastName || ''),
			nationality: cleanString(values.nationality || ''),
			address: cleanString(values.address || ''),
			idNumber: cleanString(values.idNumber || ''),
		}

		const submitResult = await fetchData(kycController.submitKYC, cleanedValues)
		//TODO: show result modal
		if (router.canGoBack()) {
			router.back()
		} else {
			router.replace('/home') // Fallback to home screen
		}
	}

	const renderStatusView = () => {
		if (!kycStatus) return null

		const { verificationStatus } = kycStatus

		if (verificationStatus === 'PENDING') {
			return (
				<View style={styles.statusContainer}>
					<MaterialIcons name="schedule" size={80} color="#F59E0B" />
					<Text style={styles.statusTitle}>
						{loc.t('kyc.status.pendingTitle')}
					</Text>
					<Text style={styles.statusMessage}>
						{loc.t('kyc.status.pendingMessage')}
					</Text>
				</View>
			)
		}

		if (verificationStatus === 'APPROVED') {
			return (
				<View style={styles.statusContainer}>
					<MaterialIcons name="check-circle" size={80} color="#10B981" />
					<Text style={styles.statusTitle}>
						{loc.t('kyc.status.approvedTitle')}
					</Text>
					<Text style={styles.statusMessage}>
						{loc.t('kyc.status.approvedMessage')}
					</Text>
				</View>
			)
		}

		if (verificationStatus === 'REJECTED') {
			return (
				<View style={styles.statusContainer}>
					<MaterialIcons name="cancel" size={80} color="#EF4444" />
					<Text style={styles.statusTitle}>
						{loc.t('kyc.status.rejectedTitle')}
					</Text>
					<Text style={styles.statusMessage}>
						{loc.t('kyc.status.rejectedMessage')}
					</Text>
					<TouchableOpacity
						style={styles.submitAgainButton}
						onPress={() => setShowForm(true)}
						activeOpacity={0.8}
					>
						<Text style={styles.submitAgainButtonText}>
							{loc.t('kyc.status.submitAgain')}
						</Text>
					</TouchableOpacity>
				</View>
			)
		}

		return null
	}

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={[styles.content, styles.centerContent]}>
					<Text style={styles.loadingText}>{loc.t('kyc.status.loading')}</Text>
				</View>
			</SafeAreaView>
		)
	}

	if (kycStatus && !showForm) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.content}>{renderStatusView()}</View>
			</SafeAreaView>
		)
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.content}>
				<Formik
					initialValues={initialValues}
					validationSchema={kycValidationSchema}
					onSubmit={handleSubmit}
				>
					{({
						handleChange,
						handleBlur,
						handleSubmit,
						setFieldValue,
						values,
						errors,
						touched,
					}) => (
						<>
							<ScrollView
								style={styles.formContainer}
								showsVerticalScrollIndicator={false}
							>
								{/* First Name and Last Name Row */}
								<View style={styles.rowContainer}>
									{/* First Name */}
									<View style={[styles.inputGroup, styles.halfWidth]}>
										<Text style={styles.label}>
											{loc.t('kyc.firstName')} {loc.t('kyc.required')}
										</Text>
										<TextInput
											style={[
												styles.input,
												touched.firstName &&
													errors.firstName &&
													styles.inputError,
											]}
											placeholder={loc.t('kyc.firstNamePlaceholder')}
											placeholderTextColor="#9CA3AF"
											value={values.firstName}
											onChangeText={handleChange('firstName')}
											onBlur={handleBlur('firstName')}
										/>
										{touched.firstName && errors.firstName && (
											<Text style={styles.errorText}>{errors.firstName}</Text>
										)}
									</View>

									{/* Last Name */}
									<View style={[styles.inputGroup, styles.halfWidth]}>
										<Text style={styles.label}>
											{loc.t('kyc.lastName')} {loc.t('kyc.required')}
										</Text>
										<TextInput
											style={[
												styles.input,
												touched.lastName &&
													errors.lastName &&
													styles.inputError,
											]}
											placeholder={loc.t('kyc.lastNamePlaceholder')}
											placeholderTextColor="#9CA3AF"
											value={values.lastName}
											onChangeText={handleChange('lastName')}
											onBlur={handleBlur('lastName')}
										/>
										{touched.lastName && errors.lastName && (
											<Text style={styles.errorText}>{errors.lastName}</Text>
										)}
									</View>
								</View>

								{/* Date of Birth and Nationality Row */}
								<View style={styles.rowContainer}>
									{/* Date of Birth */}
									<View style={[styles.inputGroup, styles.halfWidth]}>
										<Text style={styles.label}>
											{loc.t('kyc.dateOfBirth')} {loc.t('kyc.required')}
										</Text>
										<TouchableOpacity
											style={[
												styles.input,
												styles.dateInput,
												touched.dateOfBirth &&
													errors.dateOfBirth &&
													styles.inputError,
											]}
											onPress={() => setShowDatePicker(true)}
										>
											<Text style={styles.dateText}>
												{values.dateOfBirth.toLocaleDateString('en-GB')}
											</Text>
											<MaterialIcons
												name="calendar-today"
												size={20}
												color="#6B7280"
											/>
										</TouchableOpacity>
										{touched.dateOfBirth && errors.dateOfBirth && (
											<Text style={styles.errorText}>
												{typeof errors.dateOfBirth === 'string'
													? errors.dateOfBirth
													: loc.t('kyc.validation.invalidDate')}
											</Text>
										)}
										{showDatePicker && (
											<DateTimePicker
												value={values.dateOfBirth}
												mode="date"
												display={Platform.OS === 'ios' ? 'spinner' : 'default'}
												maximumDate={new Date()}
												onChange={(event, selectedDate) => {
													setShowDatePicker(Platform.OS === 'ios')
													if (selectedDate) {
														setFieldValue('dateOfBirth', selectedDate)
													}
												}}
											/>
										)}
									</View>

									{/* Nationality */}
									<View style={[styles.inputGroup, styles.halfWidth]}>
										<Text style={styles.label}>
											{loc.t('kyc.nationality')} {loc.t('kyc.required')}
										</Text>
										<TextInput
											style={[
												styles.input,
												touched.nationality &&
													errors.nationality &&
													styles.inputError,
											]}
											placeholder={loc.t('kyc.nationalityPlaceholder')}
											placeholderTextColor="#9CA3AF"
											value={values.nationality}
											onChangeText={handleChange('nationality')}
											onBlur={handleBlur('nationality')}
											maxLength={26}
											autoCapitalize="characters"
										/>
										{touched.nationality && errors.nationality && (
											<Text style={styles.errorText}>{errors.nationality}</Text>
										)}
									</View>
								</View>

								{/* Address */}
								<View style={styles.inputGroup}>
									<Text style={styles.label}>
										{loc.t('kyc.address')} {loc.t('kyc.required')}
									</Text>
									<TextInput
										style={[
											styles.input,
											styles.textArea,
											touched.address && errors.address && styles.inputError,
										]}
										placeholder={loc.t('kyc.addressPlaceholder')}
										placeholderTextColor="#9CA3AF"
										value={values.address}
										onChangeText={handleChange('address')}
										onBlur={handleBlur('address')}
										multiline
										numberOfLines={3}
										textAlignVertical="top"
									/>
									{touched.address && errors.address && (
										<Text style={styles.errorText}>{errors.address}</Text>
									)}
								</View>

								{/* ID Type */}
								<View style={styles.inputGroup}>
									<Text style={styles.label}>
										{loc.t('kyc.idType')} {loc.t('kyc.required')}
									</Text>
									<TouchableOpacity
										style={[
											styles.input,
											styles.dateInput,
											touched.idType && errors.idType && styles.inputError,
										]}
										onPress={() => setShowIdTypePicker(!showIdTypePicker)}
									>
										<Text style={styles.dateText}>
											{idTypeLabels[values.idType]}
										</Text>
										<MaterialIcons
											name={
												showIdTypePicker ? 'arrow-drop-up' : 'arrow-drop-down'
											}
											size={24}
											color="#6B7280"
										/>
									</TouchableOpacity>
									{touched.idType && errors.idType && (
										<Text style={styles.errorText}>{errors.idType}</Text>
									)}

									{showIdTypePicker && (
										<View style={styles.pickerContainer}>
											{Object.values(IdType).map((type) => (
												<TouchableOpacity
													key={type}
													style={[
														styles.pickerItem,
														values.idType === type && styles.pickerItemSelected,
													]}
													onPress={() => {
														setFieldValue('idType', type)
														setShowIdTypePicker(false)
													}}
												>
													<Text
														style={[
															styles.pickerItemText,
															values.idType === type &&
																styles.pickerItemTextSelected,
														]}
													>
														{idTypeLabels[type]}
													</Text>
													{values.idType === type && (
														<MaterialIcons
															name="check"
															size={20}
															color="#177DFF"
														/>
													)}
												</TouchableOpacity>
											))}
										</View>
									)}
								</View>

								{/* ID Number */}
								<View style={styles.inputGroup}>
									<Text style={styles.label}>
										{loc.t('kyc.idNumber')} {loc.t('kyc.required')}
									</Text>
									<TextInput
										style={[
											styles.input,
											touched.idNumber && errors.idNumber && styles.inputError,
										]}
										placeholder={loc.t('kyc.idNumberPlaceholder')}
										placeholderTextColor="#9CA3AF"
										value={values.idNumber}
										onChangeText={handleChange('idNumber')}
										onBlur={handleBlur('idNumber')}
										keyboardType="numeric"
									/>
									{touched.idNumber && errors.idNumber && (
										<Text style={styles.errorText}>{errors.idNumber}</Text>
									)}
								</View>

								{/* Documents Section */}
								<View style={styles.documentsSection}>
									<Text style={styles.sectionTitle}>
										{loc.t('kyc.documentsSection')}
									</Text>
									<Text style={styles.sectionSubtitle}>
										{loc.t('kyc.documentsSectionDescription')}
									</Text>

									{/* Document Front */}
									<View style={styles.inputGroup}>
										<Text style={styles.label}>
											{loc.t('kyc.documentFront')} {loc.t('kyc.required')}
										</Text>
										{values.documents.documentFront ? (
											<View style={styles.imagePreviewContainer}>
												<Image
													source={{ uri: values.documents.documentFront }}
													style={styles.imagePreview}
												/>
												<TouchableOpacity
													style={styles.changeImageButton}
													onPress={() =>
														showImagePickerOptions(
															setFieldValue,
															'documents.documentFront'
														)
													}
												>
													<MaterialIcons
														name="edit"
														size={20}
														color="#FFFFFF"
													/>
													<Text style={styles.changeImageText}>
														{loc.t('kyc.changePhoto')}
													</Text>
												</TouchableOpacity>
											</View>
										) : (
											<TouchableOpacity
												style={[
													styles.uploadButton,
													touched.documents?.documentFront &&
														errors.documents?.documentFront &&
														styles.inputError,
												]}
												onPress={() =>
													showImagePickerOptions(
														setFieldValue,
														'documents.documentFront'
													)
												}
												activeOpacity={0.7}
											>
												<MaterialIcons
													name="add-a-photo"
													size={32}
													color="#177DFF"
												/>
												<Text style={styles.uploadButtonText}>
													{loc.t('kyc.uploadPhoto')}
												</Text>
											</TouchableOpacity>
										)}
										{touched.documents?.documentFront &&
											errors.documents?.documentFront && (
												<Text style={styles.errorText}>
													{errors.documents.documentFront}
												</Text>
											)}
									</View>

									{/* Document Back */}
									<View style={styles.inputGroup}>
										<Text style={styles.label}>
											{loc.t('kyc.documentBack')} {loc.t('kyc.required')}
										</Text>
										{values.documents.documentBack ? (
											<View style={styles.imagePreviewContainer}>
												<Image
													source={{ uri: values.documents.documentBack }}
													style={styles.imagePreview}
												/>
												<TouchableOpacity
													style={styles.changeImageButton}
													onPress={() =>
														showImagePickerOptions(
															setFieldValue,
															'documents.documentBack'
														)
													}
												>
													<MaterialIcons
														name="edit"
														size={20}
														color="#FFFFFF"
													/>
													<Text style={styles.changeImageText}>
														{loc.t('kyc.changePhoto')}
													</Text>
												</TouchableOpacity>
											</View>
										) : (
											<TouchableOpacity
												style={[
													styles.uploadButton,
													touched.documents?.documentBack &&
														errors.documents?.documentBack &&
														styles.inputError,
												]}
												onPress={() =>
													showImagePickerOptions(
														setFieldValue,
														'documents.documentBack'
													)
												}
												activeOpacity={0.7}
											>
												<MaterialIcons
													name="add-a-photo"
													size={32}
													color="#177DFF"
												/>
												<Text style={styles.uploadButtonText}>
													{loc.t('kyc.uploadPhoto')}
												</Text>
											</TouchableOpacity>
										)}
										{touched.documents?.documentBack &&
											errors.documents?.documentBack && (
												<Text style={styles.errorText}>
													{errors.documents.documentBack}
												</Text>
											)}
									</View>

									{/* Selfie */}
									<View style={styles.inputGroup}>
										<Text style={styles.label}>
											{loc.t('kyc.selfie')} {loc.t('kyc.required')}
										</Text>
										{values.documents.selfie ? (
											<View style={styles.imagePreviewContainer}>
												<Image
													source={{ uri: values.documents.selfie }}
													style={styles.selfiePreview}
												/>
												<TouchableOpacity
													style={styles.changeImageButton}
													onPress={() =>
														showImagePickerOptions(
															setFieldValue,
															'documents.selfie',
															[1, 1]
														)
													}
												>
													<MaterialIcons
														name="edit"
														size={20}
														color="#FFFFFF"
													/>
													<Text style={styles.changeImageText}>
														{loc.t('kyc.changePhoto')}
													</Text>
												</TouchableOpacity>
											</View>
										) : (
											<TouchableOpacity
												style={[
													styles.uploadButton,
													touched.documents?.selfie &&
														errors.documents?.selfie &&
														styles.inputError,
												]}
												onPress={() =>
													showImagePickerOptions(
														setFieldValue,
														'documents.selfie',
														[1, 1]
													)
												}
												activeOpacity={0.7}
											>
												<MaterialIcons
													name="account-circle"
													size={32}
													color="#177DFF"
												/>
												<Text style={styles.uploadButtonText}>
													{loc.t('kyc.uploadSelfie')}
												</Text>
											</TouchableOpacity>
										)}
										{touched.documents?.selfie && errors.documents?.selfie && (
											<Text style={styles.errorText}>
												{errors.documents.selfie}
											</Text>
										)}
									</View>
								</View>
							</ScrollView>
							<View style={styles.buttonContainer}>
								<TouchableOpacity
									style={[styles.button, styles.cancelButton]}
									onPress={() => router.back()}
									activeOpacity={0.8}
								>
									<Text style={styles.cancelButtonText}>
										{loc.t('kyc.cancel')}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.button, styles.submitButton]}
									onPress={() => handleSubmit()}
									activeOpacity={0.8}
								>
									<Text style={styles.submitButtonText}>
										{loc.t('kyc.submit')}
									</Text>
								</TouchableOpacity>
							</View>
						</>
					)}
				</Formik>
			</View>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F0F8FF',
	},
	content: {
		flex: 1,
		paddingHorizontal: 20,
	},
	header: {
		paddingTop: 20,
		paddingBottom: 24,
	},
	backButton: {
		width: 40,
		height: 40,
		justifyContent: 'center',
		alignItems: 'flex-start',
		marginBottom: 16,
	},
	headerContent: {
		alignItems: 'center',
	},
	title: {
		fontSize: 24,
		fontWeight: '700',
		color: '#1F2937',
		marginTop: 12,
		marginBottom: 4,
	},
	subtitle: {
		fontSize: 14,
		color: '#6B7280',
		textAlign: 'center',
		lineHeight: 20,
	},
	formContainer: {
		flex: 1,
		paddingTop: 24,
	},
	rowContainer: {
		flexDirection: 'row',
		gap: 12,
		marginBottom: 0,
	},
	inputGroup: {
		marginBottom: 20,
	},
	halfWidth: {
		flex: 1,
	},
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: '#374151',
		marginBottom: 8,
	},
	input: {
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#D1D5DB',
		borderRadius: 10,
		paddingHorizontal: 16,
		paddingVertical: 12,
		fontSize: 16,
		color: '#1F2937',
	},
	inputError: {
		borderColor: '#EF4444',
	},
	textArea: {
		minHeight: 80,
		paddingTop: 12,
	},
	dateInput: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	dateText: {
		fontSize: 16,
		color: '#1F2937',
	},
	errorText: {
		fontSize: 12,
		color: '#EF4444',
		marginTop: 4,
	},
	pickerContainer: {
		backgroundColor: '#FFFFFF',
		borderRadius: 10,
		marginTop: 8,
		borderWidth: 1,
		borderColor: '#D1D5DB',
		overflow: 'hidden',
	},
	pickerItem: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
	},
	pickerItemSelected: {
		backgroundColor: '#EFF6FF',
	},
	pickerItemText: {
		fontSize: 16,
		color: '#374151',
	},
	pickerItemTextSelected: {
		color: '#177DFF',
		fontWeight: '600',
	},
	buttonContainer: {
		flexDirection: 'row',
		gap: 12,
		marginTop: 24,
		paddingBottom: 20,
	},
	button: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 48,
	},
	cancelButton: {
		backgroundColor: '#6B7280',
	},
	submitButton: {
		backgroundColor: '#177DFF',
	},
	cancelButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	submitButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	documentsSection: {
		marginTop: 8,
		paddingTop: 24,
		paddingBottom: 24,
		borderTopWidth: 1,
		borderTopColor: '#D1D5DB',
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#1F2937',
		marginBottom: 8,
	},
	sectionSubtitle: {
		fontSize: 14,
		color: '#6B7280',
		marginBottom: 20,
		lineHeight: 20,
	},
	uploadButton: {
		backgroundColor: '#FFFFFF',
		borderWidth: 2,
		borderColor: '#177DFF',
		borderRadius: 10,
		borderStyle: 'dashed',
		paddingVertical: 32,
		alignItems: 'center',
		justifyContent: 'center',
	},
	uploadButtonText: {
		color: '#177DFF',
		fontSize: 14,
		fontWeight: '600',
		marginTop: 8,
	},
	imagePreviewContainer: {
		position: 'relative',
		borderRadius: 10,
		overflow: 'hidden',
	},
	imagePreview: {
		width: '100%',
		height: 200,
		borderRadius: 10,
		backgroundColor: '#E5E7EB',
	},
	selfiePreview: {
		width: '100%',
		aspectRatio: 1,
		borderRadius: 10,
		backgroundColor: '#E5E7EB',
	},
	changeImageButton: {
		position: 'absolute',
		bottom: 12,
		right: 12,
		backgroundColor: 'rgba(23, 125, 255, 0.9)',
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
		gap: 6,
	},
	changeImageText: {
		color: '#FFFFFF',
		fontSize: 12,
		fontWeight: '600',
	},
	statusContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 40,
	},
	statusTitle: {
		fontSize: 24,
		fontWeight: '700',
		color: '#1F2937',
		marginTop: 24,
		textAlign: 'center',
	},
	statusMessage: {
		fontSize: 16,
		color: '#6B7280',
		textAlign: 'center',
		marginTop: 12,
		lineHeight: 24,
	},
	submitAgainButton: {
		backgroundColor: '#177DFF',
		paddingHorizontal: 32,
		paddingVertical: 14,
		borderRadius: 10,
		marginTop: 32,
		minWidth: 200,
		alignItems: 'center',
	},
	submitAgainButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	centerContent: {
		justifyContent: 'center',
		alignItems: 'center',
	},
	loadingText: {
		fontSize: 16,
		color: '#6B7280',
	},
})

export default KycPage
