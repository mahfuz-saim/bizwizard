import {
	Text,
	View,
	TouchableOpacity,
	StyleSheet,
	BackHandler,
	KeyboardAvoidingView,
	Platform,
	FlatList,
} from 'react-native'
import { useEffect, useRef, useCallback, useMemo, memo } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { CloseModal, ErrorModal } from '../AlertModal.jsx'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { useState } from 'react'
import useApi from '../../hooks/useApi'
import { debtController } from '../../controllers/debt.js'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import {
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetBackdrop,
	BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import GenerateReceiptHtml from '../receipt/ReceiptHtml'
import { printToFileAsync } from 'expo-print'
import * as FileSystem from 'expo-file-system/legacy'
import { usePermission } from '../../context/PermissionContext'
import * as Yup from 'yup'
import LedgerView from './LedgerView.jsx'
import { FlashList } from '@shopify/flash-list'

// Module-scope memoized row for the debt-transactions list. Lives outside
// the component so React.memo's identity is stable across re-renders, and
// re-renders only when item identity, expanded state, or callbacks change.
const DebtTransactionRow = memo(
	function DebtTransactionRow({
		item,
		isExpanded,
		onToggle,
		onPayDebt,
		onDownloadReceipt,
		loc,
		translateNumber,
		translateAmount,
	}) {
		const totalPrice = item.checkout?.totalPrice || 0
		const paidAmount = item.paidAmount || 0
		const dueAmount = totalPrice - paidAmount

		// Memoize payments sort so it doesn't re-allocate on every render.
		const allPayments = useMemo(() => {
			const itemCreatedTime = new Date(item.createdAt).getTime()
			return (item.debtPayments || [])
				.map((payment) => {
					const paymentCreatedTime = new Date(payment.createdAt).getTime()
					const timeDiff = Math.abs(paymentCreatedTime - itemCreatedTime)
					return {
						...payment,
						isDuringCheckout: timeDiff <= 2000,
					}
				})
				.sort(
					(a, b) =>
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				)
		}, [item.createdAt, item.debtPayments])

		return (
			<View>
				{/* Collapsible Header */}
				<TouchableOpacity
					style={styles.collapsibleHeader}
					onPress={() => onToggle(item.id)}
				>
					<View style={styles.collapsibleHeaderContent}>
						<Text style={styles.collapsibleHeaderText}>
							{translateNumber(new Date(item.createdAt).toLocaleDateString())} -{' '}
							<Text style={styles.collapsibleHeaderAmount}>
								{translateAmount(dueAmount.toFixed(2))}
							</Text>
						</Text>
					</View>
					<MaterialIcons
						name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
						size={24}
						color="#64748b"
					/>
				</TouchableOpacity>

				{/* Collapsible Content */}
				{isExpanded && (
					<View style={styles.collapsibleContent}>
						{/* Total and Paid Amount */}
						<View style={styles.debtContentHeader}>
							<Text style={styles.debtListDetails}>
								{loc.t('debt.total')}: {translateAmount(totalPrice.toFixed(2))}{' '}
								| {loc.t('debt.paid')}: {translateAmount(paidAmount.toFixed(2))}
							</Text>
						</View>

						{/* Action Buttons */}
						<View style={styles.debtItemButtonContainer}>
							{dueAmount > 0 && (
								<TouchableOpacity
									style={[styles.debtItemButton, styles.debtItemPayButton]}
									onPress={() => onPayDebt(item.id)}
									activeOpacity={0.8}
								>
									<MaterialIcons
										name="payment"
										size={14}
										color="#FFFFFF"
										style={styles.debtItemButtonIcon}
									/>
									<Text style={styles.debtItemButtonText}>
										{loc.t('debt.payDebt')}
									</Text>
								</TouchableOpacity>
							)}
							<TouchableOpacity
								style={[styles.debtItemButton, styles.debtItemDownloadButton]}
								onPress={() => onDownloadReceipt(item.checkoutID)}
								activeOpacity={0.8}
							>
								<MaterialIcons
									name="download"
									size={14}
									color="#FFFFFF"
									style={styles.debtItemButtonIcon}
								/>
								<Text style={styles.debtItemButtonText}>
									{loc.t('debt.downloadReceipt') || 'Download Receipt'}
								</Text>
							</TouchableOpacity>
						</View>

						{/* Debt Payment History */}
						{allPayments.length > 0 && (
							<View style={styles.paymentHistoryContainer}>
								{allPayments.map((payment, index) => (
									<View
										key={payment.id || index}
										style={styles.paymentHistoryItem}
									>
										<Text style={styles.paymentHistoryText}>
											{payment.isDuringCheckout
												? loc.t('debt.duringCheckout') || 'During Checkout'
												: translateNumber(
														new Date(payment.createdAt).toLocaleDateString()
													)}{' '}
											- {loc.t('debt.paidAmount') || 'Paid'}:{' '}
											{translateAmount(payment.amount.toFixed(2))}
										</Text>
									</View>
								))}
							</View>
						)}
					</View>
				)}
			</View>
		)
	},
	(prev, next) =>
		prev.item?.id === next.item?.id &&
		prev.item?.createdAt === next.item?.createdAt &&
		prev.item?.paidAmount === next.item?.paidAmount &&
		prev.item?.checkout?.totalPrice === next.item?.checkout?.totalPrice &&
		prev.item?.checkoutID === next.item?.checkoutID &&
		prev.isExpanded === next.isExpanded &&
		prev.onToggle === next.onToggle &&
		prev.onPayDebt === next.onPayDebt &&
		prev.onDownloadReceipt === next.onDownloadReceipt
)

// Stable callbacks forwarded to every row. These are passed once from the
// parent so the row's memo comparator can short-circuit re-renders.
export default function DebtDetails({
	visible,
	onClose,
	debtData,
	onDebtUpdate,
}) {
	const { loc } = useLocalization()
	const { translateNumber, translateAmount, translatePhone, toEnglishNumbers } =
		useNumberTranslator()
	const { fetchData } = useApi()
	const insets = useSafeAreaInsets()
	const { getStoragePermission } = usePermission()
	const bottomSheetModalRef = useRef(null)

	// State declarations BEFORE useMemo
	const [paymentAmount, setPaymentAmount] = useState(translateNumber(''))
	const [notifySms, setNotifySms] = useState(false)
	const [selectedDebt, setSelectedDebt] = useState(null)
	const [showingSingleDebt, setShowingSingleDebt] = useState(false)
	const [showingPayment, setShowingPayment] = useState(false)
	const [singleDebtData, setSingleDebtData] = useState(null)
	const [showCloseModal, setShowCloseModal] = useState(false)
	const [showErrorModal, setShowErrorModal] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')
	const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false)
	const [expandedDebtItems, setExpandedDebtItems] = useState({})
	const [activeTab, setActiveTab] = useState('transactions')
	const [ledgerData, setLedgerData] = useState(null)
	const [loadingLedger, setLoadingLedger] = useState(false)

	// Snap points for bottom sheet - dynamic based on content
	const snapPoints = useMemo(() => {
		if (showingPayment) return ['50%', '65%']
		if (showingSingleDebt) return ['75%', '90%']
		return ['75%', '90%']
	}, [showingSingleDebt, showingPayment])

	useEffect(() => {
		if (visible) {
			setShowingSingleDebt(false)
			setShowingPayment(false)
			setSingleDebtData(null)
			setPaymentAmount(translateNumber(''))
			setNotifySms(false)
			setSelectedDebt(null)
			setActiveTab('transactions')
			setLedgerData(null)
			setLoadingLedger(false)
			// Small delay to ensure proper mounting
			const timer = setTimeout(() => {
				bottomSheetModalRef.current?.present()
			}, 50)
			return () => clearTimeout(timer)
		} else {
			bottomSheetModalRef.current?.dismiss()
		}
	}, [visible, translateNumber])

	const closeModal = useCallback(
		(wasModified = false) => {
			bottomSheetModalRef.current?.dismiss()
			// Small delay before calling onClose to let animation finish
			setTimeout(() => {
				setShowingSingleDebt(false)
				setShowingPayment(false)
				setSingleDebtData(null)
				setPaymentAmount(translateNumber(''))
				setNotifySms(false)
				setSelectedDebt(null)

				// Pass the modification flag to parent
				onClose(wasModified)
			}, 150)
		},
		[onClose, translateNumber]
	)

	const handleCloseWithConfirmation = useCallback(() => {
		setShowCloseModal(true)
	}, [])

	const handleHardwareBackPress = useCallback(() => {
		if (showingPayment) {
			setShowingPayment(false)
			setPaymentAmount(translateNumber(''))
			setNotifySms(false)
			setSelectedDebt(null)
			return true
		}
		if (showingSingleDebt) {
			setShowingSingleDebt(false)
			setSingleDebtData(null)
			return true
		}
		// Close the sheet when on main view
		closeModal()
		return true
	}, [showingPayment, showingSingleDebt, translateNumber, closeModal])

	useEffect(() => {
		if (!visible) return

		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			handleHardwareBackPress
		)

		return () => backHandler.remove()
	}, [visible, handleHardwareBackPress])

	const handlePayDebt = useCallback((debt) => {
		setSelectedDebt(debt)
		setShowingPayment(true)
	}, [])

	const refreshLedgerData = useCallback(async () => {
		if (!debtData?.buyer?.userID) return

		setLoadingLedger(true)
		try {
			const result = await fetchData(debtController.getDebtLedger, {
				buyerId: debtData.buyer.userID,
			})
			if (result.success) {
				setLedgerData(result.data)
				console.log('Ledger data refreshed:', result.data)
			} else {
				ToastAndroid.show(
					result.message || loc.t('debt.fetchFailed'),
					ToastAndroid.LONG
				)
			}
		} catch (error) {
			console.error('Error loading ledger:', error)
			ToastAndroid.show(loc.t('debt.fetchFailed'), ToastAndroid.LONG)
		} finally {
			setLoadingLedger(false)
		}
	}, [debtData, fetchData, loc])

	const handleTabSwitch = useCallback(
		async (tab) => {
			setActiveTab(tab)
			if (tab === 'ledger') {
				// Always refresh ledger data when switching to ledger tab
				await refreshLedgerData()
			}
		},
		[refreshLedgerData]
	)

	const handleBackToDebtList = useCallback(() => {
		setShowingSingleDebt(false)
		setSingleDebtData(null)
	}, [])

	const handleBackToList = useCallback(() => {
		setShowingPayment(false)
		setPaymentAmount(translateNumber(''))
		setNotifySms(false)
		setSelectedDebt(null)
	}, [translateNumber])

	const closePaymentModal = useCallback(() => {
		setShowingPayment(false)
		setPaymentAmount(translateNumber(''))
		setNotifySms(false)
		setSelectedDebt(null)
	}, [translateNumber])

	const handlePaymentAmountChange = useCallback(
		(value) => {
			// Allow both Bengali and English digits, display as Bengali
			const englishValue = toEnglishNumbers(value)
			setPaymentAmount(translateNumber(englishValue))
		},
		[toEnglishNumbers, translateNumber]
	)

	const handleSubmit = useCallback(async () => {
		// Convert Bengali numbers to English for validation and API
		const englishPaymentAmount = toEnglishNumbers(paymentAmount)
		const amount = parseFloat(englishPaymentAmount)

		try {
			// Validation Logic based on payment type
			if (selectedDebt === '*') {
				// Bulk Payment (Total Debt)
				const totalDebtAmount = debtData.totalDebt || 0

				const schema = Yup.object().shape({
					amount: Yup.number()
						.typeError(
							loc.t('debt.enterValidAmount') || 'Please enter a valid amount'
						)
						.positive(
							loc.t('debt.enterValidAmount') || 'Please enter a valid amount'
						)
						.max(
							totalDebtAmount,
							loc.t('debt.amountCannotExceedTotal') ||
								'Amount cannot be more than total debt'
						)
						.required(
							loc.t('debt.enterValidAmount') ||
								'Current Payment amount is required'
						),
				})

				await schema.validate({ amount })
			} else {
				// Single Debt Payment
				// Need to find the specific debt item to validate against its due amount
				let dueAmount = 0

				if (showingSingleDebt && singleDebtData) {
					// We are in detailed single debt view
					dueAmount = singleDebtData.totalPrice - singleDebtData.Debt.paidAmount
				} else {
					// We are paying from the list view
					const debtItem = debtData.items?.find(
						(item) => item.id === selectedDebt
					)
					if (debtItem) {
						dueAmount =
							(debtItem.checkout?.totalPrice || 0) - (debtItem.paidAmount || 0)
					}
				}

				const schema = Yup.object().shape({
					amount: Yup.number()
						.typeError(
							loc.t('debt.enterValidAmount') || 'Please enter a valid amount'
						)
						.positive(
							loc.t('debt.enterValidAmount') || 'Please enter a valid amount'
						)
						.max(
							dueAmount,
							loc.t('debt.amountCannotExceedDue') ||
								'Amount cannot be more than due amount'
						)
						.required(
							loc.t('debt.enterValidAmount') ||
								'Current Payment amount is required'
						),
				})

				await schema.validate({ amount })
			}

			let result = null

			if (selectedDebt === '*') {
				result = await fetchData(debtController.resolveBulk, {
					amount: amount,
					buyerId: debtData?.buyer?.userID,
					notifySms: notifySms,
				})
			} else {
				result = await fetchData(debtController.resolveSingle, {
					amount: amount,
					type: 'PARTIAL',
					debtId: selectedDebt,
					notifySms: notifySms,
				})
			}

			if (!result.success) {
				setErrorMessage(
					result.message ||
						loc.t('debt.somethingWentWrong') ||
						'Something went wrong'
				)
				setShowErrorModal(true)
				return
			}

			// Update the parent data immediately
			if (onDebtUpdate) {
				onDebtUpdate()
			}

			// Refresh ledger data after payment
			if (ledgerData) {
				await refreshLedgerData()
			}

			// Update single debt data if we are in single debt view
			if (selectedDebt !== '*' && showingSingleDebt) {
				const updatedSingleData = await fetchData(
					debtController.getSingleDebt,
					{
						id: selectedDebt,
					}
				)
				if (updatedSingleData?.success) {
					setSingleDebtData(updatedSingleData.data)
				}
			}

			closePaymentModal()

			// Handle SMS notification status
			const smsNotificationSuccess = result.data?.smsNotificationSuccess

			if (smsNotificationSuccess === undefined) {
				// SMS was not requested
				ToastAndroid.show(
					loc.t('debt.paymentSuccess') || 'Payment successful',
					ToastAndroid.SHORT
				)
			} else if (smsNotificationSuccess === true) {
				// SMS sent successfully
				ToastAndroid.show(
					loc.t('debt.paymentSuccessWithSms') ||
						'Payment Successful and Notified Via SMS',
					ToastAndroid.LONG
				)
			} else {
				// SMS failed to send
				ToastAndroid.show(
					loc.t('debt.paymentSuccessSmsFailed') ||
						'Payment Successful but failed to Send SMS for low credit balance',
					ToastAndroid.LONG
				)
			}
		} catch (error) {
			if (error instanceof Yup.ValidationError) {
				ToastAndroid.show(error.message, ToastAndroid.LONG)
			} else {
				console.error(error)
				ToastAndroid.show(
					loc.t('debt.somethingWentWrong') || 'Something went wrong',
					ToastAndroid.SHORT
				)
			}
		}
	}, [
		paymentAmount,
		selectedDebt,
		debtData,
		fetchData,
		loc,
		toEnglishNumbers,
		closePaymentModal,
		closeModal,
		notifySms,
		onDebtUpdate,
		showingSingleDebt,
		singleDebtData,
	])

	// Download receipt handler
	const toggleDebtItem = useCallback((itemId) => {
		setExpandedDebtItems((prev) => ({
			...prev,
			[itemId]: !prev[itemId],
		}))
	}, [])

	const handleDownloadDebtReceipt = useCallback(
		async (checkoutID) => {
			try {
				// Request storage permission
				const permittedFolder = await getStoragePermission()
				if (!permittedFolder) {
					ToastAndroid.show(
						loc.t('debt.storagePermissionRequired') ||
							'Storage permission required',
						ToastAndroid.LONG
					)
					return
				}

				// Fetch the debt data
				const data = await fetchData(debtController.getSingleDebt, {
					id: checkoutID,
				})

				if (!data?.data) {
					ToastAndroid.show(
						loc.t('debt.fetchFailed') || 'Failed to fetch debt details',
						ToastAndroid.LONG
					)
					return
				}

				// Generate receipt HTML
				const receiptHtml = GenerateReceiptHtml({
					checkOutData: data.data,
				})

				// Generate PDF
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
				const filename = `Receipt_${formattedDate}.pdf`

				// Save file
				const base64 = await FileSystem.readAsStringAsync(file.uri, {
					encoding: FileSystem.EncodingType.Base64,
				})

				const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
					permittedFolder,
					filename,
					'application/pdf'
				)

				await FileSystem.writeAsStringAsync(fileUri, base64, {
					encoding: FileSystem.EncodingType.Base64,
				})

				ToastAndroid.show(
					loc.t('debt.receiptDownloaded') || 'Receipt downloaded successfully',
					ToastAndroid.LONG
				)
			} catch (error) {
				console.error('Error downloading receipt:', error)
				ToastAndroid.show(
					loc.t('debt.downloadFailed') || 'Failed to download receipt',
					ToastAndroid.LONG
				)
			}
		},
		[getStoragePermission, loc, fetchData]
	)

	// Stable sorted list for the debt-transactions FlashList. The sort
	// re-runs only when the underlying items array changes.
	const sortedDebtItems = useMemo(() => {
		const items = debtData?.items || []
		return [...items].sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		)
	}, [debtData?.items])

	const debtKeyExtractor = useCallback((item) => item?.id?.toString() || '', [])

	const renderDebtItem = useCallback(
		({ item }) => (
			<DebtTransactionRow
				item={item}
				isExpanded={expandedDebtItems[item.id] || false}
				onToggle={toggleDebtItem}
				onPayDebt={handlePayDebt}
				onDownloadReceipt={handleDownloadDebtReceipt}
				loc={loc}
				translateNumber={translateNumber}
				translateAmount={translateAmount}
			/>
		),
		[
			expandedDebtItems,
			toggleDebtItem,
			handlePayDebt,
			handleDownloadDebtReceipt,
			loc,
			translateNumber,
			translateAmount,
		]
	)

	const handleDownloadReceipt = useCallback(async () => {
		if (!singleDebtData || isDownloadingReceipt) return

		try {
			setIsDownloadingReceipt(true)

			// Request storage permission
			const permittedFolder = await getStoragePermission()
			if (!permittedFolder) {
				ToastAndroid.show(
					loc.t('debt.storagePermissionRequired') ||
						'Storage permission required',
					ToastAndroid.LONG
				)
				setIsDownloadingReceipt(false)
				return
			}

			// Generate receipt HTML
			const receiptHtml = GenerateReceiptHtml({
				checkOutData: singleDebtData,
			})

			// Generate PDF
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
			const filename = `Receipt_${formattedDate}.pdf`

			// Save file
			const base64 = await FileSystem.readAsStringAsync(file.uri, {
				encoding: FileSystem.EncodingType.Base64,
			})

			const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
				permittedFolder,
				filename,
				'application/pdf'
			)

			await FileSystem.writeAsStringAsync(fileUri, base64, {
				encoding: FileSystem.EncodingType.Base64,
			})

			ToastAndroid.show(
				loc.t('debt.receiptDownloaded') || 'Receipt downloaded successfully',
				ToastAndroid.LONG
			)
		} catch (error) {
			console.error('Error downloading receipt:', error)
			ToastAndroid.show(
				loc.t('debt.downloadFailed') || 'Failed to download receipt',
				ToastAndroid.LONG
			)
		} finally {
			setIsDownloadingReceipt(false)
		}
	}, [singleDebtData, isDownloadingReceipt, getStoragePermission, loc])

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
					if (showingPayment) {
						handleBackToList()
					} else if (showingSingleDebt) {
						handleBackToDebtList()
					} else {
						handleCloseWithConfirmation()
					}
				}}
			/>
		),
		[
			showingPayment,
			showingSingleDebt,
			handleBackToList,
			handleBackToDebtList,
			handleCloseWithConfirmation,
		]
	)

	// Handle sheet changes
	const handleSheetChanges = useCallback(
		(index) => {
			if (index === -1) {
				onClose()
			}
		},
		[onClose]
	)

	// Early returns AFTER all hooks
	if (!debtData) return null
	if (!visible) return null

	const totalDebt = debtData.totalDebt || 0
	const isDebtPositive = totalDebt > 0

	// Compute header title based on current view
	const getHeaderTitle = () => {
		if (showingPayment) return loc.t('debt.payDebt')
		if (showingSingleDebt) return loc.t('debt.debtDetails')
		return loc.t('debt.debtInfo') || 'Debt Info'
	}

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
				enableDynamicSizing={false}
				bottomInset={insets.bottom}
				backgroundStyle={styles.bottomSheetBackground}
				handleIndicatorStyle={styles.handleIndicator}
			>
				<View style={styles.headerContainer}>
					{/* Header */}
					<View style={styles.header}>
						<View style={styles.headerTextContainer}>
							<Text
								style={styles.headerTitle}
								numberOfLines={1}
								ellipsizeMode="tail"
							>
								{getHeaderTitle()}
							</Text>
						</View>
						<TouchableOpacity
							onPress={closeModal}
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
							{showingPayment ? (
								// Payment View
								<>
									{/* Payment Form */}
									<View style={styles.section}>
										<View style={styles.fieldContainer}>
											<View
												style={{
													flexDirection: 'row',
													alignItems: 'center',
													gap: 12,
												}}
											>
												<View
													style={[
														styles.inputContainer,
														{ flex: 1, marginBottom: 0 },
													]}
												>
													<Text style={styles.overlayLabel}>
														{loc.t('debt.paymentAmount') || 'Payment Amount'} *
													</Text>
													<BottomSheetTextInput
														style={styles.amountInput}
														value={paymentAmount}
														onChangeText={handlePaymentAmountChange}
														placeholder={translateNumber('0.00')}
														keyboardType="numeric"
														placeholderTextColor="rgba(0,0,0,0.54)"
														returnKeyType="done"
													/>
												</View>
												<TouchableOpacity
													style={{
														flexDirection: 'row',
														alignItems: 'center',
														gap: 4,
														maxWidth: '40%',
													}}
													onPress={() => setNotifySms(!notifySms)}
													activeOpacity={0.7}
												>
													<MaterialCommunityIcons
														name={
															notifySms
																? 'checkbox-marked'
																: 'checkbox-blank-outline'
														}
														size={24}
														color="#195FE1"
													/>
													<Text
														style={{
															color: '#333333',
															fontSize: 14,
															flexShrink: 1,
														}}
													>
														{loc.t('debt.notifySms')}
													</Text>
												</TouchableOpacity>
											</View>
										</View>
									</View>

									{/* Action Buttons */}
									<View style={styles.buttonContainer}>
										<TouchableOpacity
											style={[styles.button, styles.backButton]}
											onPress={handleBackToList}
											activeOpacity={0.8}
										>
											<MaterialIcons
												name="arrow-back"
												size={18}
												color="#6B7280"
												style={styles.buttonIcon}
											/>
											<Text style={styles.backButtonText}>
												{loc.t('debt.back') || 'Back'}
											</Text>
										</TouchableOpacity>
										<TouchableOpacity
											style={[styles.button, styles.submitButton]}
											onPress={handleSubmit}
											activeOpacity={0.8}
										>
											<MaterialIcons
												name="payment"
												size={18}
												color="#FFFFFF"
												style={styles.buttonIcon}
											/>
											<Text style={styles.buttonText}>
												{loc.t('debt.submitPayment') || 'Submit Payment'}
											</Text>
										</TouchableOpacity>
									</View>
								</>
							) : showingSingleDebt ? (
								// Single Debt Details View
								<>
									{singleDebtData && (
										<>
											{/* Payment Status */}
											<View style={styles.section}>
												<Text style={styles.sectionTitle}>
													{loc.t('debt.paymentStatus') || 'Payment Status'}
												</Text>
												<View style={styles.fieldContainer}>
													<View style={styles.infoRow}>
														<Text style={styles.infoLabel}>
															{loc.t('debt.total')}
														</Text>
														<Text style={styles.infoValue}>
															{translateAmount(
																singleDebtData.totalPrice.toFixed(2)
															)}
														</Text>
													</View>
													<View style={styles.infoRow}>
														<Text style={styles.infoLabel}>
															{loc.t('debt.paid')}
														</Text>
														<Text style={styles.infoValue}>
															{translateAmount(
																singleDebtData.Debt.paidAmount.toFixed(2)
															)}
														</Text>
													</View>
													<View style={styles.infoRow}>
														<Text style={styles.infoLabel}>
															{loc.t('debt.due')}
														</Text>
														<Text
															style={[
																styles.infoValue,
																{ color: '#FF4444', fontWeight: 'bold' },
															]}
														>
															{translateAmount(
																(
																	singleDebtData.totalPrice -
																	singleDebtData.Debt.paidAmount
																).toFixed(2)
															)}
														</Text>
													</View>
												</View>
											</View>

											{/* Payment Instruction */}
											<View style={styles.section}>
												<Text style={styles.instructionText}>
													*{' '}
													{loc.t('debt.payDebtInstruction') ||
														'Pay debt will pay debt for this transaction only'}
												</Text>
											</View>

											{/* Download Button */}
											<View style={styles.buttonContainer}>
												<TouchableOpacity
													style={[
														styles.button,
														styles.downloadButton,
														isDownloadingReceipt &&
															styles.downloadButtonDisabled,
													]}
													onPress={handleDownloadReceipt}
													activeOpacity={0.8}
													disabled={isDownloadingReceipt}
												>
													<MaterialIcons
														name={
															isDownloadingReceipt
																? 'hourglass-empty'
																: 'download'
														}
														size={18}
														color="#FFFFFF"
														style={styles.buttonIcon}
													/>
													<Text style={styles.buttonText}>
														{isDownloadingReceipt
															? loc.t('debt.downloading') || 'Downloading...'
															: loc.t('debt.downloadReceipt') ||
																'Download Receipt'}
													</Text>
												</TouchableOpacity>
											</View>

											{/* Action Buttons */}
											<View style={styles.buttonContainer}>
												<TouchableOpacity
													style={[styles.button, styles.viewButton]}
													onPress={handleBackToDebtList}
													activeOpacity={0.8}
												>
													<MaterialIcons
														name="arrow-back"
														size={18}
														color="#FFFFFF"
														style={styles.buttonIcon}
													/>
													<Text style={styles.buttonText}>
														{loc.t('debt.backToList') || 'Back to List'}
													</Text>
												</TouchableOpacity>
												{singleDebtData.totalPrice -
													singleDebtData.Debt.paidAmount >
													0 && (
													<TouchableOpacity
														style={[styles.button, styles.payButton]}
														onPress={() => handlePayDebt(singleDebtData.id)}
														activeOpacity={0.8}
													>
														<MaterialIcons
															name="payment"
															size={18}
															color="#FFFFFF"
															style={styles.buttonIcon}
														/>
														<Text style={styles.buttonText}>
															{loc.t('debt.payDebt')}
														</Text>
													</TouchableOpacity>
												)}
											</View>
										</>
									)}
								</>
							) : (
								// Customer Details View with Debt List
								<>
									{/* Customer Information Section */}
									<View style={styles.section}>
										<View style={styles.fieldContainer}>
											<View style={styles.infoRow}>
												<View style={styles.infoLabelContainer}>
													<MaterialIcons
														name="person"
														size={16}
														color="#195FE1"
														style={styles.infoIcon}
													/>
													<Text style={styles.infoLabel}>
														{loc.t('debt.customerName')}
													</Text>
												</View>
												<Text style={styles.infoValue}>{debtData.name}</Text>
											</View>

											<View style={styles.infoRow}>
												<View style={styles.infoLabelContainer}>
													<MaterialIcons
														name="phone"
														size={16}
														color="#195FE1"
														style={styles.infoIcon}
													/>
													<Text style={styles.infoLabel}>
														{loc.t('debt.customerNumber')}
													</Text>
												</View>
												<Text style={styles.infoValue}>
													{debtData.number
														? translatePhone(debtData.number)
														: '-'}
												</Text>
											</View>

											<View style={styles.infoRow}>
												<View style={styles.infoLabelContainer}>
													<MaterialIcons
														name="location-on"
														size={16}
														color="#195FE1"
														style={styles.infoIcon}
													/>
													<Text style={styles.infoLabel}>
														{loc.t('debt.customerAddress')}
													</Text>
												</View>
												<Text style={styles.infoValue}>{debtData.address}</Text>
											</View>

											<View style={styles.infoRow}>
												<View style={styles.infoLabelContainer}>
													<MaterialIcons
														name={
															isDebtPositive ? 'trending-up' : 'trending-down'
														}
														size={16}
														color="#195FE1"
														style={styles.infoIcon}
													/>
													<Text style={styles.infoLabel}>
														{loc.t('debt.totalDebt')}
													</Text>
												</View>
												<Text
													style={[
														styles.infoValue,
														{
															color: isDebtPositive ? '#FF4444' : '#A7F3D0',
															fontWeight: 'bold',
														},
													]}
												>
													{translateAmount(totalDebt.toFixed(2))}
												</Text>
											</View>
										</View>
									</View>

									{/* Tab Buttons */}
									<View style={styles.tabButtonContainer}>
										<TouchableOpacity
											style={[
												styles.tabButton,
												activeTab === 'transactions' && styles.tabButtonActive,
											]}
											onPress={() => handleTabSwitch('transactions')}
											activeOpacity={0.7}
										>
											<MaterialIcons
												name="list"
												size={18}
												color={
													activeTab === 'transactions' ? '#FFFFFF' : '#195FE1'
												}
												style={styles.tabButtonIcon}
											/>
											<Text
												style={[
													styles.tabButtonText,
													activeTab === 'transactions' &&
														styles.tabButtonTextActive,
												]}
											>
												{loc.t('debt.transactionView')}
											</Text>
										</TouchableOpacity>
										<TouchableOpacity
											style={[
												styles.tabButton,
												activeTab === 'ledger' && styles.tabButtonActive,
											]}
											onPress={() => handleTabSwitch('ledger')}
											activeOpacity={0.7}
										>
											<MaterialIcons
												name="account-balance-wallet"
												size={18}
												color={activeTab === 'ledger' ? '#FFFFFF' : '#195FE1'}
												style={styles.tabButtonIcon}
											/>
											<Text
												style={[
													styles.tabButtonText,
													activeTab === 'ledger' && styles.tabButtonTextActive,
												]}
											>
												{loc.t('debt.ledgerView')}
											</Text>
										</TouchableOpacity>
									</View>

									{/* Debt Transactions List Section */}
									{activeTab === 'transactions' ? (
										<View style={styles.section}>
											<Text style={styles.sectionTitle}>
												{loc.t('debt.debtTransactions')}
											</Text>
											<View style={styles.fieldContainer}>
												{debtData.items && debtData.items.length > 0 ? (
													<FlatList
														data={[...debtData.items].sort(
															(a, b) =>
																new Date(b.createdAt).getTime() -
																new Date(a.createdAt).getTime()
														)}
														keyExtractor={(item, index) =>
															item.id || index.toString()
														}
														scrollEnabled={false}
														showsVerticalScrollIndicator={false}
														nestedScrollEnabled={true}
														renderItem={({ item }) => {
															const totalPrice = item.checkout?.totalPrice || 0
															const paidAmount = item.paidAmount || 0
															const dueAmount = totalPrice - paidAmount
															const isExpanded =
																expandedDebtItems[item.id] || false

															// Get all debt payments and mark if they were during checkout
															const itemCreatedTime = new Date(
																item.createdAt
															).getTime()
															const allPayments = (item.debtPayments || [])
																.map((payment) => {
																	const paymentCreatedTime = new Date(
																		payment.createdAt
																	).getTime()
																	const timeDiff = Math.abs(
																		paymentCreatedTime - itemCreatedTime
																	)
																	return {
																		...payment,
																		isDuringCheckout: timeDiff <= 2000,
																	}
																})
																.sort(
																	(a, b) =>
																		new Date(b.createdAt).getTime() -
																		new Date(a.createdAt).getTime()
																)

															return (
																<View>
																	{/* Collapsible Header */}
																	<TouchableOpacity
																		style={styles.collapsibleHeader}
																		onPress={() => toggleDebtItem(item.id)}
																	>
																		<View
																			style={styles.collapsibleHeaderContent}
																		>
																			<Text
																				style={styles.collapsibleHeaderText}
																			>
																				{translateNumber(
																					new Date(
																						item.createdAt
																					).toLocaleDateString()
																				)}{' '}
																				-{' '}
																				<Text
																					style={styles.collapsibleHeaderAmount}
																				>
																					{translateAmount(
																						dueAmount.toFixed(2)
																					)}
																				</Text>
																			</Text>
																		</View>
																		<MaterialIcons
																			name={
																				isExpanded
																					? 'keyboard-arrow-up'
																					: 'keyboard-arrow-down'
																			}
																			size={24}
																			color="#64748b"
																		/>
																	</TouchableOpacity>

																	{/* Collapsible Content */}
																	{isExpanded && (
																		<View style={styles.collapsibleContent}>
																			{/* Total and Paid Amount */}
																			<View style={styles.debtContentHeader}>
																				<Text style={styles.debtListDetails}>
																					{loc.t('debt.total')}:{' '}
																					{translateAmount(
																						totalPrice.toFixed(2)
																					)}{' '}
																					| {loc.t('debt.paid')}:{' '}
																					{translateAmount(
																						paidAmount.toFixed(2)
																					)}
																				</Text>
																			</View>

																			{/* Action Buttons */}
																			<View
																				style={styles.debtItemButtonContainer}
																			>
																				{dueAmount > 0 && (
																					<TouchableOpacity
																						style={[
																							styles.debtItemButton,
																							styles.debtItemPayButton,
																						]}
																						onPress={() =>
																							handlePayDebt(item.id)
																						}
																						activeOpacity={0.8}
																					>
																						<MaterialIcons
																							name="payment"
																							size={14}
																							color="#FFFFFF"
																							style={styles.debtItemButtonIcon}
																						/>
																						<Text
																							style={styles.debtItemButtonText}
																						>
																							{loc.t('debt.payDebt')}
																						</Text>
																					</TouchableOpacity>
																				)}
																				<TouchableOpacity
																					style={[
																						styles.debtItemButton,
																						styles.debtItemDownloadButton,
																					]}
																					onPress={() =>
																						handleDownloadDebtReceipt(
																							item.checkoutID
																						)
																					}
																					activeOpacity={0.8}
																				>
																					<MaterialIcons
																						name="download"
																						size={14}
																						color="#FFFFFF"
																						style={styles.debtItemButtonIcon}
																					/>
																					<Text
																						style={styles.debtItemButtonText}
																					>
																						{loc.t('debt.downloadReceipt') ||
																							'Download Receipt'}
																					</Text>
																				</TouchableOpacity>
																			</View>

																			{/* Debt Payment History */}
																			{allPayments.length > 0 && (
																				<View
																					style={styles.paymentHistoryContainer}
																				>
																					{allPayments.map((payment, index) => (
																						<View
																							key={payment.id || index}
																							style={styles.paymentHistoryItem}
																						>
																							<Text
																								style={
																									styles.paymentHistoryText
																								}
																							>
																								{payment.isDuringCheckout
																									? loc.t(
																											'debt.duringCheckout'
																										) || 'During Checkout'
																									: translateNumber(
																											new Date(
																												payment.createdAt
																											).toLocaleDateString()
																										)}{' '}
																								-{' '}
																								{loc.t('debt.paidAmount') ||
																									'Paid'}
																								:{' '}
																								{translateAmount(
																									payment.amount.toFixed(2)
																								)}
																							</Text>
																						</View>
																					))}
																				</View>
																			)}
																		</View>
																	)}
																</View>
															)
														}}
														ItemSeparatorComponent={() => (
															<View style={styles.transactionSeparator} />
														)}
													/>
												) : (
													<View style={styles.noTransactionsContainer}>
														<MaterialIcons
															name="receipt-long"
															size={48}
															color="#D1D5DB"
														/>
														<Text style={styles.noTransactions}>
															{loc.t('debt.noTransactions')}
														</Text>
														<Text style={styles.noTransactionsSubtext}>
															{loc.t('debt.noTransactionsDesc')}
														</Text>
													</View>
												)}
											</View>
										</View>
									) : (
										/* Ledger View */
										<LedgerView
											ledgerData={ledgerData}
											loading={loadingLedger}
										/>
									)}

									{/* Action Buttons */}
									{isDebtPositive && (
										<View style={styles.fullWidthButtonContainer}>
											<TouchableOpacity
												style={[styles.button, styles.payButton]}
												onPress={() => handlePayDebt('*')}
												activeOpacity={0.8}
											>
												<MaterialIcons
													name="payment"
													size={18}
													color="#FFFFFF"
													style={styles.buttonIcon}
												/>
												<Text style={styles.buttonText}>
													{loc.t('debt.payDebt')}
												</Text>
											</TouchableOpacity>
										</View>
									)}
								</>
							)}
						</View>
					</BottomSheetScrollView>
				</KeyboardAvoidingView>
			</BottomSheetModal>

			{/* Close Confirmation Modal */}
			<CloseModal
				visible={showCloseModal}
				title={loc.t('debt.closeDetails') || 'Close Details'}
				subtitle={
					loc.t('debt.sureToClose') || 'Are you sure you want to close?'
				}
				onClose={() => setShowCloseModal(false)}
				onConfirm={() => {
					setShowCloseModal(false)
					// No modification when closing via close button
					closeModal(false)
				}}
			/>

			{/* Error Modal */}
			<ErrorModal
				visible={showErrorModal}
				title={loc.t('debt.error') || 'Error'}
				subtitle={errorMessage}
				onClose={() => setShowErrorModal(false)}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF', // AliceBlue like CustomerDetails
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
		color: '#195FE1', // Primary color
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
		paddingVertical: 12,
		borderRadius: 8,
		marginBottom: 2,
	},
	sectionTitle: {
		fontWeight: '600',
		fontSize: 16,
		color: '#195FE1',
		marginBottom: 12,
		textAlign: 'center',
	},
	instructionText: {
		fontSize: 12,
		color: '#6B7280',
		textAlign: 'center',
		marginBottom: 8,
		fontStyle: 'italic',
	},
	fieldContainer: {
		backgroundColor: '#FFFFFF',
		padding: 16,
		borderRadius: 12,
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0, 0, 0, 0.1)',
	},
	infoLabelContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
	},
	infoIcon: {
		marginRight: 8,
	},
	infoLabel: {
		fontSize: 14,
		color: '#195FE1',
		fontWeight: '500',
	},
	infoValue: {
		fontSize: 14,
		color: '#333333',
		fontWeight: '600',
		flex: 1,
		textAlign: 'right',
	},
	transactionSeparator: {
		height: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.05)',
		marginVertical: 4,
	},
	noTransactionsContainer: {
		alignItems: 'center',
		paddingVertical: 32,
	},
	noTransactions: {
		textAlign: 'center',
		color: '#6B7280',
		fontSize: 16,
		fontWeight: '600',
		marginTop: 12,
		marginBottom: 4,
	},
	noTransactionsSubtext: {
		textAlign: 'center',
		color: '#9CA3AF',
		fontSize: 12,
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
		marginTop: 16,
		paddingHorizontal: 12,
	},
	fullWidthButtonContainer: {
		marginTop: 16,
		paddingHorizontal: 12,
	},
	debtItemButtonContainer: {
		flexDirection: 'row',
		justifyContent: 'flex-start',
		gap: 8,
		marginTop: 8,
		marginBottom: 8,
		flexWrap: 'wrap',
	},
	debtItemButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	debtItemPayButton: {
		backgroundColor: '#059669',
	},
	debtItemDownloadButton: {
		backgroundColor: '#195FE1',
	},
	debtItemButtonIcon: {
		marginRight: 4,
	},
	debtItemButtonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 12,
	},
	button: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 14,
		borderRadius: 12,
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
	viewButton: {
		backgroundColor: '#195FE1',
	},
	payButton: {
		backgroundColor: '#059669',
	},
	downloadButton: {
		backgroundColor: '#195FE1',
	},
	downloadButtonDisabled: {
		backgroundColor: '#93C5FD',
		opacity: 0.7,
	},
	backButton: {
		backgroundColor: '#E5E7EB',
	},
	submitButton: {
		backgroundColor: '#059669',
	},
	buttonText: {
		color: '#ffffff',
		fontWeight: '600',
		fontSize: 15,
	},
	backButtonText: {
		color: '#6B7280',
		fontWeight: '600',
		fontSize: 15,
	},
	collapsibleHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 12,
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		marginBottom: 8,
		// removed border width and color
	},
	collapsibleHeaderContent: {
		flex: 1,
	},
	collapsibleHeaderText: {
		fontSize: 14,
		color: '#195FE1',
		fontWeight: '600',
	},
	collapsibleHeaderAmount: {
		fontWeight: 'bold',
	},
	collapsibleContent: {
		padding: 12,
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		marginBottom: 8,
	},
	debtContentHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 12,
		paddingBottom: 8,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0, 0, 0, 0.1)',
	},
	debtContentTitle: {
		flex: 1,
		fontSize: 12,
		color: '#333333',
		opacity: 0.8,
	},
	debtContentActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	debtContentAmount: {
		fontSize: 14,
		fontWeight: 'bold',
	},
	debtListItem: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 8,
		paddingHorizontal: 4,
	},
	debtListInfo: {
		flex: 1,
	},
	debtListDate: {
		fontSize: 14,
		color: '#6B7280',
		fontWeight: '500',
		marginBottom: 4,
	},
	debtListDetails: {
		fontSize: 12,
		color: '#333333',
		opacity: 0.8,
	},
	debtListActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	debtListAmount: {
		fontSize: 14,
		fontWeight: 'bold',
	},
	debtListActionButton: {
		padding: 4,
	},
	itemRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0, 0, 0, 0.05)',
	},
	itemInfo: {
		flex: 1,
	},
	itemName: {
		fontSize: 14,
		color: '#333333',
		fontWeight: '600',
		marginBottom: 4,
	},
	itemTotal: {
		fontSize: 14,
		color: '#333333',
		fontWeight: '600',
	},
	totalRow: {
		borderBottomWidth: 0,
		borderTopWidth: 2,
		borderTopColor: 'rgba(0, 0, 0, 0.15)',
		marginTop: 8,
		paddingTop: 16,
	},
	totalLabel: {
		fontSize: 16,
		color: '#195FE1',
		fontWeight: 'bold',
	},
	totalAmount: {
		fontSize: 16,
		color: '#195FE1',
		fontWeight: 'bold',
	},
	paymentHistoryContainer: {
		marginLeft: 12,
		marginTop: 4,
		paddingLeft: 12,
		borderLeftWidth: 2,
		borderLeftColor: '#10B981',
	},
	paymentHistoryItem: {
		paddingVertical: 4,
	},
	paymentHistoryText: {
		fontSize: 12,
		color: '#10B981',
		fontWeight: '600',
	},
	inputContainer: {
		marginBottom: 16,
		width: '100%',
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
	amountInput: {
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		fontSize: 16,
		color: '#333333',
		minHeight: 44,
		fontWeight: '600',
	},
	tabButtonContainer: {
		flexDirection: 'row',
		gap: 12,
		marginVertical: 16,
		paddingHorizontal: 4,
	},
	tabButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		backgroundColor: '#FFFFFF',
		borderWidth: 2,
		borderColor: '#195FE1',
	},
	tabButtonActive: {
		backgroundColor: '#195FE1',
	},
	tabButtonIcon: {
		marginRight: 6,
	},
	tabButtonText: {
		fontSize: 14,
		fontWeight: '600',
		color: '#195FE1',
	},
	tabButtonTextActive: {
		color: '#FFFFFF',
	},
})
