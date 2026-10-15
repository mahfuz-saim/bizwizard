// @dead-code — 2026-09-24 knip+grep: 0 active imports, candidate for removal (kept per request)
import {
	View,
	Text,
	Modal,
	TouchableOpacity,
	StyleSheet,
	Dimensions,
	ToastAndroid,
} from 'react-native'
import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { FlashList } from '@shopify/flash-list'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import SearchBar from '../searchBar'
import useApi from '../../hooks/useApi'
import { getAllCustomer } from '../../controllers/customer'
import ContentLoader, { Rect } from 'react-content-loader/native'

const { height: screenHeight } = Dimensions.get('window')

// Skeleton Loader Component
const CustomerSkeletonLoader = memo(() => (
	<ContentLoader
		speed={2}
		width={400}
		height={60}
		viewBox="0 0 400 60"
		backgroundColor="#f3f3f3"
		foregroundColor="#ecebeb"
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
const CustomerRow = memo(({ data, onPress, isSelected, loc }) => {
	const { translatePhone } = useNumberTranslator()

	const handlePress = useCallback(() => {
		if (data.id && onPress) {
			onPress(data)
		}
	}, [data.id, data, onPress])

	return (
		<TouchableOpacity
			onPress={handlePress}
			style={[styles.customerRow, isSelected && styles.selectedCustomerRow]}
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
				<MaterialIcons name="check-circle" size={24} color="#2563EB" />
			)}
		</TouchableOpacity>
	)
})

