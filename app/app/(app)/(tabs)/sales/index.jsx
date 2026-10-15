import { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react'
import {
	Text,
	View,
	FlatList,
	TouchableOpacity,
	Modal,
	StyleSheet,
	ActivityIndicator,
	RefreshControl,
	ToastAndroid,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import ContentLoader, { Rect } from 'react-content-loader/native'
import useApi from '../../../../src/hooks/useApi'
import { salesController } from '../../../../src/controllers/sales'
import { useLocalization } from '../../../../src/localization/localizationContext'
import useNumberTranslator from '../../../../src/hooks/useNumberTranslator'
import { FlashList } from '@shopify/flash-list'
import { useFocusEffect } from 'expo-router'

const SaleItemSkeleton = memo(() => (
	<View style={styles.skeletonContainer}>
		<ContentLoader
			speed={2}
			width={320}
			height={80}
			viewBox="0 0 320 80"
			backgroundColor="#f3f3f3"
			foregroundColor="#ecebeb"
		>
			<Rect x="16" y="16" rx="4" ry="4" width="200" height="16" />
			<Rect x="16" y="40" rx="4" ry="4" width="120" height="12" />
			<Rect x="240" y="16" rx="4" ry="4" width="64" height="16" />
		</ContentLoader>
	</View>
))

const SaleItem = memo(
	({ sale, onPress, formatPrice, loc, translateNumber }) => {
		const handlePress = useCallback(() => {
			onPress(sale)
		}, [sale, onPress])

		return (
			<TouchableOpacity onPress={handlePress} style={styles.saleItem}>
				<View style={styles.saleItemContent}>
					<View style={styles.saleItemRow}>
						<View style={styles.saleItemLeft}>
							<Text style={styles.shopName} numberOfLines={1}>
								{sale?.buyer?.Shops[0]?.name || loc.t('sales.walkingBy')}
							</Text>
							<Text style={styles.saleSubtext} numberOfLines={1}>
								{loc.t('sales.qty')}:{' '}
								{translateNumber(sale.totalQuantity.toString())} •{' '}
								{loc.t('sales.status')}: {sale.status}
							</Text>
						</View>
						<Text style={styles.priceText}>{formatPrice(sale.totalPrice)}</Text>
					</View>
				</View>
			</TouchableOpacity>
		)
	}
)

const DateSection = memo(({ item, renderSaleItem }) => (
	<View style={styles.dateSection}>
		<View style={styles.dateHeader}>
			<Text style={styles.dateText}>{item.formattedDate}</Text>
		</View>
		<FlatList
			data={item.sales}
			renderItem={renderSaleItem}
			keyExtractor={keyExtractor}
			scrollEnabled={false}
			removeClippedSubviews={true}
			initialNumToRender={10}
			maxToRenderPerBatch={5}
			windowSize={10}
			getItemLayout={getItemLayout}
		/>
	</View>
))

// Memoized modal content
const SaleModal = memo(
	({
		visible,
		selectedSale,
		onClose,
		formatPrice,
		formatDate,
		formatTime,
		formatDiscount,
		loc,
		translateNumber,
	}) => {
		if (!selectedSale) return null

		return (
			<Modal
				visible={visible}
				transparent={true}
				animationType="fade"
				onRequestClose={onClose}
				statusBarTranslucent={true}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>
								{loc.t('sales.saleDetails')}
							</Text>
							<TouchableOpacity onPress={onClose} style={styles.closeButton}>
								<MaterialIcons name="close" size={24} color="#6B7280" />
							</TouchableOpacity>
						</View>

						<View style={styles.modalBody}>
							<View style={styles.detailRow}>
								<Text style={styles.detailLabel}>
									{loc.t('sales.dateTime')}:
								</Text>
								<Text style={styles.detailValue}>
									{formatDate(selectedSale.createdAt)}{' '}
									{formatTime(selectedSale.createdAt)}
								</Text>
							</View>

							<View style={styles.detailRow}>
								<Text style={styles.detailLabel}>
									{loc.t('sales.customer')}:
								</Text>
								<Text style={styles.detailValue}>
									{selectedSale.buyerID
										? selectedSale?.buyer?.name
										: loc.t('sales.walkingBy')}
								</Text>
							</View>

							<View style={styles.detailRow}>
								<Text style={styles.detailLabel}>
									{loc.t('sales.totalQuantity')}:
								</Text>
								<Text style={styles.detailValue}>
									{translateNumber(selectedSale.totalQuantity.toString())}
								</Text>
							</View>

							<View style={styles.detailRow}>
								<Text style={styles.detailLabel}>
									{loc.t('sales.totalPrice')}:
								</Text>
								<Text style={styles.priceDetailValue}>
									{formatPrice(selectedSale.totalPrice)}
								</Text>
							</View>

							<View style={styles.detailRow}>
								<Text style={styles.detailLabel}>
									{loc.t('sales.discount')}:
								</Text>
								<Text style={styles.detailValue}>
									{formatDiscount(
										selectedSale.totalDiscount,
										selectedSale.discountType
									)}
								</Text>
							</View>

							<View style={styles.detailRow}>
								<Text style={styles.detailLabel}>{loc.t('sales.status')}:</Text>
								<Text
									style={[
										styles.detailValue,
										selectedSale.status === 'PAID'
											? styles.paidStatus
											: styles.unpaidStatus,
									]}
								>
									{selectedSale.status}
								</Text>
							</View>
						</View>

						<TouchableOpacity onPress={onClose} style={styles.closeModalButton}>
							<Text style={styles.closeModalText}>{loc.t('sales.close')}</Text>
						</TouchableOpacity>
					</View>
				</View>
			</Modal>
		)
	}
)

// Optimized key extractor
const keyExtractor = (item) => item.id

// Optimized getItemLayout for better performance
const getItemLayout = (data, index) => ({
	length: 88, // Height of sale item + margin
	offset: 88 * index,
	index,
})

export default function Sales() {
	const { fetchData } = useApi()
	const { loc } = useLocalization()
	const { translateNumber, translateAmount } = useNumberTranslator()
	const [prevSales, setPrevSales] = useState([])
	const [modalVisible, setModalVisible] = useState(false)
	const [selectedSale, setSelectedSale] = useState(null)
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [loadingMore, setLoadingMore] = useState(false)
	const [page, setPage] = useState(1)
	const [hasMore, setHasMore] = useState(true)
	const [lastFetchTime, setLastFetchTime] = useState(null)
	const [dataHash, setDataHash] = useState('')
	const isMountedRef = useRef(false)
	const isCheckingFreshnessRef = useRef(false)
	const FRESHNESS_WINDOW_MS = 15000

	// Function to generate a simple hash of the data for comparison
	const generateDataHash = useCallback((data) => {
		if (!data || data.length === 0) return ''
		// Create a simple hash based on data length, first item, and last item
		const firstItem = data[0]
		const lastItem = data[data.length - 1]
		return `${data.length}-${firstItem?.id}-${firstItem?.updatedAt}-${lastItem?.id}-${lastItem?.updatedAt}`
	}, [])

	// Function to check if data has changed
	const checkDataFreshness = useCallback(async () => {
		if (isCheckingFreshnessRef.current) {
			return false
		}

		isCheckingFreshnessRef.current = true
		try {
			// Fetch just the first page to check for changes
			const res = await fetchData(salesController.getPreviousSales, {
				queries: { page: 1, limit: 50 },
			})

			if (res.success && res.data.data) {
				const newDataHash = generateDataHash(res.data.data)

				// If data has changed or this is the first load, update everything
				if (newDataHash !== dataHash || !isMountedRef.current) {
					setDataHash(newDataHash)
					setPrevSales(res.data.data)
					setPage(2) // Next page to load
					setHasMore(res.data.data.length === 50) // Assume more data if we got full page
					setLastFetchTime(Date.now())

					if (!isMountedRef.current) {
						isMountedRef.current = true
						setLoading(false)
					}

					return true // Data was updated
				}
			}
			return false // No changes
		} catch (err) {
			console.error('Error checking data freshness:', err)
			return false
		} finally {
			isCheckingFreshnessRef.current = false
		}
	}, [fetchData, dataHash, generateDataHash])

	// Focus effect to check for data changes when page comes into focus
	useFocusEffect(
		useCallback(() => {
			// Only check for freshness if component has been mounted before
			if (
				isMountedRef.current &&
				(!lastFetchTime || Date.now() - lastFetchTime > FRESHNESS_WINDOW_MS)
			) {
				checkDataFreshness()
			}
		}, [checkDataFreshness, lastFetchTime])
	)

	// Memoized format functions to prevent re-creation
	const formatPrice = useCallback(
		(price) => {
			return translateAmount(price)
		},
		[translateAmount]
	)

	const formatDate = useCallback(
		(dateString) => {
			const date = new Date(dateString)
			const formattedDate = date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			})
			return translateNumber(formattedDate)
		},
		[translateNumber]
	)

	const formatTime = useCallback(
		(dateString) => {
			const date = new Date(dateString)
			const formattedTime = date.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
			})
			return translateNumber(formattedTime)
		},
		[translateNumber]
	)

	const formatDiscount = useCallback(
		(discount, discountType) => {
			if (discountType === 'PERCENTAGE') {
				return `${translateNumber(discount.toString())}%`
			} else {
				return translateAmount(discount)
			}
		},
		[translateNumber, translateAmount]
	)

	// Memoized modal handlers
	const openModal = useCallback((sale) => {
		setSelectedSale(sale)
		setModalVisible(true)
	}, [])

	const closeModal = useCallback(() => {
		setModalVisible(false)
		setSelectedSale(null)
	}, [])

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		const dataUpdated = await checkDataFreshness()
		if (!dataUpdated) {
			// If no changes detected, still refresh to show user feedback
			await fetchPrevData(true)
		}
		setRefreshing(false)
	}, [checkDataFreshness, fetchPrevData])

	const fetchPrevData = useCallback(
		async (reset = false) => {
			const nextPage = reset ? 1 : page
			if (reset) {
				setLoading(true)
				setHasMore(true) // reset hasMore too
			} else {
				setLoadingMore(true)
			}

			try {
				const res = await fetchData(salesController.getPreviousSales, {
					queries: { page: nextPage, limit: 50 },
				})

				if (!res.success) {
					ToastAndroid.show(
						loc.t('sales.failedToFetchHistory') ||
							'Failed to fetch sales history',
						ToastAndroid.SHORT
					)
					if (reset) setPrevSales([])
					return
				}

				const newSales = res.data.data
				if (newSales.length > 0) {
					if (reset) {
						setPrevSales(newSales)
						const newDataHash = generateDataHash(newSales)
						setDataHash(newDataHash)
						setLastFetchTime(Date.now())
					} else {
						setPrevSales((prev) => [...prev, ...newSales])
					}
					setPage(nextPage + 1)
					setHasMore(true)
				} else {
					setHasMore(false)
				}
			} catch (err) {
				console.error('Error fetching txn:', err)
				ToastAndroid.show(
					loc.t('sales.failedToFetchHistory') ||
						'Failed to fetch sales history',
					ToastAndroid.SHORT
				)
				if (reset) setPrevSales([])
			} finally {
				setLoading(false)
				setLoadingMore(false)
				if (reset) setRefreshing(false)
			}
		},
		[page, fetchData, loc, generateDataHash]
	)

	// Initial data load
	useEffect(() => {
		checkDataFreshness()
	}, [])

	// Memoized grouped sales with pre-formatted dates
	const groupedSales = useMemo(() => {
		const grouped = prevSales.reduce((acc, sale) => {
			const date = new Date(sale.createdAt).toDateString()
			if (!acc[date]) {
				acc[date] = []
			}
			acc[date].push(sale)
			return acc
		}, {})

		return Object.keys(grouped)
			.sort((a, b) => new Date(b) - new Date(a))
			.map((date) => ({
				date,
				formattedDate: formatDate(date),
				sales: grouped[date],
			}))
	}, [prevSales, formatDate])

	// Memoized render functions
	const renderSaleItem = useCallback(
		({ item: sale }) => (
			<SaleItem
				sale={sale}
				onPress={openModal}
				formatPrice={formatPrice}
				loc={loc}
				translateNumber={translateNumber}
			/>
		),
		[openModal, formatPrice, loc, translateNumber]
	)

	const renderDateSection = useCallback(
		({ item }) => <DateSection item={item} renderSaleItem={renderSaleItem} />,
		[renderSaleItem]
	)

	const renderSkeletonItem = useCallback(() => <SaleItemSkeleton />, [])

	const dateKeyExtractor = useCallback((item) => item.date, [])

	if (loading) {
		return (
			<View style={styles.container}>
				<FlatList
					data={Array(8).fill({})}
					renderItem={renderSkeletonItem}
					keyExtractor={(_, index) => `skeleton-${index}`}
					showsVerticalScrollIndicator={false}
					contentContainerStyle={styles.contentContainer}
				/>
			</View>
		)
	}

	if (!loading && groupedSales.length === 0) {
		return (
			<View style={styles.container}>
				<View style={styles.emptyContainer}>
					<Text style={styles.emptyText}>
						{loc.t('sales.noSalesFound') || 'No sales found'}
					</Text>
				</View>
			</View>
		)
	}

	return (
		<View style={styles.container}>
			<FlashList
				data={groupedSales}
				renderItem={renderDateSection}
				keyExtractor={dateKeyExtractor}
				contentContainerStyle={styles.contentContainer}
				removeClippedSubviews={true}
				onEndReached={() => {
					if (hasMore && !loadingMore) fetchPrevData()
				}}
				onEndReachedThreshold={0.2}
				refreshControl={
					<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
				}
				ListFooterComponent={
					loading && !refreshing ? (
						<ActivityIndicator style={{ margin: 20 }} />
					) : null
				}
			/>
			<SaleModal
				visible={modalVisible}
				selectedSale={selectedSale}
				onClose={closeModal}
				formatPrice={formatPrice}
				formatDate={formatDate}
				formatTime={formatTime}
				formatDiscount={formatDiscount}
				loc={loc}
				translateNumber={translateNumber}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f8f9fa',
	},
	contentContainer: {
		paddingVertical: 16,
	},
	saleItem: {
		backgroundColor: '#ffffff',
		marginHorizontal: 16,
		marginBottom: 8,
		padding: 16,
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
		borderWidth: 1,
		borderColor: '#e5e7eb',
	},
	saleItemContent: {
		flex: 1,
	},
	saleItemRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	saleItemLeft: {
		flex: 1,
		marginRight: 16,
	},
	shopName: {
		fontSize: 16,
		fontWeight: '500',
		color: '#1f2937',
		marginBottom: 4,
	},
	saleSubtext: {
		fontSize: 14,
		color: '#6b7280',
	},
	priceText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#059669',
	},
	dateSection: {
		marginBottom: 16,
	},
	dateHeader: {
		backgroundColor: '#f3f4f6',
		marginHorizontal: 16,
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
	},
	dateText: {
		fontSize: 18,
		fontWeight: '600',
		color: '#374151',
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	modalContent: {
		backgroundColor: '#ffffff',
		margin: 16,
		borderRadius: 8,
		padding: 24,
		width: '90%',
		maxWidth: 400,
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 24,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#1f2937',
	},
	closeButton: {
		padding: 4,
	},
	modalBody: {
		gap: 16,
	},
	detailRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	detailLabel: {
		fontSize: 16,
		color: '#6b7280',
		flex: 1,
	},
	detailValue: {
		fontSize: 16,
		fontWeight: '500',
		color: '#1f2937',
		textAlign: 'right',
		flex: 1,
	},
	priceDetailValue: {
		fontSize: 16,
		fontWeight: '500',
		color: '#059669',
		textAlign: 'right',
		flex: 1,
	},
	paidStatus: {
		color: '#059669',
	},
	unpaidStatus: {
		color: '#d97706',
	},
	closeModalButton: {
		backgroundColor: '#3b82f6',
		marginTop: 32,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
	},
	closeModalText: {
		color: '#ffffff',
		textAlign: 'center',
		fontWeight: '600',
	},
	skeletonContainer: {
		backgroundColor: '#ffffff',
		marginHorizontal: 16,
		marginBottom: 8,
		padding: 16,
		borderRadius: 8,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
		borderWidth: 1,
		borderColor: '#e5e7eb',
	},
	emptyContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 32,
	},
	emptyText: {
		fontSize: 16,
		color: '#6b7280',
		textAlign: 'center',
	},
})
