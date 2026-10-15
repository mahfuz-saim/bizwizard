import {
	Text,
	View,
	TouchableOpacity,
	Dimensions,
	StyleSheet,
	Linking,
	ToastAndroid,
	ScrollView,
	TextInput,
	KeyboardAvoidingView,
	Platform,
	Keyboard,
	BackHandler,
} from 'react-native'
import { useState, useCallback, useEffect, useMemo, memo, useRef } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import ContentLoader, { Rect } from 'react-content-loader/native'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import useApi from '../../hooks/useApi'
import { cleanString } from '../CleanString'
import { getSupplierProducts } from '../../controllers/supplier'
import { DeleteModal } from '../AlertModal'
import * as Yup from 'yup'
import {
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetBackdrop,
} from '@gorhom/bottom-sheet'

// Memoized Product Item Component. Receives primitive props only so
// unrelated parent re-renders (e.g. a fresh supplierProducts array
// reference from a re-fetch) don't bust memoization for rows whose data
// hasn't changed.
const ProductItem = memo(function ProductItem({
	name,
	variantName,
	variantCode,
	formattedDate,
	formattedQuantity,
	addedLabel,
	unitsLabel,
}) {
	return (
		<View style={styles.productItem}>
			<View style={styles.productHeader}>
				<View style={styles.productNameContainer}>
					<Text
						style={styles.productName}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{name}
					</Text>
					<Text
						style={styles.variantName}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{variantName} ({variantCode})
					</Text>
				</View>
				<View style={styles.quantityContainer}>
					<Text style={styles.quantityText}>{formattedQuantity}</Text>
					<Text style={styles.quantityLabel}>{unitsLabel}</Text>
				</View>
			</View>
			<View style={styles.productFooter}>
				<Text style={styles.dateText}>
					{addedLabel}: {formattedDate}
				</Text>
			</View>
		</View>
	)
})

// Memoized Product Loader Component
const ProductLoader = memo(() => (
	<View style={styles.loaderContainer}>
		{[...Array(3)].map((_, index) => (
			<ContentLoader
				key={index}
				speed={2}
				width="100%"
				height={80}
				viewBox="0 0 400 80"
				backgroundColor="#E5E7EB"
				foregroundColor="#F3F4F6"
				style={styles.loaderItem}
			>
				<Rect x="0" y="8" rx="4" ry="4" width="60%" height="14" />
				<Rect x="0" y="28" rx="4" ry="4" width="40%" height="12" />
				<Rect x="75%" y="8" rx="8" ry="8" width="20%" height="16" />
				<Rect x="0" y="52" rx="4" ry="4" width="35%" height="10" />
				<Rect x="40%" y="52" rx="4" ry="4" width="25%" height="10" />
			</ContentLoader>
		))}
	</View>
))

// Memoized Header Component
const SupplierHeader = memo(
	({ supplier, loc, onClose, showBuyTransactions, editingField }) => (
		<View style={styles.headerContainer}>
			<View style={styles.header}>
				<View style={styles.headerTextContainer}>
					<Text
						style={styles.headerTitle}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{showBuyTransactions
							? loc.t('supplier.products.title') || 'Bought Products'
							: editingField
								? loc.t('supplier.supplierForm.editSupplier') || 'Edit Supplier'
								: loc.t('supplier.supplierDetails.title') || 'Supplier Details'}
					</Text>
				</View>
				<TouchableOpacity
					onPress={onClose}
					style={styles.closeButton}
					activeOpacity={0.7}
				>
					<MaterialIcons name="close" size={16} color="#6B7280" />
				</TouchableOpacity>
			</View>
		</View>
	)
)

