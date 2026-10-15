import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	FlatList,
	TextInput,
	ToastAndroid,
	StyleSheet,
	ScrollView,
} from 'react-native'

import * as Linking from 'expo-linking'
import BouncyCheckbox from 'react-native-bouncy-checkbox'
import ContentLoader, { Rect } from 'react-content-loader/native'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import {
	paymentInit,
	verifyCoupon,
} from '../../../../../src/controllers/payment'
import useApi from '../../../../../src/hooks/useApi.jsx'
import { shopController } from '../../../../../src/controllers/shop.js'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

// Price calculation helper
function calculatePrices({
	plan,
	type,
	employeeCount,
	toEnglishNumbers,
	couponStatus,
	couponData,
}) {
	let originalPrice = 0
	let discountedPrice = 0
	if (type === 'employee') {
		const empCount = parseInt(toEnglishNumbers(employeeCount), 10) || 1
		originalPrice = empCount * (plan.price || 0)
		discountedPrice = empCount * (plan.discountedPrice || plan.price || 0)
	} else {
		originalPrice = plan.price || 0
		discountedPrice = plan.discountedPrice || plan.price || 0
	}
	if (couponStatus === 'valid' && couponData) {
		if (couponData.discountType === 'PERCENTAGE') {
			discountedPrice = Math.round(
				discountedPrice * (1 - couponData.discount / 100)
			)
		} else if (couponData.discountType === 'AMOUNT') {
			discountedPrice = Math.max(0, discountedPrice - couponData.discount)
		}
	}
	return { originalPrice, discountedPrice }
}

// Optimized Skeleton Loader Component
const SkeletonLoader = memo(() => (
	<View style={styles.container}>
		<ContentLoader
			speed={2}
			width="100%"
			height={400}
			viewBox="0 0 400 400"
			backgroundColor="#f3f3f3"
			foregroundColor="#ecebeb"
		>
			<Rect x="20" y="20" rx="8" ry="8" width="360" height="80" />
			<Rect x="20" y="120" rx="8" ry="8" width="360" height="120" />
			<Rect x="20" y="260" rx="8" ry="8" width="360" height="120" />
		</ContentLoader>
	</View>
))

// Helper to get plan display name key
function getPlanMonthKey(plan) {
	if (plan.months === 1) return 'oneMonth'
	if (plan.months === 3) return 'threeMonths'
	if (plan.months === 6) return 'sixMonths'
	if (plan.months === 12) return 'oneYear'
	if (plan.months === 24) return 'twoYears'
	if (plan.months === 60) return 'fiveYears'
	if (plan.months === 120) return 'twelveYears'
	return null
}

