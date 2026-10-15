import apiClient from './apiClient'
export async function getLatestVersion() {
	const res = await apiClient.get('/app-version/SHOP')
	return res.data
}

export async function getConfig(params) {
	const { shopId } = params

	const res = await apiClient.get(`/shop/config/${shopId}`, {
		headers: {
			Authorization: params.token,
		},
	})
	return res.data
}

export async function setConfig(data) {
	const reqBody = {
		...data.data.params,
		shopId: data.shopId,
	}
	const res = await apiClient.post('/shop/config/', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}