// Memoized Info Section Component
const SupplierInfo = memo(
	({
		supplier,
		loc,
		onCallSupplier,
		translateNumber,
		translatePhone,
		editingField,
		editFormData,
		setEditFormData,
		handleInputFocus,
		validationErrors,
		touchedFields,
		handleBlur,
		handleEditField,
		handleSaveField,
		isSavingField,
	}) => {
		const supplierData = useMemo(
			() => [
				{
					key: 'supplierName',
					label: loc.t('supplier.supplierForm.name') || 'Supplier Name',
					value: supplier.supplierName || 'Not provided',
					editable: true,
					placeholder:
						loc.t('supplier.supplierForm.namePlaceholder') ||
						'Enter supplier name',
				},
				{
					key: 'company',
					label: loc.t('supplier.supplierForm.company') || 'Company',
					value: supplier.company || 'Not provided',
					editable: true,
					placeholder:
						loc.t('supplier.supplierForm.companyPlaceholder') ||
						'Enter company name',
				},
				{
					key: 'comment',
					label: loc.t('supplier.supplierForm.comment') || 'Comment',
					value: supplier.comment || 'Not provided',
					editable: true,
					multiline: true,
					placeholder:
						loc.t('supplier.supplierForm.commentPlaceholder') ||
						'Enter comment',
				},
				...(supplier.createdAt
					? [
							{
								key: 'createdAt',
								label:
									loc.t('supplier.supplierDetails.createdAt') || 'Added On',
								value: translateNumber(
									new Date(supplier.createdAt).toLocaleDateString()
								),
								editable: false,
							},
						]
					: []),
			],
			[supplier, loc, translateNumber]
		)

		return (
			<View style={styles.section}>
				<View style={styles.infoContainer}>
					{supplierData.map((item, index) => (
						<View key={index} style={styles.infoItem}>
							<Text style={styles.infoLabel}>{item.label}</Text>
							{editingField === item.key ? (
								<>
									<TextInput
										style={[
											styles.editInput,
											item.multiline && styles.editTextArea,
										]}
										value={editFormData[item.key] || ''}
										onChangeText={(text) =>
											setEditFormData((prev) => ({
												...prev,
												[item.key]: text,
											}))
										}
										onBlur={() => handleBlur(item.key)}
										onFocus={() => handleInputFocus(item.multiline ? 200 : 50)}
										placeholder={item.placeholder}
										placeholderTextColor="rgba(0,0,0,0.54)"
										multiline={item.multiline}
										numberOfLines={item.multiline ? 3 : 1}
										textAlignVertical={item.multiline ? 'top' : 'center'}
										autoFocus
									/>
									<TouchableOpacity
										onPress={() => handleSaveField(item.key)}
										style={styles.saveIconButton}
										activeOpacity={0.7}
										disabled={isSavingField}
									>
										<MaterialIcons
											name={isSavingField ? 'hourglass-empty' : 'check'}
											size={16}
											color="#22c55e"
										/>
									</TouchableOpacity>
									{touchedFields[item.key] && validationErrors[item.key] && (
										<Text style={styles.errorText}>
											{validationErrors[item.key]}
										</Text>
									)}
								</>
							) : (
								<>
									<Text style={styles.infoValue}>{item.value}</Text>
									{item.editable && (
										<TouchableOpacity
											onPress={() => handleEditField(item.key)}
											style={styles.editIconButton}
											activeOpacity={0.7}
										>
											<MaterialIcons name="edit" size={14} color="#195FE1" />
										</TouchableOpacity>
									)}
								</>
							)}
						</View>
					))}

					{/* Phone Number with Call Button */}
					<View style={styles.infoItem}>
						<Text style={styles.infoLabel}>
							{loc.t('supplier.supplierForm.number') || 'Phone Number'}
						</Text>
						<View style={styles.phoneContainer}>
							<Text style={styles.infoValuePhone}>
								{supplier.supplier?.number
									? translatePhone(supplier.supplier.number)
									: 'Not provided'}
							</Text>
							{supplier.supplier?.number && (
								<TouchableOpacity
									onPress={() => onCallSupplier(supplier.supplier.number)}
									style={styles.phoneIcon}
									activeOpacity={0.7}
								>
									<MaterialCommunityIcons
										name="phone"
										size={18}
										color="#22c55e"
									/>
								</TouchableOpacity>
							)}
						</View>
					</View>
				</View>
			</View>
		)
	}
)

