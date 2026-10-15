import {
	Modal,
	Text,
	View,
	TouchableOpacity,
	Dimensions,
	StyleSheet,
	Linking,
	ToastAndroid,
	TouchableWithoutFeedback,
	TextInput,
	KeyboardAvoidingView,
	Platform,
	Keyboard,
	ScrollView,
	Animated,
	BackHandler,
} from 'react-native'
import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { getAllCheckouts } from '../../controllers/customer'
import useApi from '../../hooks/useApi'
import { salesController } from '../../controllers/sales'
import { DeleteModal } from '../AlertModal'
import { cleanString } from '../CleanString'
import * as Yup from 'yup'
import GenerateReceiptHtml from '../receipt/ReceiptHtml'
import { printToFileAsync } from 'expo-print'
import * as FileSystem from 'expo-file-system/legacy'
import { usePermission } from '../../context/PermissionContext'
import { useAuth } from '../../context/AuthContext'
import {
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetBackdrop,
} from '@gorhom/bottom-sheet'

const { height: screenHeight } = Dimensions.get('window')

// Memoized Transaction Item Component. Receives primitive props only so
// unrelated parent re-renders (e.g. a fresh checkoutsData array reference
// from a re-fetch) don't bust memoization for rows whose data hasn't
// changed. The `onPress` prop is expected to be a per-row closure created
// by the parent that carries the original item identity.
const TransactionItem = memo(function TransactionItem({
	formattedDate,
	formattedAmount,
	isPaid,
	paidLabel,
	unpaidLabel,
	onPress,
}) {
	const statusColor = isPaid ? '#22c55e' : '#EF4444'
	const statusText = isPaid ? paidLabel : unpaidLabel

	return (
		<View style={styles.transactionItem}>
			<View style={styles.transactionHeader}>
				<View style={styles.transactionInfo}>
					<Text style={styles.transactionDate}>{formattedDate}</Text>
					<View style={styles.transactionDetails}>
						<Text style={styles.transactionAmount}>{formattedAmount}</Text>
						<View
							style={[styles.statusBadge, { backgroundColor: statusColor }]}
						>
							<Text style={styles.statusText}>{statusText}</Text>
						</View>
					</View>
				</View>
				<TouchableOpacity
					onPress={onPress}
					style={styles.infoButton}
					activeOpacity={0.7}
				>
					<MaterialIcons name="info-outline" size={20} color="#6B7280" />
				</TouchableOpacity>
			</View>
		</View>
	)
})

// Memoized Transaction Loader Component
const TransactionLoader = memo(() => (
	<View style={styles.loaderContainer}>
		{[...Array(3)].map((_, index) => (
			<View key={index} style={styles.loaderItem}>
				<View style={styles.loaderLine1} />
				<View style={styles.loaderLine2} />
				<View style={styles.loaderLine3} />
			</View>
		))}
	</View>
))

