import apiClient from './apiClient'

export async function createExpense(data) {
	const reqBody = {
		shopID: data.shopId,
		...data.data,
	}
	const res = await apiClient.post('/expense', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function getExpense(data) {
	const params = data?.data || {}

	const query = {
		searchTerm: params.searchTerm,
		month: params.month,
		year: params.year,
		expenseType: params.expenseType,
		limit: params.limit || 10,
		page: params.page || 1,
		sortBy: params.sortBy || 'createdAt',
		sortOrder: params.sortOrder || 'desc',
	}
	const res = await apiClient.get(`/expense/shop/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
		params: query,
	})
	return res.data
}

export async function deleteExpense(data) {
	const res = await apiClient.delete(`/expense/item/${data.data.id}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export async function updateExpense(data) {
	const { id, data: reqBody } = data.data
	console.log('Updating expense with ID:', reqBody)
	const res = await apiClient.patch(`/expense/${data.data.id}`, reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}
