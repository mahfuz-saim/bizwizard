import apiClient from './apiClient'

export async function getAnalytics(data) {
	const res = await apiClient.get('/analytics', {
		headers: {
			Authorization: data.token,
		},
		params: {
			shopId: data.shopId,
			startDate: data.data.startDate,
			endDate: data.data.endDate,
		},
	})
	return res.data
}

export async function getNotSoldItem(data) {
	const res = await apiClient.get('/analytics/not-sold', {
		headers: {
			Authorization: data.token,
		},
		params: {
			shopId: data.shopId,
		},
	})
	return res.data
}

export async function getLowStockItem(data) {
	const res = await apiClient.get('/analytics/low-stock', {
		headers: {
			Authorization: data.token,
		},
		params: {
			shopId: data.shopId,
		},
	})
	return res.data
}

export async function getExpiredItem(data) {
	const res = await apiClient.get('/analytics/expired', {
		headers: {
			Authorization: data.token,
		},
		params: {
			shopId: data.shopId,
		},
	})
	return res.data
}

export async function getLotPurchaseHistory(params) {
	const res = await apiClient.get(
		`/analytics/variant/${params.data.variantId}/purchases`,
		{
			headers: {
				Authorization: params.token,
			},
		}
	)
	return res.data
}