// Subscription Plan Selector Component — used for both new buy AND renewal
const SubscriptionPlanSelector = memo(
	({
		plans,
		selectedPlan,
		onSelectPlan,
		couponStatus,
		couponData,
		agreedToTerms,
		setAgreedToTerms,
		openLink,
		onBuyPlan,
		hasActiveSubscription, // true = renew flow, false = new buy flow
		loc,
		translateAmount,
	}) => {
		// Filter out TRIAL plan
		const displayPlans = useMemo(
			() => plans.filter((p) => p.name !== 'TRIAL'),
			[plans]
		)

		const getDisplayPrice = useCallback(
			(plan) => {
				let price = plan.discountedPrice || plan.price || 0
				if (couponStatus === 'valid' && couponData) {
					if (couponData.discountType === 'PERCENTAGE') {
						price = Math.round(price * (1 - couponData.discount / 100))
					} else if (couponData.discountType === 'AMOUNT') {
						price = Math.max(0, price - couponData.discount)
					}
				}
				return price
			},
			[couponStatus, couponData]
		)

		const checkboxState = agreedToTerms[selectedPlan?.id] || false

		const handleCheckboxToggle = useCallback(() => {
			if (!selectedPlan) return
			setAgreedToTerms((prev) => ({
				...prev,
				[selectedPlan.id]: !prev[selectedPlan.id],
			}))
		}, [selectedPlan, setAgreedToTerms])

		const handleBuyPress = useCallback(() => {
			if (!selectedPlan) return
			// Use RENEW type if user already has an active non-trial subscription,
			// otherwise use SUBSCRIPTION type for new purchase
			const paymentType = hasActiveSubscription ? 'RENEW' : 'subscription'
			onBuyPlan(selectedPlan, paymentType)
		}, [selectedPlan, hasActiveSubscription, onBuyPlan])

		const getDisplayPricePerDay = useCallback(
			(plan) => {
				const price = getDisplayPrice(plan)
				const days = (plan.months || 1) * 30
				return Number((price / days).toFixed(2))
			},
			[getDisplayPrice]
		)

		const termsComponent = useMemo(
			() => (
				<View style={styles.termsContainer}>
					<View style={styles.termsTextContainer}>
						<Text style={styles.termsText}>
							{loc.t('subscriptionBuy.agreeToTermsPrefix') ||
								'I agree to the'}{' '}
						</Text>
						<TouchableOpacity
							onPress={() => openLink('https://develofirm.com/privacy-policy')}
						>
							<Text style={styles.linkText}>
								{loc.t('subscriptionBuy.privacyPolicy') || 'Privacy Policy'}
							</Text>
						</TouchableOpacity>
						<Text style={styles.termsText}>, </Text>
						<TouchableOpacity
							onPress={() =>
								openLink('https://develofirm.com/terms-of-service')
							}
						>
							<Text style={styles.linkText}>
								{loc.t('subscriptionBuy.termsAndConditions') ||
									'Terms & Conditions'}
							</Text>
						</TouchableOpacity>
						<Text style={styles.termsText}>
							{' '}
							{loc.t('subscriptionBuy.and') || 'and'}{' '}
						</Text>
						<TouchableOpacity
							onPress={() => openLink('https://develofirm.com/refund-policy')}
						>
							<Text style={styles.linkText}>
								{loc.t('subscriptionBuy.refundPolicy') || 'Refund Policy'}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			),
			[loc, openLink]
		)

		return (
			<View style={styles.planCard}>
				{/* Section title */}
				<Text style={styles.choosePlanTitle}>
					{hasActiveSubscription
						? loc.t('subscriptionBuy.renewPlan') || 'Renew Your Plan'
						: loc.t('subscriptionBuy.choosePlan') || 'Choose a Plan'}
				</Text>

				{/* Plan Options Row — horizontally scrollable */}
				<View style={styles.planOptionsScrollWrapper}>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.planOptionsRow}
					>
						{displayPlans.map((plan) => {
							const isSelected = selectedPlan?.id === plan.id
							const monthKey = getPlanMonthKey(plan)
							const displayPrice = getDisplayPrice(plan)
							const originalPrice = plan.discountedPrice || plan.price || 0

							return (
								<TouchableOpacity
									key={plan.id}
									style={[
										styles.planOption,
										isSelected && styles.planOptionSelected,
									]}
									onPress={() => onSelectPlan(plan)}
									activeOpacity={0.8}
								>
									{/* Tick icon top right */}
									{isSelected && (
										<View style={styles.planOptionTick}>
											<Ionicons
												name="checkmark-circle"
												size={20}
												color="#177DFF"
											/>
										</View>
									)}
									<Text
										style={[
											styles.planOptionDuration,
											isSelected && styles.planOptionDurationSelected,
										]}
									>
										{monthKey
											? loc.t(`subscriptionBuy.${monthKey}`) ||
												`${plan.months} ${plan.months === 1 ? 'Month' : 'Months'}`
											: `${plan.months} Months`}
									</Text>
									{couponStatus === 'valid' &&
									displayPrice !== originalPrice ? (
										<>
											<Text style={styles.planOptionOriginalPrice}>
												{translateAmount(originalPrice)}
											</Text>
											<Text
												style={[
													styles.planOptionPrice,
													isSelected && styles.planOptionPriceSelected,
												]}
											>
												{translateAmount(displayPrice)}
											</Text>
										</>
									) : (
										<Text
											style={[
												styles.planOptionPrice,
												isSelected && styles.planOptionPriceSelected,
											]}
										>
											{translateAmount(originalPrice)}
										</Text>
									)}
									{/* Per day price */}
									<Text style={styles.planOptionPerDay}>
										{translateAmount(getDisplayPricePerDay(plan))}/
										{loc.t('subscriptionBuy.perDay') || 'day'}
									</Text>
								</TouchableOpacity>
							)
						})}
					</ScrollView>
				</View>

				{/* Plan Description — localized with fallback */}
				{(() => {
					if (!selectedPlan) return null
					const isBn = loc.locale === 'bn'
					const enDesc = selectedPlan.description
					const bnDesc = selectedPlan.features?.descriptionBn
					const text = isBn ? bnDesc || enDesc : enDesc || bnDesc
					if (!text) return null
					return (
						<View style={styles.descriptionSection}>
							<View style={styles.descriptionIconWrap}>
								<Ionicons name="information-circle" size={16} color="#1E40AF" />
							</View>
							<Text style={styles.descriptionText}>{text}</Text>
						</View>
					)
				})()}
				{/* Terms Checkbox */}
				<View style={styles.checkboxSection}>
					<BouncyCheckbox
						size={20}
						fillColor="#177DFF"
						unfillColor="transparent"
						text=""
						iconStyle={styles.checkboxIcon}
						innerIconStyle={styles.checkboxInnerIcon}
						isChecked={checkboxState}
						onPress={handleCheckboxToggle}
						textComponent={termsComponent}
					/>
				</View>

				{/* Buy / Renew Button */}
				<TouchableOpacity
					style={[
						styles.buyButton,
						checkboxState ? styles.buyButtonEnabled : styles.buyButtonDisabled,
					]}
					onPress={handleBuyPress}
					disabled={!checkboxState}
				>
					<Text style={styles.buyButtonText}>
						{hasActiveSubscription
							? loc.t('subscriptionBuy.renew') || 'Renew'
							: loc.t('subscriptionBuy.buyNow') || 'Buy Now'}
					</Text>
				</TouchableOpacity>
			</View>
		)
	}
)