export default function SupplierDetails({
	supplier,
	visible,
	onClose,
	onEdit,
	onDelete,
}) {
	const { loc } = useLocalization()
	const { translateNumber, translatePhone } = useNumberTranslator()
	const bottomSheetModalRef = useRef(null)
	const [showDeleteModal, setShowDeleteModal] = useState(false)
	const [showBuyTransactions, setShowBuyTransactions] = useState(false)
	const [supplierProducts, setSupplierProducts] = useState([])
	const [isLoadingProducts, setIsLoadingProducts] = useState(false)
	const [editingField, setEditingField] = useState(null) // Changed from isEditMode to editingField
	const [editFormData, setEditFormData] = useState({
		supplierName: '',
		company: '',
		number: '',
		comment: '',
	})
	const [keyboardVisible, setKeyboardVisible] = useState(false)
	const scrollViewRef = useRef(null)
	const { fetchData } = useApi()
	const [validationErrors, setValidationErrors] = useState({})
	const [touchedFields, setTouchedFields] = useState({})
	const [isSavingField, setIsSavingField] = useState(false)

	// Snap points for bottom sheet - dynamic based on content
	const snapPoints = useMemo(() => {
		// For supplier details view, use adequate height to show all content
		if (!showBuyTransactions) {
			return ['75%', '75%']
		}
		// For products (needs more space)
		return ['75%', '90%']
	}, [showBuyTransactions])

	// Validation schema
	const validationSchema = Yup.object().shape({
		supplierName: Yup.string()
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
	})

	// Reset view when modal opens
	useEffect(() => {
		if (visible) {
			setShowBuyTransactions(false)
			setEditingField(null)
			setEditFormData({
				supplierName: supplier?.supplierName || '',
				company: supplier?.company || '',
				number: supplier?.supplier?.number || '',
				comment: supplier?.comment || '',
			})
			// Small delay to ensure proper mounting
			const timer = setTimeout(() => {
				bottomSheetModalRef.current?.present()
			}, 50)
			return () => clearTimeout(timer)
		} else {
			bottomSheetModalRef.current?.dismiss()
		}
	}, [visible, supplier])

	// Keyboard listeners
	useEffect(() => {
		const keyboardDidShowListener = Keyboard.addListener(
			'keyboardDidShow',
			() => {
				setKeyboardVisible(true)
			}
		)
		const keyboardDidHideListener = Keyboard.addListener(
			'keyboardDidHide',
			() => {
				setKeyboardVisible(false)
			}
		)

		return () => {
			keyboardDidShowListener?.remove()
			keyboardDidHideListener?.remove()
		}
	}, [])

	const closeModal = useCallback(() => {
		bottomSheetModalRef.current?.dismiss()
		setTimeout(() => {
			onClose()
			setShowBuyTransactions(false)
			setEditingField(null)
		}, 150)
	}, [onClose])

	// Handle hardware back button
	useEffect(() => {
		if (!visible) return

		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			() => {
				closeModal()
				return true
			}
		)

		return () => backHandler.remove()
	}, [visible, closeModal])

	// Render backdrop component
	const renderBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="none"
				onPress={closeModal}
			/>
		),
		[closeModal]
	)

	const handleEditField = useCallback(
		(fieldName) => {
			setEditingField(fieldName)
			setValidationErrors({})
			setTouchedFields({})
			setEditFormData({
				supplierName: supplier?.supplierName || '',
				company: supplier?.company || '',
				number: supplier?.supplier?.number || '',
				comment: supplier?.comment || '',
			})
		},
		[supplier]
	)

	const handleCancelEdit = useCallback(() => {
		Keyboard.dismiss()
		setEditingField(null)
		setValidationErrors({})
		setTouchedFields({})
		setEditFormData({
			supplierName: supplier?.supplierName || '',
			company: supplier?.company || '',
			number: supplier?.supplier?.number || '',
			comment: supplier?.comment || '',
		})
	}, [supplier])

	const handleBlur = useCallback(
		(fieldName) => {
			setTouchedFields((prev) => ({ ...prev, [fieldName]: true }))

			// Validate single field
			try {
				validationSchema.validateSyncAt(fieldName, editFormData)
				setValidationErrors((prev) => {
					const newErrors = { ...prev }
					delete newErrors[fieldName]
					return newErrors
				})
			} catch (error) {
				setValidationErrors((prev) => ({
					...prev,
					[fieldName]: error.message,
				}))
			}
		},
		[editFormData, validationSchema]
	)

	const handleInputFocus = useCallback(
		(inputHeight = 100) => {
			if (scrollViewRef.current && keyboardVisible) {
				setTimeout(() => {
					scrollViewRef.current?.scrollTo({
						y: inputHeight,
						animated: true,
					})
				}, 100)
			}
		},
		[keyboardVisible]
	)

	const handleSaveField = useCallback(
		async (fieldName) => {
			// Validate only the field being edited
			try {
				await validationSchema.validateAt(fieldName, editFormData)
				setValidationErrors({})
			} catch (error) {
				setValidationErrors({ [fieldName]: error.message })
				return
			}

			setIsSavingField(true)

			const updatedData = {
				supplierName: cleanString(editFormData.supplierName || ''),
				company: cleanString(editFormData.company || ''),
				number: cleanString(editFormData.number || ''),
				comment: cleanString(editFormData.comment || ''),
			}

			try {
				await onEdit(supplier.id, updatedData)
				setEditingField(null)
			} catch (error) {
				console.error('Error saving field:', error)
			} finally {
				setIsSavingField(false)
			}
		},
		[editFormData, supplier?.id, onEdit, validationSchema]
	)

	// Fetch supplier products with proper dependency management
	useEffect(() => {
		if (!visible || !supplier?.id || !showBuyTransactions) {
			return
		}

		const fetchSupplierProducts = async () => {
			setIsLoadingProducts(true)
			try {
				const data = await fetchData(getSupplierProducts, {
					data: { supplierId: supplier.id },
				})

				if (data?.success && data?.data?.data) {
					setSupplierProducts(data.data.data)
				}
			} catch (error) {
				console.error('Error fetching supplier products:', error)
				ToastAndroid.show(
					loc.t('supplier.products.fetchError') || 'Error loading products',
					ToastAndroid.SHORT
				)
			} finally {
				setIsLoadingProducts(false)
			}
		}

		fetchSupplierProducts()
	}, [visible, supplier?.id, showBuyTransactions])

	const handleDelete = useCallback(() => {
		setShowDeleteModal(true)
	}, [])

	const confirmDelete = useCallback(() => {
		onDelete(supplier.supplier.id)
		setShowDeleteModal(false)
		closeModal()
	}, [supplier.supplier.id, onDelete, closeModal])

	const handleCallSupplier = useCallback(
		async (phoneNumber) => {
			if (!phoneNumber) {
				ToastAndroid.show(
					loc.t('supplier.noPhoneNumber') || 'No phone number available',
					ToastAndroid.SHORT
				)
				return
			}

			const phoneUrl = `tel:${phoneNumber}`
			try {
				const supported = await Linking.canOpenURL(phoneUrl)
				if (supported) {
					await Linking.openURL(phoneUrl)
				} else {
					ToastAndroid.show(
						loc.t('supplier.callNotSupported') ||
							'Phone calls are not supported on this device',
						ToastAndroid.SHORT
					)
				}
			} catch (error) {
				ToastAndroid.show(
					loc.t('supplier.callError') || 'Error making phone call',
					ToastAndroid.SHORT
				)
			}
		},
		[loc]
	)

	// Memoized empty component
	const renderEmptyComponent = useMemo(
		() => (
			<View style={styles.emptyContainer}>
				<MaterialIcons name="inventory" size={48} color="#E5E7EB" />
				<Text style={styles.emptyText}>
					{loc.t('supplier.products.noProducts') ||
						'No products found from this supplier'}
				</Text>
			</View>
		),
		[loc]
	)

	if (!supplier) return null

	// Don't render if not visible to avoid mounting issues
	if (!visible) return null

	return (
		<>
			<BottomSheetModal
				ref={bottomSheetModalRef}
				snapPoints={snapPoints}
				enablePanDownToClose={true}
				backdropComponent={renderBackdrop}
				keyboardBehavior="interactive"
				keyboardBlurBehavior="restore"
				android_keyboardInputMode="adjustResize"
				backgroundStyle={styles.bottomSheetBackground}
				handleIndicatorStyle={styles.handleIndicator}
			>
				{/* Fixed Header */}
				<SupplierHeader
					supplier={supplier}
					loc={loc}
					onClose={closeModal}
					showBuyTransactions={showBuyTransactions}
					editingField={editingField}
				/>

				{/* Scrollable Content */}
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
							{showBuyTransactions ? (
								/* Buy Transactions View */
								<View style={styles.section}>
									<View style={styles.productsContainer}>
										<ScrollView
											style={styles.productsScrollView}
											contentContainerStyle={styles.productsScrollContent}
											showsVerticalScrollIndicator={true}
											bounces={true}
											scrollEventThrottle={16}
											nestedScrollEnabled={true}
										>
											{isLoadingProducts ? (
												<ProductLoader />
											) : supplierProducts.length > 0 ? (
												supplierProducts.map((item) => (
													<ProductItem
														key={item.id}
														name={item.name}
														variantName={item.variantName}
														variantCode={item.variantCode}
														formattedDate={translateNumber(
															new Date(item.createdAt).toLocaleDateString(
																'en-US',
																{
																	year: 'numeric',
																	month: 'short',
																	day: 'numeric',
																}
															)
														)}
														formattedQuantity={translateNumber(
															item.totalProducts?.toString()
														)}
														addedLabel={
															loc.t('supplier.products.added') || 'Added'
														}
														unitsLabel={
															loc.t('supplier.products.units') || 'units'
														}
													/>
												))
											) : (
												renderEmptyComponent
											)}
										</ScrollView>
									</View>
								</View>
							) : (
								/* Supplier Details View */
								<SupplierInfo
									supplier={supplier}
									loc={loc}
									onCallSupplier={handleCallSupplier}
									translateNumber={translateNumber}
									translatePhone={translatePhone}
									editingField={editingField}
									editFormData={editFormData}
									setEditFormData={setEditFormData}
									handleInputFocus={handleInputFocus}
									validationErrors={validationErrors}
									touchedFields={touchedFields}
									handleBlur={handleBlur}
									handleEditField={handleEditField}
									handleSaveField={handleSaveField}
									isSavingField={isSavingField}
								/>
							)}
						</View>

						{/* Bottom Buttons */}
						<View style={styles.bottomButtonContainer}>
							{showBuyTransactions ? (
								<TouchableOpacity
									style={[styles.button, styles.toggleButton]}
									onPress={() => setShowBuyTransactions(false)}
									activeOpacity={0.8}
								>
									<MaterialIcons
										name="person"
										size={18}
										color="#FFFFFF"
										style={styles.buttonIcon}
									/>
									<Text style={styles.toggleButtonText}>
										{loc.t('supplier.products.showSupplierDetails') ||
											'Show Supplier Details'}
									</Text>
								</TouchableOpacity>
							) : (
								<>
									<TouchableOpacity
										style={[styles.button, styles.deleteButtonInDetails]}
										onPress={handleDelete}
										activeOpacity={0.8}
									>
										<MaterialIcons
											name="delete"
											size={18}
											color="#FFFFFF"
											style={styles.buttonIcon}
										/>
										<Text style={styles.deleteButtonText}>
											{loc.t('supplier.supplierDetails.delete') || 'Delete'}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[styles.button, styles.toggleButton]}
										onPress={() => setShowBuyTransactions(true)}
										activeOpacity={0.8}
									>
										<MaterialIcons
											name="shopping-cart"
											size={18}
											color="#FFFFFF"
											style={styles.buttonIcon}
										/>
										<Text style={styles.toggleButtonText}>
											{loc.t('supplier.products.showBuyTransactions') ||
												'Show Buy Transactions'}
										</Text>
									</TouchableOpacity>
								</>
							)}
						</View>
					</BottomSheetScrollView>
				</KeyboardAvoidingView>
			</BottomSheetModal>

			{/* Delete Confirmation Modal */}
			<DeleteModal
				visible={showDeleteModal}
				onClose={() => setShowDeleteModal(false)}
				onConfirm={confirmDelete}
				title={loc.t('supplier.deleteConfirm.title') || undefined}
				subtitle={
					loc.t('supplier.deleteConfirm.message', {
						name: supplier?.supplierName,
					}) || `Are you sure you want to delete ${supplier?.supplierName}?`
				}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF', // AliceBlue to match customer page
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
		backgroundColor: '#195FE1', // Blue to match customer page
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
		paddingBottom: 24,
	},
	container: {
		padding: 16,
		paddingTop: 0,
		paddingBottom: 0,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
	},
	headerTextContainer: {
		flex: 1,
		marginRight: 8,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#195FE1', // Blue to match customer page
	},
	closeButton: {
		width: 28,
		height: 28,
		backgroundColor: '#E5E7EB',
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
		flexShrink: 0,
	},
	section: {
		padding: 12,
		borderRadius: 8,
		marginBottom: 4,
	},
	sectionTitle: {
		fontWeight: '600',
		fontSize: 16,
		color: '#195FE1',
		marginBottom: 12,
		textAlign: 'center',
	},
	infoContainer: {
		backgroundColor: 'transparent',
		borderRadius: 12,
		padding: 0,
	},
	infoItem: {
		marginBottom: 16,
		position: 'relative',
		paddingTop: 8,
	},
	infoLabel: {
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
	infoValue: {
		fontSize: 16,
		color: '#333333',
		fontWeight: '500',
		backgroundColor: '#FFFFFF',
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		minHeight: 44,
		textAlignVertical: 'center',
	},
	phoneContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	infoValuePhone: {
		fontSize: 16,
		color: '#333333',
		fontWeight: '500',
		backgroundColor: '#FFFFFF',
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		flex: 1,
		minHeight: 44,
		textAlignVertical: 'center',
	},
	phoneIcon: {
		backgroundColor: '#FFFFFF',
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		justifyContent: 'center',
		alignItems: 'center',
		width: 44,
		height: 44,
	},
	editIconButton: {
		position: 'absolute',
		top: 8,
		right: 8,
		padding: 4,
		borderRadius: 6,
		backgroundColor: 'transparent',
		justifyContent: 'center',
		alignItems: 'center',
		width: 28,
		height: 28,
		zIndex: 11,
	},
	saveIconButton: {
		position: 'absolute',
		top: 8,
		right: 8,
		padding: 4,
		borderRadius: 6,
		backgroundColor: 'transparent',
		justifyContent: 'center',
		alignItems: 'center',
		width: 28,
		height: 28,
		zIndex: 11,
	},
	productsContainer: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		padding: 8,
		flex: 1,
	},
	productsScrollView: {
		flex: 1,
	},
	productsScrollContent: {
		paddingVertical: 4,
		flexGrow: 1,
	},
	// Products Section Styles
	productItem: {
		backgroundColor: '#FFFFFF',
		marginHorizontal: 8,
		marginVertical: 4,
		padding: 16,
		borderRadius: 12,
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},
	productHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 8,
	},
	productNameContainer: {
		flex: 1,
		marginRight: 12,
	},
	productName: {
		fontSize: 16,
		fontWeight: '600',
		color: '#111827',
		marginBottom: 2,
	},
	variantName: {
		fontSize: 14,
		color: '#6B7280',
		fontWeight: '500',
	},
	quantityContainer: {
		alignItems: 'center',
		backgroundColor: '#EFF6FF',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
		minWidth: 60,
	},
	quantityText: {
		fontSize: 16,
		fontWeight: '700',
		color: '#2563EB',
	},
	quantityLabel: {
		fontSize: 10,
		color: '#6B7280',
		fontWeight: '500',
	},
	productFooter: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	dateText: {
		fontSize: 12,
		color: '#6B7280',
	},
	emptyContainer: {
		alignItems: 'center',
		paddingVertical: 40,
		paddingHorizontal: 20,
	},
	emptyText: {
		fontSize: 16,
		color: '#E5E7EB',
		textAlign: 'center',
		marginTop: 12,
		fontWeight: '600',
	},
	emptySubText: {
		fontSize: 14,
		color: '#D1D5DB',
		textAlign: 'center',
		marginTop: 4,
	},
	// Loader Styles
	loaderContainer: {
		backgroundColor: 'transparent',
		borderRadius: 12,
		padding: 8,
	},
	loaderItem: {
		backgroundColor: '#FFFFFF',
		marginHorizontal: 8,
		marginVertical: 4,
		padding: 16,
		borderRadius: 12,
		height: 80,
	},
	// Button Styles
	bottomButtonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
		paddingHorizontal: 28,
		paddingTop: 4,
		paddingBottom: 8,
	},
	button: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 14,
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	buttonIcon: {
		marginRight: 8,
	},
	editButton: {
		backgroundColor: '#195FE1',
	},
	editButtonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 15,
	},
	cancelButton: {
		backgroundColor: '#E5E7EB',
	},
	cancelButtonText: {
		color: '#6B7280',
		fontWeight: '600',
		fontSize: 15,
	},
	saveButton: {
		backgroundColor: '#195FE1',
	},
	saveButtonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 15,
	},
	deleteButtonInDetails: {
		backgroundColor: '#EF4444',
	},
	deleteButtonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 15,
	},
	toggleButton: {
		backgroundColor: '#195FE1',
	},
	toggleButtonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 15,
	},
	editInput: {
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingRight: 40,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		fontSize: 16,
		color: '#333333',
		minHeight: 44,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 2,
	},
	editInputFocused: {
		borderColor: 'rgba(0, 0, 0, 0.54)',
		shadowOpacity: 0.1,
	},
	editTextArea: {
		minHeight: 80,
		paddingTop: 12,
		paddingRight: 40,
		textAlignVertical: 'top',
	},
	errorText: {
		color: '#ff0033',
		fontSize: 12,
		marginTop: 4,
		marginLeft: 4,
	},
})
