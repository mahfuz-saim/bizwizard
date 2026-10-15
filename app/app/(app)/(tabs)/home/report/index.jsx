import { Text, View, TouchableOpacity, ScrollView } from 'react-native'
import { useCallback, useState } from 'react'
import ContentLoader, { Rect } from 'react-content-loader/native'
import { useFocusEffect } from 'expo-router'
import useApi from '../../../../../src/hooks/useApi'
import {
	getAnalytics,
	getNotSoldItem,
	getLowStockItem,
	getExpiredItem,
} from '../../../../../src/controllers/analytics'
import { useLocalization } from '../../../../../src/localization/localizationContext'

export default function Report() {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const [activeTab, setActiveTab] = useState('today')
	const [analyticsData, setAnalyticsData] = useState({
		today: null,
		last7Days: null,
		last30Days: null,
	})
	const [loading, setLoading] = useState(false)
	const [comparison, setComparison] = useState(null)

	// Additional data states (to be implemented later)
	const [notSoldItems, setNotSoldItems] = useState([])
	const [lowStockItems, setLowStockItems] = useState([])
	const [expiredItems, setExpiredItems] = useState([])
	const [additionalDataLoading, setAdditionalDataLoading] = useState(false)

	useFocusEffect(
		useCallback(() => {
			let isActive = true

			const refreshReportData = async () => {
				setLoading(true)
				setAdditionalDataLoading(true)

				try {
					const todayISO = new Date().toISOString()
					const last7DaysStart = new Date(
						Date.now() - 7 * 86400000
					).toISOString()
					const last30DaysStart = new Date(
						Date.now() - 30 * 86400000
					).toISOString()

					const [
						todayRes,
						last7DaysRes,
						last30DaysRes,
						notSoldRes,
						lowStockRes,
						expiredRes,
					] = await Promise.all([
						fetchData(getAnalytics, {
							startDate: todayISO,
							endDate: todayISO,
						}),
						fetchData(getAnalytics, {
							startDate: last7DaysStart,
							endDate: todayISO,
						}),
						fetchData(getAnalytics, {
							startDate: last30DaysStart,
							endDate: todayISO,
						}),
						fetchData(getNotSoldItem, {}),
						fetchData(getLowStockItem, {}),
						fetchData(getExpiredItem, {}),
					])

					if (!isActive) return

					setAnalyticsData({
						today: todayRes.data,
						last7Days: last7DaysRes.data,
						last30Days: last30DaysRes.data,
					})

					setNotSoldItems(notSoldRes.data || [])
					setLowStockItems(lowStockRes.data || [])
					setExpiredItems(expiredRes.data || [])

					calculateComparison(
						todayRes.data,
						last7DaysRes.data,
						last30DaysRes.data
					)
				} catch (err) {
					console.error('Error fetching report data:', err)
				} finally {
					if (isActive) {
						setLoading(false)
						setAdditionalDataLoading(false)
					}
				}
			}

			refreshReportData()

			return () => {
				isActive = false
			}
		}, [fetchData, calculateComparison])
	)

	const calculateComparison = useCallback(
		(todayData, last7Data, last30Data) => {
			if (!todayData || !last7Data || !last30Data) return

			// Calculate averages for 7 and 30 days
			const avg7Days = last7Data.profit / 7
			const avg30Days = last30Data.profit / 30

			const todayProfit = todayData.profit

			let comment7Days = ''
			let comment30Days = ''

			// Compare with 7-day average
			if (todayProfit > avg7Days) {
				const percentage = (
					((todayProfit - avg7Days) / Math.abs(avg7Days)) *
					100
				).toFixed(1)
				comment7Days = `📈 ${loc.t(
					'report.comparisonGreat'
				)} ${percentage}% ${loc.t('report.moreProfit7Days')}`
			} else if (todayProfit < avg7Days) {
				const percentage = (
					((avg7Days - todayProfit) / Math.abs(avg7Days)) *
					100
				).toFixed(1)
				comment7Days = `📉 ${loc.t('report.todayProfit')} ${percentage}% ${loc.t(
					'report.lowerProfit7Days'
				)}`
			} else {
				comment7Days = `📊 ${loc.t('report.profitMatches7Days')}`
			}

			// Compare with 30-day average
			if (todayProfit > avg30Days) {
				const percentage = (
					((todayProfit - avg30Days) / Math.abs(avg30Days)) *
					100
				).toFixed(1)
				comment30Days = `📈 ${loc.t(
					'report.comparisonExcellent'
				)} ${percentage}% ${loc.t('report.moreProfit30Days')}`
			} else if (todayProfit < avg30Days) {
				const percentage = (
					((avg30Days - todayProfit) / Math.abs(avg30Days)) *
					100
				).toFixed(1)
				comment30Days = `📉 ${loc.t('report.todayProfit')} ${percentage}% ${loc.t(
					'report.lowerProfit30Days'
				)}`
			} else {
				comment30Days = `📊 ${loc.t('report.profitMatches30Days')}`
			}

			setComparison({
				avg7Days,
				avg30Days,
				todayProfit,
				comment7Days,
				comment30Days,
			})
		},
		[loc]
	)

	const TabButton = ({ title, isActive, onPress }) => (
		<TouchableOpacity
			onPress={onPress}
			className={`px-4 py-2 rounded-lg mr-2 ${
				isActive ? 'bg-blue-500' : 'bg-gray-200'
			}`}
		>
			<Text
				className={`font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}
			>
				{title}
			</Text>
		</TouchableOpacity>
	)

	const MetricCard = ({ title, value, icon, isQuantity = false }) => (
		<View className="bg-white p-3 rounded-lg shadow-sm flex-1 mx-1 mb-3">
			<View className="items-center">
				<Text className="text-2xl mb-1">{icon}</Text>
				{loading ? (
					<ContentLoader
						width={80}
						height={28}
						backgroundColor="#f3f4f6"
						foregroundColor="#e5e7eb"
					>
						<Rect x="0" y="0" rx="4" ry="4" width="60" height="12" />
						<Rect x="0" y="16" rx="4" ry="4" width="80" height="16" />
					</ContentLoader>
				) : (
					<>
						<Text className="text-gray-600 text-xs text-center">{title}</Text>
						<Text className="text-lg font-bold text-gray-800 mt-1 text-center">
							{isQuantity ? '#' : '৳'}{' '}
							{typeof value === 'number'
								? value.toLocaleString()
								: value || '0'}
						</Text>
					</>
				)}
			</View>
		</View>
	)

	const getCurrentData = () => {
		return (
			analyticsData[activeTab] || {
				profit: 0,
				totalBuy: 0,
				totalDebt: 0,
				totalDiscount: 0,
				totalLoss: 0,
				totalSell: 0,
				totalquantity: 0,
			}
		)
	}

	const getTabTitle = () => {
		switch (activeTab) {
			case 'today':
				return loc.t('report.todayAnalytics')
			case 'last7Days':
				return loc.t('report.last7DaysAnalytics')
			case 'last30Days':
				return loc.t('report.last30DaysAnalytics')
			default:
				return loc.t('report.analytics')
		}
	}

	const currentData = getCurrentData()

	return (
		<ScrollView className="flex-1 bg-gray-50">
			<View className="p-4 my-4">
				{/* Tab Buttons */}
				<View className="flex-row mb-6 justify-center">
					<TabButton
						title={loc.t('report.today')}
						isActive={activeTab === 'today'}
						onPress={() => setActiveTab('today')}
					/>
					<TabButton
						title={loc.t('report.last7Days')}
						isActive={activeTab === 'last7Days'}
						onPress={() => setActiveTab('last7Days')}
					/>
					<TabButton
						title={loc.t('report.last30Days')}
						isActive={activeTab === 'last30Days'}
						onPress={() => setActiveTab('last30Days')}
					/>
				</View>

				{/* Current Tab Data */}
				<View className="mb-6">
					{loading ? (
						<ContentLoader
							width={200}
							height={20}
							backgroundColor="#f3f4f6"
							foregroundColor="#e5e7eb"
						>
							<Rect x="0" y="0" rx="4" ry="4" width="200" height="20" />
						</ContentLoader>
					) : (
						<Text className="text-lg font-semibold text-gray-800 mb-4">
							{getTabTitle()}
						</Text>
					)}

					<View className="flex-row">
						<MetricCard
							title={loc.t('report.sales')}
							value={currentData.totalSell}
							icon="💵"
						/>
						<MetricCard
							title={loc.t('report.purchases')}
							value={currentData.totalBuy}
							icon="🛒"
						/>
					</View>
					<View className="flex-row">
						<MetricCard
							title={loc.t('report.soldItems')}
							value={currentData.totalquantity}
							icon="📦"
							isQuantity={true}
						/>
						<MetricCard
							title={loc.t('report.debt')}
							value={currentData.totalDebt}
							icon="💳"
						/>
					</View>
					<View className="flex-row">
						<MetricCard
							title={loc.t('report.profit')}
							value={currentData.profit}
							icon="💰"
						/>
						<MetricCard
							title={loc.t('report.loss')}
							value={currentData.totalLoss}
							icon="📉"
						/>
					</View>
				</View>

				{/* Comparison Chart */}
				{comparison &&
					activeTab === 'today' &&
					(loading ? (
						<ContentLoader
							width="100%"
							height={200}
							backgroundColor="#f3f4f6"
							foregroundColor="#e5e7eb"
						>
							<Rect x="0" y="0" rx="8" ry="8" width="100%" height="200" />
						</ContentLoader>
					) : (
						<View className="bg-white p-4 rounded-lg shadow-sm mb-6">
							<Text className="text-lg font-semibold text-gray-800 mb-4">
								📊 {loc.t('report.profitComparison')}
							</Text>

							<View className="mb-4">
								<Text className="text-sm text-gray-600 mb-2">
									{loc.t('report.todayVsAverages')}
								</Text>
								<View className="bg-gray-100 p-3 rounded-lg mb-2">
									<Text className="font-medium">
										{loc.t('report.today')}:{' '}
										{comparison.todayProfit.toLocaleString()}
									</Text>
								</View>
								<View className="bg-blue-50 p-3 rounded-lg mb-2">
									<Text className="font-medium">
										{loc.t('report.dayAverage', { days: 7 })}:{' '}
										{comparison.avg7Days.toFixed(2)}
									</Text>
								</View>
								<View className="bg-green-50 p-3 rounded-lg">
									<Text className="font-medium">
										{loc.t('report.dayAverage', { days: 30 })}:{' '}
										{comparison.avg30Days.toFixed(2)}
									</Text>
								</View>
							</View>

							<View className="border-t border-gray-200 pt-4">
								<Text className="text-sm font-medium text-gray-700 mb-2">
									{loc.t('report.performanceAnalysis')}:
								</Text>
								<Text className="text-sm text-gray-600 mb-2">
									{comparison.comment7Days}
								</Text>
								<Text className="text-sm text-gray-600">
									{comparison.comment30Days}
								</Text>
							</View>
						</View>
					))}

				{/* Additional Data Sections */}
				{additionalDataLoading ? (
					<ContentLoader
						width="100%"
						height={120}
						backgroundColor="#f3f4f6"
						foregroundColor="#e5e7eb"
					>
						<Rect x="0" y="0" rx="8" ry="8" width="100%" height="120" />
					</ContentLoader>
				) : (
					<View className="bg-white p-4 rounded-lg shadow-sm mb-4">
						<Text className="text-lg font-semibold text-gray-800 mb-2">
							📋 {loc.t('report.additionalReports')}
						</Text>
						<Text className="text-sm text-gray-600 mb-2">
							• {loc.t('report.notSoldItems')}: {notSoldItems.length}{' '}
							{loc.t('report.items')}
						</Text>
						<Text className="text-sm text-gray-600 mb-2">
							• {loc.t('report.lowStockItems')}: {lowStockItems.length}{' '}
							{loc.t('report.items')}
						</Text>
						<Text className="text-sm text-gray-600">
							• {loc.t('report.expiredItems')}: {expiredItems.length}{' '}
							{loc.t('report.items')}
						</Text>
					</View>
				)}
			</View>
		</ScrollView>
	)
}
