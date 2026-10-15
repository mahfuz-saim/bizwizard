import React, {
	useEffect,
	useState,
	useMemo,
	useCallback,
	memo,
	useRef,
} from 'react'
import { router, useFocusEffect } from 'expo-router'
import {
	Text,
	View,
	ScrollView,
	StyleSheet,
	TouchableOpacity,
} from 'react-native'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import ContentLoader, { Rect, Circle } from 'react-content-loader/native'
import { useLocalization } from '../../../../src/localization/localizationContext'
import { getShopInfo } from '../../../../src/controllers/shop'
import useApi from '../../../../src/hooks/useApi'
import useNumberTranslator from '../../../../src/hooks/useNumberTranslator'
import { useAuth } from '../../../../src/context/AuthContext'

// Memoized components to prevent unnecessary re-renders
const InfoCard = memo(({ icon, title, value, color = '#195FE1' }) => (
	<View style={styles.infoCard}>
		<View style={[styles.iconContainer, { backgroundColor: color }]}>
			<MaterialIcons name={icon} size={24} color="#FFFFFF" />
		</View>
		<View style={styles.infoContent}>
			<Text style={styles.infoTitle}>{title}</Text>
			<Text style={styles.infoValue}>{value}</Text>
		</View>
	</View>
))

const StatsCard = memo(({ label, value, icon, color, onPress }) => {
	const CardContent = useMemo(
		() => (
			<View style={styles.statsCard}>
				<View style={[styles.statsIcon, { backgroundColor: color }]}>
					<MaterialIcons name={icon} size={20} color="#FFFFFF" />
				</View>
				<Text style={styles.statsValue}>{value}</Text>
				<Text style={styles.statsLabel}>{label}</Text>
			</View>
		),
		[label, value, icon, color]
	)

	if (onPress) {
		return (
			<TouchableOpacity
				onPress={onPress}
				activeOpacity={0.8}
				style={styles.statsCardTouchable}
			>
				{CardContent}
			</TouchableOpacity>
		)
	}

	return <View style={styles.statsCardContainer}>{CardContent}</View>
})

// Optimized skeleton components
const HeaderSkeleton = memo(() => (
	<View style={styles.header}>
		<View style={styles.headerGradient}>
			<ContentLoader
				speed={2}
				width={200}
				height={200}
				viewBox="0 0 200 200"
				backgroundColor="#ffffff20"
				foregroundColor="#ffffff30"
			>
				<Circle cx="100" cy="50" r="40" />
				<Rect x="40" y="110" rx="8" ry="8" width="120" height="20" />
				<Rect x="60" y="140" rx="6" ry="6" width="80" height="16" />
				<Rect x="70" y="170" rx="12" ry="12" width="60" height="24" />
			</ContentLoader>
		</View>
	</View>
))

const StatsSkeleton = memo(() => (
	<View style={styles.statsContainer}>
		{[1, 2].map((item) => (
			<View key={item} style={styles.statsCard}>
				<ContentLoader
					speed={2}
					width={120}
					height={80}
					viewBox="0 0 120 80"
					backgroundColor="#f3f4f6"
					foregroundColor="#e5e7eb"
				>
					<Circle cx="60" cy="20" r="16" />
					<Rect x="40" y="45" rx="4" ry="4" width="40" height="16" />
					<Rect x="30" y="65" rx="3" ry="3" width="60" height="12" />
				</ContentLoader>
			</View>
		))}
	</View>
))

