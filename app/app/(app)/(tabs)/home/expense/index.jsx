import {
	Animated,
	Dimensions,
	Easing,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from 'react-native'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import ContentLoader, { Rect } from 'react-content-loader/native'
import useApi from '../../../../../src/hooks/useApi'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import { getAnalytics } from '../../../../../src/controllers/analytics'
import { getExpense } from '../../../../../src/controllers/expense'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import AddExpense from '../../../../../src/components/expense/AddExpense'
import ExpenseDetails from '../../../../../src/components/expense/ExpenseDetails'

const MONTH_KEYS = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december',
]

const DEFAULT_ANALYTICS = {
	profit: 0,
	totalBuy: 0,
	totalDebt: 0,
	totalDiscount: 0,
	totalLoss: 0,
	totalSell: 0,
	totalquantity: 0,
}

function getMonthDateRange(month, year) {
	const startDate = new Date(year, month - 1, 1)
	const endDate = new Date(year, month, 0, 23, 59, 59, 999)
	return {
		startDate: startDate.toISOString(),
		endDate: endDate.toISOString(),
	}
}

function getExpenseRows(result) {
	if (Array.isArray(result?.data?.data)) return result.data.data
	if (Array.isArray(result?.data)) return result.data
	if (Array.isArray(result)) return result
	return []
}

