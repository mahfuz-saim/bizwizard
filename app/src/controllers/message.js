import apiClient from './apiClient'

export async function sendManyMessages(params) {
	const reqBody = {
		...params.data,
		shopId: params.shopId,
	}
	const res = await apiClient.post('/message', reqBody, {
		headers: {
			Authorization: params.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function getAllMessage(data) {
	const res = await apiClient.get('/message', {
		headers: {
			Authorization: data.token,
		},
		params: {
			shopId: data.shopId,
		},
	})
	return res.data
}
