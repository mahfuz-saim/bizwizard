import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
	ToastAndroid,
	Platform,
	BackHandler,
} from 'react-native'
import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react'
import { FlashList } from '@shopify/flash-list'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import useApi from '../../hooks/useApi'
import { debtController } from '../../controllers/debt'
import { getAllCustomer } from '../../controllers/customer'
import SearchBar from '../searchBar'
import ContentLoader, { Rect } from 'react-content-loader/native'
import {
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetBackdrop,
	BottomSheetTextInput,
	BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CloseModal } from '../AlertModal'

const { height: screenHeight } = Dimensions.get('window')

// Skeleton Loader Component
const CustomerSkeletonLoader = memo(() => (
	<ContentLoader
		speed={2}
		width={400}
		height={60}
		viewBox="0 0 400 60"
		backgroundColor="#E5E7EB"
		foregroundColor="#F3F4F6"
	>
		<Rect x="0" y="10" rx="3" ry="3" width="120" height="15" />
		<Rect x="140" y="10" rx="3" ry="3" width="80" height="15" />
		<Rect x="240" y="10" rx="3" ry="3" width="100" height="15" />
		<Rect x="0" y="35" rx="3" ry="3" width="100" height="10" />
		<Rect x="140" y="35" rx="3" ry="3" width="70" height="10" />
		<Rect x="240" y="35" rx="3" ry="3" width="90" height="10" />
	</ContentLoader>
))

// Memoized Customer Row Component
const CustomerRow = memo(({ data, onPress, isSelected, translatePhone }) => {
	const handlePress = useCallback(() => {
		if (data.buyerID && onPress) {
			onPress(data)
		}
	}, [data.buyerID, data, onPress])

	return (
		<TouchableOpacity
			onPress={handlePress}
			style={[styles.customerItem, isSelected && styles.selectedCustomerItem]}
			activeOpacity={0.7}
		>
			<View style={styles.customerInfo}>
				<Text style={styles.customerName} numberOfLines={1}>
					{data.name}
				</Text>
				<Text style={styles.customerDetails} numberOfLines={1}>
					{translatePhone(data.number)} • {data.address}
				</Text>
			</View>
			{isSelected && (
				<MaterialIcons name="check-circle" size={20} color="#059669" />
			)}
		</TouchableOpacity>
	)
})