export default function CustomerSelection({
	visible,
	onClose,
	onCustomerSelect,
	selectedCustomer,
}) {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const [customerData, setCustomerData] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [page, setPage] = useState(1)
	const [hasNextPage, setHasNextPage] = useState(true)
	const [isFetchingMore, setIsFetchingMore] = useState(false)
	const [searchTerm, setSearchTerm] = useState('')
	const [selectedCustomerData, setSelectedCustomerData] =
		useState(selectedCustomer)

	// Use ref to prevent continuous re-fetching
	const isFetchingRef = useRef(false)
	const hasInitializedRef = useRef(false)
	const limit = 10

	// Reset search when modal opens
	useEffect(() => {
		if (visible && !hasInitializedRef.current) {
			fetchCustomers()
		}
	}, [visible])

	// Reset to first page when search changes
	useEffect(() => {
		if (!hasInitializedRef.current) return
		setPage(1)
		setHasNextPage(true)
		handleSearch(1, true)
	}, [searchTerm])

	const handleSearch = useCallback(
		async (pageToFetch = page, isReset = false) => {
			const params = {
				searchTerm: searchTerm,
				limit,
				page: pageToFetch,
			}
			try {
				if (isReset) setIsLoading(true)
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
				setIsLoading(false)
				setIsFetchingMore(false)
			}
		},
		[searchTerm, fetchData, limit]
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
				console.error('CustomerSelection - Error fetching customers:', err)
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
		if (isLoading || isFetchingMore || !hasNextPage || isFetchingRef.current)
			return
		const nextPage = page + 1
		setPage(nextPage)
		handleSearch(nextPage, false)
	}, [isLoading, isFetchingMore, hasNextPage, page, handleSearch])

	// Handle customer selection
	const handleCustomerPress = useCallback((customer) => {
		setSelectedCustomerData(customer)
	}, [])

	// Handle confirm selection
	const handleConfirmSelection = useCallback(() => {
		if (selectedCustomerData && onCustomerSelect) {
			onCustomerSelect(selectedCustomerData)
			onClose()
		}
	}, [selectedCustomerData, onCustomerSelect, onClose])

	// Memoized render item function for FlashList
	const renderCustomerItem = useCallback(
		({ item }) => (
			<CustomerRow
				data={item}
				onPress={handleCustomerPress}
				isSelected={selectedCustomerData?.id === item.id}
				loc={loc}
			/>
		),
		[handleCustomerPress, selectedCustomerData?.id, loc]
	)

	// Memoized refresh handler
	const handleRefresh = useCallback(() => {
		hasInitializedRef.current = false
		fetchCustomers(true)
	}, [fetchCustomers])

	return (
		<Modal
			transparent={true}
			visible={visible}
			animationType="fade"
			onRequestClose={onClose}
		>
			<View style={styles.modalContainer}>
				<TouchableOpacity
					style={styles.backdrop}
					activeOpacity={1}
					onPress={onClose}
				/>
				<View style={styles.modalContent}>
					<View style={styles.header}>
						<Text style={styles.headerTitle}>
							{loc.t('customer.selectCustomer') || 'Select Customer'}
						</Text>
						<TouchableOpacity
							onPress={onClose}
							style={styles.closeButton}
							activeOpacity={0.7}
						>
							<MaterialIcons name="close" size={20} color="#6B7280" />
						</TouchableOpacity>
					</View>

					{/* Search Bar */}
					<View style={styles.searchContainer}>
						<SearchBar
							fetchSearchData={(term) => setSearchTerm(term)}
							onSelect={() => {}}
							placeholder={
								loc.t('customer.searchPlaceholder') || 'Search customers...'
							}
							renderItem={() => null}
							debounceDelay={800}
							showSearchResult={false}
						/>
					</View>

					{/* Customer List */}
					<View style={styles.listContainer}>
						{isLoading && !hasInitializedRef.current ? (
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
								keyExtractor={(item) => item.id}
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

					{/* Action Buttons */}
					<View style={styles.buttonContainer}>
						<TouchableOpacity
							onPress={onClose}
							style={[styles.button, styles.cancelButton]}
							activeOpacity={0.8}
						>
							<Text style={styles.cancelButtonText}>
								{loc.t('customer.cancel') || 'Cancel'}
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							onPress={handleConfirmSelection}
							style={[
								styles.button,
								styles.selectButton,
								!selectedCustomerData && styles.disabledButton,
							]}
							activeOpacity={0.8}
							disabled={!selectedCustomerData}
						>
							<Text
								style={[
									styles.selectButtonText,
									!selectedCustomerData && styles.disabledButtonText,
								]}
							>
								{loc.t('customer.select') || 'Select'}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	backdrop: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	modalContent: {
		backgroundColor: '#FFFFFF',
		margin: 20,
		borderRadius: 16,
		maxHeight: screenHeight * 0.8,
		width: '90%',
		maxWidth: 500,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
		flex: 1,
		maxHeight: screenHeight * 0.8,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#111827',
		flex: 1,
		marginRight: 8,
	},
	closeButton: {
		width: 32,
		height: 32,
		backgroundColor: '#F3F4F6',
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	searchContainer: {
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
	},
	listContainer: {
		flex: 1,
		paddingHorizontal: 16,
	},
	loadingContainer: {
		paddingVertical: 16,
	},
	skeletonItem: {
		marginBottom: 8,
	},
	footerLoading: {
		padding: 16,
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
	},
	customerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 12,
		paddingHorizontal: 16,
		marginVertical: 4,
		backgroundColor: '#F9FAFB',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	selectedCustomerRow: {
		backgroundColor: '#EFF6FF',
		borderColor: '#2563EB',
		borderWidth: 2,
	},
	customerInfo: {
		flex: 1,
		marginRight: 12,
	},
	customerName: {
		fontSize: 16,
		fontWeight: '600',
		color: '#111827',
		marginBottom: 2,
	},
	customerDetails: {
		fontSize: 14,
		color: '#6B7280',
	},
	buttonContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 16,
		borderTopWidth: 1,
		borderTopColor: '#E5E7EB',
		backgroundColor: '#FAFAFA',
	},
	button: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	cancelButton: {
		backgroundColor: '#E5E7EB',
		marginRight: 8,
	},
	selectButton: {
		backgroundColor: '#2563EB',
		marginLeft: 8,
	},
	disabledButton: {
		backgroundColor: '#D1D5DB',
		opacity: 0.5,
	},
	cancelButtonText: {
		color: '#374151',
		fontSize: 16,
		fontWeight: '600',
	},
	selectButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	disabledButtonText: {
		color: '#9CA3AF',
	},
})