// Memoized Plan Card Component (employee plans only)
const PlanCard = memo(({ plan, type, isCurrentPlan, onBuyPlan, ...props }) => {
	const { loc } = useLocalization()
	const { translateNumber, translateAmount, toEnglishNumbers } =
		useNumberTranslator()

	const {
		employeeCount,
		setEmployeeCount,
		agreedToTermsEmployee,
		setAgreedToTermsEmployee,
		openLink,
		couponStatus,
		couponData,
	} = props

	const { originalPrice, discountedPrice } = useMemo(
		() =>
			calculatePrices({
				plan,
				type,
				employeeCount,
				toEnglishNumbers,
				couponStatus,
				couponData,
			}),
		[plan, type, employeeCount, toEnglishNumbers, couponStatus, couponData]
	)

	const checkboxState = useMemo(
		() => agreedToTermsEmployee[plan.id] || false,
		[plan.id, agreedToTermsEmployee]
	)

	const handleCheckboxToggle = useCallback(() => {
		setAgreedToTermsEmployee((prev) => ({
			...prev,
			[plan.id]: !prev[plan.id],
		}))
	}, [plan.id, setAgreedToTermsEmployee])

	const handleEmployeeIncrease = useCallback(() => {
		const currentCount = parseInt(toEnglishNumbers(employeeCount), 10) || 1
		setEmployeeCount((currentCount + 1).toString())
	}, [employeeCount, toEnglishNumbers, setEmployeeCount])

	const handleEmployeeDecrease = useCallback(() => {
		const currentCount = parseInt(toEnglishNumbers(employeeCount), 10) || 1
		const newCount = Math.max(1, currentCount - 1)
		setEmployeeCount(newCount.toString())
	}, [employeeCount, toEnglishNumbers, setEmployeeCount])

	const handleEmployeeChange = useCallback(
		(value) => {
			const englishValue = toEnglishNumbers(value)
			const numericValue = englishValue.replace(/[^0-9]/g, '')
			if (numericValue === '' || parseInt(numericValue, 10) >= 1) {
				setEmployeeCount(numericValue || '1')
			}
		},
		[toEnglishNumbers, setEmployeeCount]
	)

	const handleBuyPress = useCallback(() => {
		onBuyPlan(plan, type)
	}, [onBuyPlan, plan, type])

	const termsComponent = useMemo(
		() => (
			<View style={styles.termsContainer}>
				<View style={styles.termsTextContainer}>
					<Text style={styles.termsText}>
						{loc.t('subscriptionBuy.agreeToTermsPrefix') ||
							'I agree to the'}{' '}
					</Text>
					<TouchableOpacity
						onPress={() => openLink('https://develofirm.com/privacy-policy')}
					>
						<Text style={styles.linkText}>
							{loc.t('subscriptionBuy.privacyPolicy') || 'Privacy Policy'}
						</Text>
					</TouchableOpacity>
					<Text style={styles.termsText}>, </Text>
					<TouchableOpacity
						onPress={() => openLink('https://develofirm.com/terms-of-service')}
					>
						<Text style={styles.linkText}>
							{loc.t('subscriptionBuy.termsAndConditions') ||
								'Terms & Conditions'}
						</Text>
					</TouchableOpacity>
					<Text style={styles.termsText}>
						{' '}
						{loc.t('subscriptionBuy.and') || 'and'}{' '}
					</Text>
					<TouchableOpacity
						onPress={() => openLink('https://develofirm.com/refund-policy')}
					>
						<Text style={styles.linkText}>
							{loc.t('subscriptionBuy.refundPolicy') || 'Refund Policy'}
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		),
		[loc, openLink]
	)

	return (
		<View style={[styles.planCard, isCurrentPlan && styles.currentPlanCard]}>
			<View style={styles.planHeader}>
				<View style={styles.planHeaderContent}>
					<Text style={styles.employeeSubtitle}>
						{loc.t('subscriptionBuy.addEmployeeToShop') ||
							'Add employee to your shop'}
					</Text>
				</View>
			</View>

			<View style={styles.priceSection}>
				<View style={styles.employeePriceContainer}>
					{couponStatus === 'valid' && (
						<>
							<Text style={styles.originalPriceText}>
								{translateAmount(originalPrice)}
							</Text>
							<Text style={styles.priceText}>
								{translateAmount(discountedPrice)}
							</Text>
						</>
					)}
					{couponStatus !== 'valid' && (
						<Text style={styles.priceText}>
							{translateAmount(discountedPrice)}
						</Text>
					)}
				</View>
			</View>

			{plan.features && (
				<View style={styles.featuresSection}>
					<Text style={styles.featuresText}>{plan.features}</Text>
				</View>
			)}

			<View style={styles.employeeSection}>
				<Text style={styles.employeeLabel}>
					{loc.t('subscriptionBuy.numberOfEmployees') || 'Number of Employees'}
				</Text>
				<View style={styles.employeeControls}>
					<TouchableOpacity
						style={styles.employeeButton}
						onPress={handleEmployeeDecrease}
						activeOpacity={0.7}
					>
						<Text style={styles.employeeButtonText}>-</Text>
					</TouchableOpacity>
					<TextInput
						style={styles.employeeInput}
						value={translateNumber(employeeCount)}
						onChangeText={handleEmployeeChange}
						keyboardType="numeric"
						placeholder={translateNumber('1')}
					/>
					<TouchableOpacity
						style={styles.employeeButton}
						onPress={handleEmployeeIncrease}
						activeOpacity={0.7}
					>
						<Text style={styles.employeeButtonText}>+</Text>
					</TouchableOpacity>
				</View>
			</View>

			{!isCurrentPlan && (
				<View style={styles.checkboxSection}>
					<BouncyCheckbox
						size={20}
						fillColor="#177DFF"
						unfillColor="transparent"
						text=""
						iconStyle={styles.checkboxIcon}
						innerIconStyle={styles.checkboxInnerIcon}
						isChecked={checkboxState}
						onPress={handleCheckboxToggle}
						textComponent={termsComponent}
					/>
				</View>
			)}

			{!isCurrentPlan && (
				<TouchableOpacity
					style={[
						styles.buyButton,
						checkboxState ? styles.buyButtonEnabled : styles.buyButtonDisabled,
					]}
					onPress={handleBuyPress}
					disabled={!checkboxState}
				>
					<Text style={styles.buyButtonText}>
						{loc.t('subscriptionBuy.buyNow') || 'Buy Now'}
					</Text>
				</TouchableOpacity>
			)}
		</View>
	)
})