export default function AddPreviousDebt({ visible, onClose }) {
	const { loc } = useLocalization()
	const { translateAmount, translatePhone } = useNumberTranslator()
	const { fetchData } = useApi()
	const insets = useSafeAreaInsets()

	// Bottom Sheet Modal ref
	const bottomSheetModalRef = useRef(null)

	// Snap points for bottom sheet
	const snapPoints = useMemo(() => ['65%', '90%'], [])

	const [showCustomerSelection, setShowCustomerSelection] = useState(false)
	const [selectedCustomer, setSelectedCustomer] = useState(null)
	const [totalAmount, setTotalAmount] = useState('')
	const [paidAmount, setPaidAmount] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [showCloseModal, setShowCloseModal] = useState(false)

	// Customer selection states - exactly like CustomerSelection component
	const [customerData, setCustomerData] = useState([])
	const [isLoadingCustomers, setIsLoadingCustomers] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [page, setPage] = useState(1)
	const [hasNextPage, setHasNextPage] = useState(true)
	const [isFetchingMore, setIsFetchingMore] = useState(false)
	const [searchTerm, setSearchTerm] = useState('')
	const [selectedCustomerData, setSelectedCustomerData] = useState(null)

	// Use ref to prevent continuous re-fetching
	const isFetchingRef = useRef(false)
	const hasInitializedRef = useRef(false)
	const limit = 10

	useEffect(() => {
		if (visible) {
			setShowCustomerSelection(false)
			setSelectedCustomer(null)
			setSelectedCustomerData(null)
			setTotalAmount('')
			setPaidAmount('')
			setSearchTerm('')
			setPage(1)
			setHasNextPage(true)
			hasInitializedRef.current = false
			// Small delay to ensure proper mounting
			const timer = setTimeout(() => {
				bottomSheetModalRef.current?.present()
			}, 50)
			return () => clearTimeout(timer)
		} else {
			bottomSheetModalRef.current?.dismiss()
		}
	}, [visible])

	// Reset search when customer selection is shown
	useEffect(() => {
		if (showCustomerSelection && !hasInitializedRef.current) {
			fetchCustomers()
		}
	}, [showCustomerSelection])

	// Reset to first page when search changes
	useEffect(() => {
		if (!hasInitializedRef.current || !showCustomerSelection) return
		setPage(1)
		setHasNextPage(true)
		handleSearch(1, true)
	}, [searchTerm])

	const resetForm = () => {
		setSelectedCustomer(null)
		setSelectedCustomerData(null)
		setTotalAmount('')
		setPaidAmount('')
		setShowCustomerSelection(false)
		setSearchTerm('')
		setCustomerData([])
		setPage(1)
		setHasNextPage(true)
		hasInitializedRef.current = false
	}

	const closeModal = useCallback(() => {
		bottomSheetModalRef.current?.dismiss()
		// Small delay before calling onClose to let animation finish
		setTimeout(() => {
			resetForm()
			onClose()
		}, 150)
	}, [onClose])

	const hasFormData = useCallback(() => {
		return Boolean(
			selectedCustomer || totalAmount?.trim() || paidAmount?.trim()
		)
	}, [selectedCustomer, totalAmount, paidAmount])

	const handleCloseWithConfirmation = useCallback(() => {
		if (!hasFormData()) {
			closeModal()
			return
		}
		setShowCloseModal(true)
	}, [closeModal, hasFormData])

	const handleHardwareBackPress = useCallback(() => {
		if (showCustomerSelection) {
			setShowCustomerSelection(false)
			setSelectedCustomerData(null)
			return true
		}
		handleCloseWithConfirmation()
		return true
	}, [showCustomerSelection, handleCloseWithConfirmation])

	useEffect(() => {
		if (!visible) return

		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			handleHardwareBackPress
		)

		return () => backHandler.remove()
	}, [visible, handleHardwareBackPress])

	const handleCustomerSelect = (customer) => {
		setSelectedCustomerData(customer)
	}

	const handleConfirmCustomerSelection = () => {
		if (selectedCustomerData) {
			setSelectedCustomer(selectedCustomerData)
			setShowCustomerSelection(false)
			setSearchTerm('')
			setSelectedCustomerData(null)
		}
	}

	const handleShowCustomerSelection = () => {
		setShowCustomerSelection(true)
		setSelectedCustomerData(selectedCustomer)
	}

	const handleBackToForm = () => {
		setShowCustomerSelection(false)
		setSelectedCustomerData(null)
	}

	// Customer fetching logic - exactly like CustomerSelection component
	const handleSearch = useCallback(
		async (pageToFetch = page, isReset = false) => {
			const params = {
				searchTerm: searchTerm,
				limit,
				page: pageToFetch,
			}
			try {
				if (isReset) setIsLoadingCustomers(true)
				else setIsFetchingMore(true)
				const result = await fetchData(getAllCustomer, params)
				if (!result?.success) throw 'API Error'
				const newData = result?.data?.data || []

				if (isReset) {
					setCustomerData(newData)
				} else {
					setCustomerData((prev) => [...prev, ...newData])
				}
				// If less than limit, no more pages
				setHasNextPage(newData.length === limit)
			} catch (err) {
				console.error('🚀 err : ', err)
				ToastAndroid.show(
					loc.t('customer.fetchError') || 'Failed to fetch customers',
					ToastAndroid.SHORT
				)
			} finally {
				setIsLoadingCustomers(false)
				setIsFetchingMore(false)
			}
		},
		[searchTerm, fetchData, limit, page]
	)

	// Stable fetch function for pull-to-refresh
	const fetchCustomers = useCallback(
		async (isRefresh = false) => {
			if (isFetchingRef.current) return
			isFetchingRef.current = true
			setIsRefreshing(true)
			try {
				await handleSearch(1, true)
				setPage(1)
				setHasNextPage(true)
				hasInitializedRef.current = true
			} catch (err) {
				console.error('AddPreviousDebt - Error fetching customers:', err)
				ToastAndroid.show(
					loc.t('customer.fetchError') || 'Failed to fetch customers',
					ToastAndroid.SHORT
				)
			} finally {
				setIsRefreshing(false)
				isFetchingRef.current = false
			}
		},
		[handleSearch, loc]
	)

	// Infinite scroll handler
	const handleEndReached = useCallback(() => {
		if (
			isLoadingCustomers ||
			isFetchingMore ||
			!hasNextPage ||
			isFetchingRef.current
		)
			return
		const nextPage = page + 1
		setPage(nextPage)
		handleSearch(nextPage, false)
	}, [isLoadingCustomers, isFetchingMore, hasNextPage, page, handleSearch])

	// Memoized refresh handler
	const handleRefresh = useCallback(() => {
		hasInitializedRef.current = false
		fetchCustomers(true)
	}, [fetchCustomers])

	// Memoized render item function for FlashList
	const renderCustomerItem = useCallback(
		({ item }) => (
			<CustomerRow
				data={item}
				onPress={handleCustomerSelect}
				isSelected={selectedCustomerData?.buyerID === item.buyerID}
				translatePhone={translatePhone}
			/>
		),
		[handleCustomerSelect, selectedCustomerData?.buyerID, translatePhone]
	)

	// Customer selection functions
	const handleSelectCustomer = () => {
		setShowCustomerSelection(true)
	}

	const calculateRemainingDebt = () => {
		const total = parseFloat(totalAmount) || 0
		const paid = parseFloat(paidAmount) || 0
		return Math.max(0, total - paid)
	}

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

	// Keyboard listeners: expand the sheet when keyboard shows

	const canSave =
		selectedCustomer && totalAmount && parseFloat(totalAmount) > 0 && !isLoading

	// Render backdrop component
	const renderBackdrop = useCallback(
		(props) => (
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
		(index) => {
			if (index === -1) {
				// Only trigger close confirmation if we have form data
				if (hasFormData()) {
					handleCloseWithConfirmation()
				} else {
					onClose()
				}
			}
		},
		[handleCloseWithConfirmation, hasFormData, onClose]
	)

	// Render backdrop for customer selection sheet
	const renderCustomerBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="none"
				onPress={() => {
					if (showCustomerSelection) {
						handleBackToForm()
					} else {
						handleCloseWithConfirmation()
					}
				}}
			/>
		),
		[showCustomerSelection, handleCloseWithConfirmation]
	)

	const handleSaveDebt = async () => {
		if (!canSave) return

		setIsLoading(true)

		try {
			const debtData = {
				buyerId: selectedCustomer.buyerID,
				amount: parseFloat(totalAmount),
				paidAmount: parseFloat(paidAmount) || 0,
			}

			const response = await fetchData(debtController.addPreviousDebt, debtData)

			if (response && response.success) {
				ToastAndroid.show(
					loc.t('debt.debtSavedSuccessfully') ||
						'Debt has been saved successfully',
					ToastAndroid.SHORT
				)
				closeModal()
			} else {
				throw new Error(response?.message || 'Failed to save debt')
			}
		} catch (error) {
			console.error('Error saving debt:', error)
			ToastAndroid.show(
				error.message ||
					loc.t('debt.failedToSaveDebt') ||
					'Failed to save debt. Please try again.',
				ToastAndroid.SHORT
			)
		} finally {
			setIsLoading(false)
		}
	}

	// Don't render if not visible to avoid mounting issues
	if (!visible) return null

	// compute max dynamic content size as 90% of window height
	const maxDynamicContentSize = Math.round(screenHeight * 0.9)

	return (
		<>
			{/* Single Bottom Sheet with conditional content */}
			<BottomSheetModal
				ref={bottomSheetModalRef}
				snapPoints={snapPoints}
				enablePanDownToClose={false}
				backdropComponent={renderCustomerBackdrop}
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
								{showCustomerSelection
									? loc.t('debt.selectCustomer') || 'Select Customer'
									: loc.t('debt.addPreviousDebt') || 'Add Previous Debt'}
							</Text>
						</View>
						<TouchableOpacity
							onPress={() =>
								showCustomerSelection
									? handleBackToForm()
									: handleCloseWithConfirmation()
							}
							style={styles.closeButton}
							activeOpacity={0.7}
						>
							<MaterialIcons name="close" size={16} color="#6B7280" />
						</TouchableOpacity>
					</View>
				</View>

				<View style={styles.keyboardAvoidingView}>
					<BottomSheetScrollView
						showsVerticalScrollIndicator={false}
						bounces={true}
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={styles.scrollContent}
					>
						<View style={styles.container}>
							{showCustomerSelection ? (
								// Customer Selection View
								<>
									{/* Search Bar */}
									<View style={styles.searchContainer}>
										<SearchBar
											fetchSearchData={(term) => setSearchTerm(term)}
											onSelect={() => {}}
											placeholder={
												loc.t('customer.searchPlaceholder') ||
												'Search customers...'
											}
											renderItem={() => null}
											debounceDelay={800}
											showSearchResult={false}
										/>
									</View>

									{/* Customer List */}
									<View style={styles.listContainer}>
										{isLoadingCustomers && !hasInitializedRef.current ? (
											<View style={styles.loadingContainer}>
												{[...Array(5)].map((_, index) => (
													<View key={index} style={styles.skeletonItem}>
														<CustomerSkeletonLoader />
													</View>
												))}
											</View>
										) : (
											<FlashList
												data={customerData}
												renderItem={renderCustomerItem}
												keyExtractor={(item) =>
													item.buyerID?.toString() || item.id?.toString()
												}
												showsVerticalScrollIndicator={false}
												refreshing={isRefreshing}
												onRefresh={handleRefresh}
												onEndReached={handleEndReached}
												onEndReachedThreshold={0.5}
												ListFooterComponent={
													isFetchingMore && hasNextPage ? (
														<View style={styles.footerLoading}>
															<CustomerSkeletonLoader />
														</View>
													) : null
												}
												ListEmptyComponent={() => (
													<View style={styles.emptyContainer}>
														<MaterialIcons
															name="person-outline"
															size={48}
															color="#D1D5DB"
														/>
														<Text style={styles.emptyText}>
															{searchTerm
																? loc.t('customer.noCustomersFound') ||
																	'No customers found'
																: loc.t('customer.noCustomersYet') ||
																	'No customers yet'}
														</Text>
													</View>
												)}
											/>
										)}
									</View>

									{/* Select Button - Full Width */}
									<View style={styles.buttonContainer}>
										<TouchableOpacity
											onPress={handleConfirmCustomerSelection}
											style={[
												styles.button,
												selectedCustomerData
													? styles.selectButton
													: styles.disabledButton,
											]}
											activeOpacity={selectedCustomerData ? 0.8 : 1}
											disabled={!selectedCustomerData}
										>
											<Text
												style={[
													selectedCustomerData
														? styles.selectButtonText
														: styles.disabledButtonText,
												]}
											>
												{loc.t('customer.select') || 'Select'}
											</Text>
										</TouchableOpacity>
									</View>
								</>
							) : (
								// Debt Form View
								<>
									{/* Customer Selection */}
									<View style={styles.fieldContainer}>
										{selectedCustomer ? (
											<>
												<View style={styles.infoRow}>
													<View style={styles.infoLabelContainer}>
														<MaterialIcons
															name="person"
															size={16}
															color="#195FE1"
															style={styles.infoIcon}
														/>
														<Text style={styles.infoLabel}>
															{loc.t('debt.customerName') || 'Customer Name'}
														</Text>
													</View>
													<Text style={styles.infoValue}>
														{selectedCustomer.name}
													</Text>
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
															{loc.t('debt.customerNumber') || 'Phone Number'}
														</Text>
													</View>
													<Text style={styles.infoValue}>
														{selectedCustomer.number || '-'}
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
															{loc.t('debt.customerAddress') || 'Address'}
														</Text>
													</View>
													<Text style={styles.infoValue}>
														{selectedCustomer.address || '-'}
													</Text>
												</View>

												<TouchableOpacity
													onPress={handleShowCustomerSelection}
													style={styles.changeCustomerButton}
													activeOpacity={0.8}
												>
													<MaterialIcons
														name="edit"
														size={16}
														color="#FFFFFF"
													/>
													<Text style={styles.changeCustomerButtonText}>
														{loc.t('debt.changeCustomer') || 'Change Customer'}
													</Text>
												</TouchableOpacity>
											</>
										) : (
											<TouchableOpacity
												onPress={handleShowCustomerSelection}
												style={styles.selectCustomerButton}
												activeOpacity={0.8}
											>
												<MaterialIcons
													name="person-add"
													size={20}
													color="#195FE1"
												/>
												<Text style={styles.selectCustomerButtonText}>
													{loc.t('debt.selectCustomer') || 'Select Customer'}
												</Text>
											</TouchableOpacity>
										)}
									</View>

									{/* Debt Information */}
									<View style={styles.fieldContainer}>
										{/* Total Amount Input */}
										<View style={styles.inputContainer}>
											<Text style={styles.overlayLabel}>
												{loc.t('debt.totalAmount') || 'Total Amount'} *
											</Text>
											<BottomSheetTextInput
												style={styles.amountInput}
												value={totalAmount}
												onChangeText={setTotalAmount}
												placeholder={
													loc.t('debt.enterTotalAmount') || 'Enter total amount'
												}
												keyboardType="numeric"
												placeholderTextColor="rgba(0,0,0,0.54)"
												onFocus={() => expandToTop()}
												returnKeyType="next"
											/>
										</View>

										{/* Paid Amount Input */}
										<View style={styles.inputContainer}>
											<Text style={styles.overlayLabel}>
												{loc.t('debt.paidAmount') || 'Paid Amount'}
											</Text>
											<BottomSheetTextInput
												style={styles.amountInput}
												value={paidAmount}
												onChangeText={setPaidAmount}
												placeholder={
													loc.t('debt.enterPaidAmount') || 'Enter paid amount'
												}
												keyboardType="numeric"
												placeholderTextColor="rgba(0,0,0,0.54)"
												onFocus={() => expandToTop()}
												returnKeyType="done"
											/>
										</View>

										{/* Remaining Debt Display */}
										{totalAmount && (
											<View style={styles.remainingDebtContainer}>
												<Text style={styles.remainingDebtLabel}>
													{loc.t('debt.remainingDebt') || 'Remaining Debt'}:
												</Text>
												<Text style={styles.remainingDebtAmount}>
													{translateAmount(calculateRemainingDebt())}
												</Text>
											</View>
										)}
									</View>

									{/* Action Button - Full Width */}
									<View style={styles.buttonContainer}>
										<TouchableOpacity
											onPress={handleSaveDebt}
											style={[
												styles.button,
												canSave ? styles.saveButton : styles.disabledButton,
											]}
											activeOpacity={canSave ? 0.8 : 1}
											disabled={!canSave}
										>
											<Text
												style={[
													canSave
														? styles.saveButtonText
														: styles.disabledButtonText,
												]}
											>
												{isLoading
													? loc.t('general.saving') || 'Saving...'
													: loc.t('debt.saveDebt') || 'Save Debt'}
											</Text>
										</TouchableOpacity>
									</View>
								</>
							)}
						</View>
					</BottomSheetScrollView>
				</View>
			</BottomSheetModal>

			{/* Close Confirmation Modal */}
			<CloseModal
				visible={showCloseModal}
				onClose={() => setShowCloseModal(false)}
				onConfirm={() => {
					setShowCloseModal(false)
					closeModal()
				}}
				title={loc.t('debt.discardChanges') || undefined}
				subtitle={
					loc.t('debt.sureToClose') ||
					'Are you sure you want to close without saving?'
				}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF', // AliceBlue like CustomerForm
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
		color: '#195FE1', // Primary color for header text
	},
	closeButton: {
		width: 28,
		height: 28,
		backgroundColor: '#E5E7EB',
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
	fieldContainer: {
		padding: 12,
		borderRadius: 12,
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(25, 95, 225, 0.15)',
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
	selectCustomerButton: {
		backgroundColor: 'transparent',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderRadius: 8,
		borderWidth: 2,
		borderColor: '#195FE1',
		gap: 8,
	},
	selectCustomerButtonText: {
		color: '#195FE1',
		fontSize: 16,
		fontWeight: '600',
	},
	changeCustomerButton: {
		backgroundColor: '#059669',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
		gap: 6,
		marginTop: 12,
	},
	changeCustomerButtonText: {
		color: '#FFFFFF',
		fontSize: 14,
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
	remainingDebtContainer: {
		backgroundColor: 'rgba(25, 95, 225, 0.1)',
		padding: 16,
		borderRadius: 8,
		marginTop: 8,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		width: '100%',
	},
	remainingDebtLabel: {
		fontSize: 14,
		color: '#195FE1',
		fontWeight: '500',
	},
	remainingDebtAmount: {
		fontSize: 16,
		color: '#195FE1',
		fontWeight: 'bold',
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		marginTop: 12,
		paddingBottom: 8,
		paddingHorizontal: 12,
	},
	button: {
		padding: 12,
		borderRadius: 24,
		width: '100%',
		alignItems: 'center',
	},
	saveButton: {
		backgroundColor: '#195FE1',
	},
	selectButton: {
		backgroundColor: '#195FE1',
	},
	disabledButton: {
		backgroundColor: 'transparent',
		borderWidth: 1,
		borderColor: '#195FE1',
	},
	saveButtonText: {
		color: '#ffffff',
		fontWeight: '500',
		fontSize: 16,
	},
	selectButtonText: {
		color: '#ffffff',
		fontWeight: '500',
		fontSize: 16,
	},
	disabledButtonText: {
		color: '#195FE1',
		fontWeight: '500',
		fontSize: 16,
	},
	searchContainer: {
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(25, 95, 225, 0.15)',
	},
	listContainer: {
		flex: 1,
		paddingHorizontal: 16,
		minHeight: 300,
	},
	customerItem: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 12,
		paddingHorizontal: 16,
		marginVertical: 4,
		marginHorizontal: 0,
		backgroundColor: 'rgba(25, 95, 225, 0.05)',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(25, 95, 225, 0.15)',
	},
	selectedCustomerItem: {
		backgroundColor: 'rgba(5, 150, 105, 0.15)',
		borderColor: '#059669',
		borderWidth: 2,
	},
	customerInfo: {
		flex: 1,
		marginRight: 12,
	},
	customerName: {
		fontSize: 16,
		fontWeight: '600',
		color: '#333333',
		marginBottom: 2,
	},
	customerDetails: {
		fontSize: 14,
		color: '#6B7280',
	},
	loadingContainer: {
		paddingVertical: 16,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingVertical: 40,
	},
	emptyText: {
		fontSize: 16,
		color: '#6B7280',
		textAlign: 'center',
		marginTop: 8,
	},
	skeletonItem: {
		marginBottom: 8,
	},
	footerLoading: {
		padding: 16,
	},
})
