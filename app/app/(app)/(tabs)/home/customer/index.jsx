import {
	View,
	Text,
	TouchableOpacity,
	ToastAndroid,
	Pressable,
	TextInput,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import SearchBar from '../../../../../src/components/searchBar.jsx'
import { useCallback, useState, useMemo, memo, useRef, useEffect } from 'react'
import CustomerForm from '../../../../../src/components/customer/customerForm.tsx'
import CustomerDetails from '../../../../../src/components/customer/customerDetails.jsx'
import { useFocusEffect } from 'expo-router'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'
import {
	getAllCustomer,
	addCustomer,
	updateCustomer,
	deleteCustomer,
	getAllTags,
} from '../../../../../src/controllers/customer.js'
import useApi from '../../../../../src/hooks/useApi.jsx'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Ionicons } from '@expo/vector-icons'
import ContentLoader, { Rect } from 'react-content-loader/native'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'

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

// Customer Avatar Component
const CustomerAvatar = memo(({ name, size = 32 }) => {
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
const CustomerRow = memo(({ data, onPress, loc }) => {
	const isHeader = !data.id
	const { translatePhone } = useNumberTranslator()

	const handlePress = useCallback(() => {
		if (data.id && onPress) {
			onPress(data)
		}
	}, [data.id, data, onPress])

	return (
		<View className="flex-row mx-3 border-b-slate-300 border-b-2 items-center py-3">
			{/* Name Column */}
			<TouchableOpacity
				className="w-[38%] mr-2 flex-row items-center"
				onPress={handlePress}
				activeOpacity={data.id ? 0.7 : 1}
				disabled={!data.id}
			>
				{/* Avatar - only show for data rows, not header */}
				{!isHeader && (
					<View className="mr-2 flex-shrink-0">
						<CustomerAvatar name={data.name} size={32} />
					</View>
				)}
				<View className="flex-1">
					<Text
						className={`${
							isHeader ? 'text-xl font-bold' : 'text-sm font-bold'
						}`}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{data.name}
					</Text>
				</View>
			</TouchableOpacity>

			{/* Number Column */}
			<View className="w-[30%] mr-2 flex-row items-center justify-start">
				<Text
					className={`${
						isHeader ? 'text-xl font-bold' : 'text-sm font-medium'
					}`}
					numberOfLines={1}
					ellipsizeMode="tail"
				>
					{isHeader ? data.number : translatePhone(data.number)}
				</Text>
			</View>

			{/* Address Column */}
			<View className="w-[27%] flex-row items-center justify-start">
				<Text
					className={`${
						isHeader ? 'text-xl font-bold' : 'text-sm font-medium'
					}`}
					numberOfLines={1}
					ellipsizeMode="tail"
				>
					{data.address}
				</Text>
			</View>
		</View>
	)
})

// Memoized Add Button Component
const AddCustomerButton = memo(({ onPress, text }) => {
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

// Memoized Search Component using JSX
const SearchComponent = memo(
	({
		onSearch,
		loc,
		customerFilters,
		setCustomerFilters,
		showFilterMenu,
		setShowFilterMenu,
		filterSearch,
		setFilterSearch,
		dynamicTags,
		onFetchTags,
	}) => {
		// Use only dynamic tags from API (includes both system and custom tags)
		const allFilterOptions = dynamicTags

		// Filter options based on search
		const filteredOptions = allFilterOptions.filter((option) =>
			option.label.toLowerCase().includes(filterSearch.toLowerCase())
		)

		const toggleFilter = (filterKey) => {
			setCustomerFilters((prev) => {
				if (prev.includes(filterKey)) {
					return prev.filter((f) => f !== filterKey)
				} else {
					return [...prev, filterKey]
				}
			})
		}

		const clearAllFilters = () => {
			setCustomerFilters([])
		}

		const getDisplayText = () => {
			if (customerFilters.length === 0) {
				return loc.t('customer.filterNone') || 'All'
			} else if (customerFilters.length === 1) {
				const filter = allFilterOptions.find(
					(f) => f.key === customerFilters[0]
				)
				return filter?.label || customerFilters[0]
			} else {
				return `${customerFilters.length} ${
					loc.t('customer.filtersSelected') || 'selected'
				}`
			}
		}

		const handleFilterMenuToggle = () => {
			if (!showFilterMenu) {
				// Fetch tags when opening the filter menu
				onFetchTags()
			}
			setShowFilterMenu((s) => !s)
		}

		return (
			<View className="flex-row items-center">
				<View className="flex-1 mr-3">
					<SearchBar
						fetchSearchData={onSearch}
						onSelect={() => {}}
						placeholder={
							loc.t('customer.searchPlaceholder') || 'Search customers...'
						}
						renderItem={() => null}
						debounceDelay={50}
						showSearchResult={false}
					/>
				</View>
				{/* Filter controls */}
				<View className="flex-row items-center" style={{ zIndex: 2000 }}>
					{/* Filter dropdown trigger */}
					<View className="relative" style={{ zIndex: 2100 }}>
						<Pressable
							className="bg-white px-3 py-4 rounded-xl border border-gray-300 flex-row items-center"
							onPress={handleFilterMenuToggle}
						>
							<View className="mr-2">
								<MaterialCommunityIcons
									name="filter-variant"
									size={20}
									color="#177DFF"
								/>
							</View>
							<Text className="text-sm font-medium mr-1">
								{getDisplayText()}
							</Text>
							<Ionicons
								name={showFilterMenu ? 'chevron-up' : 'chevron-down'}
								size={16}
								color="#555"
							/>
							{customerFilters.length > 0 && (
								<TouchableOpacity onPress={clearAllFilters} className="ml-1">
									<Ionicons name="close-circle" size={18} color="#888888" />
								</TouchableOpacity>
							)}
						</Pressable>

						{/* Dropdown menu */}
						{showFilterMenu && (
							<View
								className="absolute top-12 right-0 w-52 bg-white rounded-lg border border-gray-300 shadow-lg"
								style={{ zIndex: 2500, elevation: 16 }}
							>
								{/* Search input */}
								<View className="p-3 border-b border-gray-200">
									<TextInput
										className="bg-gray-50 px-3 py-2 rounded-lg text-sm border border-gray-200"
										placeholder={
											loc.t('customer.searchFilters') || 'Search filters...'
										}
										value={filterSearch}
										onChangeText={setFilterSearch}
										autoFocus={false}
									/>
								</View>

								{/* Clear All option */}
								{customerFilters.length > 0 && (
									<>
										<Pressable
											className="px-3 py-2 flex-row items-center border-b border-gray-200"
											onPress={() => {
												clearAllFilters()
												setShowFilterMenu(false)
												setFilterSearch('')
											}}
										>
											<MaterialCommunityIcons
												name="close-circle-outline"
												size={16}
												color="#DC2626"
												style={{ marginRight: 8 }}
											/>
											<Text className="text-sm flex-1 text-red-600">
												{loc.t('customer.clearAllFilters') || 'Clear All'}
											</Text>
										</Pressable>
									</>
								)}

								{/* Filter options */}
								{filteredOptions.length > 0 ? (
									filteredOptions.map((opt, idx) => (
										<Pressable
											key={opt.key}
											className={`px-3 py-2 flex-row items-center ${
												idx !== 0 || customerFilters.length > 0
													? 'border-t border-gray-200'
													: ''
											}`}
											onPress={() => toggleFilter(opt.key)}
										>
											<Text className="text-sm flex-1">{opt.label}</Text>
											{customerFilters.includes(opt.key) && (
												<Ionicons name="checkmark" size={16} color="#177DFF" />
											)}
										</Pressable>
									))
								) : (
									<View className="px-3 py-4">
										<Text className="text-sm text-gray-500 text-center">
											{loc.t('customer.noFiltersFound') || 'No filters found'}
										</Text>
									</View>
								)}
							</View>
						)}
					</View>

					{/* Outside click catcher */}
					{showFilterMenu && (
						<Pressable
							className="absolute inset-0"
							style={{ zIndex: 2050 }}
							onPress={() => {
								setShowFilterMenu(false)
								setFilterSearch('')
							}}
						>
							{/* Transparent overlay */}
						</Pressable>
					)}
				</View>
			</View>
		)
	}
)

export default function CustomerScreen() {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const [openForm, setOpenForm] = useState(false)
	const [openDetails, setOpenDetails] = useState(false)
	const [selectedCustomer, setSelectedCustomer] = useState(null)
	const [searchValue, setSearchValue] = useState('')
	const [customerData, setCustomerData] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [page, setPage] = useState(1)
	const [hasNextPage, setHasNextPage] = useState(true)
	const [isFetchingMore, setIsFetchingMore] = useState(false)
	// Customer filter state - now supports multiple filters
	const [customerFilters, setCustomerFilters] = useState([]) // Array of selected filters
	const [showFilterMenu, setShowFilterMenu] = useState(false)
	const [filterSearch, setFilterSearch] = useState('') // Search within filter dropdown
	const [dynamicTags, setDynamicTags] = useState([]) // Tags fetched from API

	// Use ref to prevent continuous re-fetching
	const isFetchingRef = useRef(false)
	const hasInitializedRef = useRef(false)
	const [searchTerm, setSearchTerm] = useState('')
	const limit = 10

	// Memoized search handler
	useEffect(() => {
		// Reset to first page when filters/search change
		setPage(1)
		setHasNextPage(true)
		handleSearch(1, true)
	}, [customerFilters, searchTerm])

	const handleSearch = useCallback(
		async (pageToFetch = page, isReset = false) => {
			let customTags = []
			let systemTags = []
			customerFilters.forEach((filter) => {
				const tag = dynamicTags.find((t) => t.key === filter)
				if (tag) {
					if (tag.type === 'custom') {
						customTags.push(tag.key)
					} else if (tag.type === 'system') {
						systemTags.push(tag.key)
					}
				}
			})

			const params = {
				searchTerm: searchTerm,
				customTag: customTags,
				systemTag: systemTags,
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
			} finally {
				setIsLoading(false)
				setIsFetchingMore(false)
			}
		},
		[customerFilters, searchTerm, dynamicTags, fetchData, limit]
	)

	// Fetch tags when filter is opened
	const fetchTags = useCallback(async () => {
		try {
			const result = await fetchData(getAllTags, {})
			if (result.success && result.data) {
				// Combine systemTags and customTags, starting with system tags
				const systemTags = result.data.systemTags || []
				const customTags = result.data.customTags || []

				// Transform all tags to match filter option format
				const formattedSystemTags = systemTags.map((tag) => ({
					key: tag.key || tag.id || tag.name,
					label: tag.name || tag.label,
					type: 'system',
				}))
				const formattedCustomTags = customTags.map((tag) => ({
					key: tag.key || tag.id || tag.name,
					label: tag.name || tag.label,
					type: 'custom',
				}))

				const allTags = [...formattedSystemTags, ...formattedCustomTags]
				setDynamicTags(allTags)
			}
		} catch (err) {
			console.error('Error fetching tags:', err)
		}
	}, [fetchData])

	// Stable fetch function for pull-to-refresh
	const fetchCustomer = useCallback(
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
				console.error('CustomerScreen - Error fetching customers:', err)
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

	// Use useFocusEffect with stable dependencies
	useFocusEffect(
		useCallback(() => {
			// Only fetch if not already initialized or if explicitly refreshing
			if (!hasInitializedRef.current && !isFetchingRef.current) {
				fetchCustomer()
			}
		}, [fetchCustomer])
	)

	// Memoized customer details handler
	const openCustomerDetails = useCallback((customer) => {
		setSelectedCustomer(customer)
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
		setSelectedCustomer(null)
	}, [])

	// Memoized add customer handler
	const handleAddCustomer = useCallback(
		async (data) => {
			const payload = {
				name: data.name,
				number: data.number,
				address: data.address,
			}

			try {
				const res = await fetchData(addCustomer, { payload: payload })
				if (res.success === true) {
					ToastAndroid.show(
						loc.t('customer.addSuccess') || 'Customer added successfully',
						ToastAndroid.SHORT
					)
					// Force refresh after adding
					hasInitializedRef.current = false
					await fetchCustomer()
				} else {
					ToastAndroid.show(
						loc.t('customer.addError') || 'Failed to add customer',
						ToastAndroid.SHORT
					)
				}
			} catch (err) {
				ToastAndroid.show(
					loc.t('customer.addError') || 'Failed to add customer',
					ToastAndroid.SHORT
				)
				console.error('CustomerScreen - Error adding customer:', err)
			}
		},
		[fetchData, fetchCustomer, loc]
	)

	// Memoized edit customer handler
	const handleEditCustomer = useCallback(
		async (customerId, data) => {
			const payload = {
				name: data.name,
				address: data.address,
				buyerID: customerId,
			}

			try {
				const res = await fetchData(updateCustomer, {
					customerId: customerId,
					payload: payload,
				})
				if (res.success === true) {
					ToastAndroid.show(
						loc.t('customer.updateSuccess') || 'Customer updated successfully',
						ToastAndroid.SHORT
					)
					// Force refresh after editing
					hasInitializedRef.current = false
					await fetchCustomer()
				} else {
					ToastAndroid.show(
						loc.t('customer.updateError') || 'Failed to update customer',
						ToastAndroid.SHORT
					)
				}
			} catch (err) {
				ToastAndroid.show(
					loc.t('customer.updateError') || 'Failed to update customer',
					ToastAndroid.SHORT
				)
				console.error('CustomerScreen - Error editing customer:', err)
			}
		},
		[fetchData, fetchCustomer, loc]
	)

	// Memoized delete customer handler
	const handleDeleteCustomer = useCallback(
		async (customerId) => {
			try {
				const res = await fetchData(deleteCustomer, { customerId: customerId })
				if (res.success === true) {
					ToastAndroid.show(
						loc.t('customer.deleteSuccess') || 'Customer deleted successfully',
						ToastAndroid.SHORT
					)
					// Force refresh after deleting
					hasInitializedRef.current = false
					await fetchCustomer()
				} else {
					ToastAndroid.show(
						loc.t('customer.deleteError') || 'Failed to delete customer',
						ToastAndroid.SHORT
					)
				}
			} catch (err) {
				ToastAndroid.show(
					loc.t('customer.deleteError') || 'Failed to delete customer',
					ToastAndroid.SHORT
				)
				console.error('CustomerScreen - Error deleting customer:', err)
			}
		},
		[fetchData, fetchCustomer, loc]
	)

	// Memoized filtered customers

	// Memoized table header
	const tableHeader = useMemo(
		() => ({
			name: loc.t('customer.tableHeader.name') || 'Name',
			number: loc.t('customer.tableHeader.number') || 'Number',
			address: loc.t('customer.tableHeader.address') || 'Address',
		}),
		[loc]
	)

	// Memoized add button text
	const addButtonText = useMemo(
		() => loc.t('customer.addBtn') || 'Add Customer',
		[loc]
	)

	// Memoized render item function for FlatList
	const renderCustomerItem = useCallback(
		({ item }) => (
			<CustomerRow data={item} onPress={openCustomerDetails} loc={loc} />
		),
		[openCustomerDetails, loc]
	)

	// Memoized refresh handler
	const handleRefresh = useCallback(() => {
		hasInitializedRef.current = false
		fetchCustomer(true)
	}, [fetchCustomer])

	// Infinite scroll handler
	const handleEndReached = useCallback(() => {
		if (isLoading || isFetchingMore || !hasNextPage) return
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
						onSearch={(item) => setSearchTerm(item)}
						customerFilters={customerFilters}
						setCustomerFilters={setCustomerFilters}
						showFilterMenu={showFilterMenu}
						setShowFilterMenu={setShowFilterMenu}
						filterSearch={filterSearch}
						setFilterSearch={setFilterSearch}
						dynamicTags={dynamicTags}
						onFetchTags={fetchTags}
					/>
				</View>
				<View className="flex-1">
					<View className="bg-tableRowHeaderBg">
						<CustomerRow data={tableHeader} loc={loc} />
					</View>
					<View className="flex-1 p-3">
						{[...Array(8)].map((_, index) => (
							<View key={index} className="mb-2">
								<CustomerSkeletonLoader />
							</View>
						))}
					</View>
				</View>
				<AddCustomerButton onPress={handleOpenForm} text={addButtonText} />
			</View>
		)
	}

	return (
		<View className="flex-1">
			<View className="bg-primaryTheme p-4 border-b-4 border-b-pageHeaderFooterBorder">
				<SearchComponent
					loc={loc}
					onSearch={(item) => setSearchTerm(item)}
					onQueryChange={setSearchValue}
					customerFilters={customerFilters}
					setCustomerFilters={setCustomerFilters}
					showFilterMenu={showFilterMenu}
					setShowFilterMenu={setShowFilterMenu}
					filterSearch={filterSearch}
					setFilterSearch={setFilterSearch}
					dynamicTags={dynamicTags}
					onFetchTags={fetchTags}
				/>
			</View>

			<View className="flex-1">
				<View className="bg-tableRowHeaderBg">
					<CustomerRow data={tableHeader} loc={loc} />
				</View>

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
							<View className="p-4 items-center justify-center">
								<CustomerSkeletonLoader />
							</View>
						) : null
					}
					ListEmptyComponent={() => (
						<View className="flex-1 justify-center items-center p-8">
							<Text className="text-gray-500 text-lg">
								{searchTerm
									? loc.t('customer.noCustomersFound') || 'No customers found'
									: loc.t('customer.noCustomersYet') || 'No customers yet'}
							</Text>
						</View>
					)}
				/>
			</View>

			<AddCustomerButton onPress={handleOpenForm} text={addButtonText} />

			{/* Add Customer Form - Only render when needed */}
			{openForm && (
				<CustomerForm
					initialValues={{}}
					handleSubmit={handleAddCustomer}
					visible={openForm}
					onClose={handleCloseForm}
				/>
			)}

			{/* Customer Details - Only render when needed */}
			{openDetails && selectedCustomer && (
				<CustomerDetails
					customer={selectedCustomer}
					visible={openDetails}
					onClose={handleCloseDetails}
					onEdit={handleEditCustomer}
					onDelete={handleDeleteCustomer}
				/>
			)}
		</View>
	)
}