// Memoized Header Component
const CustomerHeader = memo(
	({ customer, loc, onClose, showTransactions, showTransactionDetails }) => (
		<View style={styles.headerContainer}>
			<View style={styles.header}>
				<View style={styles.headerTextContainer}>
					<Text
						style={styles.headerTitle}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{showTransactionDetails
							? loc.t('customer.transactions.details') || 'Transaction Details'
							: showTransactions
								? loc.t('customer.transactions.title') || 'Purchase History'
								: loc.t('customer.customerDetails.title') || 'Customer Details'}
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

// Transaction Details Modal Component
const TransactionDetailsModal = memo(
	({
		visible,
		transaction,
		onClose,
		loc,
		translateNumber,
		translateAmount,
		onDownloadReceipt,
		isDownloading,
	}) => {
		if (!transaction) return null

		const formatDate = (dateString) => {
			return translateNumber(
				new Date(dateString).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit',
				})
			)
		}

		const getDiscountTypeText = (type) => {
			return type === 'PERCENTAGE'
				? loc.t('customer.transactions.percentage') || 'Percentage'
				: loc.t('customer.transactions.fixed') || 'Fixed'
		}

		const getSoldByText = (soldBy, soldByOwnerId, soldByEmployeeId) => {
			if (!soldBy) return '-'
			if (soldBy === 'OWNER')
				return loc.t('customer.transactions.owner') || 'Owner'
			if (soldBy === 'EMPLOYEE')
				return loc.t('customer.transactions.employee') || 'Employee'
			return soldBy
		}

		return (
			<Modal
				transparent={true}
				visible={visible}
				animationType="fade"
				onRequestClose={onClose}
			>
				<View style={styles.transactionModalBackdrop}>
					<TouchableWithoutFeedback onPress={onClose}>
						<View style={styles.backdropTouchable} />
					</TouchableWithoutFeedback>

					<View style={styles.transactionModalContainer}>
						<Animated.View style={styles.transactionModalContent}>
							<ScrollView
								showsVerticalScrollIndicator={false}
								bounces={true}
								scrollEventThrottle={16}
								nestedScrollEnabled={true}
								contentContainerStyle={styles.transactionScrollContent}
							>
								<View style={styles.transactionContainer}>
									{/* Header */}
									<View style={styles.transactionModalHeader}>
										<Text style={styles.transactionModalTitle}>
											{loc.t('customer.transactions.details') ||
												'Transaction Details'}
										</Text>
										<TouchableOpacity
											onPress={onClose}
											style={styles.transactionModalClose}
										>
											<MaterialIcons name="close" size={18} color="#6B7280" />
										</TouchableOpacity>
									</View>

									{/* Transaction Summary Section */}
									<View style={styles.section}>
										<Text style={styles.sectionTitle}>
											{loc.t('customer.transactions.summary') ||
												'Transaction Summary'}
										</Text>
										<View style={styles.fieldContainer}>
											<View style={styles.infoRow}>
												<Text style={styles.infoLabel}>
													{loc.t('customer.transactions.totalPrice') ||
														'Total Price'}
												</Text>
												<Text style={styles.transactionInfoValue}>
													{translateAmount(transaction.totalPrice?.toString())}
												</Text>
											</View>

											<View style={styles.infoRow}>
												<Text style={styles.infoLabel}>
													{loc.t('customer.transactions.totalQuantity') ||
														'Total Quantity'}
												</Text>
												<Text style={styles.transactionInfoValue}>
													{translateNumber(
														transaction.totalQuantity?.toString()
													)}
												</Text>
											</View>

											<View style={styles.infoRow}>
												<Text style={styles.infoLabel}>
													{loc.t('customer.transactions.totalDiscount') ||
														'Total Discount'}
												</Text>
												<Text style={styles.transactionInfoValue}>
													{translateAmount(
														transaction.totalDiscount?.toString()
													)}
												</Text>
											</View>

											<View style={styles.infoRow}>
												<Text style={styles.infoLabel}>
													{loc.t('customer.transactions.discountType') ||
														'Discount Type'}
												</Text>
												<Text style={styles.transactionInfoValue}>
													{getDiscountTypeText(transaction.discountType)}
												</Text>
											</View>

											<View style={styles.infoRow}>
												<Text style={styles.infoLabel}>
													{loc.t('customer.transactions.status') || 'Status'}
												</Text>
												<View
													style={[
														styles.statusBadge,
														{
															backgroundColor:
																transaction.status === 'PAID'
																	? '#22c55e'
																	: '#EF4444',
														},
													]}
												>
													<Text style={styles.statusText}>
														{transaction.status === 'PAID'
															? loc.t('customer.transactions.paid') || 'Paid'
															: loc.t('customer.transactions.unpaid') ||
																'Unpaid'}
													</Text>
												</View>
											</View>

											<View style={styles.infoRow}>
												<Text style={styles.infoLabel}>
													{loc.t('customer.transactions.soldBy') || 'Sold By'}
												</Text>
												<Text style={styles.transactionInfoValue}>
													{getSoldByText(
														transaction.soldBy,
														transaction.soldByOwnerId,
														transaction.soldByEmployeeId
													)}
												</Text>
											</View>

											<View style={styles.infoRow}>
												<Text style={styles.infoLabel}>
													{loc.t('customer.transactions.createdAt') ||
														'Created At'}
												</Text>
												<Text style={styles.transactionInfoValue}>
													{formatDate(transaction.createdAt)}
												</Text>
											</View>
										</View>
									</View>

									{/* Date Information */}
									<View style={styles.section}>
										<Text style={styles.sectionTitle}>
											{loc.t('customer.transactions.dateInfo') ||
												'Date Information'}
										</Text>
										<View style={styles.fieldContainer}>
											{transaction.updatedAt !== transaction.createdAt && (
												<View style={styles.infoRow}>
													<Text style={styles.infoLabel}>
														{loc.t('customer.transactions.updatedAt') ||
															'Updated At'}
													</Text>
													<Text style={styles.transactionInfoValue}>
														{formatDate(transaction.updatedAt)}
													</Text>
												</View>
											)}
										</View>
									</View>
								</View>
							</ScrollView>

							{/* Footer with Back and Download Buttons */}
							<View style={styles.transactionModalFooter}>
								<TouchableOpacity
									onPress={onClose}
									style={styles.transactionModalBackButton}
									activeOpacity={0.7}
								>
									<MaterialIcons name="arrow-back" size={20} color="#6B7280" />
									<Text style={styles.transactionModalBackText}>
										{loc.t('customer.transactions.back') || 'Back'}
									</Text>
								</TouchableOpacity>

								<TouchableOpacity
									onPress={onDownloadReceipt}
									style={[
										styles.transactionModalDownloadButton,
										isDownloading &&
											styles.transactionModalDownloadButtonDisabled,
									]}
									activeOpacity={0.7}
									disabled={isDownloading}
								>
									<MaterialIcons
										name={isDownloading ? 'hourglass-empty' : 'download'}
										size={20}
										color="#FFFFFF"
									/>
									<Text style={styles.transactionModalDownloadText}>
										{isDownloading
											? loc.t('customer.transactions.downloading') ||
												'Downloading...'
											: loc.t('customer.transactions.download') || 'Download'}
									</Text>
								</TouchableOpacity>
							</View>
						</Animated.View>
					</View>
				</View>
			</Modal>
		)
	}
)

