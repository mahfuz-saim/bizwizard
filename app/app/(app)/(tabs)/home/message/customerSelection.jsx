import {
	FlatList,
	Text,
	TouchableOpacity,
	View,
	Pressable,
	TextInput,
	Modal,
} from 'react-native'
import SearchBar from '../../../../../src/components/searchBar.jsx'
import { useCallback, useState, useMemo, memo, useRef, useEffect } from 'react'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'
import {
	getAllCustomer,
	getAllTags,
} from '../../../../../src/controllers/customer.js'
import useApi from '../../../../../src/hooks/useApi.jsx'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Ionicons } from '@expo/vector-icons'
import ContentLoader, { Rect } from 'react-content-loader/native'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'

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

// Memoized Customer Row Component for Selection
const CustomerSelectionRow = memo(
	({ data, isSelected, onToggleSelection, loc }) => {
		const isHeader = !data.id
		const { translatePhone } = useNumberTranslator()

		const handlePress = useCallback(() => {
			if (data.id && onToggleSelection) {
				onToggleSelection(data.buyerID)
			}
		}, [data.id, data.buyerID, onToggleSelection])

		return (
			<View className="flex-row mx-3 border-b-slate-300 border-b-2 items-center py-3">
				{/* Selection Column */}
				<View className="w-[10%] mr-2 flex-row items-center justify-center">
					{isHeader ? (
						<MaterialCommunityIcons
							name="checkbox-multiple-marked"
							size={20}
							color="#177DFF"
						/>
					) : (
						<TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
							<View
								className={`w-6 h-6 rounded border-2 items-center justify-center ${
									isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
								}`}
							>
								{isSelected && (
									<Ionicons name="checkmark" size={14} color="white" />
								)}
							</View>
						</TouchableOpacity>
					)}
				</View>

				{/* Name Column */}
				<View className="w-[35%] mr-2 flex-row items-center justify-start">
					<Text
						className={`${isHeader ? 'text-xl font-bold' : 'text-lg'}`}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{data.name}
					</Text>
				</View>

				{/* Number Column */}
				<View className="w-[30%] mr-2 flex-row items-center justify-start">
					<Text
						className={`${isHeader ? 'text-xl font-bold' : 'text-lg'}`}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{isHeader ? data.number : translatePhone(data.number)}
					</Text>
				</View>

				{/* Address Column */}
				<View className="w-[20%] flex-row items-center justify-start">
					<Text
						className={`${isHeader ? 'text-xl font-bold' : 'text-lg'}`}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{data.address}
					</Text>
				</View>
			</View>
		)
	}
)

// Memoized Search Component
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
						debounceDelay={10}
						showSearchResult={false}
					/>
				</View>
				{/* Filter controls */}
				<View className="flex-row items-center" style={{ zIndex: 2000 }}>
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

