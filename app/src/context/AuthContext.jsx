import { createContext, useEffect, useMemo, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { useContext } from 'react'
import { router } from 'expo-router'
import {
	signUp,
	getOTP as requestOTP,
	appLogin,
	verifyReferral as verifyReferralCode,
} from '../controllers/authHandler'
import { registerDevice } from '../controllers/notification'
import { BACKEND } from '../constants'
import * as Application from 'expo-application'

const TOKEN_KEY = 'jwt_token'
const AuthContext = createContext()

export const useAuth = () => {
	return useContext(AuthContext)
}

const deccodeRole = (token) => {
	try {
		const base64Url = token.split('.')[1]
		const decodedToken = JSON.parse(atob(base64Url))
		return decodedToken.role
	} catch (error) {
		return null
	}
}

export const AuthProvider = ({ children }) => {
	const [authState, setAuthState] = useState({
		token: null,
		refreshToken: null,
		authenticated: false,
		shopId: null,
		shopName: null,
		phoneNumber: null,
		role: null,
		isSubscriptionValid: false,
		tenantID: null,
	})

	useEffect(() => {
		const loadToken = async () => {
			const storedToken = await SecureStore.getItemAsync(TOKEN_KEY)
			const role = deccodeRole(storedToken || '')
			const storedRefreshToken = await SecureStore.getItemAsync('refreshToken')
			const storedTenantId = await SecureStore.getItemAsync('tenantID')
			if (storedToken && storedRefreshToken) {
				setAuthState({
					token: storedToken,
					refreshToken: storedRefreshToken,
					authenticated: true,
					shopId: null,
					isSubscriptionValid: false,
					shopName: null,
					phoneNumber: null,
					role: role,
					tenantID: storedTenantId,
				})
			}
			await refreshAccessToken()
		}
		loadToken()
	}, [])

	const registerUser = async (data) => {
		const reqBody = {
			user: { ...data.data, number: authState.phoneNumber },
			userType: data.userType,
		}
		if (data.referralCode) {
			reqBody.referralCode = data.referralCode
		}

		const [refreshToken, result] = await signUp(reqBody)

		if (result.success === true) {
			// After successful registration, we can use the token
			const accessToken = result.data.accessToken

			await SecureStore.setItemAsync(TOKEN_KEY, accessToken)
			if (refreshToken) {
				await SecureStore.setItemAsync('refreshToken', refreshToken)
			}

			const role = deccodeRole(accessToken || '')

			setAuthState((prev) => ({
				...prev,
				token: accessToken,
				refreshToken: refreshToken || null,
				authenticated: true,
				role: role,
			}))
		}

		return result
	}

	const getOTP = async (data) => {
		try {
			const result = await requestOTP({ phoneNumber: data.phoneNumber })

			// Store phone number for later use in registration if needed
			if (result.success) {
				setAuthState((prev) => ({
					...prev,
					phoneNumber: data.phoneNumber,
				}))
			}

			return result
		} catch (error) {
			console.error('🚨 Error requesting OTP:', error)
			return { success: false, message: 'Failed to request OTP' }
		}
	}

	const verifyOTP = async (data) => {
		try {
			data.deviceId = Application.getAndroidId()
			const [refreshToken, result] = await appLogin(data)

			if (!result.success) {
				throw new Error(result.message)
			}
			if (result.success === true && result.data.isOtpVerified) {
				const accessToken = result?.data?.accessToken

				let role = null
				if (result.data.accessToken) {
					await SecureStore.setItemAsync(TOKEN_KEY, accessToken)
					await SecureStore.setItemAsync('refreshToken', refreshToken)
					role = deccodeRole(accessToken || '')
				}

				setAuthState({
					token: accessToken,
					refreshToken: refreshToken || null,
					authenticated: result.data.isExists,
					phoneNumber: data.number,
					shopId: null,
					isSubscriptionValid: false,
					shopName: null,
					role: role,
				})
				await SecureStore.setItemAsync('phoneNumber', data.number)
			}
			return result
		} catch (error) {
			console.error('🚨 Error verifying OTP:', error.message)
			return { success: false, message: error.message }
		}
	}

	const verifyReferral = async (referralCode) => {
		try {
			const result = await verifyReferralCode({ referralCode })
			return result
		} catch (error) {
			console.error('🚨 Error verifying referral code:', error)
			return { success: false, message: 'Failed to verify referral code' }
		}
	}

	const logOutUser = async () => {
		await SecureStore.deleteItemAsync(TOKEN_KEY)
		await SecureStore.deleteItemAsync('refreshToken')

		setAuthState({
			token: null,
			authenticated: false,
			refreshToken: null,
			shopId: null,
			isSubscriptionValid: false,
			shopName: null,
			phoneNumber: null,
			role: null,
		})

		router.replace('/login')
	}

	const setUserToken = async (token) => {
		const role = deccodeRole(token || '')
		setAuthState((prev) => ({
			...prev,
			token: token,
			authenticated: true,
			role: role,
		}))

		await SecureStore.setItemAsync(TOKEN_KEY, token)
	}

	const getRefreshToken = async () => {
		const refreshToken = await SecureStore.getItemAsync('refreshToken')
		return refreshToken
	}

	const registerFCMToken = async () => {
		try {
			const fcmToken = await SecureStore.getItemAsync('fcmToken')
			const res = await registerDevice({
				fcmToken: fcmToken,
				accessToken: authState.token,
				shopId: authState.shopId || null,
				tenantId: authState.tenantID || null,
			})
		} catch (error) {
			console.error('🚨 Error registering FCM token:', error)
			return { success: false, message: 'Failed to register FCM token' }
		}
	}

	useEffect(() => {
		registerFCMToken()
	}, [authState.shopId])

	const refreshAccessToken = async () => {
		const refreshToken =
			authState.refreshToken || (await SecureStore.getItemAsync('refreshToken'))

		const headers = {
			'Content-Type': 'application/json',
		}

		// Only add Cookie header if we have a valid refresh token
		if (refreshToken) {
			headers['Cookie'] = `refreshToken=${refreshToken}`
		}

		const res = await fetch(`${BACKEND}/auth/refresh-token`, {
			method: 'POST',
			headers: headers,
			credentials: 'omit', // ← CHANGE THIS TO OMIT TO PREVENT AUTO COOKIES
		})
		const resJson = await res.json()
		if (resJson?.success) {
			const newToken = resJson.data.accessToken
			setUserToken(newToken)
		} else {
			await logOutUser()
		}
		return resJson
	}

	const getStoredPhoneNumber = async () => {
		const phoneNumber = await SecureStore.getItemAsync('phoneNumber')
		return phoneNumber
	}

	const values = useMemo(
		() => ({
			authState,
			setAuthState,
			setUserToken,
			registerUser,
			logOutUser,
			getRefreshToken,
			getOTP,
			verifyOTP,
			verifyReferral,
			registerFCMToken,
			refreshAccessToken,
			getStoredPhoneNumber,
		}),
		[authState]
	)

	return <AuthContext.Provider value={values}>{children}</AuthContext.Provider>
}
