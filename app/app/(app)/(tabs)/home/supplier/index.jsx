import {
	Text,
	TouchableOpacity,
	View,
	ToastAndroid,
	Linking,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import SearchBar from '../../../../../src/components/searchBar.jsx'
import { useCallback, useState, useMemo, memo, useRef, useEffect } from 'react'
import SupplierForm from '../../../../../src/components/supplier/supplierForm.tsx'
import SupplierDetails from '../../../../../src/components/supplier/supplierDetails.jsx'
import { useFocusEffect } from 'expo-router'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import {
	getAllSupplier,
	addSupplierToShop,
	updateSupplierToShop,
	deleteSupplier,
} from '../../../../../src/controllers/supplier.js'
import useApi from '../../../../../src/hooks/useApi.jsx'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import ContentLoader, { Rect } from 'react-content-loader/native'

// Helper function to generate consistent avatar colors based on name
const getAvatarColor = (name) => {
	const colors = [
		'#FF6B6B',
		'#4ECDC4',
		'#45B7D1',
		'#FFA07A',
		'#98D8C8',
		'#F7DC6F',
		'#BB8FCE',
		'#85C1E2',
		'#F8B739',
		'#52B788',
		'#E63946',
		'#457B9D',
		'#F77F00',
		'#06AED5',
		'#8338EC',
	]
	const charCodeSum = name
		.split('')
		.reduce((sum, char) => sum + char.charCodeAt(0), 0)
	return colors[charCodeSum % colors.length]
}

// Supplier Avatar Component
const SupplierAvatar = memo(({ name, size = 32 }) => {
	const firstLetter = name ? name.charAt(0).toUpperCase() : '?'
	const backgroundColor = getAvatarColor(name || '')

	return (
		<View
			className="rounded-full justify-center items-center"
			style={{
				width: size,
				height: size,
				backgroundColor,
			}}
		>
			<Text
				className="font-medium text-white"
				style={{ fontSize: size * 0.45 }}
			>
				{firstLetter}
			</Text>
		</View>
	)
})

// Skeleton Loader Component
const SupplierSkeletonLoader = memo(() => (
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

// Memoized Supplier Row Component
const SupplierRow = memo(({ data, onPress, onCall, loc, translatePhone }) => {
	const isHeader = !data.id

	const handlePress = useCallback(() => {
		if (data.id && onPress) {
			onPress(data)
		}
	}, [data.id, data, onPress])

	const handleCall = useCallback(() => {
		if (data.supplier?.number && data.id && onCall) {
			onCall(data.supplier.number)
		}
	}, [data.supplier?.number, data.id, onCall])

	return (
		<View className="flex-row mx-3 border-b-slate-300 border-b-2 items-center py-3">
			{/* Name Column */}
			{isHeader ? (
				<View className="w-1/3 mr-3 flex-row items-center justify-start">
					<Text
						className="text-xl font-bold"
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{data.supplierName || data.name}
					</Text>
				</View>
			) : (
				<TouchableOpacity
					className="w-1/3 mr-3 flex-row items-center"
					onPress={handlePress}
					activeOpacity={0.7}
				>
					{/* Avatar */}
					<View className="mr-2 flex-shrink-0">
						<SupplierAvatar name={data.supplierName} size={32} />
					</View>
					<View className="flex-1">
						<Text
							className="text-sm font-bold"
							numberOfLines={1}
							ellipsizeMode="tail"
						>
							{data.supplierName}
						</Text>
					</View>
				</TouchableOpacity>
			)}

			{/* Company Column */}
			<View className="w-[28%] mr-3 flex-row items-center justify-start">
				<Text
					className={`${
						isHeader ? 'text-xl font-bold' : 'text-sm font-medium'
					}`}
					numberOfLines={1}
					ellipsizeMode="tail"
				>
					{data.supplier?.company || data.company || '-'}
				</Text>
			</View>

			{/* Number Column */}
			<View className="w-[36%] flex-row items-center justify-start">
				<Text
					className={`${
						isHeader ? 'text-xl font-bold' : 'text-sm font-medium'
					}`}
					numberOfLines={1}
					ellipsizeMode="tail"
					style={{
						flexShrink: 1,
						maxWidth: data.supplier?.number && data.id ? '85%' : '100%',
					}}
				>
					{isHeader
						? data.supplier?.number || data.number
						: translatePhone(data.supplier?.number || data.number)}
				</Text>
				{data.supplier?.number && data.id && (
					<TouchableOpacity
						onPress={handleCall}
						className="ml-1 flex-shrink-0"
						activeOpacity={0.7}
					>
						<MaterialCommunityIcons name="phone" size={18} color="#22c55e" />
					</TouchableOpacity>
				)}
			</View>
		</View>
	)
})

// Memoized Add Button Component
const AddSupplierButton = memo(({ onPress, text }) => {
	const handlePress = useCallback(() => {
		onPress()
	}, [onPress])

	return (
		<TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
			<View className="bg-btnPrimary items-center rounded-full py-2 mx-4 my-4">
				<Text
					numberOfLines={1}
					textBreakStrategy="simple"
					className="text-xl mt-2 mb-2 text-white"
				>
					{text}
				</Text>
			</View>
		</TouchableOpacity>
	)
})

// Memoized Search Component (JSX usage) - provides query updates via onQueryChange
const SearchComponent = memo(({ onSearch, onQueryChange, loc }) => {
	return (
		<View>
			<SearchBar
				fetchSearchData={onSearch}
				onSelect={() => {}}
				placeholder={
					loc.t('supplier.searchPlaceholder') || 'Search suppliers...'
				}
				renderItem={() => null}
				debounceDelay={10}
				showSearchResult={false}
				onQueryChange={onQueryChange}
			/>
		</View>
	)
})

export default function SupplierScreen() {
	const { loc } = useLocalization()
	const { translatePhone } = useNumberTranslator()
	const { fetchData } = useApi()
	const [openForm, setOpenForm] = useState(false)
	const [openDetails, setOpenDetails] = useState(false)
	const [selectedSupplier, setSelectedSupplier] = useState(null)
	const [searchValue, setSearchValue] = useState('')
	const [supplierData, setSupplierData] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [page, setPage] = useState(1)
	const [hasNextPage, setHasNextPage] = useState(true)
	const [isFetchingMore, setIsFetchingMore] = useState(false)

	// Use ref to prevent continuous re-fetching
	const isFetchingRef = useRef(false)
	const hasInitializedRef = useRef(false)
	const [searchTerm, setSearchTerm] = useState('')
	const limit = 10

	const handleSearchStable = useCallback(
		async (pageToFetch = 1, isReset = false) => {
			// Prevent multiple simultaneous calls
			if (isFetchingRef.current) return

			const params = {
				searchTerm: searchTerm,
				limit,
				page: pageToFetch || 1, // Ensure page is never undefined
			}
			try {
				isFetchingRef.current = true
				if (isReset) setIsLoading(true)
				else setIsFetchingMore(true)
				const result = await fetchData(getAllSupplier, params)
				if (!result?.success) throw 'API Error'
				const newData = result?.data?.data || []
				const meta = result?.data?.meta || {}

				if (isReset) {
					setSupplierData(newData)
				} else {
					// Prevent duplicates when appending new data
					setSupplierData((prev) => {
						const existingIds = new Set(prev.map((item) => item.id))
						const uniqueNewData = newData.filter(
							(item) => !existingIds.has(item.id)
						)
						return [...prev, ...uniqueNewData]
					})
				}

				// Calculate if there are more pages
				const totalPages = Math.ceil(meta.total / meta.limit)
				setHasNextPage(meta.page < totalPages)
			} catch (err) {
				console.error('🚀 err : ', err)
			} finally {
				setIsLoading(false)
				setIsFetchingMore(false)
				isFetchingRef.current = false
			}
		},
		[searchTerm, fetchData, limit]
	)

	// Create a ref to store the latest search function
	const handleSearchRef = useRef(handleSearchStable)
	handleSearchRef.current = handleSearchStable

	// Stable search function that doesn't change reference
	const handleSearch = useCallback((pageToFetch = 1, isReset = false) => {
		return handleSearchRef.current(pageToFetch, isReset)
	}, [])

	// Handle search term changes
	useEffect(() => {
		if (!hasInitializedRef.current) return // Don't trigger on initial mount

		// Reset to first page when search changes
		setPage(1)
		setHasNextPage(true)
		handleSearch(1, true)
	}, [searchTerm, handleSearch])

	// Stable fetch function for pull-to-refresh
	const fetchSupplier = useCallback(
		async (isRefresh = false) => {
			if (isFetchingRef.current) return

			try {
				setIsRefreshing(true)
				await handleSearch(1, true)
				setPage(1)
				setHasNextPage(true)
				hasInitializedRef.current = true
			} catch (err) {
				console.error('SupplierScreen - Error fetching suppliers:', err)
				ToastAndroid.show(
					loc.t('supplier.fetchError') || 'Failed to fetch suppliers',
					ToastAndroid.SHORT
				)
			} finally {
				setIsRefreshing(false)
			}
		},
		[handleSearch, loc]
	)

	// Use useFocusEffect with stable dependencies
	useFocusEffect(
		useCallback(() => {
			// Only fetch if not already initialized or if explicitly refreshing
			if (!hasInitializedRef.current && !isFetchingRef.current) {
				fetchSupplier()
			}
		}, [fetchSupplier])
	)

	// Memoized supplier details handler
	const openSupplierDetails = useCallback((supplier) => {
		setSelectedSupplier(supplier)
		setOpenDetails(true)
	}, [])

	// Memoized form handlers
	const handleOpenForm = useCallback(() => {
		setOpenForm(true)
	}, [])

	const handleCloseForm = useCallback(() => {
		setOpenForm(false)
	}, [])

	const handleCloseDetails = useCallback(() => {
		setOpenDetails(false)
		setSelectedSupplier(null)
	}, [])

	// Memoized call supplier handler
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

	// Memoized add supplier handler
	const handleAddSupplier = useCallback(
		async (data) => {
			try {
				const res = await fetchData(addSupplierToShop, data)
				if (res.success === true) {
					ToastAndroid.show(
						loc.t('supplier.addSuccess') || 'Supplier added successfully',
						ToastAndroid.SHORT
					)
					// Force refresh after adding
					hasInitializedRef.current = false
					await fetchSupplier()
				} else {
					ToastAndroid.show(
						loc.t('supplier.addError') || 'Failed to add supplier',
						ToastAndroid.SHORT
					)
				}
			} catch (err) {
				ToastAndroid.show(
					loc.t('supplier.addError') || 'Failed to add supplier',
					ToastAndroid.SHORT
				)
			}
		},
		[fetchData, fetchSupplier, loc]
	)

	// Memoized edit supplier handler
	const handleEditSupplier = useCallback(
		async (supplierId, data) => {
			try {
				const res = await fetchData(updateSupplierToShop, {
					supplierId: supplierId,
					payload: data,
				})
				if (res.success === true) {
					ToastAndroid.show(
						loc.t('supplier.updateSuccess') || 'Supplier updated successfully',
						ToastAndroid.SHORT
					)
					// Force refresh after editing
					hasInitializedRef.current = false
					await fetchSupplier()
				} else {
					ToastAndroid.show(
						loc.t('supplier.updateError') || 'Failed to update supplier',
						ToastAndroid.SHORT
					)
				}
			} catch (err) {
				ToastAndroid.show(
					loc.t('supplier.updateError') || 'Failed to update supplier',
					ToastAndroid.SHORT
				)
			}
		},
		[fetchData, fetchSupplier, loc]
	)

	// Memoized delete supplier handler
	const handleDeleteSupplier = useCallback(
		async (supplierId) => {
			try {
				const res = await fetchData(deleteSupplier, {
					supplierId: supplierId,
				})
				if (res.success === true) {
					ToastAndroid.show(
						loc.t('supplier.deleteSuccess') || 'Supplier deleted successfully',
						ToastAndroid.SHORT
					)
					// Force refresh after deleting
					hasInitializedRef.current = false
					await fetchSupplier()
				} else {
					ToastAndroid.show(
						loc.t('supplier.deleteError') || 'Failed to delete supplier',
						ToastAndroid.SHORT
					)
				}
			} catch (err) {
				ToastAndroid.show(
					loc.t('supplier.deleteError') || 'Failed to delete supplier',
					ToastAndroid.SHORT
				)
			}
		},
		[fetchData, fetchSupplier, loc]
	)

	// Remove filtered suppliers since we now handle search through API
	// const filteredSuppliers = useMemo(() => {
	// 	if (!searchValue.trim()) {
	// 		return supplierData
	// 	}

	// 	const filtered = supplierData.filter(
	// 		(supplier) =>
	// 			supplier.supplierName
	// 				?.toLowerCase()
	// 				.includes(searchValue.toLowerCase()) ||
	// 			supplier.supplier?.number
	// 				?.toLowerCase()
	// 				.includes(searchValue.toLowerCase()) ||
	// 			supplier.supplier?.company // This is already included
	// 				?.toLowerCase()
	// 				.includes(searchValue.toLowerCase()) ||
	// 			supplier.comment?.toLowerCase().includes(searchValue.toLowerCase())
	// 	)

	// 	return filtered
	// }, [supplierData, searchValue])

	const tableHeader = useMemo(
		() => ({
			name: loc.t('supplier.tableHeader.name') || 'Name',
			company: loc.t('supplier.tableHeader.company') || 'Company',
			number: loc.t('supplier.tableHeader.number') || 'Number',
		}),
		[loc]
	)

	// Memoized render item function for FlatList
	const renderSupplierItem = useCallback(
		({ item }) => (
			<SupplierRow
				data={item}
				onPress={openSupplierDetails}
				onCall={handleCallSupplier}
				loc={loc}
				translatePhone={translatePhone}
			/>
		),
		[openSupplierDetails, handleCallSupplier, loc, translatePhone]
	)

	// Memoized refresh handler
	const handleRefresh = useCallback(() => {
		hasInitializedRef.current = false
		fetchSupplier(true)
	}, [fetchSupplier])

	// Infinite scroll handler
	const handleEndReached = useCallback(() => {
		if (isLoading || isFetchingMore || !hasNextPage || isFetchingRef.current)
			return
		const nextPage = page + 1
		setPage(nextPage)
		handleSearch(nextPage, false)
	}, [isLoading, isFetchingMore, hasNextPage, page, handleSearch])

	// Show loading skeleton while initial loading
	if (isLoading && !hasInitializedRef.current) {
		return (
			<View className="flex-1">
				<View className="bg-primaryTheme p-4 border-b-4 border-b-pageHeaderFooterBorder">
					<SearchComponent
						loc={loc}
						onSearch={handleSearch}
						onQueryChange={setSearchValue}
					/>
				</View>
				<View className="flex-1">
					<View className="bg-tableRowHeaderBg">
						<SupplierRow
							data={tableHeader}
							loc={loc}
							translatePhone={translatePhone}
						/>
					</View>
					{/* Show skeleton loaders */}
					<View className="flex-1 p-3">
						{[...Array(8)].map((_, index) => (
							<View key={index} className="mb-2">
								<SupplierSkeletonLoader />
							</View>
						))}
					</View>
				</View>
				<AddSupplierButton
					onPress={handleOpenForm}
					text={loc.t('supplier.addBtn') || 'Add Supplier'}
				/>
			</View>
		)
	}

	return (
		<View className="flex-1">
			{/* Header Section */}
			<View className="bg-primaryTheme p-4 border-b-4 border-b-pageHeaderFooterBorder">
				<SearchComponent
					loc={loc}
					onSearch={(item) => setSearchTerm(item)}
					onQueryChange={setSearchValue}
				/>
			</View>

			{/* Content Section */}
			<View className="flex-1">
				{/* Table Header */}
				<View className="bg-tableRowHeaderBg">
					<SupplierRow
						data={tableHeader}
						loc={loc}
						translatePhone={translatePhone}
					/>
				</View>

				{/* Supplier List */}
				<FlashList
					data={supplierData}
					renderItem={renderSupplierItem}
					keyExtractor={(item, index) =>
						item.id ? `supplier-${item.id}` : `supplier-empty-${index}`
					}
					showsVerticalScrollIndicator={false}
					refreshing={isRefreshing}
					onRefresh={handleRefresh}
					onEndReached={handleEndReached}
					onEndReachedThreshold={0.5}
					ListFooterComponent={
						isFetchingMore && hasNextPage ? (
							<View className="p-4 items-center justify-center">
								<SupplierSkeletonLoader />
							</View>
						) : null
					}
					ListEmptyComponent={() => (
						<View className="flex-1 justify-center items-center p-8">
							<Text className="text-gray-500 text-lg">
								{searchTerm
									? loc.t('supplier.noSuppliersFound') || 'No suppliers found'
									: loc.t('supplier.noSuppliersYet') || 'No suppliers yet'}
							</Text>
						</View>
					)}
				/>
			</View>

			{/* Add Supplier Button */}
			<AddSupplierButton
				onPress={handleOpenForm}
				text={loc.t('supplier.addBtn') || 'Add Supplier'}
			/>

			{/* Add Supplier Form - Only render when needed */}
			{openForm && (
				<SupplierForm
					initialValues={{}}
					handleSubmit={handleAddSupplier}
					visible={openForm}
					onClose={handleCloseForm}
				/>
			)}

			{/* Supplier Details - Only render when needed */}
			{openDetails && selectedSupplier && (
				<SupplierDetails
					supplier={selectedSupplier}
					visible={openDetails}
					onClose={handleCloseDetails}
					onEdit={handleEditSupplier}
					onDelete={handleDeleteSupplier}
				/>
			)}
		</View>
	)
}
