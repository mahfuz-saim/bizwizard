import {
	Text,
	View,
	TouchableOpacity,
	Dimensions,
	StyleSheet,
	Linking,
	ToastAndroid,
	ScrollView,
	Modal,
} from 'react-native'
import { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react'
import {
	BottomSheetModal,
	BottomSheetView,
	BottomSheetBackdrop,
} from '@gorhom/bottom-sheet'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { router } from 'expo-router'
import { getEmployeeTransactions } from '../../controllers/employee'
import useApi from '../../hooks/useApi'

const { height: screenHeight } = Dimensions.get('window')

// Memoized Transaction Item Component
const TransactionItem = memo(({ item, loc, translateNumber, onPress }) => {
	const formattedDate = useMemo(() => {
		return translateNumber(
			new Date(item.createdAt).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			})
		)
	}, [item.createdAt, translateNumber])

	const statusColor = item.status === 'PAID' ? '#22c55e' : '#EF4444'
	const statusText =
		item.status === 'PAID'
			? loc.t('employee.transactions.paid') || 'Paid'
			: loc.t('employee.transactions.unpaid') || 'Unpaid'

	return (
		<View style={styles.transactionItem}>
			<View style={styles.transactionHeader}>
				<View style={styles.transactionInfo}>
					<Text style={styles.transactionDate}>{formattedDate}</Text>
					<View style={styles.transactionDetails}>
						<Text style={styles.transactionAmount}>
							৳{translateNumber(item.totalPrice?.toString())}
						</Text>
						<View
							style={[styles.statusBadge, { backgroundColor: statusColor }]}
						>
							<Text style={styles.statusText}>{statusText}</Text>
						</View>
					</View>
				</View>
				<TouchableOpacity
					onPress={() => onPress(item)}
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
const EmployeeHeader = memo(({ employee, loc, onClose, showTransactions }) => (
	<View style={styles.header}>
		<View style={styles.headerTextContainer}>
			<Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
				{showTransactions
					? loc.t('employee.transactions.title') || 'Transaction History'
					: loc.t('employee.employeeDetails.title')}
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
))

// Transaction Details Modal Component
const TransactionDetailsModal = memo(
	({ visible, transaction, onClose, loc, translateNumber }) => {
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
				? loc.t('employee.transactions.percentage') || 'Percentage'
				: loc.t('employee.transactions.fixed') || 'Fixed'
		}

		return (
			<Modal
				transparent={true}
				visible={visible}
				animationType="fade"
				onRequestClose={onClose}
			>
				<View style={styles.transactionModalBackdrop}>
					<View style={styles.transactionModalContent}>
						{/* Header */}
						<View style={styles.transactionModalHeader}>
							<Text style={styles.transactionModalTitle}>
								{loc.t('employee.transactions.details') ||
									'Transaction Details'}
							</Text>
							<TouchableOpacity
								onPress={onClose}
								style={styles.transactionModalClose}
							>
								<MaterialIcons name="close" size={24} color="#6B7280" />
							</TouchableOpacity>
						</View>

						{/* Content */}
						<ScrollView style={styles.transactionModalScroll}>
							<View style={styles.transactionDetailItem}>
								<Text style={styles.transactionDetailLabel}>
									{loc.t('employee.transactions.totalPrice') || 'Total Price'}
								</Text>
								<Text style={styles.transactionDetailValue}>
									৳{translateNumber(transaction.totalPrice?.toString())}
								</Text>
							</View>

							<View style={styles.transactionDetailItem}>
								<Text style={styles.transactionDetailLabel}>
									{loc.t('employee.transactions.totalQuantity') ||
										'Total Quantity'}
								</Text>
								<Text style={styles.transactionDetailValue}>
									{translateNumber(transaction.totalQuantity?.toString())}
								</Text>
							</View>

							<View style={styles.transactionDetailItem}>
								<Text style={styles.transactionDetailLabel}>
									{loc.t('employee.transactions.totalDiscount') ||
										'Total Discount'}
								</Text>
								<Text style={styles.transactionDetailValue}>
									৳{translateNumber(transaction.totalDiscount?.toString())}
								</Text>
							</View>

							<View style={styles.transactionDetailItem}>
								<Text style={styles.transactionDetailLabel}>
									{loc.t('employee.transactions.discountType') ||
										'Discount Type'}
								</Text>
								<Text style={styles.transactionDetailValue}>
									{getDiscountTypeText(transaction.discountType)}
								</Text>
							</View>

							<View style={styles.transactionDetailItem}>
								<Text style={styles.transactionDetailLabel}>
									{loc.t('employee.transactions.status') || 'Status'}
								</Text>
								<View
									style={[
										styles.statusBadge,
										{
											backgroundColor:
												transaction.status === 'PAID' ? '#22c55e' : '#EF4444',
										},
									]}
								>
									<Text style={styles.statusText}>
										{transaction.status === 'PAID'
											? loc.t('employee.transactions.paid') || 'Paid'
											: loc.t('employee.transactions.unpaid') || 'Unpaid'}
									</Text>
								</View>
							</View>

							{transaction.updatedAt !== transaction.createdAt && (
								<View style={styles.transactionDetailItem}>
									<Text style={styles.transactionDetailLabel}>
										{loc.t('employee.transactions.updatedAt') || 'Updated At'}
									</Text>
									<Text style={styles.transactionDetailValue}>
										{formatDate(transaction.updatedAt)}
									</Text>
								</View>
							)}
						</ScrollView>

						{/* Close Button */}
						<View style={styles.transactionModalFooter}>
							<TouchableOpacity
								onPress={onClose}
								style={styles.transactionModalCloseButton}
							>
								<Text style={styles.transactionModalCloseText}>
									{loc.t('employee.transactions.okay') || 'Okay'}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		)
	}
)

export default function EmployeeDetails({
	employee,
	visible,
	onClose,
	onDelete,
}) {
	const { loc } = useLocalization()
	const { translateNumber, translatePhone } = useNumberTranslator()
	const bottomSheetModalRef = useRef(null)
	const snapPoints = useMemo(() => ['92%'], [])
	const [showDeleteModal, setShowDeleteModal] = useState(false)
	const [showTransactions, setShowTransactions] = useState(false)
	const [transactionsData, setTransactionsData] = useState([])
	const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
	const [selectedTransaction, setSelectedTransaction] = useState(null)
	const [showTransactionModal, setShowTransactionModal] = useState(false)
	const { fetchData } = useApi()

	// Reset view when modal opens
	useEffect(() => {
		if (visible) {
			setShowTransactions(false)
			bottomSheetModalRef.current?.present()
		}
	}, [visible])

	// Fetch transactions data when transactions view is opened
	const fetchTransactions = useCallback(async () => {
		setIsLoadingTransactions(true)
		try {
			const result = await fetchData(getEmployeeTransactions, {
				data: {
					userId: employee.userID,
				},
			})
			if (result.success && result.data?.data) {
				setTransactionsData(result.data.data || [])
			} else {
				console.error('No data found or API error:', result)
				setTransactionsData([])
			}
		} catch (error) {
			console.error('Error fetching transactions:', error)
			ToastAndroid.show(
				loc.t('employee.transactions.fetchError') ||
					'Failed to fetch transactions',
				ToastAndroid.SHORT
			)
		} finally {
			setIsLoadingTransactions(false)
		}
	}, [employee?.userID])

	useEffect(() => {
		if (!visible || !employee?.userID || !showTransactions) {
			return
		}

		fetchTransactions()
	}, [visible, employee?.userID, showTransactions, fetchTransactions])

	const closeModal = useCallback(() => {
		bottomSheetModalRef.current?.dismiss()
		onClose()
	}, [onClose])

	const handleCallEmployee = useCallback(
		async (phoneNumber) => {
			if (!phoneNumber) {
				ToastAndroid.show(
					loc.t('employee.noPhoneNumber') || 'No phone number available',
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
						loc.t('employee.callNotSupported') ||
							'Calling is not supported on this device',
						ToastAndroid.SHORT
					)
				}
			} catch (error) {
				ToastAndroid.show(
					loc.t('employee.callError') || 'Call Error',
					ToastAndroid.SHORT
				)
			}
		},
		[loc]
	)

	const handleDelete = useCallback(() => {
		setShowDeleteModal(true)
	}, [])

	const confirmDelete = useCallback(() => {
		onDelete(employee.id)
		setShowDeleteModal(false)
		closeModal()
	}, [employee.id, onDelete, closeModal])

	const handleTransactionPress = useCallback((transaction) => {
		setSelectedTransaction(transaction)
		setShowTransactionModal(true)
	}, [])

	// Memoized empty component for transactions
	const renderEmptyTransactions = useMemo(
		() => (
			<View style={styles.emptyContainer}>
				<MaterialIcons name="receipt" size={48} color="#E5E7EB" />
				<Text style={styles.emptyText}>
					{loc.t('employee.transactions.noTransactions') ||
						'No transactions found'}
				</Text>
				<Text style={styles.emptySubText}>
					{loc.t('employee.transactions.noTransactionsDesc') ||
						'No transaction history found for this employee'}
				</Text>
			</View>
		),
		[loc]
	)

	const renderDeleteConfirmModal = useCallback(
		() => (
			<Modal
				transparent={true}
				visible={showDeleteModal}
				animationType="fade"
				onRequestClose={() => setShowDeleteModal(false)}
			>
				<View style={styles.deleteModalBackdrop}>
					<View style={styles.deleteModalContent}>
						<MaterialIcons
							name="warning"
							size={48}
							color="#EF4444"
							style={styles.warningIcon}
						/>
						<Text style={styles.deleteTitle}>
							{loc.t('employee.deleteConfirm.title')}
						</Text>
						<Text style={styles.deleteMessage}>
							{loc.t('employee.deleteConfirm.message', {
								name: employee?.name || 'this employee',
							})}
						</Text>
						<View style={styles.deleteButtonContainer}>
							<TouchableOpacity
								style={[styles.deleteButton, styles.cancelDeleteButton]}
								onPress={() => {
									setShowDeleteModal(false)
								}}
								activeOpacity={0.8}
							>
								<Text style={styles.cancelDeleteText}>
									{loc.t('employee.deleteConfirm.cancel')}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.deleteButton, styles.confirmDeleteButton]}
								onPress={confirmDelete}
								activeOpacity={0.8}
							>
								<Text style={styles.confirmDeleteText}>
									{loc.t('employee.deleteConfirm.delete')}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		),
		[showDeleteModal, employee?.name, confirmDelete, loc]
	)

	const showAttendanceDetails = () => {
		closeModal()
		router.push({
			pathname: '/home/employee/AttendanceDetails',
			params: {
				employeeId: employee.userID,
			},
		})
	}

	const renderBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="close"
				onPress={closeModal}
			/>
		),
		[closeModal]
	)

	if (!employee) {
		return null
	}

	return (
		<>
			<BottomSheetModal
				ref={bottomSheetModalRef}
				snapPoints={snapPoints}
				backdropComponent={renderBackdrop}
				onDismiss={onClose}
				enablePanDownToClose={true}
				enableOverDrag={false}
				topInsetAndroid={0}
				backgroundStyle={{ backgroundColor: '#F0F8FF' }}
			>
				<BottomSheetView style={styles.bottomSheetContainer}>
					{/* Header */}
					<View style={styles.headerContainer}>
						<EmployeeHeader
							employee={employee}
							loc={loc}
							onClose={closeModal}
							showTransactions={showTransactions}
						/>
					</View>

					{/* Content */}
					<View style={styles.contentArea} pointerEvents="box-none">
						{showTransactions ? (
							<ScrollView
								style={styles.transactionsScrollView}
								contentContainerStyle={styles.transactionsScrollContent}
								showsVerticalScrollIndicator={true}
								keyboardShouldPersistTaps="handled"
								scrollEventThrottle={16}
								removeClippedSubviews={true}
								bounces={false}
								alwaysBounceVertical={false}
								decelerationRate="normal"
								overScrollMode="never"
							>
								<View style={styles.section}>
									<View style={styles.transactionsContainer}>
										{isLoadingTransactions ? (
											<TransactionLoader />
										) : transactionsData.length > 0 ? (
											transactionsData.map((transaction, index) => (
												<TransactionItem
													key={transaction.id || index}
													item={transaction}
													loc={loc}
													translateNumber={translateNumber}
													onPress={handleTransactionPress}
												/>
											))
										) : (
											renderEmptyTransactions
										)}
									</View>
								</View>

								{/* Bottom Buttons */}
								<View style={styles.bottomButtonContainer}>
									<TouchableOpacity
										style={[styles.button, styles.attendanceButton]}
										onPress={showAttendanceDetails}
										activeOpacity={0.8}
									>
										<MaterialIcons
											name="schedule"
											size={18}
											color="#FFFFFF"
											style={styles.buttonIcon}
										/>
										<Text style={styles.backButtonText}>
											{loc.t('employee.employeeDetails.attendanceDetails')}
										</Text>
									</TouchableOpacity>
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
											{loc.t('employee.transactions.showEmployeeDetails') ||
												'Show Employee Details'}
										</Text>
									</TouchableOpacity>
								</View>
							</ScrollView>
						) : (
							<ScrollView
								style={styles.detailsScrollView}
								contentContainerStyle={styles.detailsScrollContent}
								showsVerticalScrollIndicator={true}
								keyboardShouldPersistTaps="handled"
								scrollEventThrottle={16}
								removeClippedSubviews={true}
								bounces={false}
								alwaysBounceVertical={false}
								decelerationRate="normal"
								overScrollMode="never"
							>
								<View style={styles.section}>
									<View style={styles.infoContainer}>
										{/* Name */}
										<View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('employee.employeeForm.name')}
											</Text>
											<Text style={styles.infoValue}>
												{employee.name || 'Not provided'}
											</Text>
										</View>

										{/* Phone Number */}
										<View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('employee.employeeForm.number')}
											</Text>
											<View style={styles.phoneContainer}>
												<Text style={styles.infoValuePhone}>
													{employee.number
														? translatePhone(employee.number)
														: 'Not provided'}
												</Text>
												{employee.number && (
													<TouchableOpacity
														onPress={() => handleCallEmployee(employee.number)}
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

										{/* Address */}
										<View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('employee.employeeForm.address')}
											</Text>
											<Text style={styles.infoValue}>
												{employee.address || 'Not provided'}
											</Text>
										</View>

										{/* Date of Birth and Joined Date - Side by Side */}
										<View style={styles.twoColumnContainer}>
											{/* Date of Birth */}
											<View style={[styles.infoItem, styles.halfWidth]}>
												<Text style={styles.infoLabel}>
													{loc.t('employee.employeeForm.dob')}
												</Text>
												<Text style={styles.infoValue}>
													{employee.dob
														? translateNumber(
																(() => {
																	const [day, month, year] =
																		employee.dob.split('/')
																	const date = new Date(year, month - 1, day)
																	return date.toLocaleDateString()
																})()
															)
														: 'Not provided'}
												</Text>
											</View>

											{/* Joined Date */}
											{employee.createdAt && (
												<View style={[styles.infoItem, styles.halfWidth]}>
													<Text style={styles.infoLabel}>
														{loc.t('employee.employeeDetails.joinedAt')}
													</Text>
													<Text style={styles.infoValue}>
														{translateNumber(
															new Date(employee.createdAt).toLocaleDateString()
														)}
													</Text>
												</View>
											)}
										</View>

										{/* National ID */}
										{/* <View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('employee.employeeForm.nid')}
											</Text>
											<Text style={styles.infoValue}>
												{employee.nid
													? translateNumber(employee.nid)
													: 'Not provided'}
											</Text>
										</View> */}

										{/* Birth Certificate */}
										{/* <View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('employee.employeeForm.birthCertificate')}
											</Text>
											<Text style={styles.infoValue}>
												{employee.birthCertificate
													? translateNumber(employee.birthCertificate)
													: 'Not provided'}
											</Text>
										</View> */}
									</View>
								</View>

								{/* Bottom Buttons */}
								<View style={styles.bottomButtonContainer}>
									<TouchableOpacity
										style={[styles.button, styles.attendanceButton]}
										onPress={showAttendanceDetails}
										activeOpacity={0.8}
									>
										<MaterialIcons
											name="schedule"
											size={18}
											color="#FFFFFF"
											style={styles.buttonIcon}
										/>
										<Text style={styles.backButtonText}>
											{loc.t('employee.employeeDetails.attendanceDetails')}
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
											{loc.t('employee.transactions.showTransactions') ||
												'Show Transactions'}
										</Text>
									</TouchableOpacity>
								</View>
							</ScrollView>
						)}
					</View>
				</BottomSheetView>
			</BottomSheetModal>
			{renderDeleteConfirmModal()}

			{/* Transaction Details Modal */}
			<TransactionDetailsModal
				visible={showTransactionModal}
				transaction={selectedTransaction}
				onClose={() => setShowTransactionModal(false)}
				loc={loc}
				translateNumber={translateNumber}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	bottomSheetContainer: {
		flex: 1,
		backgroundColor: '#F0F8FF',
		flexDirection: 'column',
	},
	container: {
		flex: 1,
		flexDirection: 'column',
	},
	contentArea: {
		flex: 1,
		paddingHorizontal: 16,
		paddingBottom: 8,
		backgroundColor: '#F0F8FF',
	},
	detailsScrollView: {
		flex: 1,
		backgroundColor: '#F0F8FF',
	},
	detailsScrollContent: {
		paddingBottom: 24,
		flexGrow: 1,
		backgroundColor: '#F0F8FF',
	},
	headerContainer: {
		backgroundColor: '#F0F8FF',
		paddingHorizontal: 16,
		paddingBottom: 16,
		borderBottomWidth: 2,
		borderBottomColor: 'rgba(0,0,0,0.08)',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		backgroundColor: '#F0F8FF',
	},
	headerTextContainer: {
		flex: 1,
		marginRight: 8,
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
		flexShrink: 0,
	},
	section: {
		padding: 12,
		borderRadius: 8,
		marginBottom: 4,
		backgroundColor: '#F0F8FF',
	},
	sectionTitle: {
		fontWeight: '600',
		fontSize: 16,
		color: '#195FE1',
		marginBottom: 12,
		textAlign: 'center',
	},
	infoContainer: {
		backgroundColor: '#F0F8FF',
		borderRadius: 12,
		padding: 0,
	},
	infoItem: {
		marginBottom: 16,
		position: 'relative',
		paddingTop: 8,
	},
	twoColumnContainer: {
		flexDirection: 'row',
		gap: 12,
		marginBottom: 16,
	},
	halfWidth: {
		flex: 1,
		marginBottom: 0,
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
	// Transactions Section Styles
	transactionsContainer: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		padding: 8,
		flex: 1,
	},
	transactionsScrollView: {
		flex: 1,
		backgroundColor: '#F0F8FF',
	},
	transactionsScrollContent: {
		paddingVertical: 4,
		paddingBottom: 24,
		flexGrow: 1,
		backgroundColor: '#F0F8FF',
	},
	transactionItem: {
		backgroundColor: '#F8FAFC',
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
		backgroundColor: '#F0F8FF',
	},
	emptyText: {
		fontSize: 16,
		color: '#6B7280',
		textAlign: 'center',
		marginTop: 12,
		fontWeight: '600',
	},
	emptySubText: {
		fontSize: 14,
		color: '#9CA3AF',
		textAlign: 'center',
		marginTop: 4,
	},
	// Loader Styles
	loaderContainer: {
		backgroundColor: '#F0F8FF',
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
		paddingHorizontal: 12,
		paddingVertical: 16,
		backgroundColor: '#F0F8FF',
		marginTop: 12,
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		gap: 12,
		marginTop: 16,
	},
	button: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 12,
		borderRadius: 24,
		flex: 1,
		minHeight: 44,
	},
	buttonIcon: {
		marginRight: 8,
	},
	toggleButton: {
		backgroundColor: '#195FE1',
	},
	toggleButtonText: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 15,
	},
	attendanceButton: {
		backgroundColor: '#195FE1',
	},
	backButtonText: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 15,
	},
	// Delete Modal Styles
	deleteModalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	deleteModalContent: {
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		padding: 24,
		alignItems: 'center',
		minWidth: 300,
	},
	warningIcon: {
		marginBottom: 16,
	},
	deleteTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#1F2937',
		marginBottom: 8,
		textAlign: 'center',
	},
	deleteMessage: {
		fontSize: 14,
		color: '#6B7280',
		textAlign: 'center',
		marginBottom: 24,
		lineHeight: 20,
	},
	deleteButtonContainer: {
		flexDirection: 'row',
		gap: 12,
		width: '100%',
	},
	deleteButton: {
		flex: 1,
		padding: 12,
		borderRadius: 8,
		alignItems: 'center',
	},
	cancelDeleteButton: {
		backgroundColor: '#E5E7EB',
	},
	confirmDeleteButton: {
		backgroundColor: '#EF4444',
	},
	cancelDeleteText: {
		color: '#6B7280',
		fontWeight: '500',
		fontSize: 14,
	},
	confirmDeleteText: {
		color: '#FFFFFF',
		fontWeight: '500',
		fontSize: 14,
	},
	// Transaction Details Modal Styles
	transactionModalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	transactionModalContent: {
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		width: '90%',
		maxHeight: '80%',
		overflow: 'hidden',
	},
	transactionModalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
	},
	transactionModalTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#1F2937',
		flex: 1,
	},
	transactionModalClose: {
		padding: 4,
	},
	transactionModalScroll: {
		maxHeight: 400,
	},
	transactionDetailItem: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#F3F4F6',
	},
	transactionDetailLabel: {
		fontSize: 14,
		color: '#6B7280',
		fontWeight: '500',
		flex: 1,
	},
	transactionDetailValue: {
		fontSize: 14,
		color: '#1F2937',
		fontWeight: '600',
		textAlign: 'right',
		marginLeft: 16,
	},
	transactionModalFooter: {
		padding: 20,
		borderTopWidth: 1,
		borderTopColor: '#E5E7EB',
	},
	transactionModalCloseButton: {
		backgroundColor: '#195FE1',
		padding: 12,
		borderRadius: 8,
		alignItems: 'center',
	},
	transactionModalCloseText: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 16,
	},
	// Legacy styles (for backward compatibility)
	backdropTouchable: {
		flex: 1,
	},
	scrollContainer: {
		maxHeight: screenHeight * 0.9,
	},
	backButton: {
		backgroundColor: '#6B7280',
	},
	deleteBtn: {
		backgroundColor: '#EF4444',
	},
	deleteBtnText: {
		color: '#FFFFFF',
		fontWeight: '500',
		fontSize: 16,
	},
})