const InfoSkeleton = memo(() => (
	<View style={styles.section}>
		<ContentLoader
			speed={2}
			width={350}
			height={24}
			viewBox="0 0 350 24"
			backgroundColor="#f3f4f6"
			foregroundColor="#e5e7eb"
		>
			<Rect x="0" y="0" rx="6" ry="6" width="150" height="18" />
		</ContentLoader>

		{[1, 2].map((item) => (
			<View key={item} style={styles.infoCard}>
				<ContentLoader
					speed={2}
					width={350}
					height={48}
					viewBox="0 0 350 48"
					backgroundColor="#f3f4f6"
					foregroundColor="#e5e7eb"
				>
					<Circle cx="24" cy="24" r="20" />
					<Rect x="64" y="8" rx="4" ry="4" width="80" height="12" />
					<Rect x="64" y="28" rx="4" ry="4" width="120" height="16" />
				</ContentLoader>
			</View>
		))}
	</View>
))

const SubscriptionSkeleton = memo(() => (
	<View style={styles.subscriptionContainer}>
		<ContentLoader
			speed={2}
			width={350}
			height={60}
			viewBox="0 0 350 60"
			backgroundColor="#f3f4f6"
			foregroundColor="#e5e7eb"
		>
			<Rect x="0" y="0" rx="16" ry="16" width="350" height="60" />
		</ContentLoader>
	</View>
))

const ProfileSkeleton = memo(() => (
	<ScrollView
		style={styles.container}
		showsVerticalScrollIndicator={false}
		removeClippedSubviews={true}
		maxToRenderPerBatch={3}
		windowSize={5}
	>
		<HeaderSkeleton />
		<StatsSkeleton />
		<SubscriptionSkeleton />
		<InfoSkeleton />
		<View style={styles.bottomPadding} />
	</ScrollView>
))

