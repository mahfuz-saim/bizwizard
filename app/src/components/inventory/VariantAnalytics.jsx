import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	ScrollView,
} from 'react-native'
import { useState } from 'react'
import { Feather } from '@expo/vector-icons'
import { BarChart } from 'react-native-gifted-charts'
import { useLocalization } from '../../localization/localizationContext.jsx'
import { useNumberTranslator } from '../../hooks/useNumberTranslator.jsx'
import useApi from '../../hooks/useApi.jsx'
import { getLotPurchaseHistory } from '../../controllers/analytics.js'

export default function VariantAnalytics({ product }) {
	const { loc } = useLocalization()
	const { translateNumber } = useNumberTranslator()
	const { fetchData } = useApi()
	const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
	const [purchaseHistory, setPurchaseHistory] = useState([])
	const [analyticsLoading, setAnalyticsLoading] = useState(false)
	const [isTimelineOpen, setIsTimelineOpen] = useState(false)

	const handleFetchAnalytics = async () => {
		setIsAnalyticsOpen(!isAnalyticsOpen)
		if (!isAnalyticsOpen && product?.id) {
			try {
				setAnalyticsLoading(true)
				const res = await fetchData(getLotPurchaseHistory, {
					variantId: product.id,
				})
				if (res?.success && res?.data) {
					setPurchaseHistory(res.data)
				}
			} catch (err) {
				console.error('🚨 Error fetching analytics:', err)
			} finally {
				setAnalyticsLoading(false)
			}
		}
	}

	// Helper: Format date for display
	const formatAnalyticsDate = (dateString) => {
		if (!dateString) return 'N/A'
		const date = new Date(dateString)
		const day = date.getDate().toString().padStart(2, '0')
		const month = (date.getMonth() + 1).toString().padStart(2, '0')
		const year = date.getFullYear().toString().slice(-2)
		return translateNumber(`${day}/${month}/${year}`)
	}

	// Helper: Calculate analytics
	const calculateAnalytics = () => {
		if (!purchaseHistory || purchaseHistory.length === 0) {
			return {
				avgBuyPrice: 0,
				currentSellPrice: 0,
				profitPerUnit: 0,
				totalPurchaseAmount: 0,
				totalQuantity: 0,
				currentStock: 0,
				purchaseCount: 0,
			}
		}

		const buyPrices = purchaseHistory.map((item) => item.unitPrice || 0)
		const sellPrices = purchaseHistory.map((item) => item.lot?.sellPrice || 0)

		const totalBuyPrice = purchaseHistory.reduce(
			(sum, item) => sum + (item.unitPrice || 0),
			0
		)
		const avgBuyPrice = totalBuyPrice / purchaseHistory.length

		const totalSellPrice = sellPrices.reduce((sum, price) => sum + price, 0)
		const avgSellPrice = totalSellPrice / sellPrices.length

		const lowestBuyPrice = Math.min(...buyPrices)
		const highestBuyPrice = Math.max(...buyPrices)
		const lowestSellPrice = Math.min(...sellPrices)
		const highestSellPrice = Math.max(...sellPrices)

		const currentSellPrice =
			purchaseHistory[0]?.lot?.sellPrice || product?.sellPrice || 0

		const profitPerUnit = currentSellPrice - avgBuyPrice

		const totalPurchaseAmount = purchaseHistory.reduce(
			(sum, item) => sum + (item.amount || 0),
			0
		)

		const totalQuantity = purchaseHistory.reduce(
			(sum, item) => sum + (item.quantity || 0),
			0
		)

		// Sum all lot stocks from purchase history
		const currentStock = purchaseHistory.reduce(
			(sum, item) => sum + (item.lot?.stock || 0),
			0
		)

		return {
			avgBuyPrice: parseFloat(avgBuyPrice.toFixed(2)),
			avgSellPrice: parseFloat(avgSellPrice.toFixed(2)),
			lowestBuyPrice: parseFloat(lowestBuyPrice.toFixed(2)),
			highestBuyPrice: parseFloat(highestBuyPrice.toFixed(2)),
			lowestSellPrice: parseFloat(lowestSellPrice.toFixed(2)),
			highestSellPrice: parseFloat(highestSellPrice.toFixed(2)),
			currentSellPrice,
			profitPerUnit: parseFloat(profitPerUnit.toFixed(2)),
			totalPurchaseAmount,
			totalQuantity,
			currentStock,
			purchaseCount: purchaseHistory.length,
		}
	}

	// Helper: Prepare chart data for price trends
	const getPriceChartData = () => {
		if (!purchaseHistory || purchaseHistory.length === 0) return []

		// Sort by date (oldest first for chart) and take last 5
		const sorted = [...purchaseHistory]
			.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
			.slice(-5)

		const chartData = []

		sorted.forEach((item, index) => {
			const date = new Date(item.createdAt)
			const day = date.getDate().toString().padStart(2, '0')
			const month = (date.getMonth() + 1).toString().padStart(2, '0')
			const dateLabel = `${day}/${month}`
			const stockBought = item.quantity || 0
			const stockRemaining = item.lot?.stock || 0

			// Buy price bar
			chartData.push({
				value: item.unitPrice || 0,
				frontColor: '#1E40AF',
				labelComponent: () => (
					<Text
						style={{
							color: '#374151',
							fontSize: 10,
							fontWeight: '600',
							width: 40,
							textAlign: 'center',
							marginLeft: -1,
						}}
						numberOfLines={1}
					>
						{dateLabel}
					</Text>
				),
				spacing: 2,
			})

			// Sell price bar
			chartData.push({
				value: item.lot?.sellPrice || 0,
				frontColor: '#60A5FA',
				label: '',
				spacing: index === sorted.length - 1 ? 2 : 15,
				stockInfo: `${dateLabel}\n${
					loc.t('quantityUpdate.quantity') || 'Qty'
				}: ${translateNumber(stockBought.toString())}\n${
					loc.t('quantityUpdate.remainingStock') || 'Rem'
				}: ${translateNumber(stockRemaining.toString())}`,
			})
		})

		return chartData
	}

	return (
		<View style={styles.accordionContainer}>
			<TouchableOpacity
				style={styles.accordionHeader}
				onPress={handleFetchAnalytics}
				activeOpacity={0.7}
			>
				<Text style={styles.accordionTitle}>
					{loc.t('quantityUpdate.viewAnalytics')}
				</Text>
				{isAnalyticsOpen ? (
					<Feather name="chevron-up" size={20} color="#195FE1" />
				) : (
					<Feather name="chevron-down" size={20} color="#195FE1" />
				)}
			</TouchableOpacity>
			{isAnalyticsOpen && (
				<ScrollView
					style={styles.accordionContent}
					showsVerticalScrollIndicator={false}
					nestedScrollEnabled={true}
				>
					{analyticsLoading ? (
						<View style={styles.loadingContainer}>
							<Text style={styles.loadingText}>
								{loc.t('quantityUpdate.loadingAnalytics') ||
									'Loading analytics...'}
							</Text>
						</View>
					) : purchaseHistory.length === 0 ? (
						<View style={styles.emptyContainer}>
							<Text style={styles.emptyText}>
								{loc.t('quantityUpdate.noPurchaseHistory') ||
									'No purchase history available'}
							</Text>
						</View>
					) : (
						<>
							{/* Profit Summary Cards */}
							<View style={styles.statsContainer}>
								<Text style={styles.sectionTitle}>
									{loc.t('quantityUpdate.profitSummary') || 'Profit Summary'}
								</Text>
								<View style={styles.statsGrid}>
									{/* Lowest Buy Price */}
									<View style={styles.statCard}>
										<Text style={styles.statLabel}>
											{loc.t('quantityUpdate.lowestBuyPrice') ||
												'Lowest Buy Price'}
										</Text>
										<Text style={styles.statValue}>
											৳
											{translateNumber(
												calculateAnalytics().lowestBuyPrice.toString()
											)}
										</Text>
									</View>
									{/* Lowest Sell Price */}
									<View style={styles.statCard}>
										<Text style={styles.statLabel}>
											{loc.t('quantityUpdate.lowestSellPrice') ||
												'Lowest Sell Price'}
										</Text>
										<Text style={styles.statValue}>
											৳
											{translateNumber(
												calculateAnalytics().lowestSellPrice.toString()
											)}
										</Text>
									</View>
									{/* Highest Buy Price */}
									<View style={styles.statCard}>
										<Text style={styles.statLabel}>
											{loc.t('quantityUpdate.highestBuyPrice') ||
												'Highest Buy Price'}
										</Text>
										<Text style={styles.statValue}>
											৳
											{translateNumber(
												calculateAnalytics().highestBuyPrice.toString()
											)}
										</Text>
									</View>
									{/* Highest Sell Price */}
									<View style={styles.statCard}>
										<Text style={styles.statLabel}>
											{loc.t('quantityUpdate.highestSellPrice') ||
												'Highest Sell Price'}
										</Text>
										<Text style={styles.statValue}>
											৳
											{translateNumber(
												calculateAnalytics().highestSellPrice.toString()
											)}
										</Text>
									</View>
									{/* Average Buy Price */}
									<View style={styles.statCard}>
										<Text style={styles.statLabel}>
											{loc.t('quantityUpdate.avgBuyPrice') ||
												'Average Buy Price'}
										</Text>
										<Text style={styles.statValue}>
											৳
											{translateNumber(
												calculateAnalytics().avgBuyPrice.toString()
											)}
										</Text>
									</View>
									{/* Average Sell Price */}
									<View style={styles.statCard}>
										<Text style={styles.statLabel}>
											{loc.t('quantityUpdate.avgSellPrice') ||
												'Average Sell Price'}
										</Text>
										<Text style={styles.statValue}>
											৳
											{translateNumber(
												calculateAnalytics().avgSellPrice.toString()
											)}
										</Text>
									</View>
									{/* Times Purchased */}
									<View style={styles.statCard}>
										<Text style={styles.statLabel}>
											{loc.t('quantityUpdate.productPurchased') ||
												'Times Purchased'}
										</Text>
										<Text style={styles.statValue}>
											{translateNumber(
												calculateAnalytics().purchaseCount.toString()
											)}{' '}
											{loc.t('quantityUpdate.times') || 'times'}
										</Text>
									</View>
									{/* Total Purchase Amount */}
									<View style={styles.statCard}>
										<Text style={styles.statLabel}>
											{loc.t('quantityUpdate.totalPurchaseAmount') ||
												'Total Purchase Amount'}
										</Text>
										<Text style={styles.statValue}>
											৳
											{translateNumber(
												calculateAnalytics().totalPurchaseAmount.toString()
											)}
										</Text>
									</View>
								</View>
							</View>

							{/* Stock Insight */}
							<View style={styles.stockContainer}>
								<Text style={styles.sectionTitle}>
									{loc.t('quantityUpdate.stockInsight') || 'Stock Insight'}
								</Text>
								<View style={styles.stockStats}>
									<View style={styles.stockRow}>
										<Text style={styles.stockLabel}>
											{loc.t('quantityUpdate.totalPurchased') ||
												'Total Purchased'}
											:
										</Text>
										<Text style={styles.stockValue}>
											{translateNumber(
												calculateAnalytics().totalQuantity.toString()
											)}
										</Text>
									</View>
									<View style={styles.stockRow}>
										<Text style={styles.stockLabel}>
											{loc.t('quantityUpdate.totalSold') || 'Total Sold'}:
										</Text>
										<Text style={styles.stockValue}>
											{translateNumber(
												(
													calculateAnalytics().totalQuantity -
													calculateAnalytics().currentStock
												).toString()
											)}
										</Text>
									</View>
									<View style={styles.stockRow}>
										<Text style={styles.stockLabel}>
											{loc.t('quantityUpdate.currentStock') || 'Current Stock'}:
										</Text>
										<Text style={styles.stockValue}>
											{translateNumber(
												calculateAnalytics().currentStock.toString()
											)}
										</Text>
									</View>
									<View style={styles.progressBarContainer}>
										<View style={styles.progressBarBg}>
											<View
												style={[
													styles.progressBarFill,
													{
														width: `${
															calculateAnalytics().totalQuantity > 0
																? (
																		(calculateAnalytics().currentStock /
																			calculateAnalytics().totalQuantity) *
																		100
																	).toFixed(0)
																: 0
														}%`,
													},
												]}
											/>
										</View>
										<Text style={styles.progressText}>
											{translateNumber(
												(
													(calculateAnalytics().currentStock /
														calculateAnalytics().totalQuantity) *
													100
												).toFixed(0)
											)}
											% {loc.t('quantityUpdate.remaining') || 'remaining'}
										</Text>
									</View>
								</View>
							</View>

							{/* Price Trend Chart */}
							{purchaseHistory.length > 0 && (
								<View style={styles.chartContainer}>
									<Text style={styles.sectionTitle}>
										{loc.t('quantityUpdate.priceTrend') || 'Price Trend'}
									</Text>
									<ScrollView horizontal showsHorizontalScrollIndicator={true}>
										<View style={styles.chartWrapper}>
											<BarChart
												data={getPriceChartData()}
												width={Math.max(
													350,
													Math.ceil(getPriceChartData().length / 2) * 80
												)}
												height={220}
												barWidth={18}
												initialSpacing={20}
												noOfSections={5}
												yAxisColor="#E5E7EB"
												xAxisColor="#E5E7EB"
												yAxisTextStyle={{ color: '#6B7280', fontSize: 10 }}
												xAxisLabelTextStyle={{
													color: '#374151',
													fontSize: 9,
													fontWeight: '600',
												}}
												renderTooltip={(item) => {
													return (
														<View style={styles.tooltipContainer}>
															<Text style={styles.tooltipText}>
																৳{translateNumber(item.value.toString())}
															</Text>
															{item.stockInfo && (
																<Text
																	style={[
																		styles.tooltipText,
																		{ fontSize: 9, marginTop: 2 },
																	]}
																>
																	{item.stockInfo}
																</Text>
															)}
														</View>
													)
												}}
											/>
										</View>
									</ScrollView>
									<View style={styles.legendContainer}>
										<View style={styles.legendItem}>
											<View
												style={[
													styles.legendDot,
													{ backgroundColor: '#1E40AF' },
												]}
											/>
											<Text style={styles.legendText}>
												{loc.t('quantityUpdate.buyPrice') || 'Buy Price'}
											</Text>
										</View>
										<View style={styles.legendItem}>
											<View
												style={[
													styles.legendDot,
													{ backgroundColor: '#60A5FA' },
												]}
											/>
											<Text style={styles.legendText}>
												{loc.t('quantityUpdate.sellPrice') || 'Sell Price'}
											</Text>
										</View>
									</View>
								</View>
							)}

							{/* Purchase Timeline */}
							<View style={styles.timelineContainer}>
								<TouchableOpacity
									style={styles.timelineHeader}
									onPress={() => setIsTimelineOpen(!isTimelineOpen)}
									activeOpacity={0.7}
								>
									<Text style={styles.sectionTitle}>
										{loc.t('quantityUpdate.purchaseTimeline') ||
											'Purchase Timeline'}
									</Text>
									{isTimelineOpen ? (
										<Feather name="chevron-up" size={18} color="#195FE1" />
									) : (
										<Feather name="chevron-down" size={18} color="#195FE1" />
									)}
								</TouchableOpacity>
								{isTimelineOpen && (
									<View style={styles.tableContainer}>
										{/* Table Header */}
										<View style={styles.tableHeader}>
											<Text style={[styles.tableHeaderCell, styles.dateColumn]}>
												{loc.t('quantityUpdate.date') || 'Date'}
											</Text>
											<Text
												style={[styles.tableHeaderCell, styles.priceColumn]}
											>
												{loc.t('quantityUpdate.unitBuyPrice') ||
													'Unit Buy Price'}
											</Text>
											<Text
												style={[styles.tableHeaderCell, styles.priceColumn]}
											>
												{loc.t('quantityUpdate.sellPrice') || 'Sell Price'}
											</Text>
											<Text style={[styles.tableHeaderCell, styles.qtyColumn]}>
												{loc.t('quantityUpdate.quantity') || 'Quantity'}
											</Text>
											<Text style={[styles.tableHeaderCell, styles.qtyColumn]}>
												{loc.t('quantityUpdate.remainingStock') || 'Remaining'}
											</Text>
										</View>

										{/* Table Body */}
										{[...purchaseHistory]
											.sort(
												(a, b) => new Date(b.createdAt) - new Date(a.createdAt)
											)
											.map((item, index) => (
												<View key={item.id} style={styles.tableRow}>
													<Text style={[styles.tableCell, styles.dateColumn]}>
														{formatAnalyticsDate(item.createdAt)}
													</Text>
													<Text style={[styles.tableCell, styles.priceColumn]}>
														৳
														{translateNumber(item.unitPrice?.toString() || '0')}
													</Text>
													<Text style={[styles.tableCell, styles.priceColumn]}>
														৳
														{translateNumber(
															item.lot?.sellPrice?.toString() || '0'
														)}
													</Text>
													<Text style={[styles.tableCell, styles.qtyColumn]}>
														{translateNumber(item.quantity?.toString() || '0')}
													</Text>
													<Text style={[styles.tableCell, styles.qtyColumn]}>
														{translateNumber(
															item.lot?.stock?.toString() || '0'
														)}
													</Text>
												</View>
											))}
									</View>
								)}
							</View>
						</>
					)}
				</ScrollView>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	accordionContainer: {
		marginHorizontal: 16,
		marginBottom: 16,
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#E5E7EB',
		overflow: 'hidden',
	},
	accordionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 16,
		backgroundColor: '#F9FAFB',
	},
	accordionTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#195FE1',
	},
	accordionContent: {
		padding: 16,
		backgroundColor: '#FFFFFF',
		maxHeight: 600,
	},
	loadingContainer: {
		paddingVertical: 40,
		alignItems: 'center',
	},
	loadingText: {
		fontSize: 14,
		color: '#6B7280',
	},
	emptyContainer: {
		paddingVertical: 40,
		alignItems: 'center',
	},
	emptyText: {
		fontSize: 14,
		color: '#6B7280',
		textAlign: 'center',
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#111827',
		marginBottom: 12,
		marginTop: 8,
	},
	insightsContainer: {
		marginBottom: 16,
	},
	insightItem: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 8,
		paddingVertical: 4,
	},
	insightBullet: {
		fontSize: 16,
		color: '#195FE1',
		marginRight: 8,
		fontWeight: 'bold',
	},
	insightText: {
		flex: 1,
		fontSize: 14,
		color: '#374151',
		lineHeight: 20,
	},
	statsContainer: {
		marginBottom: 16,
	},
	statsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	statCard: {
		flex: 1,
		minWidth: '48%',
		backgroundColor: '#F9FAFB',
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	profitCard: {
		backgroundColor: '#ECFDF5',
		borderColor: '#10B981',
	},
	lossCard: {
		backgroundColor: '#FEF2F2',
		borderColor: '#EF4444',
	},
	statLabel: {
		fontSize: 12,
		color: '#6B7280',
		marginBottom: 4,
	},
	statValue: {
		fontSize: 18,
		fontWeight: '700',
		color: '#111827',
	},
	profitValue: {
		color: '#10B981',
	},
	lossValue: {
		color: '#EF4444',
	},
	chartContainer: {
		marginBottom: 16,
	},
	chartWrapper: {
		paddingVertical: 8,
	},
	tooltipContainer: {
		backgroundColor: '#111827',
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 4,
	},
	tooltipText: {
		color: '#FFFFFF',
		fontSize: 11,
		fontWeight: '600',
	},
	legendContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 20,
		marginTop: 12,
	},
	legendItem: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	legendDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		marginRight: 6,
	},
	legendText: {
		fontSize: 12,
		color: '#6B7280',
	},
	stockContainer: {
		marginBottom: 16,
	},
	stockStats: {
		backgroundColor: '#F9FAFB',
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	stockRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	stockLabel: {
		fontSize: 14,
		color: '#6B7280',
	},
	stockValue: {
		fontSize: 14,
		fontWeight: '600',
		color: '#111827',
	},
	progressBarContainer: {
		marginTop: 8,
	},
	progressBarBg: {
		height: 12,
		backgroundColor: '#E5E7EB',
		borderRadius: 6,
		overflow: 'hidden',
	},
	progressBarFill: {
		height: '100%',
		backgroundColor: '#195FE1',
		borderRadius: 6,
	},
	progressText: {
		fontSize: 12,
		color: '#6B7280',
		marginTop: 4,
		textAlign: 'center',
	},
	timelineContainer: {
		marginBottom: 24,
	},
	timelineHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 2,
		paddingHorizontal: 12,
		marginBottom: 8,
		backgroundColor: '#F3F4F6',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	tableContainer: {
		borderWidth: 1,
		borderColor: '#E5E7EB',
		borderRadius: 8,
		overflow: 'hidden',
		backgroundColor: '#FFFFFF',
	},
	tableHeader: {
		flexDirection: 'row',
		backgroundColor: '#F3F4F6',
		borderBottomWidth: 2,
		borderBottomColor: '#D1D5DB',
	},
	tableHeaderCell: {
		padding: 12,
		fontWeight: '700',
		fontSize: 12,
		color: '#374151',
		textAlign: 'center',
	},
	tableRow: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
	},
	tableCell: {
		padding: 10,
		fontSize: 12,
		color: '#111827',
		textAlign: 'center',
	},
	dateColumn: {
		flex: 2,
	},
	priceColumn: {
		flex: 1.5,
	},
	qtyColumn: {
		flex: 1,
	},
	timelineItem: {
		flexDirection: 'row',
		marginBottom: 16,
		paddingLeft: 8,
	},
	timelineDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: '#195FE1',
		marginTop: 4,
		marginRight: 12,
	},
	timelineContent: {
		flex: 1,
		backgroundColor: '#F9FAFB',
		padding: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	timelineDate: {
		fontSize: 13,
		fontWeight: '600',
		color: '#195FE1',
		marginBottom: 8,
	},
	timelineDetails: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 4,
	},
	timelineLabel: {
		fontSize: 13,
		color: '#6B7280',
	},
	timelineValue: {
		fontSize: 13,
		fontWeight: '600',
		color: '#111827',
	},
	timelineTotal: {
		color: '#195FE1',
		fontWeight: '700',
	},
})
