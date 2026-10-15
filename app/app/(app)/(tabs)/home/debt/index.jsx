import {
	Text,
	TouchableOpacity,
	View,
	ToastAndroid,
	Modal,
	ScrollView,
	Pressable,
	InteractionManager,
} from 'react-native'
import { FlashList } from '@shopify/flash-list'
import SearchBar from '../../../../../src/components/searchBar.jsx'
import { useState, useCallback, useMemo, memo, useRef, useEffect } from 'react'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'
import { getAllDebt } from '../../../../../src/controllers/debt.js'
import useApi from '../../../../../src/hooks/useApi.jsx'
import DebtDetails from '../../../../../src/components/debt/debtDetails.jsx'
import AddPreviousDebt from '../../../../../src/components/debt/AddPreviousDebt.jsx'
import { useFocusEffect } from 'expo-router'
import ContentLoader, { Rect } from 'react-content-loader/native'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import { sendManyMessages } from '../../../../../src/controllers/message.js'
import { getShopInfo } from '../../../../../src/controllers/shop.js'
import { Ionicons } from '@expo/vector-icons'
import { ConfirmModal } from '../../../../../src/components/AlertModal'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { useRouter } from 'expo-router'

// DateTimePicker is loaded lazily inside ConfirmationModal so the initial
// screen render stays lightweight and the navigation transition feels instant.
// Keeping it at module level forced the entire native picker module to mount
// before the screen could paint.
let DateTimePickerRef = null
const DateTimePickerLazy = (props) => {
	if (!DateTimePickerRef) {
		DateTimePickerRef =
			require('@react-native-community/datetimepicker').default
	}
	return DateTimePickerRef ? <DateTimePickerRef {...props} /> : null
}

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

// Single shared skeleton row, reused so the loader is rendered once and
// cloned cheaply instead of mounting N heavy SVG loaders in a ScrollView.
const SkeletonRow = memo(() => (
	<ContentLoader
		speed={2}
		width="100%"
		height={70}
		viewBox="0 0 400 70"
		backgroundColor="#f3f3f3"
		foregroundColor="#ecebeb"
	>
		<Rect x="20" y="15" rx="4" ry="4" width="100" height="16" />
		<Rect x="20" y="35" rx="4" ry="4" width="80" height="12" />
		<Rect x="150" y="20" rx="4" ry="4" width="120" height="20" />
		<Rect x="300" y="20" rx="4" ry="4" width="80" height="20" />
	</ContentLoader>
))

const SKELETON_PLACEHOLDER = [0, 1, 2, 3, 4, 5, 6, 7]

const SkeletonList = memo(() => (
	<View className="flex-1 p-3">
		{SKELETON_PLACEHOLDER.map((i) => (
			<View key={i} className="mb-2">
				<SkeletonRow />
			</View>
		))}
	</View>
))

// Footer loader for pagination (FlashList footer slot).
const SkeletonFooter = memo(() => (
	<View className="py-3">
		<SkeletonRow />
	</View>
))

// Backwards-compat alias used inside the ScrollView branch.
const SkeletonLoader = SkeletonList

// Memoized debt row component
const DebtRowComponent = memo(
	({
		data,
		onOpenModal,
		translateAmount,
		isHeaderRow,
		isReminderMode,
		isSelected,
		onToggleSelection,
	}) => {
		const debtAmount = isHeaderRow ? 0 : data.totalDebt || 0

		// Memoized styles for performance
		const amountStyle = useMemo(
			() => ({
				className: `text-sm font-medium ${
					debtAmount > 0 ? 'text-red-600' : 'text-green-600'
				}`,
			}),
			[debtAmount]
		)

		const handlePress = useCallback(() => {
			if (!isHeaderRow) {
				if (isReminderMode && onToggleSelection) {
					onToggleSelection(data.id)
				} else if (onOpenModal) {
					onOpenModal(data)
				}
			}
		}, [data, onOpenModal, onToggleSelection, isHeaderRow, isReminderMode])

		if (isHeaderRow) {
			return (
				<View className="flex-row mx-3 border-b-slate-300 border-b-2 items-center py-3">
					{isReminderMode && (
						<View className="w-[10%] mr-2 flex-row items-center justify-center">
							<MaterialCommunityIcons
								name="checkbox-multiple-marked"
								size={20}
								color="#177DFF"
							/>
						</View>
					)}
					<View
						className={`${
							isReminderMode ? 'w-[33%]' : 'w-[38%]'
						} mr-2 flex-row items-center justify-start`}
					>
						<Text className="text-xl font-bold">{data.name}</Text>
					</View>
					<View className="w-[30%] mr-2 flex-row items-center justify-start">
						<Text className="text-xl font-bold">{data.address}</Text>
					</View>
					<View className="w-[27%] flex-row items-center justify-start">
						<Text className="text-xl font-bold">{data.totalDebt}</Text>
					</View>
				</View>
			)
		}

		return (
			<View className="flex-row mx-3 border-b-slate-300 border-b-2 items-center py-3">
				{/* Selection Column (Reminder Mode) */}
				{isReminderMode && (
					<View className="w-[10%] mr-2 flex-row items-center justify-center">
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
					</View>
				)}

				{/* Name Column */}
				<TouchableOpacity
					className={`${
						isReminderMode ? 'w-[33%]' : 'w-[38%]'
					} mr-2 flex-row items-center`}
					onPress={handlePress}
					activeOpacity={0.7}
				>
					{/* Avatar */}
					<View className="mr-2 flex-shrink-0">
						<CustomerAvatar name={data.name} size={32} />
					</View>
					<View className="flex-1">
						<Text
							className="text-sm font-bold"
							numberOfLines={1}
							ellipsizeMode="tail"
						>
							{data.name}
						</Text>
					</View>
				</TouchableOpacity>

				{/* Address Column */}
				<View className="w-[30%] mr-2 flex-row items-center justify-start">
					<Text
						className="text-sm font-medium"
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{data.address}
					</Text>
				</View>

				{/* Debt Amount Column */}
				<View className="w-[27%] flex-row items-center justify-start">
					<Text className={amountStyle.className} numberOfLines={1}>
						{translateAmount(debtAmount, {
							currencySymbol: '৳',
							decimalPlaces: 2,
						})}
					</Text>
				</View>
			</View>
		)
	},
	(prevProps, nextProps) => {
		// Custom comparison function to ensure proper re-rendering.
		// We only check fields that actually change between list updates
		// during a session — name/address rarely mutate after the initial
		// fetch so skipping them keeps memoization cheap.
		if (prevProps.isHeaderRow !== nextProps.isHeaderRow) return false
		if (prevProps.isReminderMode !== nextProps.isReminderMode) return false
		if (prevProps.isSelected !== nextProps.isSelected) return false
		if (prevProps.data?.id !== nextProps.data?.id) return false
		if (prevProps.data?.totalDebt !== nextProps.data?.totalDebt) return false
		return true
	}
)

