import React, { useCallback, useRef, useState, useMemo, memo } from 'react'
import {
	Dimensions,
	FlatList,
	Pressable,
	StatusBar,
	Text,
	TouchableOpacity,
	View,
	BackHandler,
	ToastAndroid,
	StyleSheet,
	ActivityIndicator,
} from 'react-native'
import ContentLoader, { Rect } from 'react-content-loader/native'
import dashBoardButtons from './buttons'
import { router, useFocusEffect } from 'expo-router'
import { statusBarColor, barStyleMode } from '../../../../../src/constants'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import * as Icons from '../../../../../assets/dashboardIcons/index'
import { getDraftCount } from '../../../../../src/controllers/draft.js'
import { getAnalytics } from '../../../../../src/controllers/analytics.js'
import useApi from '../../../../../src/hooks/useApi.jsx'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import { useAuth } from '../../../../../src/context/AuthContext.jsx'
import { useSyncContext } from '../../../../../src/context/SyncContext.jsx'

// ─── Responsive Helpers ───────────────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// Base design was built on a 1080×2340 px device (≈ 393 dp wide at 2.75x)
const BASE_WIDTH = 393
const scale = SCREEN_WIDTH / BASE_WIDTH

// Clamp so tiny phones and huge tablets don't go crazy
const rs = (size) =>
	Math.round(Math.min(Math.max(size * scale, size * 0.75), size * 1.4))

// Device breakpoints (in dp / logical pixels)
const isSmallPhone = SCREEN_WIDTH < 360 // e.g. Galaxy A01
const isPhone = SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 600
const isTablet = SCREEN_WIDTH >= 600 && SCREEN_WIDTH < 900
const isLargeTablet = SCREEN_WIDTH >= 900

// How many grid columns for the dashboard icon grid
const NUM_COLUMNS = isLargeTablet ? 6 : isTablet ? 5 : 4

// ─────────────────────────────────────────────────────────────────────────────

