// @dead-code — 2026-09-24 knip+grep: 0 active imports, candidate for removal (kept per request)
// src/utils/smsRetrieverHelper.js
// This helper file demonstrates how to set up SMS Retrieval API for Android
// This implementation is focused on working with your custom auth system

import { Platform } from 'react-native'

/**
 * Set up SMS Retriever API for automatic OTP detection on Android
 *
 * @returns {Promise<string|null>} The extracted OTP code or null
 */
export const startSmsRetriever = async () => {
	if (Platform.OS !== 'android') {
		console.log('SMS Retriever is only available on Android')
		return null
	}

	try {
		// In a real implementation, you would:
		// 1. Generate an app signature hash to identify your app
		// 2. Set up a native module bridge to Android's SMS Retriever API
		// 3. Register a broadcast receiver for SMS_RETRIEVED action

		// For demonstration, we're using a timeout to simulate receiving an SMS
		return new Promise((resolve) => {
			setTimeout(() => {
				// Simulated OTP code - in production this would come from the SMS
				const mockOtp = '1234'
				console.log('SMS received with code:', mockOtp)
				resolve(mockOtp)
			}, 3000)
		})
	} catch (error) {
		console.error('🚨 Error setting up SMS Retriever:', error)
		return null
	}
}

/**
 * Format the SMS message for automatic detection by Android
 * Share this format with your backend team
 *
 * @param {string} otp - The OTP code to include in the SMS
 * @param {string} appHash - Your app's hash for verification
 * @returns {string} - Properly formatted SMS message
 */
export const formatSmsMessageForAutoDetection = (
	otp,
	appHash = 'YourAppHash'
) => {
	return `<#> Your verification code is: ${otp}\n${appHash}`
}

/**
 * In a production implementation, you'd need these additional steps:
 *
 * 1. ANDROID MANIFEST PERMISSIONS:
 *    <uses-permission android:name="android.permission.RECEIVE_SMS" />
 *
 * 2. GRADLE DEPENDENCIES:
 *    implementation 'com.google.android.gms:play-services-auth:20.4.1'
 *    implementation 'com.google.android.gms:play-services-auth-api-phone:18.0.1'
 *
 * 3. NATIVE MODULE IMPLEMENTATION:
 *    Create a bridge to Android's SmsRetriever API
 *
 * 4. SMS FORMAT FOR YOUR BACKEND:
 *    The SMS must:
 *      - Begin with "<#>"
 *      - Contain the OTP code
 *      - End with the app hash (a 11-character string)
 *      - Example: "<#> Your verification code is: 1234\nFA+9qCX9VSu"
 */