// Main component with optimizations
export default function ProfileScreen() {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const { setAuthState } = useAuth()
	const { translateNumber, translatePhone } = useNumberTranslator()
	const [shopInfo, setShopInfo] = useState({})
	const [loading, setLoading] = useState(true)
	const lastFocusRefreshAtRef = useRef(0)
	const FOCUS_REFRESH_WINDOW_MS = 15000

	// Memoized functions to prevent recreation on every render
	const getCategoryIcon = useCallback((category) => {
		switch (category?.toUpperCase()) {
			case 'GROCERY':
				return 'local-grocery-store'
			case 'PHARMACY':
				return 'local-pharmacy'
			case 'RESTAURANT':
				return 'restaurant'
			default:
				return 'store'
		}
	}, [])

	const handleSubscriptionPress = useCallback(() => {
		router.push('/home/subscriptionBuy')
	}, [])

	const handleCreditPress = useCallback(() => {
		router.push('/home/message/credit')
	}, [])

	// Memoized function to load shop data
	const loadShopData = useCallback(
		async (showLoader = true) => {
			try {
				if (showLoader) {
					setLoading(true)
				}
				const data = await fetchData(getShopInfo, {})
				if (data?.data?.subscription?.status === 'ACTIVE') {
					setAuthState((prev) => ({
						...prev,
						isSubscriptionValid: true,
					}))
				}
				const newShopInfo = data?.data || {}

				// Only update if data has changed to avoid unnecessary re-renders
				setShopInfo((prevInfo) => {
					const hasChanged =
						prevInfo.credit !== newShopInfo.credit ||
						prevInfo.shopName !== newShopInfo.shopName ||
						prevInfo.shopCode !== newShopInfo.shopCode ||
						prevInfo.category !== newShopInfo.category ||
						prevInfo.contact !== newShopInfo.contact ||
						prevInfo.tradeLicense !== newShopInfo.tradeLicense ||
						prevInfo.createdAt !== newShopInfo.createdAt

					return hasChanged ? newShopInfo : prevInfo
				})
			} catch (error) {
				console.error('🚨 Failed to fetch shop info:', error)
			} finally {
				setLoading(false)
			}
		},
		[fetchData, setAuthState]
	)

	// Initial load
	useEffect(() => {
		loadShopData(true)
	}, []) // Empty dependency - run only once on mount

	// Refresh data when screen comes into focus
	useFocusEffect(
		useCallback(() => {
			const now = Date.now()
			if (now - lastFocusRefreshAtRef.current < FOCUS_REFRESH_WINDOW_MS) {
				return
			}
			lastFocusRefreshAtRef.current = now

			// Don't show loader on focus refresh for smooth experience
			loadShopData(false)
		}, [loadShopData])
	)

	// Memoized computed values to prevent recalculation
	const computedValues = useMemo(() => {
		const daysTogether = shopInfo.createdAt
			? Math.floor(
					(new Date() - new Date(shopInfo.createdAt)) / (1000 * 60 * 60 * 24)
				)
			: 0

		const categoryText =
			shopInfo.category?.toLowerCase().replace('_', ' ') ||
			loc.t('profile.general')

		const creditValue = translateNumber(shopInfo.credit || 0)

		return {
			daysTogether,
			categoryText,
			creditValue,
		}
	}, [
		shopInfo.createdAt,
		shopInfo.category,
		shopInfo.credit,
		loc,
		translateNumber,
	])

	// Memoized localized strings
	const localizedStrings = useMemo(
		() => ({
			shopName: shopInfo.shopName || loc.t('profile.shopName'),
			shopCode: `${loc.t('profile.shopCode')}: ${
				shopInfo.shopCode || loc.t('profile.notAvailable')
			}`,
			currentCredit: loc.t('profile.currentCredit'),
			daysTogether: loc.t('profile.daysTogether'),
			buySubscription: loc.t('profile.buySubscription') || 'Buy Subscription',
			shopInformation: loc.t('profile.shopInformation'),
			contactNumber: loc.t('profile.contactNumber'),
			tradeLicense: loc.t('profile.tradeLicense'),
			notSet: loc.t('profile.notSet'),
		}),
		[shopInfo.shopName, shopInfo.shopCode, loc]
	)

	// Memoized category icon
	const categoryIcon = useMemo(
		() => getCategoryIcon(shopInfo.category),
		[shopInfo.category, getCategoryIcon]
	)

	// Show skeleton loader while loading
	if (loading) {
		return <ProfileSkeleton />
	}

	return (
		<ScrollView
			style={styles.container}
			showsVerticalScrollIndicator={false}
			removeClippedSubviews={true}
			maxToRenderPerBatch={4}
			windowSize={6}
			initialNumToRender={3}
		>
			{/* Header Section */}
			<View style={styles.header}>
				<View style={styles.headerGradient}>
					<View style={styles.shopIconContainer}>
						<MaterialIcons name={categoryIcon} size={40} color="#FFFFFF" />
					</View>
					<Text style={styles.shopName}>{localizedStrings.shopName}</Text>
					<Text style={styles.shopCode}>{localizedStrings.shopCode}</Text>
					<View style={styles.categoryBadge}>
						<Text style={styles.categoryText}>
							{computedValues.categoryText}
						</Text>
					</View>
				</View>
			</View>

			{/* Stats Section */}
			<View style={styles.statsContainer}>
				<StatsCard
					label={localizedStrings.currentCredit}
					value={computedValues.creditValue}
					icon="account-balance-wallet"
					color="#10B981"
					onPress={handleCreditPress}
				/>
				<StatsCard
					label={localizedStrings.daysTogether}
					value={translateNumber(computedValues.daysTogether.toString())}
					icon="schedule"
					color="#F59E0B"
					onPress={handleSubscriptionPress}
				/>
			</View>

			{/* Subscription and Referral Buttons */}
			<View style={styles.subscriptionContainer}>
				<TouchableOpacity
					style={styles.subscriptionButton}
					activeOpacity={0.8}
					onPress={handleSubscriptionPress}
				>
					<MaterialIcons name="card-membership" size={20} color="#FFFFFF" />
					<Text style={styles.subscriptionButtonText}>
						{localizedStrings.buySubscription}
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.referralButton}
					activeOpacity={0.8}
					onPress={() => router.push('/profile/referral-rewards')}
				>
					<MaterialIcons name="card-giftcard" size={20} color="#FFFFFF" />
					<Text style={styles.subscriptionButtonText}>
						{loc.t('profile.referralRewards')}
					</Text>
				</TouchableOpacity>
			</View>

			{/* Information Section */}
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>
					{localizedStrings.shopInformation}
				</Text>

				<InfoCard
					icon="phone"
					title={localizedStrings.contactNumber}
					value={
						shopInfo.contact
							? translatePhone(shopInfo.contact)
							: localizedStrings.notSet
					}
					color="#10B981"
				/>

				<InfoCard
					icon="description"
					title={localizedStrings.tradeLicense}
					value={shopInfo.tradeLicense || localizedStrings.notSet}
					color="#F59E0B"
				/>
			</View>

			<View style={styles.bottomPadding} />
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F8FAFC',
	},
	header: {
		marginBottom: 20,
	},
	headerGradient: {
		backgroundColor: '#195FE1',
		paddingTop: 25,
		paddingBottom: 25,
		paddingHorizontal: 20,
		borderBottomLeftRadius: 30,
		borderBottomRightRadius: 30,
		alignItems: 'center',
		shadowColor: '#6592E5',
		shadowOffset: {
			width: 0,
			height: 4,
		},
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 8,
	},
	shopIconContainer: {
		width: 80,
		height: 80,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		borderRadius: 40,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 16,
		borderWidth: 3,
		borderColor: 'rgba(255, 255, 255, 0.3)',
	},
	shopName: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#FFFFFF',
		textAlign: 'center',
		marginBottom: 4,
	},
	shopCode: {
		fontSize: 16,
		color: '#E5E7EB',
		textAlign: 'center',
		marginBottom: 12,
		fontWeight: '600',
	},
	categoryBadge: {
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		paddingHorizontal: 16,
		paddingVertical: 6,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.3)',
	},
	categoryText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '500',
		textTransform: 'capitalize',
	},
	statsContainer: {
		flexDirection: 'row',
		paddingHorizontal: 20,
		marginBottom: 20,
		gap: 12,
	},
	statsCard: {
		backgroundColor: '#FFFFFF',
		padding: 16,
		borderRadius: 16,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	statsCardTouchable: {
		flex: 1,
	},
	statsCardContainer: {
		flex: 1,
	},
	statsIcon: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 8,
	},
	statsValue: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#1F2937',
		marginBottom: 4,
	},
	statsLabel: {
		fontSize: 12,
		color: '#6B7280',
		textAlign: 'center',
	},
	subscriptionContainer: {
		flexDirection: 'row',
		paddingHorizontal: 20,
		marginBottom: 20,
		gap: 12,
	},
	subscriptionButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#195FE1',
		paddingVertical: 14,
		paddingHorizontal: 12,
		borderRadius: 16,
		shadowColor: '#195FE1',
		shadowOffset: {
			width: 0,
			height: 4,
		},
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 6,
		gap: 8,
	},
	referralButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#10B981',
		paddingVertical: 14,
		paddingHorizontal: 12,
		borderRadius: 16,
		shadowColor: '#10B981',
		shadowOffset: {
			width: 0,
			height: 4,
		},
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 6,
		gap: 8,
	},
	subscriptionButtonText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
	},
	section: {
		paddingHorizontal: 20,
		marginBottom: 24,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#1F2937',
		marginBottom: 16,
	},
	infoCard: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#FFFFFF',
		padding: 16,
		marginBottom: 12,
		borderRadius: 12,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 2,
	},
	iconContainer: {
		width: 48,
		height: 48,
		borderRadius: 24,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 16,
	},
	infoContent: {
		flex: 1,
	},
	infoTitle: {
		fontSize: 14,
		color: '#6B7280',
		marginBottom: 2,
	},
	infoValue: {
		fontSize: 16,
		fontWeight: '500',
		color: '#1F2937',
	},
	bottomPadding: {
		height: 20,
	},
})