// Shallow equality for analytics objects with a fixed key set.
// Cheaper than JSON.stringify on every focus and avoids the cost
// of re-rendering analytics cards when nothing actually changed.
const shallowAnalyticsEqual = (a, b) => {
	if (a === b) return true
	if (!a || !b) return false
	const aKeys = Object.keys(a)
	const bKeys = Object.keys(b)
	if (aKeys.length !== bKeys.length) return false
	for (let i = 0; i < aKeys.length; i++) {
		const key = aKeys[i]
		if (a[key] !== b[key]) return false
	}
	return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Slim progress bar shown at the very top while the device product catalog
// is being downloaded for quick (offline) access. Non-interactive.
const SyncDownloadBanner = memo(({ visible, label }) => {
	if (!visible) return null
	return (
		<View style={styles.syncDownloadBanner}>
			<Text style={styles.syncDownloadBannerText} numberOfLines={1}>
				{label}
			</Text>
			<ActivityIndicator
				size={12}
				color="#195FE1"
				style={styles.syncDownloadBannerSpinner}
			/>
		</View>
	)
})

// Memoized Sales Analytics Card
const SalesAnalyticsCard = memo(({ todayAnalytics }) => {
	const { loc, currentLocale } = useLocalization()
	const { translateAmount } = useNumberTranslator()
	const isBangla = currentLocale === 'bn'

	return (
		<View style={styles.analyticsCard}>
			<Text style={styles.analyticsLabel}>{loc.t('dashboard.sellToday')}</Text>
			<Text
				style={[
					styles.analyticsMainValue,
					isBangla && styles.analyticsMainValueBn,
				]}
			>
				{translateAmount(todayAnalytics.totalSell, {
					currencySymbol: '৳',
					decimalPlaces: 0,
				})}
			</Text>
			<View style={styles.analyticsRow}>
				<View style={[styles.analyticsSubLeft, styles.borderRight]}>
					<Text style={styles.analyticsSubLabel}>
						{loc.t('dashboard.debtAmount')}
					</Text>
					<Text
						style={[
							styles.analyticsSubValue,
							isBangla && styles.analyticsSubValueBn,
						]}
					>
						{translateAmount(todayAnalytics.totalDebt, {
							currencySymbol: '৳',
							decimalPlaces: 0,
						})}
					</Text>
				</View>
				<View style={styles.analyticsSubRight}>
					<Text style={styles.analyticsSubLabel}>
						{loc.t('dashboard.discount')}
					</Text>
					<Text
						style={[
							styles.analyticsSubValue,
							isBangla && styles.analyticsSubValueBn,
						]}
					>
						{translateAmount(todayAnalytics.totalDiscount, {
							currencySymbol: '৳',
							decimalPlaces: 0,
						})}
					</Text>
				</View>
			</View>
		</View>
	)
})

// Memoized Profit Analytics Card
const ProfitAnalyticsCard = memo(({ todayAnalytics, yesterdayAnalytics }) => {
	const { loc, currentLocale } = useLocalization()
	const { translateAmount, translateNumber } = useNumberTranslator()
	const isBangla = currentLocale === 'bn'

	return (
		<View style={styles.analyticsCard}>
			<Text style={styles.analyticsLabel}>
				{loc.t('dashboard.profitToday')}
			</Text>
			<Text
				style={[
					styles.analyticsMainValue,
					isBangla && styles.analyticsMainValueBn,
				]}
			>
				{translateAmount(todayAnalytics.profit, {
					currencySymbol: '৳',
					decimalPlaces: 0,
				})}
			</Text>
			<View style={styles.analyticsRow}>
				<View style={[styles.analyticsSubLeft, styles.borderRight]}>
					<Text style={styles.analyticsSubLabel} numberOfLines={1}>
						{loc.t('dashboard.lastSoldUnit')}
					</Text>
					<Text
						style={[
							styles.analyticsSubValue,
							isBangla && styles.analyticsSubValueBn,
						]}
					>
						# {translateNumber(todayAnalytics.totalquantity)}
					</Text>
				</View>
				<View style={styles.analyticsSubRight}>
					<Text style={styles.analyticsSubLabel}>
						{loc.t('dashboard.lastProfit')}
					</Text>
					<Text
						style={[
							styles.analyticsSubValue,
							isBangla && styles.analyticsSubValueBn,
						]}
					>
						{translateAmount(yesterdayAnalytics.profit, {
							currencySymbol: '৳',
							decimalPlaces: 0,
						})}
					</Text>
				</View>
			</View>
		</View>
	)
})

// Memoized Order Button
const OrderButton = memo(({ type, count, onPress }) => {
	const { loc, currentLocale } = useLocalization()
	const { translateNumber } = useNumberTranslator()
	const isBangla = currentLocale === 'bn'

	const handlePress = useCallback(() => {
		onPress({ name: type === 'draft' ? 'draftOrder' : 'onlineOrder' })
	}, [type, onPress])

	const iconComponent = useMemo(() => {
		return type === 'draft' ? (
			<Icons.DraftIcon width={rs(25)} height={rs(25)} />
		) : (
			<Icons.OnlineIcon width={rs(25)} height={rs(25)} />
		)
	}, [type])

	const displayCount = useMemo(() => {
		const countValue = type === 'draft' && count !== null ? count : 0
		return translateNumber(countValue)
	}, [type, count, translateNumber])

	const showSkeleton = type === 'draft' && count === null

	return (
		<View style={styles.orderButtonWrapper}>
			<Pressable onPress={handlePress}>
				<View style={styles.orderButtonInner}>
					{showSkeleton ? (
						<DraftCountSkeleton />
					) : (
						<View style={styles.orderButtonPill}>
							{iconComponent}
							<Text
								style={[
									styles.orderButtonCount,
									isBangla && styles.orderButtonCountBn,
								]}
							>
								{displayCount}
							</Text>
						</View>
					)}
					<Text style={styles.orderButtonLabel}>
						{loc.t(
							type === 'draft'
								? 'dashboard.draftOrder'
								: 'dashboard.pickUpOrder'
						)}
					</Text>
				</View>
			</Pressable>
		</View>
	)
})

// Memoized Draft Count Skeleton
const DraftCountSkeleton = memo(() => (
	<View style={styles.orderButtonPill}>
		<Icons.DraftIcon width={rs(25)} height={rs(25)} />
		<ContentLoader
			speed={2}
			width={rs(30)}
			height={rs(20)}
			viewBox={`0 0 ${rs(30)} ${rs(20)}`}
			backgroundColor="#ffffff20"
			foregroundColor="#ffffff40"
			style={{ marginLeft: rs(16) }}
		>
			<Rect x="0" y="0" rx="4" ry="4" width={rs(30)} height={rs(20)} />
		</ContentLoader>
	</View>
))

// Memoized Analytics Card Skeleton
const SKELETON_LOADER_PROPS = {
	speed: 2,
	backgroundColor: '#ffffff20',
	foregroundColor: '#ffffff40',
}

const AnalyticsCardSkeleton = memo(({ type }) => {
	const { loc } = useLocalization()

	const config = useMemo(() => {
		if (type === 'sales') {
			return {
				label: 'dashboard.sellToday',
				leftLabel: 'dashboard.debtAmount',
				rightLabel: 'dashboard.discount',
			}
		}
		return {
			label: 'dashboard.profitToday',
			leftLabel: 'dashboard.lastSoldUnit',
			rightLabel: 'dashboard.lastProfit',
		}
	}, [type])

	const mainW = rs(80)
	const mainH = rs(20)
	const subW = rs(50)
	const subH = rs(14)

	return (
		<View style={styles.analyticsCard}>
			<Text style={styles.analyticsLabel}>{loc.t(config.label)}</Text>
			<ContentLoader
				{...SKELETON_LOADER_PROPS}
				width={mainW}
				height={mainH}
				viewBox={`0 0 ${mainW} ${mainH}`}
				style={{ marginVertical: rs(8) }}
			>
				<Rect x="0" y="0" rx="4" ry="4" width={mainW} height={rs(16)} />
			</ContentLoader>
			<View style={styles.analyticsRow}>
				<View style={[styles.analyticsSubLeft, styles.borderRight]}>
					<Text style={styles.analyticsSubLabel}>
						{loc.t(config.leftLabel)}
					</Text>
					<ContentLoader
						{...SKELETON_LOADER_PROPS}
						width={subW}
						height={subH}
						viewBox={`0 0 ${subW} ${subH}`}
					>
						<Rect x="0" y="0" rx="4" ry="4" width={subW} height={subH} />
					</ContentLoader>
				</View>
				<View style={styles.analyticsSubRight}>
					<Text style={styles.analyticsSubLabel}>
						{loc.t(config.rightLabel)}
					</Text>
					<ContentLoader
						{...SKELETON_LOADER_PROPS}
						width={subW}
						height={subH}
						viewBox={`0 0 ${subW} ${subH}`}
					>
						<Rect x="0" y="0" rx="4" ry="4" width={subW} height={subH} />
					</ContentLoader>
				</View>
			</View>
		</View>
	)
})

// Memoized Dashboard Button
const DashboardButton = memo(({ item, onPress }) => {
	const { loc } = useLocalization()

	const handlePress = useCallback(() => {
		onPress(item)
	}, [item, onPress])

	return (
		<View style={styles.dashboardButtonWrapper}>
			<TouchableOpacity onPress={handlePress}>
				<View style={styles.dashboardButtonInner}>
					<View style={styles.dashboardButtonIconBg}>{item.icon}</View>
					<Text
						style={styles.dashboardButtonLabel}
						numberOfLines={2}
						adjustsFontSizeToFit
					>
						{loc.t(`dashboard.icons.${item.name}`)}
					</Text>
				</View>
			</TouchableOpacity>
		</View>
	)
})

// Memoized Spiral Component
const SPIRAL_CIRCLE_BASE_STYLE = {
	boxShadow: 'inset -4px 4px 3px #000000',
}
const SPIRAL_CIRCLE_CLASS = 'w-8 h-8 bg-bgColor rounded-full mx-1'

const SpiralComponent = memo(() => {
	const circleCount = Math.ceil(SCREEN_WIDTH / rs(36)) + 2
	const spiralElements = useMemo(
		() =>
			Array.from({ length: circleCount }, (_, i) => (
				<View
					key={i}
					className={SPIRAL_CIRCLE_CLASS}
					style={SPIRAL_CIRCLE_BASE_STYLE}
				/>
			)),
		[circleCount]
	)

	return <View style={styles.spiralRow}>{spiralElements}</View>
})

// Memoized Quick Action Button
const QuickActionButton = memo(({ type, onPress }) => {
	const { loc } = useLocalization()

	const handlePress = useCallback(() => {
		onPress({ name: type === 'calculator' ? 'smartCalc' : 'addInventory' })
	}, [type, onPress])

	const iconSize = rs(50)

	const iconComponent = useMemo(() => {
		return type === 'calculator' ? (
			<Icons.CalculatorIcon width={iconSize} height={iconSize} />
		) : (
			<Icons.AddProductIcon width={iconSize} height={iconSize} />
		)
	}, [type, iconSize])

	const labelText = useMemo(() => {
		return loc.t(
			type === 'calculator' ? 'dashboard.calculator' : 'dashboard.warehouse'
		)
	}, [type, loc])

	return (
		<View style={styles.quickActionWrapper}>
			<Pressable onPress={handlePress}>
				<View style={styles.quickActionInner}>
					{iconComponent}
					<Text style={styles.quickActionLabel}>{labelText}</Text>
				</View>
			</Pressable>
		</View>
	)
})

export default function Dashboard() {
	const { authState } = useAuth()
	const { loc } = useLocalization()
	const sync = useSyncContext()
	// true only while the global product catalog is being downloaded
	const isDownloadingProducts = !!sync?.isSyncing && sync?.phase === 'product'
	const backPressCount = useRef(0)
	const backPressTimer = useRef(null)
	const { fetchData } = useApi()
	const [draftOrderNumber, setDraftOrderNumber] = useState(null)
	const [todayAnalytics, setTodayAnalytics] = useState(null)
	const [yesterdayAnalytics, setYesterdayAnalytics] = useState(null)

	const fetchDraftOrders = useCallback(async () => {
		try {
			const res = await fetchData(getDraftCount, {})
			if (!res.success) {
				setDraftOrderNumber(0)
				return
			}
			setDraftOrderNumber((prev) =>
				prev === res.data.total ? prev : res.data.total
			)
		} catch (err) {
			console.error('Error fetching draft orders:', err)
			setDraftOrderNumber(0)
		}
	}, [fetchData])

	const fetchTodayAnalytics = useCallback(async () => {
		const todayISO = new Date().toISOString()
		try {
			const res = await fetchData(getAnalytics, {
				startDate: todayISO,
				endDate: todayISO,
			})
			setTodayAnalytics((prev) =>
				shallowAnalyticsEqual(prev, res.data) ? prev : res.data
			)
		} catch (err) {
			console.error('Error fetching analytics:', err)
			setTodayAnalytics({})
		}
	}, [fetchData])

	const fetchYesterdayAnalytics = useCallback(async () => {
		const yesterdayISO = new Date(Date.now() - 86400000).toISOString()
		try {
			const res = await fetchData(getAnalytics, {
				startDate: yesterdayISO,
				endDate: yesterdayISO,
			})
			setYesterdayAnalytics((prev) =>
				shallowAnalyticsEqual(prev, res.data) ? prev : res.data
			)
		} catch (err) {
			console.error('Error fetching analytics:', err)
			setYesterdayAnalytics({})
		}
	}, [fetchData])

	const handleBackPress = useCallback(() => {
		if (backPressCount.current === 0) {
			backPressCount.current = 1
			ToastAndroid.show(
				loc.t('dashboard.pressBackAgainToExit') || 'Press back again to exit',
				ToastAndroid.SHORT
			)
			backPressTimer.current = setTimeout(() => {
				backPressCount.current = 0
			}, 2000)
			return true
		} else {
			if (backPressTimer.current) {
				clearTimeout(backPressTimer.current)
				backPressTimer.current = null
			}
			BackHandler.exitApp()
			return false
		}
	}, [loc])

	useFocusEffect(
		useCallback(() => {
			fetchDraftOrders()
			fetchTodayAnalytics()
			fetchYesterdayAnalytics()
			const backHandler = BackHandler.addEventListener(
				'hardwareBackPress',
				handleBackPress
			)
			return () => {
				backHandler.remove()
				if (backPressTimer.current) {
					clearTimeout(backPressTimer.current)
					backPressTimer.current = null
				}
			}
		}, [
			fetchDraftOrders,
			fetchTodayAnalytics,
			fetchYesterdayAnalytics,
			handleBackPress,
		])
	)

	const handleButtonPress = useCallback(
		(item) => {
			switch (item.name) {
				case 'addInventory':
					router.push('/home/inventory/add')
					break
				case 'inventory':
					router.push('/home/inventory/details')
					break
				case 'sell':
					router.push('/home/transactions/sell')
					break
				case 'smartCalc':
					router.push('/home/calculator')
					break
				case 'customer':
					router.push('/home/customer')
					break
				case 'employee':
					if (authState.role === 'OWNER') {
						router.push('/home/employee')
					} else if (authState.role === 'EMPLOYEE') {
						router.push('/home/employee/Employee')
					}
					break
				case 'onlineOrder':
					router.push('/home/pickup')
					break
				case 'draftOrder':
					router.push('/home/draft')
					break
				case 'supplier':
					router.push('/home/supplier')
					break
				case 'debt':
					router.push('/home/debt')
					break
				case 'message':
					router.push('/home/message')
					break
				case 'report':
					router.push('/home/report')
					break
				case 'expense':
					router.push('/home/expense')
					break
			}
		},
		[authState.role]
	)

	const renderDashboardButton = useCallback(
		({ item }) => <DashboardButton item={item} onPress={handleButtonPress} />,
		[handleButtonPress]
	)

	const keyExtractor = useCallback((item) => item.name, [])

	const handleSellPress = useCallback(() => {
		handleButtonPress({ name: 'sell' })
	}, [handleButtonPress])

	const memoizedTodayAnalytics = useMemo(() => todayAnalytics, [todayAnalytics])

	const salesCard = useMemo(() => {
		return memoizedTodayAnalytics ? (
			<SalesAnalyticsCard todayAnalytics={memoizedTodayAnalytics} />
		) : (
			<AnalyticsCardSkeleton type="sales" />
		)
	}, [memoizedTodayAnalytics])

	const profitCard = useMemo(() => {
		return todayAnalytics && yesterdayAnalytics ? (
			<ProfitAnalyticsCard
				todayAnalytics={todayAnalytics}
				yesterdayAnalytics={yesterdayAnalytics}
			/>
		) : (
			<AnalyticsCardSkeleton type="profit" />
		)
	}, [todayAnalytics, yesterdayAnalytics])

	// Responsive item layout for FlatList
	const getItemLayout = useCallback((data, index) => {
		const itemHeight = rs(100)
		return {
			length: itemHeight,
			offset: itemHeight * Math.floor(index / NUM_COLUMNS),
			index,
		}
	}, [])

	return (
		<View style={styles.container}>
			<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />

			{/* Product catalog download progress — slim bar, full width */}
			<SyncDownloadBanner
				visible={isDownloadingProducts}
				label={loc.t('dashboard.downloadingProducts')}
			/>

			{/* Banner */}
			<View>
				<View style={styles.bannerBg}>
					<View style={styles.bannerCardRow}>
						<View style={styles.bannerCardWrapper}>{salesCard}</View>
						<View style={styles.bannerCardWrapper}>{profitCard}</View>
					</View>
				</View>
				<View className="flex justify-between -mt-4 -ml-4 relative z-10">
					<SpiralComponent />
				</View>
				<View className="w-full h-4 bg-bgColor -mt-4 z-20" />
			</View>

			<View style={styles.bodyContainer}>
				{/* Order buttons */}
				<View style={styles.orderButtonsRow}>
					<OrderButton
						type="draft"
						count={draftOrderNumber}
						onPress={handleButtonPress}
					/>
					<OrderButton type="online" count={0} onPress={handleButtonPress} />
				</View>

				{/* Dashboard buttons */}
				<View style={styles.dashboardButtonsContainer}>
					<FlatList
						data={dashBoardButtons}
						renderItem={renderDashboardButton}
						keyExtractor={keyExtractor}
						numColumns={NUM_COLUMNS}
						key={NUM_COLUMNS} // force re-render when columns change (e.g. orientation)
						initialNumToRender={NUM_COLUMNS * 2}
						maxToRenderPerBatch={NUM_COLUMNS * 2}
						windowSize={10}
						removeClippedSubviews={true}
						getItemLayout={getItemLayout}
						scrollEnabled={false}
					/>
				</View>

				{/* Quick action buttons */}
				<View style={styles.quickActionsRow}>
					<QuickActionButton type="calculator" onPress={handleButtonPress} />
					<QuickActionButton type="inventory" onPress={handleButtonPress} />
				</View>

				{/* Sell button */}
				<Pressable onPress={handleSellPress}>
					<View style={styles.sellButton}>
						<Icons.BarcodeIcon width={rs(100)} height={rs(68)} />
						<Text
							style={styles.sellButtonText}
							numberOfLines={1}
							textBreakStrategy="simple"
						>
							{loc.t('dashboard.sellBtn')}
						</Text>
					</View>
				</Pressable>
			</View>
		</View>
	)
}

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	// Root
	container: {
		flex: 1,
		paddingBottom: rs(20),
		backgroundColor: '#F0F8FF', // bgColor — replace with your token if needed
	},

	// ── Sync download banner ──────────────────────────────────────────────────
	syncDownloadBanner: {
		width: '100%',
		minHeight: rs(10),
		backgroundColor: '#D6E7FF',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: rs(20),
	},
	syncDownloadBannerText: {
		flex: 1,
		fontSize: rs(7),
		color: '#195FE1',
		fontWeight: '500',
	},
	syncDownloadBannerSpinner: {
		marginLeft: rs(8),
	},

	// ── Banner ────────────────────────────────────────────────────────────────
	bannerBg: {
		backgroundColor: '#1A56DB', // primaryTheme — replace with your token
		paddingHorizontal: rs(16),
	},
	bannerCardRow: {
		flexDirection: 'row',
		justifyContent: 'space-evenly',
		marginHorizontal: 'auto',
		marginVertical: rs(8),
		paddingTop: rs(8),
		paddingBottom: rs(16),
	},
	bannerCardWrapper: {
		width: '50%',
		padding: rs(4),
	},

	// Analytics card (shared by Sales & Profit)
	analyticsCard: {
		backgroundColor: 'rgba(255,255,255,0.20)',
		borderRadius: rs(8),
		padding: rs(12),
	},
	analyticsLabel: {
		color: '#F0F8FF',
		fontSize: rs(13),
	},
	analyticsMainValue: {
		color: '#F0F8FF',
		textAlign: 'left',
		marginVertical: rs(8),
		fontSize: rs(14),
	},
	analyticsMainValueBn: {
		fontSize: rs(18),
	},
	analyticsRow: {
		flexDirection: 'row',
	},
	analyticsSubLeft: {
		paddingRight: rs(8),
		flexShrink: 1,
	},
	analyticsSubRight: {
		paddingLeft: rs(8),
		flexShrink: 1,
	},
	borderRight: {
		borderRightWidth: 2,
		borderRightColor: 'rgba(255,255,255,0.60)',
	},
	analyticsSubLabel: {
		color: '#F0F8FF',
		fontSize: rs(11),
	},
	analyticsSubValue: {
		color: '#F0F8FF',
		fontSize: rs(13),
	},
	analyticsSubValueBn: {
		fontSize: rs(16),
	},

	// ── Spiral ────────────────────────────────────────────────────────────────
	spiralContainer: {
		marginTop: rs(-16),
		marginLeft: rs(-16),
		zIndex: 10,
		position: 'relative',
	},
	spiralRow: {
		flexDirection: 'row',
	},
	spiralCircle: {
		width: rs(32),
		height: rs(32),
		backgroundColor: '#F0F8FF',
		borderRadius: rs(16),
		marginHorizontal: rs(4),
		shadowColor: '#000000',
		shadowOffset: { width: -4, height: 4 }, // matches inset -4px 4px
		shadowOpacity: 1, // was 0.3, working uses full black
		shadowRadius: 3,
		elevation: 4,
	},
	spiralCover: {
		width: '100%',
		height: rs(16),
		backgroundColor: '#F0F8FF',
		marginTop: rs(-16),
		zIndex: 20,
	},

	// ── Body ──────────────────────────────────────────────────────────────────
	bodyContainer: {
		flexDirection: 'column',
		justifyContent: 'space-between',
		flex: 1,
	},

	// ── Order buttons ─────────────────────────────────────────────────────────
	orderButtonsRow: {
		flexDirection: 'row',
		justifyContent: 'space-around',
	},
	orderButtonWrapper: {
		width: '50%',
	},
	orderButtonInner: {
		alignItems: 'center',
		padding: rs(8),
	},
	orderButtonPill: {
		flexDirection: 'row',
		borderRadius: rs(50),
		backgroundColor: '#78B9EB', // color_3 — replace with your token
		padding: rs(16),
		alignItems: 'center',
		paddingHorizontal: rs(32),
		marginBottom: rs(8),
	},
	orderButtonCount: {
		color: '#F0F8FF',
		marginLeft: rs(16),
		fontWeight: 'bold',
		fontSize: rs(14),
	},
	orderButtonCountBn: {
		fontSize: rs(22),
	},
	orderButtonLabel: {
		fontSize: rs(13),
	},

	// ── Dashboard icon grid ───────────────────────────────────────────────────
	dashboardButtonsContainer: {
		marginHorizontal: rs(16),
	},
	dashboardButtonWrapper: {
		// Each cell takes 1/NUM_COLUMNS of the row
		width: `${100 / NUM_COLUMNS}%`,
	},
	dashboardButtonInner: {
		borderRadius: rs(8),
		alignItems: 'center',
		padding: rs(8),
	},
	dashboardButtonIconBg: {
		backgroundColor: '#D9D9D9', // dashboardButtonBg — replace with your token
		marginBottom: rs(4),
		borderRadius: rs(8),
		padding: rs(8),
	},
	dashboardButtonLabel: {
		fontSize: rs(12),
		textAlign: 'center',
	},

	// ── Quick actions ─────────────────────────────────────────────────────────
	quickActionsRow: {
		flexDirection: 'row',
		marginVertical: rs(8),
		justifyContent: 'space-around',
	},
	quickActionWrapper: {
		alignItems: 'center',
	},
	quickActionInner: {
		alignItems: 'center',
	},
	quickActionLabel: {
		marginTop: rs(4),
		fontSize: rs(13),
	},

	// ── Sell button ───────────────────────────────────────────────────────────
	sellButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-evenly',
		backgroundColor: '#195FE1',
		borderRadius: rs(12),
		marginHorizontal: rs(32),
		marginTop: rs(4),
		paddingVertical: rs(8),
	},
	sellButtonText: {
		fontSize: rs(28),
		color: '#F0F8FF',
	},
})
