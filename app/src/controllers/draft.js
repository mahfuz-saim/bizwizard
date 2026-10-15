import apiClient from './apiClient'

export async function getAllDraft(data) {
	const res = await apiClient.get(`/draft-order/shop/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export async function getSingleDraft(data) {
	const res = await apiClient.get(`/draft-order/${data.data.id}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export async function deleteDraft(data) {
	const res = await apiClient.delete(`/draft-order/${data.data.id}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export async function updateDraft(data) {
	const product = data.data
	const reqBody = {
		shopID: data.shopId,
		...product,
	}
	const res = await apiClient.post('/draft-order', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function getDraftCount(data) {
	const res = await apiClient.get(`/draft-order/count/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}