// Memoized total debt summary component
const TotalDebtSummary = memo(
	({
		totalDebtCustomers,
		totalDebtAmount,
		translateNumber,
		translateAmount,
		loc,
		isReminderMode,
		selectedCount,
		selectedDebtAmount,
		isLoading,
	}) => {
		const summaryStyle = useMemo(
			() => ({
				className: `text-lg font-bold ${
					totalDebtAmount > 0 ? 'text-red-600' : 'text-green-600'
				}`,
			}),
			[totalDebtAmount]
		)

		const displayCustomers = isReminderMode ? selectedCount : totalDebtCustomers
		const displayAmount = isReminderMode ? selectedDebtAmount : totalDebtAmount

		const SummaryValueSkeleton = () => (
			<ContentLoader
				speed={2}
				width={80}
				height={24}
				viewBox="0 0 80 24"
				backgroundColor="#f3f3f3"
				foregroundColor="#ecebeb"
			>
				<Rect x="20" y="4" rx="4" ry="4" width="60" height="16" />
			</ContentLoader>
		)

		return (
			<View className="mt-3 bg-white rounded-lg py-3 px-5 shadow-sm flex-row justify-between">
				<View className="flex-row justify-between items-center">
					<Text className="text-lg font-semibold text-gray-700">
						{isReminderMode
							? loc.t('debt.selectedCustomers') + ': ' || 'Selected: '
							: loc.t('debt.totalCustomers') + ': ' || 'Total Customers'}
					</Text>
					{isLoading ? (
						<SummaryValueSkeleton />
					) : (
						<Text className="text-lg font-bold text-blue-600">
							{translateNumber(displayCustomers)}
						</Text>
					)}
				</View>
				<View className="flex-row justify-between items-center">
					<Text className="text-lg font-semibold text-gray-700">
						{isReminderMode
							? loc.t('debt.selectedDebt') + ': ' || 'Selected Debt: '
							: loc.t('debt.totalDebtAmount') + ': ' || 'Total Debt'}
					</Text>
					{isLoading ? (
						<SummaryValueSkeleton />
					) : (
						<Text className={summaryStyle.className}>
							{translateAmount(displayAmount, {
								currencySymbol: '৳',
								decimalPlaces: 2,
							})}
						</Text>
					)}
				</View>
			</View>
		)
	}
)

// Memoized empty component
const EmptyComponent = memo(({ searchValue, loc }) => (
	<View className="flex-1 justify-center items-center p-8">
		<Text className="text-gray-500 text-lg text-center">
			{searchValue
				? loc.t('debt.noSearchResults') ||
					'No customers found matching your search'
				: loc.t('debt.noDebtFound') || 'No debt records found'}
		</Text>
		{searchValue && (
			<Text className="text-gray-400 text-sm text-center mt-2">
				{loc.t('debt.tryDifferentSearch') ||
					'Try searching with a different term'}
			</Text>
		)}
	</View>
))

