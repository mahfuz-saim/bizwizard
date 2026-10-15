import apiClient from './apiClient'

export async function signUp(data) {
	try {
		const res = await apiClient.post('/user/create-user', data, {
			headers: {
				'Content-Type': 'application/json',
			},
		})

		const resJson = res.data
		const cookieHeader =
			res.headers?.['set-cookie'] || res.headers?.['Set-Cookie']
		const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
		let refreshToken = cookie ? cookie.split('=')[1].split(';')[0] : null
		return [refreshToken, resJson]
	} catch (error) {
		console.error('🚨 Error in signUp:', error)
		return {
			success: false,
			message: 'Registration failed due to network error',
		}
	}
}

export async function getOTP(data) {
	try {
		const reqBody = {
			number: data.phoneNumber,
		}
		const controller = new AbortController()
		setTimeout(() => controller.abort(), 10000) // 10-second timeout

		const res = await apiClient.post('/auth/get-otp', reqBody, {
			signal: controller.signal,
			headers: {
				'Content-Type': 'application/json',
			},
		})
		return res.data
	} catch (error) {
		return { success: false, message: 'Failed to get OTP due to network error' }
	}
}

export async function appLogin(data) {
	try {
		const res = await apiClient.post('/auth/app-login', data, {
			headers: {
				'Content-Type': 'application/json',
			},
		})
		const resJson = res.data
		const cookieHeader =
			res.headers?.['set-cookie'] || res.headers?.['Set-Cookie']
		const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
		let refreshToken = cookie ? cookie.split('=')[1].split(';')[0] : null
		return [refreshToken, resJson]
	} catch (error) {
		console.error('🚨 Error in appLogin:', error)
		return [
			null,
			{ success: false, message: 'Login failed due to network error' },
		]
	}
}

export async function verifyReferral(data) {
	try {
		const res = await apiClient.get(
			`/user/verify-referral/${data.referralCode}`
		)
		return res.data
	} catch (error) {
		console.error('🚨 Error in verifyReferral:', error)
		return { success: false, message: 'Failed to verify referral code' }
	}
}
