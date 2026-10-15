import React, { useEffect, useState, useCallback, useMemo, memo } from 'react'
import {
	Text,
	View,
	ScrollView,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	Share,
	ToastAndroid,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import ContentLoader, { Rect } from 'react-content-loader/native'
import { useFocusEffect } from 'expo-router'
import { useLocalization } from '../../../../src/localization/localizationContext'
import {
	getReferralRewards,
	availReferralReward,
} from '../../../../src/controllers/referral'
import { getProfileInfo } from '../../../../src/controllers/profile'
import useApi from '../../../../src/hooks/useApi'
import useNumberTranslator from '../../../../src/hooks/useNumberTranslator'

// Memoized Referral Code Card Component
const ReferralCodeCard = memo(({ referralCode, loc }) => {
	const [copied, setCopied] = useState(false)

	const handleCopy = useCallback(() => {
		if (referralCode) {
			Clipboard.setString(referralCode)
			setCopied(true)
			ToastAndroid.show(loc.t('referral.codeCopied'), ToastAndroid.SHORT)
			setTimeout(() => setCopied(false), 2000)
		}
	}, [referralCode, loc])

	const handleShare = useCallback(async () => {
		if (referralCode) {
			try {
				const message = `Running a business? Try Bebsapati!\nJoin with my referral code ${referralCode} and claim 100 credits or 7 days of subscription now.\nDownload the app: https://play.google.com/store/apps/details?id=com.bebsapati.com`
				await Share.share({ message })
			} catch (error) {
				console.error('Error sharing:', error)
			}
		}
	}, [referralCode])

	if (!referralCode) return null

	return (
		<View style={styles.referralCodeCard}>
			<View style={styles.referralCodeHeader}>
				<MaterialIcons name="loyalty" size={20} color="#195FE1" />
				<Text style={styles.referralCodeTitle}>
					{loc.t('referral.yourReferralCode')}
				</Text>
			</View>
			<View style={styles.referralCodeRow}>
				<View style={styles.referralCodeBox}>
					<Text style={styles.referralCodeText}>{referralCode}</Text>
				</View>
				<TouchableOpacity
					style={styles.iconButton}
					onPress={handleCopy}
					activeOpacity={0.7}
				>
					<MaterialIcons
						name={copied ? 'check' : 'content-copy'}
						size={18}
						color={copied ? '#10B981' : '#195FE1'}
					/>
					<Text
						style={[
							styles.iconButtonText,
							copied && styles.iconButtonTextSuccess,
						]}
					>
						{copied ? loc.t('referral.copied') : loc.t('referral.copy')}
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={styles.iconButton}
					onPress={handleShare}
					activeOpacity={0.7}
				>
					<MaterialIcons name="share" size={18} color="#195FE1" />
					<Text style={styles.iconButtonText}>{loc.t('referral.share')}</Text>
				</TouchableOpacity>
			</View>
		</View>
	)
})

// Memoized Reward Card Component
const RewardCard = memo(
	({
		reward,
		userType,
		onClaim,
		loc,
		translateNumber,
		selectedRewardType,
		onRewardTypeSelect,
	}) => {
		const [claiming, setClaiming] = useState(false)

		const handleClaim = async () => {
			setClaiming(true)
			await onClaim(reward.rewardId, userType)
			setClaiming(false)
		}

		const formattedDate = useMemo(() => {
			try {
				const date = new Date(reward.createdAt)
				return date.toLocaleDateString('en-GB', {
					day: '2-digit',
					month: 'short',
					year: 'numeric',
				})
			} catch {
				return reward.createdAt
			}
		}, [reward.createdAt])

		return (
			<View style={styles.rewardCard}>
				{/* Header: icon + date */}
				<View style={styles.rewardHeader}>
					<View style={styles.rewardIconContainer}>
						<MaterialIcons name="card-giftcard" size={22} color="#195FE1" />
					</View>
					<Text style={styles.rewardDate}>
						{loc.t('referral.createdOn')}: {formattedDate}
					</Text>
				</View>

				{/* Choose reward type label */}
				<Text style={styles.rewardTypeTitle}>
					{loc.t('referral.selectRewardType')}
				</Text>

				{/* Reward type selector cards */}
				<View style={styles.rewardTypeButtons}>
					{/* Credits card */}
					<TouchableOpacity
						style={[
							styles.rewardTypeCard,
							selectedRewardType === 'CREDITS' && styles.rewardTypeCardActive,
						]}
						onPress={() => onRewardTypeSelect('CREDITS')}
						activeOpacity={0.75}
					>
						<View
							style={[
								styles.rewardTypeIconWrap,
								selectedRewardType === 'CREDITS' &&
									styles.rewardTypeIconWrapActive,
							]}
						>
							<MaterialIcons
								name="account-balance-wallet"
								size={22}
								color={selectedRewardType === 'CREDITS' ? '#FFFFFF' : '#10B981'}
							/>
						</View>
						<Text
							style={[
								styles.rewardTypeCardValue,
								selectedRewardType === 'CREDITS' &&
									styles.rewardTypeCardValueActive,
							]}
						>
							{translateNumber(reward.credits)}
						</Text>
						<Text
							style={[
								styles.rewardTypeCardLabel,
								selectedRewardType === 'CREDITS' &&
									styles.rewardTypeCardLabelActive,
							]}
						>
							{loc.t('referral.credits')}
						</Text>
						{selectedRewardType === 'CREDITS' && (
							<View style={styles.selectedBadge}>
								<MaterialIcons name="check-circle" size={14} color="#195FE1" />
							</View>
						)}
					</TouchableOpacity>

					{/* Subscription days card */}
					<TouchableOpacity
						style={[
							styles.rewardTypeCard,
							selectedRewardType === 'SUBSCRIPTION_EXTENSION' &&
								styles.rewardTypeCardActive,
						]}
						onPress={() => onRewardTypeSelect('SUBSCRIPTION_EXTENSION')}
						activeOpacity={0.75}
					>
						<View
							style={[
								styles.rewardTypeIconWrap,
								selectedRewardType === 'SUBSCRIPTION_EXTENSION' &&
									styles.rewardTypeIconWrapActiveSub,
							]}
						>
							<MaterialIcons
								name="event"
								size={22}
								color={
									selectedRewardType === 'SUBSCRIPTION_EXTENSION'
										? '#FFFFFF'
										: '#F59E0B'
								}
							/>
						</View>
						<Text
							style={[
								styles.rewardTypeCardValue,
								selectedRewardType === 'SUBSCRIPTION_EXTENSION' &&
									styles.rewardTypeCardValueActive,
							]}
						>
							{translateNumber(reward.subDays)}{' '}
						</Text>
						<Text
							style={[
								styles.rewardTypeCardLabel,
								selectedRewardType === 'SUBSCRIPTION_EXTENSION' &&
									styles.rewardTypeCardLabelActive,
							]}
						>
							{loc.t('referral.subscriptionDays')}
						</Text>
						{selectedRewardType === 'SUBSCRIPTION_EXTENSION' && (
							<View style={styles.selectedBadge}>
								<MaterialIcons name="check-circle" size={14} color="#195FE1" />
							</View>
						)}
					</TouchableOpacity>
				</View>

				{/* Claim Button */}
				<TouchableOpacity
					style={[
						styles.claimButton,
						(!selectedRewardType || claiming) && styles.claimButtonDisabled,
					]}
					onPress={handleClaim}
					disabled={!selectedRewardType || claiming}
					activeOpacity={0.8}
				>
					{claiming ? (
						<ActivityIndicator size="small" color="#FFFFFF" />
					) : (
						<>
							<MaterialIcons name="redeem" size={18} color="#FFFFFF" />
							<Text style={styles.claimButtonText}>
								{loc.t('referral.availReward')}
							</Text>
						</>
					)}
				</TouchableOpacity>
			</View>
		)
	}
)

// Skeleton Loader for Referral Code
const ReferralCodeSkeleton = memo(() => (
	<View style={styles.referralCodeCard}>
		<ContentLoader
			speed={2}
			width={350}
			height={80}
			viewBox="0 0 350 80"
			backgroundColor="#f3f4f6"
			foregroundColor="#e5e7eb"
		>
			<Rect x="0" y="0" rx="8" ry="8" width="350" height="80" />
		</ContentLoader>
	</View>
))

// Skeleton Loader
const RewardsSkeleton = memo(() => (
	<View style={styles.skeletonContainer}>
		{[1, 2].map((item) => (
			<View key={item} style={styles.rewardCard}>
				<ContentLoader
					speed={2}
					width={350}
					height={180}
					viewBox="0 0 350 180"
					backgroundColor="#f3f4f6"
					foregroundColor="#e5e7eb"
				>
					<Rect x="0" y="0" rx="8" ry="8" width="350" height="180" />
				</ContentLoader>
			</View>
		))}
	</View>
))

// Empty State Component
const EmptyState = memo(({ icon, message }) => (
	<View style={styles.emptyState}>
		<MaterialIcons name={icon} size={56} color="#D1D5DB" />
		<Text style={styles.emptyStateText}>{message}</Text>
	</View>
))

// Main Component
export default function ReferralRewardsScreen() {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const { translateNumber } = useNumberTranslator()
	const [rewards, setRewards] = useState({ asReferred: null, asReferrer: [] })
	const [referralCode, setReferralCode] = useState(null)
	const [loading, setLoading] = useState(true)
	const [selectedRewardTypes, setSelectedRewardTypes] = useState({})

	const loadRewards = useCallback(
		async (showLoader = true) => {
			try {
				if (showLoader) setLoading(true)
				const result = await fetchData(getReferralRewards, {})
				const profileResult = await fetchData(getProfileInfo, {})

				if (result?.success && result?.data) {
					setRewards({
						asReferred: result.data.asReferred || null,
						asReferrer: result.data.asReferrer || [],
					})
				}

				if (profileResult?.success && profileResult?.data) {
					const userRole = profileResult.data.role?.[0]
					let code = null
					if (userRole === 'OWNER' && profileResult.data.Owner)
						code = profileResult.data.Owner.ReferralCode?.code
					else if (userRole === 'BUYER' && profileResult.data.Buyer)
						code = profileResult.data.Buyer.ReferralCode?.code
					else if (userRole === 'SUPPLIER' && profileResult.data.Supplier)
						code = profileResult.data.Supplier.ReferralCode?.code
					else if (userRole === 'EMPLOYEE' && profileResult.data.Employee)
						code = profileResult.data.Employee.ReferralCode?.code
					else if (
						userRole === 'SALES_REPRESENTATIVE' &&
						profileResult.data.SalesRepresentative
					)
						code = profileResult.data.SalesRepresentative.ReferralCode?.code
					setReferralCode(code)
				}
			} catch (error) {
				console.error('Failed to fetch referral rewards:', error)
				ToastAndroid.show(loc.t('referral.claimFailed'), ToastAndroid.LONG)
			} finally {
				setLoading(false)
			}
		},
		[fetchData, loc]
	)

	useEffect(() => {
		loadRewards(true)
	}, [])

	useFocusEffect(
		useCallback(() => {
			loadRewards(false)
		}, [loadRewards])
	)

	const handleClaimReward = useCallback(
		async (rewardId, userType) => {
			const rewardType = selectedRewardTypes[rewardId]
			if (!rewardType) {
				ToastAndroid.show(
					loc.t('referral.selectRewardType'),
					ToastAndroid.SHORT
				)
				return
			}
			try {
				const result = await fetchData(availReferralReward, {
					rewardId,
					rewardType,
					userType,
				})
				if (result?.success) {
					ToastAndroid.show(loc.t('referral.rewardClaimed'), ToastAndroid.LONG)
					await loadRewards(false)
					setSelectedRewardTypes((prev) => {
						const newState = { ...prev }
						delete newState[rewardId]
						return newState
					})
				} else {
					ToastAndroid.show(loc.t('referral.claimFailed'), ToastAndroid.SHORT)
				}
			} catch (error) {
				console.error('Failed to claim reward:', error)
				ToastAndroid.show(loc.t('referral.claimFailed'), ToastAndroid.SHORT)
			}
		},
		[fetchData, loc, selectedRewardTypes, loadRewards]
	)

	const handleRewardTypeSelect = useCallback((rewardId, rewardType) => {
		setSelectedRewardTypes((prev) => ({ ...prev, [rewardId]: rewardType }))
	}, [])

	if (loading) {
		return (
			<ScrollView style={styles.container}>
				<View style={styles.section}>
					<ReferralCodeSkeleton />
				</View>
				<RewardsSkeleton />
			</ScrollView>
		)
	}

	const hasRewards =
		rewards.asReferred !== null || rewards.asReferrer.length > 0

	return (
		<ScrollView
			style={styles.container}
			showsVerticalScrollIndicator={false}
			contentContainerStyle={[
				styles.scrollContent,
				!hasRewards && styles.centerContent,
			]}
		>
			{/* Referral Code */}
			<View style={styles.section}>
				<ReferralCodeCard referralCode={referralCode} loc={loc} />
			</View>

			{/* Reward Info Banner */}
			<View style={styles.rewardInfoBanner}>
				<View style={styles.rewardInfoIconWrap}>
					<MaterialIcons name="workspace-premium" size={28} color="#195FE1" />
				</View>
				<Text style={styles.rewardInfoBannerText}>
					{loc.t('referral.rewardInfoBanner')}
				</Text>
			</View>

			{/* Pending rewards info */}
			{hasRewards && (
				<View style={styles.infoBanner}>
					<MaterialIcons name="info-outline" size={18} color="#195FE1" />
					<Text style={styles.infoBannerText}>
						{loc.t('referral.rewardInfo')}
					</Text>
				</View>
			)}

			{!hasRewards ? (
				<EmptyState
					icon="card-giftcard"
					message={loc.t('referral.noRewards')}
				/>
			) : (
				<>
					{rewards.asReferred && (
						<View style={styles.section}>
							<View style={styles.sectionHeader}>
								<MaterialIcons name="person-add" size={20} color="#195FE1" />
								<Text style={styles.sectionTitle}>
									{loc.t('referral.asReferred')}
								</Text>
							</View>
							<RewardCard
								reward={rewards.asReferred}
								userType="referred"
								onClaim={handleClaimReward}
								loc={loc}
								translateNumber={translateNumber}
								selectedRewardType={
									selectedRewardTypes[rewards.asReferred.rewardId]
								}
								onRewardTypeSelect={(type) =>
									handleRewardTypeSelect(rewards.asReferred.rewardId, type)
								}
							/>
						</View>
					)}

					{rewards.asReferrer.length > 0 && (
						<View style={styles.section}>
							<View style={styles.sectionHeader}>
								<MaterialIcons name="groups" size={20} color="#195FE1" />
								<Text style={styles.sectionTitle}>
									{loc.t('referral.asReferrer')}
								</Text>
							</View>
							{rewards.asReferrer.map((reward) => (
								<RewardCard
									key={reward.rewardId}
									reward={reward}
									userType="referrer"
									onClaim={handleClaimReward}
									loc={loc}
									translateNumber={translateNumber}
									selectedRewardType={selectedRewardTypes[reward.rewardId]}
									onRewardTypeSelect={(type) =>
										handleRewardTypeSelect(reward.rewardId, type)
									}
								/>
							))}
						</View>
					)}
				</>
			)}

			<View style={styles.bottomPadding} />
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F8FAFC',
	},
	scrollContent: {
		paddingBottom: 8,
	},
	centerContent: {
		flexGrow: 1,
		justifyContent: 'center',
	},

	// ── Referral Code Card ──────────────────────────────────────────────
	referralCodeCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 14,
		padding: 14,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 4,
		elevation: 3,
	},
	referralCodeHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		marginBottom: 10,
	},
	referralCodeTitle: {
		fontSize: 14,
		fontWeight: '600',
		color: '#1F2937',
	},
	referralCodeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	referralCodeBox: {
		flex: 1,
		backgroundColor: '#EFF6FF',
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: '#195FE1',
		borderStyle: 'dashed',
		paddingVertical: 10,
		paddingHorizontal: 12,
		alignItems: 'center',
	},
	referralCodeText: {
		fontSize: 20,
		fontWeight: '700',
		color: '#195FE1',
		letterSpacing: 2,
	},
	iconButton: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#EFF6FF',
		borderRadius: 10,
		paddingVertical: 10,
		paddingHorizontal: 10,
		gap: 4,
	},
	iconButtonText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#195FE1',
	},
	iconButtonTextSuccess: {
		color: '#10B981',
	},

	// ── Reward Info Banner ──────────────────────────────────────────────
	rewardInfoBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#FEF9C3',
		borderLeftWidth: 3,
		borderLeftColor: '#195FE1',
		paddingVertical: 10,
		paddingHorizontal: 12,
		marginHorizontal: 16,
		marginTop: 10,
		marginBottom: 4,
		borderRadius: 10,
		gap: 10,
	},
	rewardInfoIconWrap: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: '#EFF6FF',
		alignItems: 'center',
		justifyContent: 'center',
	},
	rewardInfoBannerText: {
		flex: 1,
		fontSize: 13,
		color: '#1E40AF',
		lineHeight: 19,
	},

	// ── Info Banner ─────────────────────────────────────────────────────
	infoBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#EFF6FF',
		borderLeftWidth: 3,
		borderLeftColor: '#195FE1',
		paddingVertical: 8,
		paddingHorizontal: 12,
		marginHorizontal: 16,
		marginTop: 8,
		marginBottom: 2,
		borderRadius: 8,
		gap: 8,
	},
	infoBannerText: {
		flex: 1,
		fontSize: 12,
		color: '#1E40AF',
		lineHeight: 18,
	},

	// ── Section ─────────────────────────────────────────────────────────
	section: {
		paddingHorizontal: 16,
		marginTop: 14,
		marginBottom: 0,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 10,
		gap: 6,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#1F2937',
	},

	// ── Reward Card ─────────────────────────────────────────────────────
	rewardCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 14,
		padding: 14,
		marginBottom: 12,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 4,
		elevation: 3,
	},
	rewardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 12,
		gap: 10,
	},
	rewardIconContainer: {
		width: 42,
		height: 42,
		borderRadius: 21,
		backgroundColor: '#EFF6FF',
		alignItems: 'center',
		justifyContent: 'center',
	},
	rewardDate: {
		fontSize: 13,
		color: '#6B7280',
	},

	// ── Reward Type Selector ────────────────────────────────────────────
	rewardTypeTitle: {
		fontSize: 13,
		fontWeight: '600',
		color: '#374151',
		marginBottom: 8,
	},
	rewardTypeButtons: {
		flexDirection: 'row',
		gap: 10,
		marginBottom: 12,
	},
	rewardTypeCard: {
		flex: 1,
		alignItems: 'center',
		backgroundColor: '#F9FAFB',
		borderWidth: 1.5,
		borderColor: '#E5E7EB',
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 8,
		gap: 4,
		position: 'relative',
	},
	rewardTypeCardActive: {
		backgroundColor: '#EFF6FF',
		borderColor: '#195FE1',
	},
	rewardTypeIconWrap: {
		width: 38,
		height: 38,
		borderRadius: 19,
		backgroundColor: '#F0FDF4',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 2,
	},
	rewardTypeIconWrapActive: {
		backgroundColor: '#10B981',
	},
	rewardTypeIconWrapActiveSub: {
		backgroundColor: '#F59E0B',
	},
	rewardTypeCardValue: {
		fontSize: 16,
		fontWeight: '700',
		color: '#1F2937',
	},
	rewardTypeCardValueActive: {
		color: '#195FE1',
	},
	rewardTypeCardUnit: {
		fontSize: 12,
		fontWeight: '400',
	},
	rewardTypeCardLabel: {
		fontSize: 11,
		color: '#6B7280',
		textAlign: 'center',
	},
	rewardTypeCardLabelActive: {
		color: '#195FE1',
		fontWeight: '600',
	},
	selectedBadge: {
		position: 'absolute',
		top: 6,
		right: 6,
	},

	// ── Claim Button ────────────────────────────────────────────────────
	claimButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#195FE1',
		borderRadius: 10,
		paddingVertical: 12,
		paddingHorizontal: 20,
		gap: 6,
		shadowColor: '#195FE1',
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.25,
		shadowRadius: 6,
		elevation: 5,
	},
	claimButtonDisabled: {
		backgroundColor: '#9CA3AF',
		shadowOpacity: 0,
		elevation: 0,
	},
	claimButtonText: {
		color: '#FFFFFF',
		fontSize: 15,
		fontWeight: '600',
	},

	// ── Empty State ─────────────────────────────────────────────────────
	emptyState: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 40,
	},
	emptyStateText: {
		fontSize: 15,
		color: '#9CA3AF',
		marginTop: 12,
		textAlign: 'center',
	},

	// ── Misc ─────────────────────────────────────────────────────────────
	skeletonContainer: {
		paddingHorizontal: 16,
		paddingTop: 12,
	},
	bottomPadding: {
		height: 16,
	},
})
