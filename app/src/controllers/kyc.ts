import { IKycInput } from '@/app/(app)/(shared)/kyc'
import { IApiFuncParam } from './types'
import apiClient from './apiClient'

const submitKYC = async (payload: IApiFuncParam<IKycInput>) => {
	const formData = new FormData()
	const { documents, dateOfBirth, ...rest } = payload.data

	// Append text data
	formData.append(
		'data',
		JSON.stringify({
			...rest,
			dateOfBirth: dateOfBirth.toISOString(),
		})
	)

	// Append files with proper format
	Object.entries(documents).forEach(([key, uri]) => {
		if (uri) {
			const filename = uri.split('/').pop() || `${key}.jpg`
			formData.append(key, {
				uri: uri,
				name: filename,
				type: 'image/jpeg',
			} as any)
		}
	})

	const res = await apiClient.post('/user/kyc/submit-kyc', formData, {
		headers: {
			Authorization: payload.token,
			// Don't set Content-Type for multipart/form-data - let client set it with boundary
		},
	})
	return res.data
}

const getKYCStatus = async (payload: IApiFuncParam<{ shopId: string }>) => {
	const res = await apiClient.get(`/user/kyc/kyc-status/${payload.shopId}`, {
		headers: {
			Authorization: payload.token,
		},
	})
	return res.data
}

export const kycController = { submitKYC, getKYCStatus }
