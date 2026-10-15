import {
	getAnalytics,
	logEvent,
	setUserId,
	setUserProperties,
} from '@react-native-firebase/analytics'

class AnalyticsService {
	analytics = getAnalytics()
	async phoneInputStarted() {
		await logEvent(this.analytics, 'phone_input_started')
	}

	async otpSent() {
		await logEvent(this.analytics, 'otp_sent')
	}

	async otpVerified() {
		await logEvent(this.analytics, 'otp_verified')
	}

	async login() {
		await logEvent(this.analytics, 'login', {
			method: 'phone_otp',
		})
	}

	async signUp() {
		await logEvent(this.analytics, 'sign_up', {
			method: 'phone_otp',
		})
	}

	async shopCreated() {
		await logEvent(this.analytics, 'shop_created')
	}

	async subscriptionStarted(plan: string) {
		await logEvent(this.analytics, 'subscription_started', {
			plan,
		})
	}

	async setUser(userId: string) {
		await setUserId(this.analytics, userId)
	}

	async setHasShop(hasShop: boolean) {
		await setUserProperties(this.analytics, {
			has_shop: hasShop ? 'true' : 'false',
		})
	}
}

export default new AnalyticsService()