export default function CustomerSelectionScreen({
	visible,
	onClose,
	onAddCustomers,
	existingSelectedUsers = [],
}) {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const { translateNumber } = useNumberTranslator()

	const [customerData, setCustomerData] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [customerFilters, setCustomerFilters] = useState([])
	const [showFilterMenu, setShowFilterMenu] = useState(false)
	const [filterSearch, setFilterSearch] = useState('')
	const [dynamicTags, setDynamicTags] = useState([])
	const [searchTerm, setSearchTerm] = useState('')
	const [selectedCustomers, setSelectedCustomers] = useState([])

	const isFetchingRef = useRef(false)

	// Initialize selected customers with existing ones
	useEffect(() => {
		if (visible) {
			setSelectedCustomers([...existingSelectedUsers])
		}
	}, [visible, existingSelectedUsers])

	// Fetch customers based on search and filters
	const handleSearch = useCallback(() => {
		const fetchSearchData = async () => {
			if (isFetchingRef.current) return
			isFetchingRef.current = true

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
			}
			try {
				const result = await fetchData(getAllCustomer, params)
				if (result?.success) {
					setCustomerData(result?.data?.data || [])
				}
			} catch (err) {
				console.error('Error fetching customers:', err)
			} finally {
				setIsLoading(false)
				isFetchingRef.current = false
			}
		}
		fetchSearchData()
	}, [customerFilters, searchTerm, dynamicTags, fetchData])

	// Fetch tags when filter is opened
	const fetchTags = useCallback(async () => {
		try {
			const result = await fetchData(getAllTags, {})
			if (result.success && result.data) {
				const systemTags = result.data.systemTags || []
				const customTags = result.data.customTags || []

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

	// Effect to trigger search when filters or search term changes
	useEffect(() => {
		if (visible) {
			handleSearch()
		}
	}, [customerFilters, searchTerm, visible, handleSearch])

	// Initial data fetch when modal opens
	useEffect(() => {
		if (visible && !isFetchingRef.current) {
			setIsLoading(true)
			handleSearch()
		}
	}, [visible])

	// Toggle individual customer selection
	const toggleCustomerSelection = useCallback((customerId) => {
		setSelectedCustomers((prev) => {
			if (prev.includes(customerId)) {
				return prev.filter((id) => id !== customerId)
			} else {
				return [...prev, customerId]
			}
		})
	}, [])

	// Select all visible customers
	const selectAllVisible = useCallback(() => {
		const visibleCustomerIds = customerData.map((customer) => customer.buyerID)
		const allVisibleSelected = visibleCustomerIds.every((id) =>
			selectedCustomers.includes(id)
		)

		if (allVisibleSelected) {
			// Deselect all visible
			setSelectedCustomers((prev) =>
				prev.filter((id) => !visibleCustomerIds.includes(id))
			)
		} else {
			// Select all visible
			setSelectedCustomers((prev) => {
				const newSelected = [...prev]
				visibleCustomerIds.forEach((id) => {
					if (!newSelected.includes(id)) {
						newSelected.push(id)
					}
				})
				return newSelected
			})
		}
	}, [customerData, selectedCustomers])

	// Handle add customers to message
	const handleAddToMessage = useCallback(() => {
		const selectedCustomerData = customerData.filter((customer) =>
			selectedCustomers.includes(customer.buyerID)
		)
		onAddCustomers(selectedCustomerData)
		onClose()
	}, [selectedCustomers, customerData, onAddCustomers, onClose])

	// Table header
	const tableHeader = useMemo(
		() => ({
			name: loc.t('customer.tableHeader.name') || 'Name',
			number: loc.t('customer.tableHeader.number') || 'Number',
			address: loc.t('customer.tableHeader.address') || 'Address',
		}),
		[loc]
	)

	// Render customer item
	const renderCustomerItem = useCallback(
		({ item }) => (
			<CustomerSelectionRow
				data={item}
				isSelected={selectedCustomers.includes(item.buyerID)}
				onToggleSelection={toggleCustomerSelection}
				loc={loc}
			/>
		),
		[selectedCustomers, toggleCustomerSelection, loc]
	)

	// Key extractor
	const keyExtractor = useCallback(
		(item) => item.id?.toString() || Math.random().toString(),
		[]
	)

	return (
		<Modal
			visible={visible}
			animationType="fade"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<View className="flex-1 bg-gray-50">
				{/* Header */}
				<View className="bg-primaryTheme p-4 border-b-4 border-b-pageHeaderFooterBorder">
					<View className="flex-row items-center justify-between mb-4">
						<Text className="text-xl font-bold text-white">
							{loc.t('message.selectCustomers') || 'Select Customers'}
						</Text>
						<TouchableOpacity onPress={onClose} className="p-2">
							<Ionicons name="close" size={24} color="white" />
						</TouchableOpacity>
					</View>

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

					{/* Selected count */}
					<View className="mt-3 bg-white rounded-lg p-3 shadow-sm">
						<Text className="text-sm font-medium text-gray-700">
							{translateNumber(selectedCustomers.length)}{' '}
							{loc.t('message.customersSelected') || 'customers selected'}
						</Text>
					</View>
				</View>

				{/* Customer List */}
				<View className="flex-1">
					{/* Table header with select all */}
					<View className="bg-tableRowHeaderBg">
						<TouchableOpacity onPress={selectAllVisible}>
							<CustomerSelectionRow data={tableHeader} loc={loc} />
						</TouchableOpacity>
					</View>

					{isLoading ? (
						<View className="flex-1 p-3">
							{[...Array(8)].map((_, index) => (
								<View key={index} className="mb-2">
									<CustomerSkeletonLoader />
								</View>
							))}
						</View>
					) : (
						<FlatList
							data={customerData}
							renderItem={renderCustomerItem}
							keyExtractor={keyExtractor}
							showsVerticalScrollIndicator={false}
							initialNumToRender={10}
							maxToRenderPerBatch={5}
							windowSize={10}
							removeClippedSubviews={true}
							ListEmptyComponent={() => (
								<View className="flex-1 justify-center items-center p-8">
									<Text className="text-gray-500 text-lg text-center">
										{loc.t('customer.noCustomersFound') || 'No customers found'}
									</Text>
								</View>
							)}
						/>
					)}
				</View>

				{/* Bottom Actions */}
				<View className="p-4 bg-white border-t border-gray-200">
					<View className="flex-row">
						<TouchableOpacity
							className="flex-1 bg-gray-200 py-4 rounded-lg items-center mr-4"
							onPress={onClose}
						>
							<Text className="text-gray-700 font-semibold text-base">
								{loc.t('message.cancelButton') || 'Cancel'}
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							className={`flex-1 py-4 rounded-lg items-center ${
								selectedCustomers.length > 0 ? 'bg-blue-600' : 'bg-gray-300'
							}`}
							onPress={handleAddToMessage}
							disabled={selectedCustomers.length === 0}
						>
							<Text
								className={`font-semibold text-base ${
									selectedCustomers.length > 0 ? 'text-white' : 'text-gray-500'
								}`}
							>
								{loc.t('message.addToMessage') || 'Add to Message'} (
								{translateNumber(selectedCustomers.length)})
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	)
}
