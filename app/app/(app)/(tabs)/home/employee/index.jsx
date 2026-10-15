import {
	FlatList,
	Text,
	TouchableOpacity,
	View,
	ToastAndroid,
	Linking,
	BackHandler,
} from 'react-native'
import SearchBar from '../../../../../src/components/searchBar.jsx'
import { useCallback, useState, useMemo, memo, useRef } from 'react'
import EmployeeDetails from '../../../../../src/components/employee/employeeDetails.jsx'
import { router, useFocusEffect } from 'expo-router'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'
import {
	getAllEmployee,
	deleteEmployee,
} from '../../../../../src/controllers/employee.js'
import useApi from '../../../../../src/hooks/useApi.jsx'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
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

// Employee Avatar Component
const EmployeeAvatar = memo(({ name, size = 32 }) => {
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
const EmployeeSkeletonLoader = memo(() => (
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

// Memoized Employee Row Component
const EmployeeRow = memo(({ data, onPress, onCall, translatePhone }) => {
	const isHeader = !data.id

	const handlePress = useCallback(() => {
		if (data.id && onPress) {
			onPress(data)
		}
	}, [data.id, data, onPress])

	const handleCall = useCallback(() => {
		if (data.number && data.id && onCall) {
			onCall(data.number)
		}
	}, [data.number, data.id, onCall])

	return (
		<View className="flex-row mx-3 border-b-slate-300 border-b-2 items-center py-3">
			{/* Name Column */}
			{isHeader ? (
				<View className="w-1/2 mr-2 flex-row items-center justify-start">
					<Text
						className="text-xl font-bold"
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{data.name}
					</Text>
				</View>
			) : (
				<TouchableOpacity
					className="w-1/2 mr-2 flex-row items-center"
					onPress={handlePress}
					activeOpacity={0.7}
				>
					{/* Avatar */}
					<View className="mr-2 flex-shrink-0">
						<EmployeeAvatar name={data.name} size={32} />
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
			)}

			{/* Number Column */}
			<View className="w-1/2 flex-row items-center justify-start">
				<Text
					className={`${
						isHeader ? 'text-xl font-bold' : 'text-sm font-medium'
					}`}
					numberOfLines={1}
					ellipsizeMode="tail"
					style={{
						flexShrink: 1,
						maxWidth: data.number && data.id ? '85%' : '100%',
					}}
				>
					{isHeader ? data.number : translatePhone(data.number)}
				</Text>
				{data.number && data.id && (
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

// Memoized Employee Requests Button Component
const EmployeeRequestsButton = memo(({ onPress, text }) => {
	const handlePress = useCallback(() => {
		onPress()
	}, [onPress])

	return (
		<TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
			<View className="bg-btnPrimary items-center rounded-full py-2 mx-4 my-4">
				<Text className="text-xl mt-2 mb-2 text-white">{text}</Text>
			</View>
		</TouchableOpacity>
	)
})

// Memoized Search Component
const SearchComponent = memo(({ onSearch, placeholder }) => {
	return (
		<View>
			<SearchBar
				fetchSearchData={onSearch}
				onSelect={() => {}}
				placeholder={placeholder}
				renderItem={() => null}
				debounceDelay={10}
				showSearchResult={false}
			/>
		</View>
	)
})

export default function EmployeeScreen() {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const { translatePhone } = useNumberTranslator()
	const [openDetails, setOpenDetails] = useState(false)
	const [selectedEmployee, setSelectedEmployee] = useState(null)
	const [searchValue, setSearchValue] = useState('')
	const [employeeData, setEmployeeData] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)

	// Use ref to prevent continuous re-fetching
	const isFetchingRef = useRef(false)
	const hasInitializedRef = useRef(false)

	// Memoized search handler
	const handleSearch = useCallback((item) => {
		setSearchValue(item)
	}, [])

	const fetchSearchData = async (searchTerm) => {
		const params = {
			searchTerm: searchTerm,
		}
		try {
			const result = await fetchData(getAllEmployee, params)
			if (!result.success) {
				throw 'API Error'
			}
			setEmployeeData(result?.data?.data || [])
		} catch (err) {
			console.error('🚀 err : ', err)
		}
	}

	// Stable fetch function - removed dependencies that cause re-creation
	const fetchEmployee = useCallback(
		async (isRefresh = false) => {
			// Prevent multiple simultaneous fetches
			if (isFetchingRef.current) {
				return
			}

			isFetchingRef.current = true

			if (isRefresh) {
				setIsRefreshing(true)
			} else {
				setIsLoading(true)
			}

			try {
				const res = await fetchData(getAllEmployee, {})
				if (!res.success) {
					throw new Error('Failed to fetch employees')
				}
				setEmployeeData(res.data.data || [])
				hasInitializedRef.current = true
			} catch (err) {
				ToastAndroid.show(
					loc.t('employee.fetchError') || 'Failed to fetch employees',
					ToastAndroid.SHORT
				)
			} finally {
				setIsLoading(false)
				setIsRefreshing(false)
				isFetchingRef.current = false
			}
		},
		[fetchData, loc]
	)

	// Use useFocusEffect with stable dependencies
	useFocusEffect(
		useCallback(() => {
			// Only fetch if not already initialized or if explicitly refreshing
			if (!hasInitializedRef.current && !isFetchingRef.current) {
				fetchEmployee()
			}
		}, [fetchEmployee])
	)

	// Handle hardware back button for Android
	useFocusEffect(
		useCallback(() => {
			const onBackPress = () => {
				router.push('/home/dashboard')
				return true
			}

			const subscription = BackHandler.addEventListener(
				'hardwareBackPress',
				onBackPress
			)

			return () => subscription.remove()
		}, [])
	)

	// Memoized employee details handler
	const openEmployeeDetails = useCallback((employee) => {
		setSelectedEmployee(employee)
		setOpenDetails(true)
	}, [])

	// Memoized close details handler
	const handleCloseDetails = useCallback(() => {
		setOpenDetails(false)
		setSelectedEmployee(null)
	}, [])

	// Memoized call employee handler
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
							'Phone calls are not supported on this device',
						ToastAndroid.SHORT
					)
				}
			} catch (error) {
				ToastAndroid.show(
					loc.t('employee.callError') || 'Error making phone call',
					ToastAndroid.SHORT
				)
			}
		},
		[loc]
	)

	// Memoized delete employee handler
	const handleDeleteEmployee = useCallback(
		async (employeeId) => {
			try {
				const res = await fetchData(deleteEmployee, { employeeId: employeeId })
				if (res.success === true) {
					ToastAndroid.show(
						loc.t('employee.deleteSuccess') || 'Employee deleted successfully',
						ToastAndroid.SHORT
					)
					// Force refresh after deleting
					hasInitializedRef.current = false
					await fetchEmployee()
				} else {
					ToastAndroid.show(
						loc.t('employee.deleteError') || 'Failed to delete employee',
						ToastAndroid.SHORT
					)
				}
			} catch (err) {
				ToastAndroid.show(
					loc.t('employee.deleteError') || 'Failed to delete employee',
					ToastAndroid.SHORT
				)
			}
		},
		[fetchData, fetchEmployee, loc]
	)

	// Memoized employee requests navigation handler
	const handleEmployeeRequests = useCallback(() => {
		router.push('/home/employee/joinRequests')
	}, [])

	// Memoized filtered employees - only recalculates when employeeData or searchValue changes
	const filteredEmployees = useMemo(() => {
		if (!searchValue.trim()) {
			return employeeData
		}

		const filtered = employeeData.filter((employee) => {
			const translatedPhone = translatePhone(employee.number || '')
			return (
				employee.name?.toLowerCase().includes(searchValue.toLowerCase()) ||
				employee.number?.toLowerCase().includes(searchValue.toLowerCase()) ||
				translatedPhone.toLowerCase().includes(searchValue.toLowerCase())
			)
		})

		return filtered
	}, [employeeData, searchValue, translatePhone])

	// Memoized table header
	const tableHeader = useMemo(
		() => ({
			name: loc.t('employee.tableHeader.name') || 'Name',
			number: loc.t('employee.tableHeader.number') || 'Number',
		}),
		[loc]
	)

	// Memoized localized texts
	const localizedTexts = useMemo(
		() => ({
			searchPlaceholder:
				loc.t('employee.searchPlaceholder') || 'Search employees...',
			addBtn: loc.t('employee.addBtn') || 'Employee Requests',
			attendanceBtn: loc.t('employee.attendanceBtn') || 'Attendance Requests',
			noSearchResults:
				loc.t('employee.noSearchResults') ||
				'No employees found matching your search',
			noEmployees: loc.t('employee.noEmployees') || 'No employees yet',
			tryDifferentSearch:
				loc.t('employee.tryDifferentSearch') ||
				'Try searching with a different term',
		}),
		[loc]
	)

	// Memoized render item function for FlatList
	const renderEmployeeItem = useCallback(
		({ item }) => (
			<EmployeeRow
				data={item}
				onPress={openEmployeeDetails}
				onCall={handleCallEmployee}
				translatePhone={translatePhone}
			/>
		),
		[openEmployeeDetails, handleCallEmployee, translatePhone]
	)

	// Memoized refresh handler
	const handleRefresh = useCallback(() => {
		hasInitializedRef.current = false
		fetchEmployee(true)
	}, [fetchEmployee])

	// Memoized get item layout for better FlatList performance
	const getItemLayout = useCallback(
		(data, index) => ({
			length: 60, // Approximate height of each row
			offset: 60 * index,
			index,
		}),
		[]
	)

	// Show loading skeleton while initial loading
	if (isLoading && !hasInitializedRef.current) {
		return (
			<View className="flex-1">
				<View className="bg-primaryTheme p-4 border-b-4 border-b-pageHeaderFooterBorder">
					<SearchComponent
						searchValue={searchValue}
						onSearch={fetchSearchData}
						placeholder={localizedTexts.searchPlaceholder}
					/>
				</View>
				<View className="flex-1">
					<View className="bg-tableRowHeaderBg">
						<EmployeeRow data={tableHeader} translatePhone={translatePhone} />
					</View>
					{/* Show skeleton loaders */}
					<View className="flex-1 p-3">
						{[...Array(8)].map((_, index) => (
							<View key={index} className="mb-2">
								<EmployeeSkeletonLoader />
							</View>
						))}
					</View>
				</View>
				<View className="flex-row mx-4 my-2 gap-2">
					<TouchableOpacity
						onPress={handleEmployeeRequests}
						activeOpacity={0.8}
						className="flex-1"
					>
						<View className="bg-btnPrimary items-center rounded-full py-2">
							<Text
								className="text-xl mt-2 mb-2 text-white"
								numberOfLines={1}
								textBreakStrategy="simple"
							>
								{localizedTexts.addBtn}
							</Text>
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => router.push('/home/employee/AttendanceRequest')}
						activeOpacity={0.8}
						className="flex-1"
					>
						<View className="bg-btnPrimary items-center rounded-full py-2">
							<Text
								className="text-xl mt-2 mb-2 text-white"
								numberOfLines={1}
								textBreakStrategy="simple"
							>
								{localizedTexts.attendanceBtn}
							</Text>
						</View>
					</TouchableOpacity>
				</View>
			</View>
		)
	}

	return (
		<View className="flex-1">
			{/* Header Section */}
			<View className="bg-primaryTheme p-4 border-b-4 border-b-pageHeaderFooterBorder">
				<SearchComponent
					searchValue={searchValue}
					onSearch={fetchSearchData}
					placeholder={localizedTexts.searchPlaceholder}
				/>
			</View>

			{/* Content Section */}
			<View className="flex-1">
				{/* Table Header */}
				<View className="bg-tableRowHeaderBg">
					<EmployeeRow data={tableHeader} translatePhone={translatePhone} />
				</View>

				{/* Employee List */}
				<FlatList
					data={filteredEmployees}
					renderItem={renderEmployeeItem}
					keyExtractor={(item) => item.id}
					showsVerticalScrollIndicator={false}
					getItemLayout={getItemLayout}
					initialNumToRender={10}
					maxToRenderPerBatch={5}
					windowSize={10}
					removeClippedSubviews={true}
					refreshing={isRefreshing}
					onRefresh={handleRefresh}
					ListEmptyComponent={() => (
						<View className="flex-1 justify-center items-center p-8">
							<Text className="text-gray-500 text-lg">
								{searchValue
									? localizedTexts.noSearchResults
									: localizedTexts.noEmployees}
							</Text>
							{searchValue && (
								<Text className="text-gray-400 text-sm text-center mt-2">
									{localizedTexts.tryDifferentSearch}
								</Text>
							)}
						</View>
					)}
				/>
			</View>

			{/* Action Buttons Row */}
			<View className="flex-row mx-4 my-4 gap-2">
				{/* Employee Requests Button */}
				<TouchableOpacity
					onPress={handleEmployeeRequests}
					activeOpacity={0.8}
					className="flex-1"
				>
					<View className="bg-btnPrimary items-center rounded-full py-2">
						<Text className="text-xl mt-2 mb-2 text-white">
							{localizedTexts.addBtn}
						</Text>
					</View>
				</TouchableOpacity>

				{/* Attendance Requests Button */}
				<TouchableOpacity
					onPress={() => router.push('/home/employee/AttendanceRequest')}
					activeOpacity={0.8}
					className="flex-1"
				>
					<View className="bg-btnPrimary items-center rounded-full py-2">
						<Text className="text-xl mt-2 mb-2 text-white">
							{localizedTexts.attendanceBtn}
						</Text>
					</View>
				</TouchableOpacity>
			</View>

			{/* Employee Details - Only render when needed */}
			{openDetails && selectedEmployee && (
				<EmployeeDetails
					employee={selectedEmployee}
					visible={openDetails}
					onClose={handleCloseDetails}
					onDelete={handleDeleteEmployee}
				/>
			)}
		</View>
	)
}