// Memoized Add Debt Button Component
const AddDebtButton = memo(({ onPress, text }) => {
	const handlePress = useCallback(() => {
		onPress()
	}, [onPress])

	return (
		<TouchableOpacity
			onPress={handlePress}
			activeOpacity={0.8}
			className="flex-1"
		>
			<View className="bg-btnPrimary items-center rounded-full py-2">
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

// Confirmation Modal Component
const ConfirmationModal = memo(
	({ visible, onClose, onConfirm, selectedCount, translateNumber, loc }) => {
		const [isScheduled, setIsScheduled] = useState(false)
		const [selectedDateTime, setSelectedDateTime] = useState(null)
		const [showDatePicker, setShowDatePicker] = useState(false)
		const [showTimePicker, setShowTimePicker] = useState(false)
		const [tempDate, setTempDate] = useState(new Date())

		// Reset state when modal closes
		useEffect(() => {
			if (!visible) {
				setIsScheduled(false)
				setSelectedDateTime(null)
				setShowDatePicker(false)
				setShowTimePicker(false)
				setTempDate(new Date())
			}
		}, [visible])

		const handleDateChange = (event, selectedDate) => {
			setShowDatePicker(false)

			if (event.type === 'dismissed' || !selectedDate) {
				return
			}

			setTempDate(selectedDate)
			setTimeout(() => {
				setShowTimePicker(true)
			}, 50)
		}

		const handleTimeChange = (event, selectedTime) => {
			setShowTimePicker(false)

			if (event.type === 'dismissed' || !selectedTime) {
				return
			}

			const finalDateTime = new Date(tempDate)
			finalDateTime.setHours(selectedTime.getHours())
			finalDateTime.setMinutes(selectedTime.getMinutes())
			finalDateTime.setSeconds(0)
			finalDateTime.setMilliseconds(0)

			setSelectedDateTime(finalDateTime)
		}

		const openDateTimePicker = () => {
			const initialDate = selectedDateTime || new Date()
			setTempDate(initialDate)
			setShowDatePicker(true)
		}

		const formatDateTime = (date) => {
			if (!date) return loc.t('debt.selectDateTime') || 'Select date and time'
			return `${date.toLocaleDateString('en-US', {
				weekday: 'short',
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			})} ${loc.t('debt.at') || 'at'} ${date.toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: '2-digit',
				hour12: true,
			})}`
		}

		const minimumDate = useMemo(() => {
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			return today
		}, [])

		const canConfirm = !isScheduled || (isScheduled && selectedDateTime)

		const handleConfirm = () => {
			if (canConfirm) {
				onConfirm(isScheduled ? selectedDateTime : new Date())
			}
		}

		return (
			<Modal
				visible={visible}
				transparent={true}
				animationType="fade"
				onRequestClose={onClose}
			>
				<TouchableOpacity
					activeOpacity={1}
					onPress={onClose}
					className="flex-1 justify-center items-center px-5"
					style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
				>
					<TouchableOpacity
						activeOpacity={1}
						onPress={(e) => e.stopPropagation()}
						className="w-full max-w-[340px] rounded-xl p-6 items-center"
						style={{
							backgroundColor: '#F0F8FF',
							shadowColor: '#000',
							shadowOffset: { width: 0, height: 2 },
							shadowOpacity: 0.25,
							shadowRadius: 3.84,
							elevation: 5,
						}}
					>
						<ScrollView
							showsVerticalScrollIndicator={false}
							className="w-full"
							contentContainerStyle={{ alignItems: 'center' }}
						>
							<View className="mb-4">
								<MaterialCommunityIcons
									name="alert-circle-outline"
									size={48}
									color="#177DFF"
								/>
							</View>
							<Text
								className="text-lg font-semibold text-center mb-2"
								style={{ color: '#1F2937' }}
							>
								{loc.t('debt.confirmReminderTitle') || 'Send Debt Reminder?'}
							</Text>
							<Text
								className="text-sm text-center mb-4"
								style={{ color: '#6B7280', lineHeight: 20 }}
							>
								{loc.t('debt.confirmReminderMessage') ||
									'This will send debt reminders to'}{' '}
								<Text className="font-bold">
									{translateNumber(selectedCount)}
								</Text>{' '}
								{loc.t('debt.customers') || 'customers'}.
							</Text>

							{/* Credit Info */}
							<View className="bg-blue-50 rounded-lg p-3 mb-4 w-full">
								<View className="flex-row justify-between items-center">
									<Text
										className="text-sm font-semibold"
										style={{ color: '#1F2937' }}
									>
										{loc.t('debt.creditsToUse') || 'Credits to use:'}
									</Text>
									<Text className="text-lg font-bold text-blue-600">
										{translateNumber(selectedCount)}
									</Text>
								</View>
							</View>

							{/* Schedule Toggle */}
							<View className="w-full mb-4">
								<View className="flex-row items-center justify-between bg-white rounded-lg p-3 border border-gray-200">
									<TouchableOpacity
										className={`flex-1 py-2 rounded-lg items-center mr-2 ${
											!isScheduled ? 'bg-blue-500' : 'bg-gray-100'
										}`}
										onPress={() => setIsScheduled(false)}
										activeOpacity={0.7}
									>
										<Text
											className={`font-semibold text-sm ${
												!isScheduled ? 'text-white' : 'text-gray-600'
											}`}
											numberOfLines={1}
										>
											{loc.t('debt.sendNow') || 'Send Now'}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										className={`flex-1 py-2 rounded-lg items-center ml-2 ${
											isScheduled ? 'bg-blue-500' : 'bg-gray-100'
										}`}
										onPress={() => setIsScheduled(true)}
										activeOpacity={0.7}
									>
										<Text
											className={`font-semibold text-sm ${
												isScheduled ? 'text-white' : 'text-gray-600'
											}`}
											numberOfLines={1}
										>
											{loc.t('debt.schedule') || 'Schedule'}
										</Text>
									</TouchableOpacity>
								</View>
							</View>

							{/* Date Time Picker (shown when scheduled) */}
							{isScheduled && (
								<View className="w-full mb-4">
									<TouchableOpacity
										className="bg-white rounded-lg border border-gray-200 p-3 flex-row justify-between items-center"
										onPress={openDateTimePicker}
										activeOpacity={0.7}
									>
										<Text
											className={`text-sm flex-1 ${
												selectedDateTime ? 'text-gray-800' : 'text-gray-500'
											}`}
											numberOfLines={2}
										>
											{formatDateTime(selectedDateTime)}
										</Text>
										<MaterialCommunityIcons
											name="calendar-clock"
											size={20}
											color="#177DFF"
										/>
									</TouchableOpacity>
								</View>
							)}

							{/* Action Buttons */}
							<View className="flex-row w-full gap-3 mt-2">
								<TouchableOpacity
									className="flex-1 py-3 rounded-lg items-center justify-center"
									style={{ backgroundColor: '#6B7280', minHeight: 44 }}
									onPress={onClose}
									activeOpacity={0.8}
								>
									<Text className="text-white font-semibold text-base">
										{loc.t('debt.cancel') || 'Cancel'}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									className={`flex-1 py-3 rounded-lg items-center justify-center ${
										canConfirm ? '' : 'opacity-50'
									}`}
									style={{
										backgroundColor: canConfirm ? '#177DFF' : '#93C5FD',
										minHeight: 44,
									}}
									onPress={handleConfirm}
									disabled={!canConfirm}
									activeOpacity={0.8}
								>
									<Text className="text-white font-semibold text-base">
										{loc.t('debt.send') || 'Send'}
									</Text>
								</TouchableOpacity>
							</View>
						</ScrollView>

						{/* Date Picker (lazy-loaded) */}
						{showDatePicker && (
							<DateTimePickerLazy
								value={tempDate}
								mode="date"
								display="default"
								onChange={handleDateChange}
								minimumDate={minimumDate}
							/>
						)}

						{/* Time Picker (lazy-loaded) */}
						{showTimePicker && (
							<DateTimePickerLazy
								value={tempDate}
								mode="time"
								display="default"
								onChange={handleTimeChange}
								is24Hour={false}
							/>
						)}
					</TouchableOpacity>
				</TouchableOpacity>
			</Modal>
		)
	}
)

export default function DebtScreen() {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const router = useRouter()
	const { translateNumber, translateAmount, translatePhone } =
		useNumberTranslator()
	const [modalVisible, setModalVisible] = useState(false)
	const [selectedDebt, setSelectedDebt] = useState(null)
	// IMPORTANT: initial isLoading is false so the static UI (header, search,
	// table header, action buttons) renders instantly. The skeleton only shows
	// in the data list slot — never as a full-screen blank.
	const [isLoading, setIsLoading] = useState(false)
	const [totalDebtAmount, setTotalDebtAmount] = useState(0)
	const [totalDebtCustomers, setTotalDebtCustomers] = useState(0)
	const [addPreviousDebtVisible, setAddPreviousDebtVisible] = useState(false)
	const [isReminderMode, setIsReminderMode] = useState(false)
	const [selectedDebtors, setSelectedDebtors] = useState([])
	const [showConfirmModal, setShowConfirmModal] = useState(false)
	const [shopInfo, setShopInfo] = useState(null)

	// Unified fetch function for pagination and search
	const [searchValue, setSearchValue] = useState('')
	const [debtData, setDebtData] = useState([])
	const [page, setPage] = useState(1)
	const [limit] = useState(10)
	const [hasMore, setHasMore] = useState(true)
	const [isFetchingMore, setIsFetchingMore] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)

	// Use refs to prevent continuous re-fetching (like customer page)
	const isFetchingRef = useRef(false)
	const hasInitializedRef = useRef(false)
	const [searchTerm, setSearchTerm] = useState('')
	const lastDataHashRef = useRef('')
	const lastSummaryHashRef = useRef('')

	// Filter states
	const [statusFilter, setStatusFilter] = useState('ALL') // 'UNPAID' | 'PAID' | 'PARTIALLY_PAID' | 'ALL'
	const [includeCompleted, setIncludeCompleted] = useState(false)
	const [showFilterMenu, setShowFilterMenu] = useState(false)

	const refreshDataOnDebtEdit = (debtId) => {}

	// modal to show KYC info
	const [showKycModal, setShowKycModal] = useState(false)

	// Fetch shop info for credits — deferred so it doesn't block initial paint.
	useEffect(() => {
		const handle = InteractionManager.runAfterInteractions(async () => {
			const result = await fetchData(getShopInfo, {})
			if (result.success) {
				setShopInfo(result.data)
			}
		})
		return () => handle.cancel?.()
	}, [])

	// Helper function to create a simple hash of data for comparison
	const createDataHash = useCallback((data, summary) => {
		const dataStr = JSON.stringify(
			data?.map((item) => ({
				id: item.id,
				totalDebt: item.totalDebt,
				name: item.name,
				address: item.address,
			})) || []
		)
		const summaryStr = JSON.stringify({
			totalRemainingAmount: summary?.totalRemainingAmount || 0,
			totalDebtCustomers: summary?.totalDebtCustomers || 0,
		})
		return dataStr + summaryStr
	}, [])

	// Memoized debt calculation function
	const calculateTotalDebt = useCallback((items) => {
		if (!items || items.length === 0) {
			return 0
		}

		return items.reduce((total, item) => {
			const debtAmount =
				(item.checkout?.totalPrice || 0) - (item.paidAmount || 0)
			return total + debtAmount
		}, 0)
	}, [])

	// Main search handler (like customer page)
	// Note: `debtData` is intentionally read via a functional state update
	// inside setDebtData so it does not need to be a dependency. Keeping the
	// dependency list small prevents this callback from being recreated on
	// every render and avoids re-triggering the search effect.
	const handleSearch = useCallback(
		async (pageToFetch = 1, isReset = false) => {
			const params = {
				searchTerm: searchTerm,
				limit,
				page: pageToFetch,
				...(includeCompleted && { includeCompleted: true }),
				...(statusFilter !== 'ALL' && { status: statusFilter }),
			}
			try {
				if (isReset) setIsLoading(true)
				else setIsFetchingMore(true)

				const res = await fetchData(getAllDebt, params)
				if (!res.success) {
					throw new Error('Failed to fetch debt data')
				} else {
					// Use meta for pagination
					const meta = res.data.meta || {}

					// Format data inline to avoid dependency issues
					const unnamedText = loc.t('debt.unnamed') || 'Unnamed'
					const formattedData =
						res.data.data?.map((debt) => ({
							id: debt.buyer?.id || '',
							name: debt.buyer?.Shops[0].name || unnamedText,
							number: debt.buyer?.number || '',
							address: debt.buyer?.Shops[0].address || '-',
							totalDebt: calculateTotalDebt(debt.items) || 0,
							items: debt.items || [],
							buyer: debt.buyer || {},
						})) || []

					// Use functional state updates so we don't need to depend on
					// `debtData` and can avoid recreating this callback per render.
					setDebtData((prev) => {
						const newDataForComparison = isReset
							? formattedData
							: [...prev, ...formattedData]
						const newDataHash = createDataHash(
							newDataForComparison,
							res.data.summary
						)

						if (isReset && newDataHash !== lastDataHashRef.current) {
							lastDataHashRef.current = newDataHash
							return formattedData
						} else if (!isReset) {
							// For pagination, always append new data
							const completeDataHash = createDataHash(
								[...prev, ...formattedData],
								res.data.summary
							)
							lastDataHashRef.current = completeDataHash
							return [...prev, ...formattedData]
						}
						return prev
					})

					setTotalDebtAmount(res.data.summary.totalRemainingAmount)
					setTotalDebtCustomers(res.data.summary.totalDebtCustomers)
					setHasMore(meta.page * meta.limit < meta.total)
				}
			} catch (err) {
				console.log(err)
				ToastAndroid.show(
					loc.t('debt.fetchError') || 'Failed to fetch debt data',
					ToastAndroid.SHORT
				)
			} finally {
				setIsLoading(false)
				setIsFetchingMore(false)
			}
		},
		[
			searchTerm,
			fetchData,
			calculateTotalDebt,
			limit,
			loc.t,
			createDataHash,
			statusFilter,
			includeCompleted,
		]
	)

	// Reset to first page when search term or filters change (like customer page).
	// Skip the very first run — `useFocusEffect` already handles the initial load
	// and we don't want two parallel fetches competing for state on mount.
	const isFirstFilterEffectRef = useRef(true)
	useEffect(() => {
		if (isFirstFilterEffectRef.current) {
			isFirstFilterEffectRef.current = false
			return
		}
		setPage(1)
		setHasMore(true)
		handleSearch(1, true)
	}, [searchTerm, statusFilter, includeCompleted, handleSearch])

	// Function to check if data has changed without updating UI
	const checkForDataChanges = useCallback(async () => {
		if (isFetchingRef.current) return

		try {
			const params = {
				searchTerm: searchTerm,
				limit,
				page: 1, // Only check first page for changes
				...(includeCompleted && { includeCompleted: true }),
				...(statusFilter !== 'ALL' && { status: statusFilter }),
			}

			const res = await fetchData(getAllDebt, params)
			if (res.success) {
				// Format data for comparison
				const unnamedText = loc.t('debt.unnamed') || 'Unnamed'
				const formattedData =
					res.data.data?.map((debt) => ({
						id: debt.buyer?.id || '',
						name: debt.buyer?.Shops[0].name || unnamedText,
						number: debt.buyer?.number || '',
						address: debt.buyer?.Shops[0].address || '-',
						totalDebt: calculateTotalDebt(debt.items) || 0,
						items: debt.items || [],
						buyer: debt.buyer || {},
					})) || []

				// Create hash of current data from server
				const currentServerHash = createDataHash(
					formattedData,
					res.data.summary
				)

				// If data has changed, update the UI
				if (currentServerHash !== lastDataHashRef.current) {
					// Data has changed, directly update state instead of calling handleSearch again
					setDebtData(formattedData)
					setTotalDebtAmount(res.data.summary.totalRemainingAmount)
					setTotalDebtCustomers(res.data.summary.totalDebtCustomers)
					lastDataHashRef.current = currentServerHash
					setPage(1)
					setHasMore(
						res.data.meta.page * res.data.meta.limit < res.data.meta.total
					)

					// Update selectedDebt if it exists to reflect changes in Bottom Sheet
					setSelectedDebt((currentSelected) => {
						if (!currentSelected) return null
						const updatedSelected = formattedData.find(
							(item) => item.id === currentSelected.id
						)
						return updatedSelected || currentSelected
					})
				}
			}
		} catch (err) {
			console.error('Error checking for data changes:', err)
			// Don't show error toast for background checks
		}
	}, [
		searchTerm,
		fetchData,
		calculateTotalDebt,
		limit,
		loc.t,
		createDataHash,
		statusFilter,
		includeCompleted,
	])

	// Stable fetch function for pull-to-refresh (like customer page)
	const fetchDebtData = useCallback(
		async (isRefresh = false) => {
			if (isFetchingRef.current) return
			isFetchingRef.current = true
			setIsRefreshing(true)
			try {
				await handleSearch(1, true)
				setPage(1)
				setHasMore(true)
				hasInitializedRef.current = true
			} catch (err) {
				ToastAndroid.show(
					loc.t('debt.fetchError') || 'Failed to fetch debt data',
					ToastAndroid.SHORT
				)
			} finally {
				setIsRefreshing(false)
				isFetchingRef.current = false
			}
		},
		[handleSearch, loc]
	)

	// Use useFocusEffect with smart data checking.
	// We defer the actual network call until after the navigation transition
	// finishes via InteractionManager. This guarantees the screen paints
	// instantly when the debt icon is tapped and the skeleton (or cached data)
	// is visible the moment the transition completes.
	useFocusEffect(
		useCallback(() => {
			const handle = InteractionManager.runAfterInteractions(() => {
				if (!hasInitializedRef.current && !isFetchingRef.current) {
					// First time loading - fetch data normally
					fetchDebtData()
				} else if (hasInitializedRef.current) {
					// Already initialized - check for changes without forcing refresh
					checkForDataChanges()
				}
			})
			return () => handle.cancel?.()
		}, [fetchDebtData, checkForDataChanges])
	)

	// Memoized search handler for SearchBar component
	const handleSearchInput = useCallback((term) => {
		setSearchTerm(term)
	}, [])

	// Memoized infinite scroll handler
	const handleLoadMore = useCallback(() => {
		if (!isLoading && !isFetchingMore && hasMore) {
			const nextPage = page + 1
			setPage(nextPage)
			handleSearch(nextPage, false)
		}
	}, [isLoading, isFetchingMore, hasMore, page, handleSearch])

	// Toggle debtor selection
	const toggleDebtorSelection = useCallback((debtorId) => {
		setSelectedDebtors((prev) => {
			if (prev.includes(debtorId)) {
				return prev.filter((id) => id !== debtorId)
			} else {
				return [...prev, debtorId]
			}
		})
	}, [])

	// Memoized modal handlers
	const openDebtModal = useCallback(
		(debt) => {
			if (!isReminderMode) {
				setSelectedDebt(debt)
				setModalVisible(true)
			}
		},
		[isReminderMode]
	)

	const handlePayDebt = useCallback(
		(debtId) => {
			setModalVisible(false)
			// Check for changes after payment instead of forcing refresh
			setTimeout(() => checkForDataChanges(), 500)
		},
		[checkForDataChanges]
	)

	const handleViewDetails = useCallback((debtId) => {
		setModalVisible(false)
		console.log('View details for debt ID:', debtId)
	}, [])

	// Memoized render item function for FlashList
	const renderDebtItem = useCallback(
		({ item }) => (
			<DebtRowComponent
				data={item}
				onOpenModal={openDebtModal}
				translateAmount={translateAmount}
				isHeaderRow={false}
				isReminderMode={isReminderMode}
				isSelected={selectedDebtors.includes(item.id)}
				onToggleSelection={toggleDebtorSelection}
			/>
		),
		[
			openDebtModal,
			translateAmount,
			isReminderMode,
			selectedDebtors,
			toggleDebtorSelection,
		]
	)

	// Keep getItemLayout stable so FlashList can skip measurement work.
	const getItemType = useCallback(() => 'row', [])

	// Key extractor uses the buyer id we already memoize.
	const keyExtractor = useCallback((item) => item?.id || '', [])

	// Memoized header data
	const headerData = useMemo(
		() => ({
			name: loc.t('debt.tableHeader.customer') || 'Customer',
			address: loc.t('debt.tableHeader.address') || 'Address',
			totalDebt: loc.t('debt.tableHeader.debtAmount') || 'Debt Amount',
		}),
		[loc]
	)

	// Calculate selected debt amount
	const selectedDebtAmount = useMemo(() => {
		return debtData
			.filter((debt) => selectedDebtors.includes(debt.id))
			.reduce((sum, debt) => sum + debt.totalDebt, 0)
	}, [debtData, selectedDebtors])

	// Handle reminder mode toggle
	const handleReminderModeToggle = useCallback(() => {
		if (isReminderMode) {
			// Exit reminder mode
			setIsReminderMode(false)
			setSelectedDebtors([])
		} else {
			// Enter reminder mode - select all by default
			setIsReminderMode(true)
			const allDebtorIds = debtData.map((debt) => debt.id)
			setSelectedDebtors(allDebtorIds)
		}
	}, [isReminderMode, debtData])

	// Toggle all debtors selection
	const toggleAllDebtors = useCallback(() => {
		if (selectedDebtors.length === debtData.length) {
			// All selected - deselect all
			setSelectedDebtors([])
		} else {
			// Some or none selected - select all
			const allDebtorIds = debtData.map((debt) => debt.id)
			setSelectedDebtors(allDebtorIds)
		}
	}, [selectedDebtors.length, debtData])

	// Handle send reminders
	const handleSendReminders = useCallback(async () => {
		// Check credits
		const availableCredits = shopInfo?.credit || 0
		if (selectedDebtors.length > availableCredits) {
			ToastAndroid.show(
				loc.t('debt.insufficientCredits') || 'Insufficient credits',
				ToastAndroid.LONG
			)
			return
		}

		// Show confirmation modal
		setShowConfirmModal(true)
	}, [selectedDebtors.length, shopInfo, loc])

	// Confirm and send reminders
	const confirmSendReminders = useCallback(
		async (scheduledDateTime) => {
			setShowConfirmModal(false)

			// Get selected debtor phone numbers
			const selectedDebtorData = debtData.filter((debt) =>
				selectedDebtors.includes(debt.id)
			)
			const receiverIds = selectedDebtorData.map((debt) => debt.buyer.id)

			const data = {
				msgBody: 'debt',
				receiverId: receiverIds,
				scheduledAt: scheduledDateTime,
			}

			try {
				const result = await fetchData(sendManyMessages, data)
				if (result.success) {
					ToastAndroid.show(
						loc.t('debt.remindersSent') || 'Reminders sent successfully',
						ToastAndroid.SHORT
					)
					// Exit reminder mode and refresh data
					setIsReminderMode(false)
					setSelectedDebtors([])
					// Refresh shop info to update credits
					const shopResult = await fetchData(getShopInfo, {})
					if (shopResult.success) {
						setShopInfo(shopResult.data)
					}
				} else {
					if (result.message === 'KYC_ERR') {
						setShowKycModal(true)
					} else {
						ToastAndroid.show(
							loc.t('debt.remindersFailed') || 'Failed to send reminders',
							ToastAndroid.SHORT
						)
					}
				}
			} catch (err) {
				console.error('Error sending reminders:', err)
				ToastAndroid.show(
					loc.t('debt.remindersFailed') || 'Failed to send reminders',
					ToastAndroid.SHORT
				)
			}
		},
		[debtData, selectedDebtors, fetchData, loc]
	)

	// Memoized close handlers
	const handleCloseDebtDetails = useCallback(
		(wasModified) => {
			setModalVisible(false)
			setSelectedDebt(null)
			// Only refresh if data was actually modified
			if (wasModified) {
				setTimeout(() => checkForDataChanges(), 500)
			}
		},
		[checkForDataChanges]
	)

	const handleCloseAddPreviousDebt = useCallback(() => {
		setAddPreviousDebtVisible(false)
		// Check for changes instead of forcing refresh (in case debt was added)
		setTimeout(() => checkForDataChanges(), 500)
	}, [checkForDataChanges])

	// Memoized refresh handler (like customer page)
	const handleRefresh = useCallback(() => {
		hasInitializedRef.current = false
		fetchDebtData(true)
	}, [fetchDebtData])

	// Memoized list footer component — memoized so FlashList doesn't re-render
	// its slot on unrelated state changes (e.g. search keystrokes).
	const ListFooterComponent = useMemo(() => {
		return isFetchingMore && hasMore ? <SkeletonFooter /> : null
	}, [isFetchingMore, hasMore])

	// Stable identity for the list footer so FlashList doesn't tear it down.
	const stableFooter = useMemo(
		() => <>{ListFooterComponent}</>,
		[ListFooterComponent]
	)

	// Empty component: rebuild only when search term or loc actually changes.
	const ListEmptyComponent = useMemo(
		() => <EmptyComponent searchValue={searchTerm} loc={loc} />,
		[searchTerm, loc]
	)

	// Memoized empty functions for SearchBar
	const emptyOnSelect = useCallback(() => {}, [])
	const emptyRenderItem = useCallback(() => null, [])

	// Memoized add button text
	const addDebtButtonText = useMemo(
		() => loc.t('debt.addPreviousDebt') || 'Add Previous Debt',
		[loc]
	)

	// Memoized reminder button text
	const reminderButtonText = useMemo(
		() => loc.t('debt.reminder') || 'Reminder',
		[loc]
	)

	// Memoized button handler
	const handleOpenAddDebt = useCallback(() => {
		setAddPreviousDebtVisible(true)
	}, [])

	return (
		<View className="flex-1">
			{/* Backdrop for filter menu */}
			{showFilterMenu && (
				<Pressable
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						zIndex: 1999,
						backgroundColor: 'transparent',
					}}
					onPress={() => setShowFilterMenu(false)}
				/>
			)}

			<View className="bg-primaryTheme p-4 border-b-4 border-b-pageHeaderFooterBorder">
				<View className="flex-row items-center">
					<View className="flex-1 mr-3">
						<SearchBar
							fetchSearchData={handleSearchInput}
							onSelect={emptyOnSelect}
							placeholder={
								loc.t('debt.searchPlaceholder') || 'Search customers...'
							}
							renderItem={emptyRenderItem}
							debounceDelay={10}
							showSearchResult={false}
						/>
					</View>

					{/* Filter Dropdown */}
					<View className="relative" style={{ zIndex: 2100 }}>
						<Pressable
							className="bg-white px-3 py-4 rounded-xl border border-gray-300 flex-row items-center"
							onPress={() => setShowFilterMenu((s) => !s)}
						>
							<Ionicons name="filter" size={20} color="#177DFF" />
							<Text className="text-sm font-medium ml-2 mr-1">
								{statusFilter === 'ALL'
									? loc.t('debt.filter.all') || 'All'
									: statusFilter === 'UNPAID'
										? loc.t('debt.filter.unpaid') || 'Unpaid'
										: statusFilter === 'PAID'
											? loc.t('debt.filter.paid') || 'Paid'
											: loc.t('debt.filter.partiallyPaid') || 'Partial'}
							</Text>
							<Ionicons
								name={showFilterMenu ? 'chevron-up' : 'chevron-down'}
								size={16}
								color="#555"
							/>
						</Pressable>

						{/* Dropdown Menu */}
						{showFilterMenu && (
							<View
								className="absolute top-12 right-0 w-56 bg-white rounded-lg border border-gray-300 shadow-lg"
								style={{ zIndex: 2500, elevation: 16 }}
							>
								{/* Status Filter Options */}
								<View className="border-b border-gray-200 pb-2">
									<Text className="text-xs text-gray-500 px-3 pt-2 pb-1 font-semibold">
										{loc.t('debt.filter.statusLabel') || 'Status'}
									</Text>
									{[
										{
											key: 'UNPAID',
											label: loc.t('debt.filter.unpaid') || 'Unpaid',
										},
										{ key: 'PAID', label: loc.t('debt.filter.paid') || 'Paid' },
										{
											key: 'PARTIALLY_PAID',
											label:
												loc.t('debt.filter.partiallyPaid') || 'Partially Paid',
										},
										{ key: 'ALL', label: loc.t('debt.filter.all') || 'All' },
									].map((opt, idx) => (
										<Pressable
											key={opt.key}
											className="px-3 py-2 flex-row items-center"
											onPress={() => {
												setStatusFilter(opt.key)
											}}
										>
											<Text className="text-sm flex-1">{opt.label}</Text>
											{statusFilter === opt.key && (
												<Ionicons name="checkmark" size={16} color="#177DFF" />
											)}
										</Pressable>
									))}
								</View>

								{/* Include Completed Option */}
								<View className="pt-2">
									<Pressable
										className="px-3 py-2 flex-row items-center"
										onPress={() => {
											setIncludeCompleted((prev) => !prev)
										}}
									>
										<View
											className={`w-5 h-5 rounded border-2 items-center justify-center mr-2 ${
												includeCompleted
													? 'bg-blue-500 border-blue-500'
													: 'border-gray-300'
											}`}
										>
											{includeCompleted && (
												<Ionicons name="checkmark" size={14} color="white" />
											)}
										</View>
										<Text className="text-sm flex-1">
											{loc.t('debt.filter.includePastDebt') ||
												'Include Past Debt'}
										</Text>
									</Pressable>
								</View>
							</View>
						)}
					</View>
				</View>

				{/* Total debt summary */}
				{/* Show if data exists OR if initial loading (no data yet) */}
				{(debtData.length > 0 || (isLoading && !hasInitializedRef.current)) && (
					<TotalDebtSummary
						totalDebtCustomers={totalDebtCustomers}
						totalDebtAmount={totalDebtAmount}
						translateNumber={translateNumber}
						translateAmount={translateAmount}
						loc={loc}
						isReminderMode={isReminderMode}
						selectedCount={selectedDebtors.length}
						selectedDebtAmount={selectedDebtAmount}
						isLoading={isLoading && !hasInitializedRef.current}
					/>
				)}
			</View>

			<View className="flex-1">
				{/* Table header */}
				<View className="bg-tableRowHeaderBg">
					<DebtRowComponent
						data={headerData}
						isHeaderRow={true}
						translateAmount={translateAmount}
						isReminderMode={isReminderMode}
						onToggleSelection={toggleAllDebtors}
					/>
				</View>

				{/* Table content */}
				{isLoading && debtData.length === 0 ? (
					<ScrollView
						className="flex-1 p-3"
						showsVerticalScrollIndicator={false}
					>
						{[...Array(8)].map((_, index) => (
							<View key={index} className="mb-2">
								<SkeletonLoader />
							</View>
						))}
					</ScrollView>
				) : (
					<FlashList
						data={debtData}
						renderItem={renderDebtItem}
						keyExtractor={(item) => item.id}
						showsVerticalScrollIndicator={false}
						refreshing={isRefreshing}
						onRefresh={handleRefresh}
						onEndReached={handleLoadMore}
						onEndReachedThreshold={0.5}
						ListEmptyComponent={ListEmptyComponent}
						ListFooterComponent={ListFooterComponent}
						removeClippedSubviews={false}
						maxToRenderPerBatch={10}
						windowSize={10}
						initialNumToRender={8}
						updateCellsBatchingPeriod={50}
						extraData={isReminderMode ? selectedDebtors : null}
					/>
				)}
			</View>

			{/* Bottom Action Buttons */}
			{isReminderMode ? (
				<View className="flex-row mx-4 my-4 gap-2">
					<TouchableOpacity
						className="flex-1 bg-red-600 py-4 rounded-full items-center"
						onPress={handleReminderModeToggle}
						activeOpacity={0.8}
					>
						<Text className="text-white font-semibold text-xl">
							{loc.t('debt.cancel') || 'Cancel'}
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						className={`flex-1 py-4 rounded-full items-center ${
							selectedDebtors.length > 0 ? 'bg-blue-600' : 'bg-gray-300'
						}`}
						onPress={handleSendReminders}
						disabled={selectedDebtors.length === 0}
						activeOpacity={0.8}
					>
						<Text
							className={`font-semibold text-xl ${
								selectedDebtors.length > 0 ? 'text-white' : 'text-gray-500'
							}`}
							numberOfLines={1}
							textBreakStrategy="simple"
						>
							{loc.t('debt.send') || 'Send'} (
							{translateNumber(selectedDebtors.length)})
						</Text>
					</TouchableOpacity>
				</View>
			) : (
				<View className="flex-row mx-4 my-4 gap-2">
					<AddDebtButton
						onPress={handleReminderModeToggle}
						text={reminderButtonText}
					/>
					<AddDebtButton onPress={handleOpenAddDebt} text={addDebtButtonText} />
				</View>
			)}

			{/* Debt Details Modal */}
			<DebtDetails
				visible={modalVisible}
				onClose={handleCloseDebtDetails}
				debtData={selectedDebt}
				onPayDebt={handlePayDebt}
				onViewDetails={handleViewDetails}
				onDebtUpdate={checkForDataChanges}
			/>

			{/* Add Previous Debt Modal */}
			<AddPreviousDebt
				visible={addPreviousDebtVisible}
				onClose={handleCloseAddPreviousDebt}
			/>

			{/* Confirmation Modal */}
			<ConfirmationModal
				visible={showConfirmModal}
				onClose={() => setShowConfirmModal(false)}
				onConfirm={confirmSendReminders}
				selectedCount={selectedDebtors.length}
				translateNumber={translateNumber}
				loc={loc}
			/>

			{/* KYC Verification Modal */}
			<ConfirmModal
				visible={showKycModal}
				onClose={() => setShowKycModal(false)}
				onConfirm={() => {
					setShowKycModal(false)
					router.push('/kyc')
				}}
				title={loc.t('message.kyc.errorTitle') || 'KYC Verification Required'}
				subtitle={
					loc.t('message.kyc.errorMessage') ||
					'Your account needs to be KYC verified to send messages. Please complete the KYC process.'
				}
				confirmText={loc.t('message.kyc.proceedButton') || 'Proceed to KYC'}
				cancelText={loc.t('common.ok') || 'OK'}
				iconName="verified-user"
				iconColor="#F59E0B"
				confirmButtonColor="#177DFF"
			/>
		</View>
	)
}
