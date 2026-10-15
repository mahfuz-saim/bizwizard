import { useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Alert } from 'react-native'
import { useLocalization } from '../localization/localizationContext'

export default function useApi() {
	const { authState, logOutUser, refreshAccessToken } = useAuth()
	const { loc } = useLocalization()

	const fetchData = useCallback(
		async (
			apiFunction,
			params,
			localApiFunction,
			localApiMode = 'write',
			options = {}
		) => {
			const skipLocal =
				typeof options === 'boolean' ? options : !!options?.skipLocal
			if (!skipLocal && localApiFunction && localApiMode === 'read') {
				// Inject current shopId into local read so shop-scoped queries (variants/lots) are filtered
				// Ponytail: reuse existing authState.shopId, support both shopID/shopId casings for offline schema
				let localParams = params
				if (params && typeof params === 'object' && !Array.isArray(params)) {
					const hasShopID = 'shopID' in params
					const hasShopId = 'shopId' in params
					if (authState.shopId) {
						if (!hasShopID && !hasShopId) {
							localParams = {
								...params,
								shopID: authState.shopId,
								shopId: authState.shopId,
							}
						} else if (hasShopId && !hasShopID) {
							localParams = { ...params, shopID: params.shopId }
						} else if (hasShopID && !hasShopId) {
							localParams = { ...params, shopId: params.shopID }
						}
					}
				}
				const result = await localApiFunction(localParams, localApiMode)
				if (result?.success) {
					return result
				}
			}
			//NOTE: no data returned from local function, continue to call remote api
			try {
				params = {
					data: params,
					token: authState.token,
					shopId: authState.shopId,
				}
				let result = await apiFunction(params)
				if (result.success) {
					if (localApiFunction) {
						await localApiFunction(result.data, 'write')
					}
					return result
				}
				if (result.success === false && result.message === 'jwt expired') {
					const resJson = await refreshAccessToken()
					//if (resJson.message === 'Invalid Refresh Token') {
					if (!resJson?.success) {
						Alert.alert(
							loc.t('login.loginExpired'),
							loc.t('login.loginExpiredMsg'),
							[
								{
									text: loc.t('common.ok'),
									onPress: async () => {
										await logOutUser()
										return
									},
								},
							],
							{ cancelable: false }
						)
						return { success: false, loggedOut: true }
					}
					const newToken = resJson.data.accessToken
					params.token = newToken
				}
				result = await apiFunction(params)
				if (result?.success && localApiFunction) {
					await localApiFunction(result.data, 'write')
				}
				return result
			} catch (err) {
				console.log('🚨 TOKEN ERROR: ', err)
			}
		},
		[authState, refreshAccessToken, logOutUser, loc]
	)

	return {
		fetchData,
	}
}