export default function Expenditure() {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const { translateNumber, translateAmount } = useNumberTranslator()
	const now = useMemo(() => new Date(), [])
	const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
	const [selectedYear, setSelectedYear] = useState(now.getFullYear())
	const [analytics, setAnalytics] = useState({ ...DEFAULT_ANALYTICS })
	const [expenseRows, setExpenseRows] = useState([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [showAddExpense, setShowAddExpense] = useState(false)
	const [showExpenseDetails, setShowExpenseDetails] = useState(false)
	const fadeAnim = useRef(new Animated.Value(0)).current
	const hasLoadedRef = useRef(false)
	const isFetchingRef = useRef(false)
	// ✅ Track mount state to prevent setState before mount or after unmount
	const isMountedRef = useRef(false)
	const screenWidth = Dimensions.get('window').width

	// ✅ Set mounted on mount, clear on unmount
	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	const safeNumber = useCallback((value) => {
		const num = Number(value)
		return isFinite(num) ? num : 0
	}, [])

	const formatMoney = useCallback(
		(value) => {
			const safeValue = isFinite(Number(value)) ? Number(value) : 0
			return translateAmount(safeValue, {
				currencySymbol: '৳ ',
				decimalPlaces: 0,
				useCommas: true,
			})
		},
		[translateAmount]
	)

	const loadMonthlyData = useCallback(async () => {
		// ✅ Don't start fetch if component not mounted yet
		if (!isMountedRef.current) return
		if (isFetchingRef.current) return

		const firstLoad = !hasLoadedRef.current
		isFetchingRef.current = true

		// ✅ Guard every setState with isMountedRef check
		if (firstLoad) {
			if (isMountedRef.current) setLoading(true)
		} else {
			if (isMountedRef.current) setRefreshing(true)
		}

		try {
			const range = getMonthDateRange(selectedMonth, selectedYear)
			const [analyticsRes, generalExpenseRes, salaryExpenseRes] =
				await Promise.all([
					fetchData(getAnalytics, {
						startDate: range.startDate,
						endDate: range.endDate,
					}),
					fetchData(getExpense, {
						month: selectedMonth,
						year: selectedYear,
						page: 1,
						limit: 100,
						searchTerm: '',
						sortBy: 'createdAt',
						sortOrder: 'desc',
						expenseType: 'GENERAL',
					}),
					fetchData(getExpense, {
						month: selectedMonth,
						year: selectedYear,
						page: 1,
						limit: 100,
						searchTerm: '',
						sortBy: 'createdAt',
						sortOrder: 'desc',
						expenseType: 'EMPLOYEE_SALARY',
					}),
				])

			// ✅ After async work, check mount state before any setState
			if (!isMountedRef.current) return

			const rawAnalytics =
				analyticsRes?.data && typeof analyticsRes.data === 'object'
					? analyticsRes.data
					: {}

			const monthlyAnalytics = { ...DEFAULT_ANALYTICS }
			Object.keys(DEFAULT_ANALYTICS).forEach((key) => {
				const val = rawAnalytics[key]
				const parsed = Number(val)
				monthlyAnalytics[key] = isFinite(parsed) ? parsed : 0
			})

			const generalRows = getExpenseRows(generalExpenseRes)
			const salaryRows = getExpenseRows(salaryExpenseRes)

			const generalRowsWithType = (
				Array.isArray(generalRows) ? generalRows : []
			).map((row) => ({
				...row,
				expenseType: 'GENERAL',
			}))

			const salaryRowsWithType = (
				Array.isArray(salaryRows) ? salaryRows : []
			).map((row) => ({
				...row,
				expenseType: 'EMPLOYEE_SALARY',
			}))

			const rows = [...generalRowsWithType, ...salaryRowsWithType]

			// ✅ Final mount check before setting state
			if (!isMountedRef.current) return

			setAnalytics(monthlyAnalytics)
			setExpenseRows(rows)
			hasLoadedRef.current = true

			fadeAnim.setValue(0)
			Animated.timing(fadeAnim, {
				toValue: 1,
				duration: 320,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}).start()
		} catch (error) {
			console.error('Error loading monthly accounts:', error)

			// ✅ Guard catch block setState too
			if (!isMountedRef.current) return

			setAnalytics({ ...DEFAULT_ANALYTICS })
			setExpenseRows([])
			hasLoadedRef.current = true

			fadeAnim.setValue(0)
			Animated.timing(fadeAnim, {
				toValue: 1,
				duration: 320,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}).start()
		} finally {
			// ✅ Guard finally block setState too
			if (!isMountedRef.current) return
			setLoading(false)
			setRefreshing(false)
			isFetchingRef.current = false
		}
	}, [fadeAnim, fetchData, selectedMonth, selectedYear])

	const handleExpenseAddedCallback = useCallback(() => {
		loadMonthlyData()
	}, [loadMonthlyData])

	// ✅ Only run after mount via useEffect
	useEffect(() => {
		loadMonthlyData()
	}, [loadMonthlyData])

	useFocusEffect(
		useCallback(() => {
			// ✅ Only refetch if already mounted and loaded before
			if (!isMountedRef.current) return
			if (!hasLoadedRef.current) return
			loadMonthlyData()
		}, [loadMonthlyData])
	)

	const moveMonth = useCallback((direction) => {
		setSelectedMonth((prevMonth) => {
			if (direction === 'next') {
				if (prevMonth === 12) {
					setSelectedYear((prevYear) => prevYear + 1)
					return 1
				}
				return prevMonth + 1
			}
			if (prevMonth === 1) {
				setSelectedYear((prevYear) => prevYear - 1)
				return 12
			}
			return prevMonth - 1
		})
	}, [])

	const yearlyChange = useCallback((delta) => {
		setSelectedYear((prev) => prev + delta)
	}, [])

	const expenseItems = useMemo(() => {
		const generalItems = []
		const salaryItems = []

		if (!Array.isArray(expenseRows) || expenseRows.length === 0) {
			return { general: [], salary: [] }
		}

		expenseRows.forEach((entry) => {
			if (!entry || typeof entry !== 'object') return

			const items = Array.isArray(entry?.ExpenseItem) ? entry.ExpenseItem : []

			const itemData = items.map((item, index) => {
				const rawAmount = Number(item?.amount)
				const safeAmount = isFinite(rawAmount) ? rawAmount : 0

				return {
					id: item?.id ?? `${entry?.id ?? 'expense'}-${index}`,
					expenseID: entry?.id ?? null,
					name: item?.name ?? loc.t('expense.cause') ?? 'Expense',
					description: item?.description ?? '',
					amount: safeAmount,
					date: entry?.createdAt ?? null,
					expenseType: entry?.expenseType ?? 'GENERAL',
				}
			})

			if (entry?.expenseType === 'EMPLOYEE_SALARY') {
				salaryItems.push(...itemData)
			} else {
				generalItems.push(...itemData)
			}
		})

		return { general: generalItems, salary: salaryItems }
	}, [expenseRows, loc])

	const generalExpenseTotal = useMemo(() => {
		if (
			!Array.isArray(expenseItems?.general) ||
			expenseItems.general.length === 0
		) {
			return 0
		}
		const total = expenseItems.general.reduce((sum, item) => {
			const amt = Number(item?.amount)
			return sum + (isFinite(amt) ? amt : 0)
		}, 0)
		return isFinite(total) ? total : 0
	}, [expenseItems])

	const salaryExpenseTotal = useMemo(() => {
		if (
			!Array.isArray(expenseItems?.salary) ||
			expenseItems.salary.length === 0
		) {
			return 0
		}
		const total = expenseItems.salary.reduce((sum, item) => {
			const amt = Number(item?.amount)
			return sum + (isFinite(amt) ? amt : 0)
		}, 0)
		return isFinite(total) ? total : 0
	}, [expenseItems])

	const expenseTotal = useMemo(() => {
		const buy = safeNumber(analytics?.totalBuy)
		const general = safeNumber(generalExpenseTotal)
		const salary = safeNumber(salaryExpenseTotal)
		const total = buy + general + salary
		return isFinite(total) ? total : 0
	}, [analytics?.totalBuy, generalExpenseTotal, salaryExpenseTotal, safeNumber])

	const netProfit = useMemo(() => {
		const sell = safeNumber(analytics?.totalSell)
		const buy = safeNumber(analytics?.totalBuy)
		const general = safeNumber(generalExpenseTotal)
		const salary = safeNumber(salaryExpenseTotal)
		const profit = sell - buy - general - salary
		return isFinite(profit) ? profit : 0
	}, [
		analytics?.totalBuy,
		analytics?.totalSell,
		generalExpenseTotal,
		salaryExpenseTotal,
		safeNumber,
	])

	const summaryCards = useMemo(
		() => [
			{
				label: loc.t('expense.totalSales'),
				value: safeNumber(analytics?.totalSell),
				icon: 'cash-multiple',
				accent: '#0EA5E9',
				isAmount: true,
			},
			{
				label: loc.t('expense.profit'),
				value: safeNumber(analytics?.profit),
				icon: 'trending-up',
				accent: '#22C55E',
				isAmount: true,
			},
			{
				label: loc.t('expense.expenses'),
				value: safeNumber(expenseTotal),
				icon: 'receipt',
				accent: '#F97316',
				isAmount: true,
			},
			{
				label: loc.t('expense.totalDebt'),
				value: safeNumber(analytics?.totalDebt),
				icon: 'credit-card-outline',
				accent: '#EF4444',
				isAmount: true,
			},
			{
				label: loc.t('expense.totalDiscount'),
				value: safeNumber(analytics?.totalDiscount),
				icon: 'sale',
				accent: '#8B5CF6',
				isAmount: true,
			},
			{
				label: loc.t('expense.itemsSold'),
				value: safeNumber(analytics?.totalquantity),
				icon: 'package-variant-closed',
				accent: '#14B8A6',
				isAmount: false,
			},
		],
		[analytics, expenseTotal, loc, safeNumber]
	)

	const animatedStyle = useMemo(
		() => ({
			opacity: fadeAnim,
			transform: [
				{
					translateY: fadeAnim.interpolate({
						inputRange: [0, 1],
						outputRange: [10, 0],
						extrapolate: 'clamp',
					}),
				},
			],
		}),
		[fadeAnim]
	)

	const renderLoadingSkeleton = () => (
		<View className="px-4 pt-4">
			<View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
				<ContentLoader
					speed={2}
					width={screenWidth - 40}
					height={84}
					viewBox={`0 0 ${screenWidth - 40} 84`}
					backgroundColor="#EDF2F7"
					foregroundColor="#E2E8F0"
				>
					<Rect x="0" y="4" rx="6" ry="6" width="180" height="18" />
					<Rect x="0" y="30" rx="12" ry="12" width="210" height="42" />
				</ContentLoader>
			</View>
			<View className="flex-row flex-wrap justify-between">
				{[...Array(6)].map((_, index) => (
					<View
						key={index}
						className="w-[48.5%] bg-white rounded-2xl p-4 mb-3 shadow-sm"
					>
						<ContentLoader
							speed={2}
							width={140}
							height={70}
							viewBox="0 0 140 70"
							backgroundColor="#EDF2F7"
							foregroundColor="#E2E8F0"
						>
							<Rect x="0" y="0" rx="8" ry="8" width="28" height="28" />
							<Rect x="0" y="36" rx="4" ry="4" width="90" height="14" />
							<Rect x="0" y="56" rx="4" ry="4" width="70" height="12" />
						</ContentLoader>
					</View>
				))}
			</View>
		</View>
	)

	return (
		<View className="flex-1 bg-[#F3F6FB]">
			<ScrollView
				className="flex-1"
				contentContainerStyle={{ paddingBottom: 110 }}
			>
				<View className="px-4 pt-4 pb-3">
					<View className="bg-white rounded-3xl p-4 shadow-sm">
						<View className="flex-row items-center justify-between gap-2">
							<View className="flex-1 bg-slate-50 rounded-xl p-2 flex-row items-center justify-between border border-slate-200">
								<TouchableOpacity onPress={() => moveMonth('prev')}>
									<MaterialCommunityIcons
										name="chevron-left"
										size={22}
										color="#334155"
									/>
								</TouchableOpacity>
								<Text className="text-slate-800 font-semibold">
									{loc.t(`expense.months.${MONTH_KEYS[selectedMonth - 1]}`)}
								</Text>
								<TouchableOpacity onPress={() => moveMonth('next')}>
									<MaterialCommunityIcons
										name="chevron-right"
										size={22}
										color="#334155"
									/>
								</TouchableOpacity>
							</View>
							<View className="w-[38%] bg-slate-50 rounded-xl p-2 flex-row items-center justify-between border border-slate-200">
								<TouchableOpacity onPress={() => yearlyChange(-1)}>
									<MaterialCommunityIcons
										name="minus"
										size={22}
										color="#334155"
									/>
								</TouchableOpacity>
								<Text className="text-slate-800 font-semibold">
									{translateNumber(selectedYear)}
								</Text>
								<TouchableOpacity onPress={() => yearlyChange(1)}>
									<MaterialCommunityIcons
										name="plus"
										size={22}
										color="#334155"
									/>
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</View>

				{loading ? (
					renderLoadingSkeleton()
				) : (
					<Animated.View style={animatedStyle}>
						<View className="px-4 flex-row flex-wrap justify-between">
							{summaryCards.map((item) => (
								<View
									key={item.label}
									className="w-[48.5%] bg-white rounded-2xl p-3 mb-3 shadow-sm"
								>
									<View className="flex-row items-center min-h-14">
										<View
											className="w-11 h-11 rounded-xl items-center justify-center mr-3 shrink-0"
											style={{
												backgroundColor: `${item.accent}22`,
											}}
										>
											<MaterialCommunityIcons
												name={item.icon}
												size={20}
												color={item.accent}
											/>
										</View>
										<View className="flex-1 justify-center">
											<Text
												className="text-slate-900 font-bold text-base leading-tight"
												numberOfLines={1}
											>
												{item.isAmount
													? formatMoney(item.value)
													: translateNumber(
															isFinite(item.value) ? item.value : 0
														)}
											</Text>
											<Text
												className="text-slate-500 text-xs mt-0.5"
												numberOfLines={1}
											>
												{item.label}
											</Text>
										</View>
									</View>
								</View>
							))}
						</View>

						<View className="px-4 mt-3">
							<View className="bg-white rounded-2xl p-4 shadow-sm">
								<Text className="text-slate-900 font-semibold text-base mb-3">
									{loc.t('expense.profitSummary')}
								</Text>
								<View className="space-y-2">
									<View className="flex-row justify-between py-1">
										<Text className="text-slate-600">
											{loc.t('expense.sales')}
										</Text>
										<Text className="text-slate-900 font-medium">
											{formatMoney(safeNumber(analytics?.totalSell))}
										</Text>
									</View>
									<View className="flex-row justify-between py-1">
										<Text className="text-slate-600">
											{loc.t('expense.buyCost')}
										</Text>
										<Text className="text-slate-900 font-medium">
											- {formatMoney(safeNumber(analytics?.totalBuy))}
										</Text>
									</View>
									<View className="flex-row justify-between py-1">
										<Text className="text-slate-600">
											{loc.t('expense.otherExpenses')}
										</Text>
										<Text className="text-slate-900 font-medium">
											- {formatMoney(safeNumber(generalExpenseTotal))}
										</Text>
									</View>
									<View className="flex-row justify-between py-1">
										<Text className="text-slate-600">
											{loc.t('expense.employeeSalary')}
										</Text>
										<Text className="text-slate-900 font-medium">
											- {formatMoney(safeNumber(salaryExpenseTotal))}
										</Text>
									</View>
									<View className="h-px bg-slate-200 my-2" />
									<View className="flex-row justify-between py-1">
										<Text className="text-slate-900 font-semibold">
											{loc.t('expense.netProfit')}
										</Text>
										<Text
											className={`font-bold ${
												safeNumber(netProfit) >= 0
													? 'text-emerald-600'
													: 'text-rose-600'
											}`}
										>
											{formatMoney(safeNumber(netProfit))}
										</Text>
									</View>
								</View>
							</View>
						</View>
					</Animated.View>
				)}
			</ScrollView>

			<View className="flex-row px-4 mb-4 mt-2 gap-3">
				<TouchableOpacity
					onPress={() => setShowExpenseDetails(true)}
					className="flex-1"
				>
					<View className="bg-btnPrimary items-center justify-center rounded-full h-[52px]">
						<Text className="text-xl text-white">
							{loc.t('expense.viewExpenses')}
						</Text>
					</View>
				</TouchableOpacity>

				<TouchableOpacity
					onPress={() => setShowAddExpense(true)}
					className="flex-1"
				>
					<View className="bg-btnPrimary items-center justify-center rounded-full h-[52px]">
						<Text className="text-xl text-white">
							{loc.t('expense.addBtn')}
						</Text>
					</View>
				</TouchableOpacity>
			</View>

			{showExpenseDetails && (
				<ExpenseDetails
					visible={showExpenseDetails}
					onClose={() => setShowExpenseDetails(false)}
					items={expenseItems}
					onItemsUpdated={handleExpenseAddedCallback}
				/>
			)}

			<AddExpense
				visible={showAddExpense}
				onClose={() => setShowAddExpense(false)}
				onSuccess={handleExpenseAddedCallback}
			/>
		</View>
	)
}