const SubscriptionBuy = () => {
	const [couponCode, setCouponCode] = useState('')
	const [couponStatus, setCouponStatus] = useState(null)
	const [couponData, setCouponData] = useState(null)
	const [couponLoading, setCouponLoading] = useState(false)

	const [selectedSubscriptionPlan, setSelectedSubscriptionPlan] = useState(null)

	const validateCoupon = useCallback(async (code) => {
		setCouponLoading(true)
		setCouponStatus(null)
		setCouponData(null)
		const couponVeirfy = await verifyCoupon(code)
		if (couponVeirfy?.success && couponVeirfy.data.status === 'ACTIVE') {
			setCouponStatus('valid')
			setCouponData(couponVeirfy.data)
			ToastAndroid.show('Coupon verified Successfully!', ToastAndroid.SHORT)
		} else {
			setCouponStatus('invalid')
			setCouponData(null)
			ToastAndroid.show('Invalid or expired coupon code', ToastAndroid.SHORT)
		}
		setCouponLoading(false)
	}, [])

	const getDiscountedPrice = useCallback(
		(basePrice) => {
			if (couponStatus === 'valid' && couponData) {
				if (couponData.discountType === 'PERCENTAGE') {
					return Math.round(basePrice * (1 - couponData.discount / 100))
				} else if (couponData.discountType === 'AMOUNT') {
					return Math.max(0, basePrice - couponData.discount)
				}
			}
			return basePrice
		},
		[couponStatus, couponData]
	)

	const { fetchData } = useApi()
	const { loc } = useLocalization()
	const { translateNumber, translateAmount, toEnglishNumbers } =
		useNumberTranslator()

	const [employeeCount, setEmployeeCount] = useState('1')
	const [agreedToTermsSubscription, setAgreedToTermsSubscription] = useState({})
	const [agreedToTermsEmployee, setAgreedToTermsEmployee] = useState({})
	const [currentSubscription, setCurrentSubscription] = useState(null)
	const [allPlans, setAllPlans] = useState({
		subscriptionPlan: [],
		employeePlan: [],
	})
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)

	const isTrialSubscription = useMemo(
		() => currentSubscription?.plan?.name === 'TRIAL',
		[currentSubscription]
	)

	// true when user has a real paid active subscription (not trial, not null)
	const hasActiveNonTrialSubscription = useMemo(
		() => !!currentSubscription && !isTrialSubscription,
		[currentSubscription, isTrialSubscription]
	)

	// Set default selected plan (1-month) once plans are loaded — ticked by default to remove friction
	useEffect(() => {
		const nonTrialPlans = allPlans.subscriptionPlan.filter(
			(p) => p.name !== 'TRIAL'
		)
		if (nonTrialPlans.length > 0 && !selectedSubscriptionPlan) {
			const oneMonthPlan =
				nonTrialPlans.find((p) => p.months === 1) || nonTrialPlans[0]
			setSelectedSubscriptionPlan(oneMonthPlan)
			setAgreedToTermsSubscription({ [oneMonthPlan.id]: true })
		}
	}, [allPlans.subscriptionPlan])

	// Always show the subscription selector (for both new buy and renewal).
	// Show employee plans only when there's an active non-trial subscription.
	const flatListData = useMemo(() => {
		const data = []

		// Current subscription card — always shown once data is ready
		if (currentSubscription || !loading) {
			data.push({
				id: 'current-subscription',
				type: 'current-subscription',
				data: currentSubscription,
			})
		}

		// Coupon code section — shown after current subscription
		data.push({
			id: 'coupon-section',
			type: 'coupon-section',
		})

		// Subscription plan selector — always shown (new buy OR renewal)
		const nonTrialPlans = allPlans.subscriptionPlan.filter(
			(p) => p.name !== 'TRIAL'
		)
		if (nonTrialPlans.length > 0) {
			data.push({
				id: 'subscription-selector',
				type: 'subscription-selector',
			})
		}

		// Employee plans — only when there's a real active subscription
		if (hasActiveNonTrialSubscription && allPlans.employeePlan.length > 0) {
			allPlans.employeePlan.forEach((plan, index) => {
				data.push({
					id: `employee-plan-${index}`,
					type: 'plan',
					plan: {
						...plan,
						price: plan.pricePerEmployee,
						discountedPrice: plan.discountedPrice,
					},
					planType: 'employee',
				})
			})
		}

		return data
	}, [currentSubscription, allPlans, loading, hasActiveNonTrialSubscription])

	const openLink = useCallback(
		async (url) => {
			try {
				const supported = await Linking.canOpenURL(url)
				if (supported) {
					await Linking.openURL(url)
				} else {
					ToastAndroid.show(
						loc.t('subscriptionBuy.cannotOpenUrl') || 'Cannot open URL',
						ToastAndroid.SHORT
					)
				}
			} catch (error) {
				ToastAndroid.show(
					loc.t('subscriptionBuy.errorOccurred') || 'An error occurred',
					ToastAndroid.SHORT
				)
			}
		},
		[loc]
	)

	const formatDate = useCallback(
		(dateString) => {
			try {
				const date = new Date(dateString)
				if (isNaN(date.getTime())) return dateString || 'Invalid Date'
				const day = date.getDate().toString().padStart(2, '0')
				const month = (date.getMonth() + 1).toString().padStart(2, '0')
				const year = date.getFullYear().toString()
				return `${translateNumber(day)}/${translateNumber(month)}/${translateNumber(year)}`
			} catch {
				return dateString || 'Invalid Date'
			}
		},
		[translateNumber]
	)

	const handleBuyPlan = useCallback(
		async (plan, type) => {
			let params = {}
			let totalPrice = 0

			if (type === 'RENEW') {
				// Renew uses the selected plan from the selector
				totalPrice = plan.discountedPrice || plan.price || 0
				totalPrice = getDiscountedPrice(totalPrice)
				params = {
					paymentType: 'RENEW_PLAN',
					planId: plan.id,
					total_amount: totalPrice,
				}
			} else if (type === 'employee') {
				if (!currentSubscription) {
					ToastAndroid.show(
						loc.t('subscriptionBuy.needActiveSubscription') ||
							'You need to have an active subscription plan to purchase an employee plan.',
						ToastAndroid.LONG
					)
					return
				}
				const empCount = parseInt(toEnglishNumbers(employeeCount), 10)
				if (isNaN(empCount) || empCount <= 0) {
					ToastAndroid.show(
						loc.t('subscriptionBuy.enterValidEmployeeCount') ||
							'Please enter a valid number of employees.',
						ToastAndroid.SHORT
					)
					return
				}
				totalPrice = empCount * (plan.discountedPrice || plan.price || 0)
				totalPrice = getDiscountedPrice(totalPrice)
				params = {
					paymentType: 'EMPLOYEE',
					planId: plan.id,
					employeeCount: empCount,
					total_amount: totalPrice,
				}
			} else if (type === 'subscription') {
				totalPrice = plan.discountedPrice || plan.price || 0
				totalPrice = getDiscountedPrice(totalPrice)
				params = {
					paymentType: 'SUBSCRIPTION',
					planId: plan.id,
					total_amount: totalPrice,
				}
			}

			if (couponStatus === 'valid' && couponData?.code) {
				params.couponCode = couponData.code
				params.coupon = couponData.code
			}

			try {
				const successUrl = Linking.createURL(
					'/home/subscriptionBuy/PaymentPage',
					{
						queryParams: {
							status: 'success',
							paymentType: params.paymentType,
						},
					}
				)
				const failUrl = Linking.createURL('/home/subscriptionBuy/PaymentPage', {
					queryParams: { status: 'failed', paymentType: params.paymentType },
				})
				const cancelUrl = Linking.createURL(
					'/home/subscriptionBuy/PaymentPage',
					{
						queryParams: {
							status: 'cancelled',
							paymentType: params.paymentType,
						},
					}
				)

				params = {
					...params,
					success_url: successUrl,
					fail_url: failUrl,
					cancel_url: cancelUrl,
				}

				const response = await fetchData(paymentInit, params)

				if (response.success) {
					ToastAndroid.show(
						loc.t('subscriptionBuy.openingPaymentGateway') ||
							'Opening payment gateway...',
						ToastAndroid.SHORT
					)
					Linking.openURL(response.data)
				} else {
					ToastAndroid.show(
						loc.t('subscriptionBuy.paymentInitFailed') ||
							'Failed to initialize payment. Please try again.',
						ToastAndroid.LONG
					)
				}
			} catch (error) {
				console.error('Payment initialization error:', error)
				ToastAndroid.show(
					loc.t('subscriptionBuy.paymentInitFailed') ||
						'Failed to initialize payment. Please try again.',
					ToastAndroid.LONG
				)
			}
		},
		[
			currentSubscription,
			employeeCount,
			toEnglishNumbers,
			fetchData,
			loc,
			couponStatus,
			couponData,
			getDiscountedPrice,
		]
	)

	const alertHandleBuyPlan = useCallback(
		(plan, type) => {
			let isAgreed = false
			if (type === 'RENEW' || type === 'subscription') {
				isAgreed = agreedToTermsSubscription[plan.id] || false
			} else if (type === 'employee') {
				isAgreed = agreedToTermsEmployee[plan.id] || false
			}

			if (!isAgreed) {
				ToastAndroid.show(
					loc.t('subscriptionBuy.agreeToTermsFirst') ||
						'Please agree to terms and conditions before proceeding.',
					ToastAndroid.LONG
				)
				return
			}

			handleBuyPlan(plan, type)
		},
		[agreedToTermsSubscription, agreedToTermsEmployee, loc, handleBuyPlan]
	)

	useEffect(() => {
		fetchAllPlans()
	}, [])

	useFocusEffect(
		useCallback(() => {
			fetchSubscriptionData()
		}, [fetchSubscriptionData])
	)

	const fetchSubscriptionData = useCallback(async () => {
		try {
			const data = await fetchData(shopController.fetchActiveSubscriptions, {})
			if (data.success && data.data) {
				setCurrentSubscription(data.data)
			}
		} catch (error) {
			console.error('Error fetching subscription:', error)
			ToastAndroid.show(
				loc.t('subscriptionBuy.failedLoadSubscription') ||
					'Failed to load subscription data',
				ToastAndroid.LONG
			)
		}
	}, [fetchData, loc])

	const fetchAllPlans = useCallback(async () => {
		try {
			const data = await fetchData(shopController.fetchAllSubscriptions, {})
			if (data.success && data.data) {
				setAllPlans(data.data)
			} else {
				ToastAndroid.show(
					loc.t('subscriptionBuy.failedLoadPlans') ||
						'Failed to load subscription plans',
					ToastAndroid.LONG
				)
			}
			setLoading(false)
		} catch (error) {
			console.error('Error fetching plans:', error)
			ToastAndroid.show(
				loc.t('subscriptionBuy.failedLoadPlans') ||
					'Failed to load subscription plans',
				ToastAndroid.LONG
			)
			setLoading(false)
		}
	}, [fetchData, loc])

	const refreshSubscriptionData = useCallback(async () => {
		setRefreshing(true)
		try {
			await Promise.all([fetchSubscriptionData(), fetchAllPlans()])
		} catch (error) {
			console.error('Error refreshing data:', error)
			ToastAndroid.show(
				loc.t('subscriptionBuy.updateFailed') || 'Failed to update data',
				ToastAndroid.SHORT
			)
		} finally {
			setRefreshing(false)
		}
	}, [fetchSubscriptionData, fetchAllPlans, loc])

	const renderCurrentSubscription = useCallback(
		(subscription) => {
			if (!subscription) {
				return (
					<View style={styles.noSubscriptionCard}>
						<Text style={styles.noSubscriptionTitle}>
							{loc.t('subscriptionBuy.noActiveSubscription') ||
								'You have no active subscription plan'}
						</Text>
						<Text style={styles.noSubscriptionSubtitle}>
							{loc.t('subscriptionBuy.chooseToGetStarted') ||
								'Choose a plan below to get started'}
						</Text>
					</View>
				)
			}

			const isTrialSub = subscription.plan.name === 'TRIAL'

			return (
				<View style={styles.currentSubscriptionCard}>
					{/* Single end date message as requested */}
					<Text style={styles.subscriptionEndMessage}>
						{isTrialSub
							? `${loc.t('subscriptionBuy.trialEndMessage') || 'Your current free trial will end on: '}${formatDate(subscription.endDate)}`
							: `${loc.t('subscriptionBuy.activeSubscriptionEndMessage') || 'Your current subscription will end on: '}${formatDate(subscription.endDate)}`}
					</Text>
				</View>
			)
		},
		[loc, translateAmount, formatDate]
	)

	const renderListItem = useCallback(
		({ item }) => {
			switch (item.type) {
				case 'current-subscription':
					return (
						<View style={styles.sectionContainer}>
							{renderCurrentSubscription(item.data)}
						</View>
					)
				case 'coupon-section':
					return (
						<View style={styles.sectionContainer}>
							<View style={styles.couponContainer}>
								<Text style={styles.couponLabel}>
									{loc.t('subscriptionBuy.couponLabel') || 'Coupon Code'}
								</Text>
								<View style={styles.couponRow}>
									<TextInput
										style={styles.couponInput}
										value={couponCode}
										onChangeText={setCouponCode}
										placeholder={
											loc.t('subscriptionBuy.couponPlaceholder') ||
											'Enter coupon'
										}
										autoCapitalize="characters"
									/>
									<TouchableOpacity
										style={styles.couponApplyBtn}
										onPress={() => validateCoupon(couponCode)}
										disabled={couponLoading || !couponCode.trim()}
									>
										<Text style={styles.couponApplyText}>
											{couponLoading
												? loc.t('subscriptionBuy.applying') || 'Applying...'
												: loc.t('subscriptionBuy.apply') || 'Apply'}
										</Text>
									</TouchableOpacity>
								</View>
								{couponStatus === 'invalid' && (
									<Text style={styles.couponError}>
										{loc.t('subscriptionBuy.invalidCoupon') ||
											'Invalid or expired coupon'}
									</Text>
								)}
							</View>
						</View>
					)
				case 'subscription-selector':
					return (
						<View style={styles.selectorSectionContainer}>
							<SubscriptionPlanSelector
								plans={allPlans.subscriptionPlan}
								selectedPlan={selectedSubscriptionPlan}
								onSelectPlan={(plan) => {
									setSelectedSubscriptionPlan(plan)
									// Tick by default to remove friction
									setAgreedToTermsSubscription({ [plan.id]: true })
								}}
								couponStatus={couponStatus}
								couponData={couponData}
								agreedToTerms={agreedToTermsSubscription}
								setAgreedToTerms={setAgreedToTermsSubscription}
								openLink={openLink}
								onBuyPlan={alertHandleBuyPlan}
								hasActiveSubscription={hasActiveNonTrialSubscription}
								loc={loc}
								translateAmount={translateAmount}
							/>
						</View>
					)
				case 'plan':
					return (
						<PlanCard
							plan={item.plan}
							type={item.planType}
							isCurrentPlan={currentSubscription?.plan?.id === item.plan.id}
							onBuyPlan={alertHandleBuyPlan}
							employeeCount={employeeCount}
							setEmployeeCount={setEmployeeCount}
							agreedToTermsEmployee={agreedToTermsEmployee}
							setAgreedToTermsEmployee={setAgreedToTermsEmployee}
							openLink={openLink}
							couponStatus={couponStatus}
							couponData={couponData}
						/>
					)
				default:
					return null
			}
		},
		[
			renderCurrentSubscription,
			allPlans.subscriptionPlan,
			selectedSubscriptionPlan,
			couponStatus,
			couponData,
			couponCode,
			couponLoading,
			validateCoupon,
			loc,
			agreedToTermsSubscription,
			openLink,
			alertHandleBuyPlan,
			hasActiveNonTrialSubscription,
			translateAmount,
			translateNumber,
			toEnglishNumbers,
			currentSubscription,
			employeeCount,
			agreedToTermsEmployee,
		]
	)

	const keyExtractor = useCallback((item) => item.id, [])

	if (loading) {
		return (
			<View style={styles.loadingContainer}>
				<SkeletonLoader />
				<Text style={styles.loadingText}>
					{loc.t('subscriptionBuy.loadingSubscriptions') ||
						'Loading subscriptions...'}
				</Text>
			</View>
		)
	}

	return (
		<FlatList
			style={styles.container}
			data={flatListData}
			renderItem={renderListItem}
			keyExtractor={keyExtractor}
			showsVerticalScrollIndicator={false}
			contentContainerStyle={styles.contentContainer}
			removeClippedSubviews={true}
			maxToRenderPerBatch={5}
			updateCellsBatchingPeriod={50}
			initialNumToRender={3}
			windowSize={10}
			refreshing={refreshing}
			onRefresh={refreshSubscriptionData}
		/>
	)
}

