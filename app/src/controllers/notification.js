import apiClient from './apiClient'
export async function registerDevice(payload) {
	try {
		if (!payload.accessToken) {
			return
		}
		let url = '/notifications/register-device'
		let reqBody = {
			token: payload.fcmToken,
		}
		if (payload.shopId) {
			reqBody.shopId = payload.shopId
		}

		const response = await apiClient.post(url, reqBody, {
			headers: {
				'Content-Type': 'application/json',
				Authorization: payload.accessToken,
				'x-tenant-id': payload?.tenantId,
			},
		})

		if (response.status < 200 || response.status >= 300) {
			throw new Error('Failed to register device')
		}
		return response.data
	} catch (error) {
		console.error('Error registering device:', error)
		throw error
	}
}

async function getAllNotifications(payload) {
	const { shopId } = payload
	try {
		const response = await apiClient.get(`/notifications/${shopId}`, {
			headers: {
				Authorization: payload.token,
			},
		})
		return response.data
	} catch (error) {
		console.error('Error Fetching notifications:', error)
		throw error
	}
}

async function markNotificationAsRead(payload) {
	const notificationId = payload.data.id
	try {
		const response = await apiClient.post(
			`/notifications/mark-read/${notificationId}`,
			null,
			{
				headers: {
					Authorization: payload.token,
				},
			}
		)
		return response.data
	} catch (error) {
		console.error('Error Marking notification as Read:', error)
		throw error
	}
}
export const notificationController = {
	registerDevice,
	getAllNotifications,
	markNotificationAsRead,
}