export default function CustomerDetails({
	customer,
	visible,
	onClose,
	onEdit,
	onDelete,
}) {
	const { loc } = useLocalization()
	const { translateNumber, translatePhone, translateAmount } =
		useNumberTranslator()
	const { getStoragePermission } = usePermission()
	const { authState } = useAuth()
	const bottomSheetModalRef = useRef(null)
	const [showDeleteModal, setShowDeleteModal] = useState(false)
	const [showTransactions, setShowTransactions] = useState(false)
	const [checkoutsData, setCheckoutsData] = useState([])
	const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
	const [selectedTransaction, setSelectedTransaction] = useState(null)
	const [showTransactionDetails, setShowTransactionDetails] = useState(false)
	const [editingField, setEditingField] = useState(null) // 'name' or 'address'
	const [editFormData, setEditFormData] = useState({
		name: '',
		address: '',
	})
	const { fetchData } = useApi()
	const [validationErrors, setValidationErrors] = useState({})
	const [touchedFields, setTouchedFields] = useState({})
	const [fullTransactionData, setFullTransactionData] = useState(null)
	const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false)
	const [isSavingField, setIsSavingField] = useState(false)

	// Snap points for bottom sheet - dynamic based on content
	const snapPoints = useMemo(() => {
		// For customer details view, use adequate height to show all content
		if (!showTransactions && !showTransactionDetails) {
			return ['75%', '75%']
		}
		// For transactions and transaction details (needs more space)
		return ['75%', '90%']
	}, [showTransactions, showTransactionDetails])

	// Validation schema
	const validationSchema = Yup.object().shape({
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

	// Reset view when modal opens
	useEffect(() => {
		if (visible) {
			setShowTransactions(false)
			setShowTransactionDetails(false)
			setSelectedTransaction(null)
			setEditingField(null)
			setEditFormData({
				name: customer?.name || '',
				address: customer?.address || '',
			})
			// Small delay to ensure proper mounting
			const timer = setTimeout(() => {
				bottomSheetModalRef.current?.present()
			}, 50)
			return () => clearTimeout(timer)
		} else {
			bottomSheetModalRef.current?.dismiss()
		}
	}, [visible, customer])

	// Fetch checkouts data when transactions view is opened
	const fetchCheckouts = useCallback(async () => {
		setIsLoadingTransactions(true)
		try {
			const result = await fetchData(getAllCheckouts, {
				buyerId: customer.buyerID,
			})
			if (result.success && result.data?.data) {
				setCheckoutsData(result.data.data || [])
			} else {
				console.error('No data found or API error:', result)
				setCheckoutsData([])
			}
		} catch (error) {
			console.error('Error fetching checkouts:', error)
			ToastAndroid.show(
				loc.t('customer.transactions.fetchError') ||
					'Failed to fetch transactions',
				ToastAndroid.SHORT
			)
		} finally {
			setIsLoadingTransactions(false)
		}
	}, [customer?.buyerID])

	useEffect(() => {
		if (!visible || !customer?.buyerID || !showTransactions) {
			return
		}

		fetchCheckouts()
	}, [visible, customer?.buyerID, showTransactions, fetchCheckouts])

	const closeModal = useCallback(() => {
		bottomSheetModalRef.current?.dismiss()
		setTimeout(() => {
			onClose()
			setShowTransactions(false)
			setShowTransactionDetails(false)
			setSelectedTransaction(null)
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

	const handleCallCustomer = useCallback(
		async (phoneNumber) => {
			if (!phoneNumber) {
				ToastAndroid.show(
					loc.t('customer.noPhoneNumber') || 'No phone number available',
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
						loc.t('customer.callNotSupported') ||
							'Calling is not supported on this device',
						ToastAndroid.SHORT
					)
				}
			} catch (error) {
				ToastAndroid.show(
					loc.t('customer.callError') || 'Call Error',
					ToastAndroid.SHORT
				)
			}
		},
		[loc]
	)

	const handleEditField = useCallback(
		(fieldName) => {
			setEditingField(fieldName)
			setValidationErrors({})
			setTouchedFields({})
			setEditFormData({
				name: customer?.name || '',
				address: customer?.address || '',
			})
		},
		[customer]
	)

	const handleCancelEdit = useCallback(() => {
		Keyboard.dismiss()
		setEditingField(null)
		setValidationErrors({})
		setTouchedFields({})
		setEditFormData({
			name: customer?.name || '',
			address: customer?.address || '',
		})
	}, [customer])

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
				name: cleanString(editFormData.name || ''),
				address: cleanString(editFormData.address || ''),
			}

			try {
				await onEdit(customer.buyerID, updatedData)
				setEditingField(null)
			} catch (error) {
				console.error('Error saving field:', error)
			} finally {
				setIsSavingField(false)
			}
		},
		[editFormData, customer?.buyerID, onEdit, validationSchema]
	)

	const handleDelete = useCallback(() => {
		setShowDeleteModal(true)
	}, [])

	const confirmDelete = useCallback(() => {
		onDelete(customer.id)
		setShowDeleteModal(false)
		closeModal()
	}, [customer.id, onDelete, closeModal])

	const handleTransactionInfoPress = useCallback(
		async (transaction) => {
			const result = await fetchData(salesController.getCheckoutDetails, {
				checkoutId: transaction.id,
			})

			if (result.success && result.data) {
				setSelectedTransaction(result.data)
				setFullTransactionData(result.data) // Store full data for receipt
				setShowTransactionDetails(true)
			}
		},
		[fetchData]
	)

	const handleBackToTransactionList = useCallback(() => {
		setShowTransactionDetails(false)
		setSelectedTransaction(null)
		setFullTransactionData(null)
	}, [])

	// Download receipt function
	const handleDownloadReceipt = useCallback(async () => {
		if (!fullTransactionData || isDownloadingReceipt) {
			return
		}

		setIsDownloadingReceipt(true)

		try {
			const permittedFolder = await getStoragePermission()

			if (!permittedFolder) {
				ToastAndroid.show(
					loc.t('customer.transactions.storagePermissionDenied') ||
						'Storage permission denied',
					ToastAndroid.SHORT
				)
				setIsDownloadingReceipt(false)
				return
			}

			// For testing: Use fullTransactionData directly
			const receiptData = fullTransactionData

			const receiptHtml = GenerateReceiptHtml({
				checkOutData: receiptData,
			})

			console.log('Generated Receipt HTML') // Debug log

			const file = await printToFileAsync({
				html: receiptHtml,
				base64: true,
			})

			// Generate filename
			const date = new Date()
			let hours = date.getHours()
			let minutes = date.getMinutes()
			let ampm = hours >= 12 ? 'PM' : 'AM'
			hours = hours % 12
			hours = hours ? hours : 12
			minutes = minutes < 10 ? '0' + minutes : minutes
			const day = date.getDate()
			const month = date.getMonth() + 1
			const year = date.getFullYear()
			const formattedDate = `${hours}-${minutes} ${ampm} ${
				day < 10 ? '0' + day : day
			}-${month < 10 ? '0' + month : month}-${year}`
			const filename = `${formattedDate}.pdf`

			// Save file
			const base64 = await FileSystem.readAsStringAsync(file.uri, {
				encoding: FileSystem.EncodingType.Base64,
			})

			await FileSystem.StorageAccessFramework.createFileAsync(
				permittedFolder,
				filename,
				'application/pdf'
			).then(async (uri) => {
				await FileSystem.writeAsStringAsync(uri, base64, {
					encoding: FileSystem.EncodingType.Base64,
				})
			})

			ToastAndroid.show(
				loc.t('customer.transactions.downloadSuccess') ||
					'Receipt downloaded successfully',
				ToastAndroid.SHORT
			)
		} catch (error) {
			ToastAndroid.show(
				loc.t('customer.transactions.downloadFailed') ||
					'Failed to download receipt',
				ToastAndroid.SHORT
			)
		} finally {
			setIsDownloadingReceipt(false)
		}
	}, [
		fullTransactionData,
		isDownloadingReceipt,
		getStoragePermission,
		loc,
		authState,
	])

	// Memoized empty component for transactions
	const renderEmptyTransactions = useMemo(
		() => (
			<View style={styles.emptyContainer}>
				<MaterialIcons name="receipt" size={48} color="#E5E7EB" />
				<Text style={styles.emptyText}>
					{loc.t('customer.transactions.noTransactions') ||
						'No transactions found'}
				</Text>
				<Text style={styles.emptySubText}>
					{loc.t('customer.transactions.noTransactionsDesc') ||
						'No purchase history found for this customer'}
				</Text>
			</View>
		),
		[loc]
	)

	if (!customer) return null

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
				<CustomerHeader
					customer={customer}
					loc={loc}
					onClose={closeModal}
					showTransactions={showTransactions}
					showTransactionDetails={showTransactionDetails}
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
							{/* Content */}
							{showTransactionDetails ? (
								/* Transaction Details View */
								<>
									{selectedTransaction && (
										<View style={styles.section}>
											<View style={styles.transactionDetailsContainer}>
												{/* Total Price with Status */}
												<View style={styles.detailRow}>
													<Text style={styles.detailLabel}>
														{loc.t('customer.transactions.totalPrice') ||
															'Total Price'}
														:
													</Text>
													<Text style={styles.detailValue}>
														{translateAmount(
															selectedTransaction.totalPrice?.toString()
														)}{' '}
														<Text
															style={[
																styles.statusInlineText,
																{
																	color:
																		selectedTransaction.status === 'PAID'
																			? '#22c55e'
																			: '#EF4444',
																},
															]}
														>
															(
															{selectedTransaction.status === 'PAID'
																? loc.t('customer.transactions.paid') || 'Paid'
																: loc.t('customer.transactions.unpaid') ||
																	'Unpaid'}
															)
														</Text>
													</Text>
												</View>

												{/* Total Quantity */}
												<View style={styles.detailRow}>
													<Text style={styles.detailLabel}>
														{loc.t('customer.transactions.totalQuantity') ||
															'Total Quantity'}
														:
													</Text>
													<Text style={styles.detailValue}>
														{translateNumber(
															selectedTransaction.totalQuantity?.toString()
														)}
													</Text>
												</View>

												{/* Total Discount */}
												<View style={styles.detailRow}>
													<Text style={styles.detailLabel}>
														{loc.t('customer.transactions.totalDiscount') ||
															'Total Discount'}
														:
													</Text>
													<Text style={styles.detailValue}>
														{translateAmount(
															selectedTransaction.totalDiscount?.toString()
														)}
													</Text>
												</View>

												{/* Discount Type */}
												<View style={styles.detailRow}>
													<Text style={styles.detailLabel}>
														{loc.t('customer.transactions.discountType') ||
															'Discount Type'}
														:
													</Text>
													<Text style={styles.detailValue}>
														{selectedTransaction.discountType === 'PERCENTAGE'
															? loc.t('customer.transactions.percentage') ||
																'Percentage'
															: loc.t('customer.transactions.fixed') || 'Fixed'}
													</Text>
												</View>

												{/* Total Paid (if debt exists) */}
												{selectedTransaction?.Debt && (
													<View style={styles.detailRow}>
														<Text style={styles.detailLabel}>
															{loc.t('customer.transactions.totalPaid') ||
																'Total Paid'}
															:
														</Text>
														<Text style={styles.detailValue}>
															{translateAmount(
																selectedTransaction.Debt.paidAmount.toString()
															)}
														</Text>
													</View>
												)}

												{/* Sold By */}
												<View style={styles.detailRow}>
													<Text style={styles.detailLabel}>
														{loc.t('customer.transactions.soldBy') || 'Sold By'}
														:
													</Text>
													<Text style={styles.detailValue}>
														{!selectedTransaction.soldBy
															? '-'
															: selectedTransaction.soldBy === 'OWNER'
																? loc.t('customer.transactions.owner') ||
																	'Owner'
																: selectedTransaction.soldBy === 'EMPLOYEE'
																	? loc.t('customer.transactions.employee') ||
																		'Employee'
																	: selectedTransaction.soldBy}
													</Text>
												</View>

												{/* Created At */}
												<View style={styles.detailRow}>
													<Text style={styles.detailLabel}>
														{loc.t('customer.transactions.createdAt') ||
															'Created At'}
														:
													</Text>
													<Text style={styles.detailValue}>
														{translateNumber(
															new Date(
																selectedTransaction.createdAt
															).toLocaleDateString('en-US', {
																year: 'numeric',
																month: 'long',
																day: 'numeric',
																hour: '2-digit',
																minute: '2-digit',
															})
														)}
													</Text>
												</View>

												{/* Updated At */}
												{selectedTransaction.updatedAt !==
													selectedTransaction.createdAt && (
													<View style={styles.detailRow}>
														<Text style={styles.detailLabel}>
															{loc.t('customer.transactions.updatedAt') ||
																'Updated At'}
															:
														</Text>
														<Text style={styles.detailValue}>
															{translateNumber(
																new Date(
																	selectedTransaction.updatedAt
																).toLocaleDateString('en-US', {
																	year: 'numeric',
																	month: 'long',
																	day: 'numeric',
																	hour: '2-digit',
																	minute: '2-digit',
																})
															)}
														</Text>
													</View>
												)}
											</View>
										</View>
									)}
								</>
							) : showTransactions ? (
								/* Transactions View */
								<View style={styles.section}>
									<View style={styles.transactionsContainer}>
										<ScrollView
											style={styles.transactionsScrollView}
											contentContainerStyle={styles.transactionsScrollContent}
											showsVerticalScrollIndicator={true}
											bounces={true}
											scrollEventThrottle={16}
											nestedScrollEnabled={true}
										>
											{(() => {
												if (isLoadingTransactions) {
													return <TransactionLoader />
												} else if (checkoutsData.length > 0) {
													return checkoutsData.map((item) => (
														<TransactionItem
															key={item.id}
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
															formattedAmount={translateNumber(
																item.totalPrice?.toString()
															)}
															isPaid={item.status === 'PAID'}
															paidLabel={
																loc.t('customer.transactions.paid') || 'Paid'
															}
															unpaidLabel={
																loc.t('customer.transactions.unpaid') ||
																'Unpaid'
															}
															onPress={() => handleTransactionInfoPress(item)}
														/>
													))
												} else {
													return renderEmptyTransactions
												}
											})()}
										</ScrollView>
									</View>
								</View>
							) : (
								/* Customer Details View */
								<View style={styles.section}>
									<View style={styles.infoContainer}>
										{/* Name Field */}
										<View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('customer.customerForm.name') || 'Name'}
											</Text>
											{editingField === 'name' ? (
												<>
													<TextInput
														style={styles.editInput}
														value={editFormData.name}
														onChangeText={(text) =>
															setEditFormData((prev) => ({
																...prev,
																name: text,
															}))
														}
														onBlur={() => handleBlur('name')}
														placeholder={
															loc.t('customer.customerForm.namePlaceholder') ||
															'Enter customer name'
														}
														placeholderTextColor="rgba(0,0,0,0.54)"
														autoFocus
													/>
													<TouchableOpacity
														onPress={() => handleSaveField('name')}
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
													{touchedFields.name && validationErrors.name && (
														<Text style={styles.errorText}>
															{validationErrors.name}
														</Text>
													)}
												</>
											) : (
												<>
													<Text style={styles.infoValue}>{customer.name}</Text>
													<TouchableOpacity
														onPress={() => handleEditField('name')}
														style={styles.editIconButton}
														activeOpacity={0.7}
													>
														<MaterialIcons
															name="edit"
															size={14}
															color="#195FE1"
														/>
													</TouchableOpacity>
												</>
											)}
										</View>
										{/* Phone Number Field */}
										<View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('customer.customerForm.number') ||
													'Phone Number'}
											</Text>
											<View style={styles.phoneContainer}>
												<Text style={styles.infoValuePhone}>
													{customer.number
														? translatePhone(customer.number)
														: 'Not provided'}
												</Text>
												{customer.number && (
													<TouchableOpacity
														onPress={() => handleCallCustomer(customer.number)}
														style={styles.phoneIcon}
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
										{/* Address Field */}
										<View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('customer.customerForm.address') || 'Address'}
											</Text>
											{editingField === 'address' ? (
												<>
													<TextInput
														style={[styles.editInput, styles.editTextArea]}
														value={editFormData.address}
														onChangeText={(text) =>
															setEditFormData((prev) => ({
																...prev,
																address: text,
															}))
														}
														onBlur={() => handleBlur('address')}
														placeholder={
															loc.t(
																'customer.customerForm.addressPlaceholder'
															) || 'Enter customer address'
														}
														placeholderTextColor="rgba(0,0,0,0.54)"
														multiline
														numberOfLines={3}
														textAlignVertical="top"
														autoFocus
													/>
													<TouchableOpacity
														onPress={() => handleSaveField('address')}
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
													{touchedFields.address &&
														validationErrors.address && (
															<Text style={styles.errorText}>
																{validationErrors.address}
															</Text>
														)}
												</>
											) : (
												<>
													<Text style={[styles.infoValue, styles.editTextArea]}>
														{customer.address || '-'}
													</Text>
													<TouchableOpacity
														onPress={() => handleEditField('address')}
														style={styles.editIconButton}
														activeOpacity={0.7}
													>
														<MaterialIcons
															name="edit"
															size={14}
															color="#195FE1"
														/>
													</TouchableOpacity>
												</>
											)}
										</View>
									</View>
								</View>
							)}
						</View>

						{/* Bottom Buttons */}
						<View style={styles.bottomButtonContainer}>
							{showTransactionDetails ? (
								<>
									<TouchableOpacity
										style={[styles.button, styles.toggleButton]}
										onPress={handleBackToTransactionList}
										activeOpacity={0.8}
									>
										<MaterialIcons
											name="arrow-back"
											size={18}
											color="#FFFFFF"
											style={styles.buttonIcon}
										/>
										<Text style={styles.toggleButtonText}>
											{loc.t('customer.transactions.backToList') ||
												'Back to List'}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[
											styles.button,
											styles.downloadButton,
											isDownloadingReceipt && styles.downloadButtonDisabled,
										]}
										onPress={handleDownloadReceipt}
										activeOpacity={0.8}
										disabled={isDownloadingReceipt}
									>
										<MaterialIcons
											name={
												isDownloadingReceipt ? 'hourglass-empty' : 'download'
											}
											size={18}
											color="#FFFFFF"
											style={styles.buttonIcon}
										/>
										<Text style={styles.downloadButtonText}>
											{isDownloadingReceipt
												? loc.t('customer.transactions.downloading') ||
													'Downloading...'
												: loc.t('customer.transactions.download') || 'Download'}
										</Text>
									</TouchableOpacity>
								</>
							) : showTransactions ? (
								<TouchableOpacity
									style={[styles.button, styles.toggleButton]}
									onPress={() => setShowTransactions(false)}
									activeOpacity={0.8}
								>
									<MaterialIcons
										name="person"
										size={18}
										color="#FFFFFF"
										style={styles.buttonIcon}
									/>
									<Text style={styles.toggleButtonText}>
										{loc.t('customer.transactions.showCustomerDetails') ||
											'Show Customer Details'}
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
											{loc.t('customer.customerDetails.delete') || 'Delete'}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[styles.button, styles.toggleButton]}
										onPress={() => setShowTransactions(true)}
										activeOpacity={0.8}
									>
										<MaterialIcons
											name="receipt"
											size={18}
											color="#FFFFFF"
											style={styles.buttonIcon}
										/>
										<Text style={styles.toggleButtonText}>
											{loc.t('customer.transactions.showTransactions') ||
												'Show Transactions'}
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
				title={loc.t('customer.deleteConfirm.title') || undefined}
				subtitle={
					loc.t('customer.deleteConfirm.message', {
						name: customer?.name,
					}) || `Are you sure you want to delete ${customer?.name}?`
				}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF', // AliceBlue to match form
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
		backgroundColor: '#195FE1', // Blue to match form
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
		color: '#195FE1', // Blue to match form
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
	fieldContainer: {
		backgroundColor: '#FFFFFF',
		padding: 16,
		borderRadius: 12,
	},
	infoItem: {
		marginBottom: 16,
		position: 'relative',
		paddingTop: 8,
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0, 0, 0, 0.1)',
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
		paddingRight: 40,
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
	// Transactions Section Styles
	transactionsContainer: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		padding: 8,
		flex: 1,
	},
	transactionsScrollView: {
		flex: 1,
	},
	transactionsScrollContent: {
		paddingVertical: 4,
		flexGrow: 1,
	},
	transactionItem: {
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
	transactionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	transactionInfo: {
		flex: 1,
		marginRight: 12,
	},
	transactionDate: {
		fontSize: 14,
		color: '#6B7280',
		marginBottom: 4,
		fontWeight: '500',
	},
	transactionDetails: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	transactionAmount: {
		fontSize: 18,
		fontWeight: '700',
		color: '#111827',
	},
	statusBadge: {
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 8,
		alignSelf: 'flex-start',
	},
	statusText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#FFFFFF',
	},
	infoButton: {
		padding: 8,
		borderRadius: 8,
		// backgroundColor: '#F3F4F6',
		alignItems: 'center',
		justifyContent: 'center',
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
	loaderLine1: {
		height: 12,
		backgroundColor: '#E5E7EB',
		borderRadius: 4,
		marginBottom: 8,
		width: '60%',
	},
	loaderLine2: {
		height: 16,
		backgroundColor: '#F3F4F6',
		borderRadius: 4,
		marginBottom: 8,
		width: '40%',
	},
	loaderLine3: {
		height: 10,
		backgroundColor: '#E5E7EB',
		borderRadius: 4,
		width: '30%',
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
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		gap: 12,
		marginTop: 16,
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
	toggleButton: {
		backgroundColor: '#195FE1',
	},
	toggleButtonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 15,
	},
	deleteButtonInDetails: {
		backgroundColor: '#EF4444',
	},
	editButton: {
		backgroundColor: '#195FE1',
	},
	deleteButtonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 15,
	},
	editButtonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 15,
	},
	downloadButton: {
		backgroundColor: '#195FE1',
	},
	downloadButtonDisabled: {
		backgroundColor: '#93C5FD',
		opacity: 0.7,
	},
	downloadButtonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 15,
	},
	// Transaction Details Inline Styles
	itemRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(255, 255, 255, 0.1)',
	},
	itemInfo: {
		flex: 1,
	},
	itemName: {
		fontSize: 14,
		color: '#FFFFFF',
		fontWeight: '600',
		marginBottom: 4,
	},
	transactionInfoValue: {
		fontSize: 14,
		color: '#FFFFFF',
		fontWeight: '600',
		flex: 1,
		textAlign: 'right',
	},
	itemTotal: {
		fontSize: 14,
		color: '#FFFFFF',
		fontWeight: '600',
	},
	totalRow: {
		borderBottomWidth: 0,
		borderTopWidth: 2,
		borderTopColor: 'rgba(255, 255, 255, 0.3)',
		marginTop: 8,
		paddingTop: 16,
	},
	totalLabel: {
		fontSize: 16,
		color: '#FFFFFF',
		fontWeight: 'bold',
	},
	totalAmount: {
		fontSize: 16,
		color: '#FFFFFF',
		fontWeight: 'bold',
	},
	// Edit Mode Styles
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
	// Transaction Details Modal Styles
	transactionModalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	transactionModalContainer: {
		width: '90%',
		maxHeight: screenHeight * 0.8,
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		overflow: 'hidden',
	},
	transactionModalContent: {
		flex: 1,
	},
	transactionScrollContent: {
		flexGrow: 1,
	},
	transactionContainer: {
		padding: 16,
	},
	transactionModalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
	},
	transactionModalTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#111827',
		flex: 1,
	},
	transactionModalClose: {
		padding: 8,
		backgroundColor: '#F3F4F6',
		borderRadius: 20,
	},
	transactionModalFooter: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
		padding: 16,
		borderTopWidth: 1,
		borderTopColor: '#E5E7EB',
		backgroundColor: '#FFFFFF',
	},
	transactionModalBackButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 14,
		borderRadius: 12,
		backgroundColor: '#E5E7EB',
		gap: 8,
	},
	transactionModalBackText: {
		color: '#6B7280',
		fontWeight: '600',
		fontSize: 15,
	},
	transactionModalDownloadButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 14,
		borderRadius: 12,
		backgroundColor: '#10B981',
		gap: 8,
	},
	transactionModalDownloadButtonDisabled: {
		backgroundColor: '#93C5FD',
		opacity: 0.7,
	},
	transactionModalDownloadText: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 15,
	},
	// Transaction Details Styles
	transactionDetailsContainer: {
		backgroundColor: 'transparent',
		paddingVertical: 8,
	},
	detailRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0, 0, 0, 0.1)',
	},
	detailLabel: {
		fontSize: 15,
		color: '#195FE1',
		fontWeight: '600',
		flex: 1,
	},
	detailValue: {
		fontSize: 15,
		color: '#333333',
		fontWeight: '500',
		flex: 1,
		textAlign: 'right',
	},
	statusInlineText: {
		fontSize: 15,
		fontWeight: '600',
	},
})