const styles = StyleSheet.create({
	couponContainer: {
		backgroundColor: 'white',
		borderRadius: 8,
		padding: 16,
		borderWidth: 1,
		borderColor: '#E5E7EB',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
	},
	couponLabel: {
		fontSize: 14,
		fontWeight: '500',
		color: '#374151',
		marginBottom: 8,
	},
	couponRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	couponInput: {
		flex: 1,
		height: 40,
		borderWidth: 1,
		borderColor: '#D1D5DB',
		borderRadius: 8,
		paddingHorizontal: 12,
		backgroundColor: '#F9FAFB',
		fontSize: 16,
	},
	couponApplyBtn: {
		marginLeft: 8,
		backgroundColor: '#177DFF',
		borderRadius: 8,
		paddingVertical: 8,
		paddingHorizontal: 16,
	},
	couponApplyText: {
		color: 'white',
		fontWeight: '600',
		fontSize: 16,
	},
	couponSuccess: {
		color: '#166534',
		marginTop: 8,
		fontSize: 14,
	},
	couponError: {
		color: '#991B1B',
		marginTop: 8,
		fontSize: 14,
	},
	container: {
		flex: 1,
		backgroundColor: '#F9FAFB',
	},
	contentContainer: {
		padding: 16,
	},
	loadingContainer: {
		flex: 1,
		backgroundColor: '#F9FAFB',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 16,
	},
	loadingText: {
		color: '#6B7280',
		marginTop: 8,
		textAlign: 'center',
	},
	sectionContainer: {
		marginBottom: 16,
	},
	selectorSectionContainer: {
		marginBottom: 4,
	},
	noSubscriptionCard: {
		backgroundColor: 'white',
		borderRadius: 8,
		padding: 24,
		borderWidth: 1,
		borderColor: '#E5E7EB',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
	},
	noSubscriptionTitle: {
		textAlign: 'center',
		color: '#6B7280',
		fontSize: 18,
		marginBottom: 8,
	},
	noSubscriptionSubtitle: {
		textAlign: 'center',
		color: '#9CA3AF',
		marginTop: 8,
	},
	currentSubscriptionCard: {
		backgroundColor: 'white',
		borderRadius: 8,
		padding: 16,
		borderWidth: 1,
		borderColor: '#177DFF',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
	},
	subscriptionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 12,
	},
	subscriptionHeaderLeft: {
		flex: 1,
		flexDirection: 'row',
		gap: 16,
		alignItems: 'center',
	},
	subscriptionTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#111827',
	},
	statusBadgeContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 4,
	},
	statusBadge: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 9999,
	},
	activeBadge: {
		backgroundColor: '#DCFCE7',
	},
	inactiveBadge: {
		backgroundColor: '#FEE2E2',
	},
	statusText: {
		fontSize: 12,
		fontWeight: '500',
	},
	activeText: {
		color: '#166534',
	},
	inactiveText: {
		color: '#991B1B',
	},
	subscriptionPrice: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#177DFF',
	},
	subscriptionDetails: {
		borderTopWidth: 1,
		borderTopColor: '#E5E7EB',
		paddingTop: 12,
	},
	dateRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 8,
	},
	dateLabel: {
		color: '#6B7280',
	},
	dateValue: {
		color: '#111827',
		fontWeight: '500',
	},
	trialCouponBanner: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		backgroundColor: '#FEF3C7',
		borderRadius: 8,
		padding: 12,
		marginTop: 12,
		borderWidth: 1,
		borderColor: '#FDE68A',
	},
	trialCouponText: {
		flex: 1,
		color: '#92400E',
		fontSize: 13,
		lineHeight: 20,
		fontWeight: '500',
	},
	termsContainer: {
		flex: 1,
		marginLeft: 8,
	},
	termsTextContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	termsText: {
		fontSize: 12,
		color: '#6B7280',
		lineHeight: 20,
	},
	linkText: {
		color: '#3B82F6',
		textDecorationLine: 'underline',
		fontSize: 12,
	},
	checkboxIcon: {
		borderRadius: 4,
	},
	checkboxInnerIcon: {
		borderWidth: 2,
		borderRadius: 4,
	},
	// Plan Selector Styles
	choosePlanTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#111827',
		marginBottom: 12,
	},
	planOptionsScrollWrapper: {
		position: 'relative',
		marginBottom: 16,
		paddingTop: 12,
	},
	planOptionsRow: {
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: 4,
	},
	planOption: {
		width: 110,
		position: 'relative',
		backgroundColor: '#F9FAFB',
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: '#E5E7EB',
		paddingVertical: 14,
		paddingHorizontal: 6,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 90,
	},
	planOptionSelected: {
		borderColor: '#177DFF',
		backgroundColor: '#EFF6FF',
	},
	planOptionTick: {
		position: 'absolute',
		top: -8,
		right: -8,
		backgroundColor: 'white',
		borderRadius: 10,
	},
	planOptionDuration: {
		fontSize: 13,
		fontWeight: '600',
		color: '#6B7280',
		textAlign: 'center',
		marginBottom: 6,
	},
	planOptionDurationSelected: {
		color: '#177DFF',
	},
	planOptionPrice: {
		fontSize: 14,
		fontWeight: '700',
		color: '#111827',
		textAlign: 'center',
	},
	planOptionPriceSelected: {
		color: '#177DFF',
	},
	planOptionOriginalPrice: {
		fontSize: 11,
		color: '#9CA3AF',
		textDecorationLine: 'line-through',
		textAlign: 'center',
		marginBottom: 2,
	},
	planDateSection: {
		borderTopWidth: 1,
		borderTopColor: '#E5E7EB',
		paddingTop: 12,
		marginBottom: 12,
	},
	descriptionSection: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		backgroundColor: '#EFF6FF',
		borderWidth: 1,
		borderColor: '#DBEAFE',
		borderLeftWidth: 3,
		borderLeftColor: '#177DFF',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 12,
		marginBottom: 16,
		gap: 8,
	},
	descriptionIconWrap: {
		marginTop: 1,
	},
	descriptionText: {
		flex: 1,
		fontSize: 13,
		lineHeight: 18,
		color: '#1E3A8A',
	},
	// Plan Card Styles (employee)
	planCard: {
		backgroundColor: 'white',
		borderRadius: 8,
		padding: 16,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: '#E5E7EB',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
	},
	currentPlanCard: {
		borderColor: '#177DFF',
	},
	planHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 12,
	},
	planHeaderContent: {
		flex: 1,
	},
	employeeSubtitle: {
		fontSize: 14,
		color: '#6B7280',
		textAlign: 'center',
	},
	priceSection: {
		marginBottom: 16,
	},
	employeePriceContainer: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	priceText: {
		textAlign: 'center',
		fontSize: 20,
		fontWeight: 'bold',
		color: '#111827',
	},
	originalPriceText: {
		fontSize: 18,
		textAlign: 'center',
		color: '#9CA3AF',
		textDecorationLine: 'line-through',
		marginLeft: 8,
	},
	featuresSection: {
		marginBottom: 16,
	},
	featuresText: {
		color: '#374151',
	},
	employeeSection: {
		marginBottom: 16,
	},
	employeeLabel: {
		textAlign: 'center',
		fontSize: 14,
		fontWeight: '500',
		color: '#374151',
		marginBottom: 8,
	},
	employeeControls: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	employeeButton: {
		width: 40,
		height: 40,
		backgroundColor: '#177DFF',
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	employeeButtonText: {
		color: 'white',
		fontSize: 18,
		fontWeight: 'bold',
	},
	employeeInput: {
		marginHorizontal: 16,
		width: 96,
		height: 48,
		textAlign: 'center',
		borderWidth: 1,
		borderColor: '#D1D5DB',
		borderRadius: 8,
		backgroundColor: '#F9FAFB',
		fontSize: 18,
		fontWeight: '500',
	},
	checkboxSection: {
		marginBottom: 16,
	},
	buyButton: {
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
	},
	buyButtonEnabled: {
		backgroundColor: '#177DFF',
	},
	buyButtonDisabled: {
		backgroundColor: '#9CA3AF',
	},
	buyButtonText: {
		color: 'white',
		textAlign: 'center',
		fontWeight: '600',
	},
	planOptionPerDay: {
		fontSize: 11,
		color: '#9CA3AF',
		textAlign: 'center',
		marginTop: 3,
	},
	subscriptionEndMessage: {
		fontSize: 15,
		fontWeight: '500',
		color: '#374151',
		textAlign: 'center',
		marginVertical: 8,
	},
})

export default SubscriptionBuy
