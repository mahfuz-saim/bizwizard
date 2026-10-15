import apiClient from './apiClient'

export async function joinShopRequest(data) {
	const res = await apiClient.get(`/employee/join-shop/${data.data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export async function addEmployee(data) {
	const reqBody = {
		shopID: data.shopId,
		...data.data,
	}
	const res = await apiClient.post('/user/create-employee', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

/**
 * data - func param
 * data {
 *   token:string,
 *   shopId:string,
 *   data:{
 *     page?: number,
 *     limit?: number,
 *     sortBy?: string, // e.g., "createdAt" or "amount"
 *     sortOrder?: string, // "asc" or "desc"
 *     searchTerm?: string, // user name or phone number
 *   }
 * }
 */
export async function getAllEmployee(data) {
	const params = data?.data || {}

	const query = {
		page: params.page,
		limit: params.limit,
		searchTerm: params.searchTerm, // user name or phone number
		sortBy: params.sortBy, // e.g., "createdAt" or "amount"
		sortOrder: params.sortOrder,
	}

	const res = await apiClient.get('/employee', {
		headers: {
			Authorization: data.token,
		},
		params: query,
	})
	return res.data
}

export async function deleteEmployee(data) {
	const res = await apiClient.delete(`/employee/${data.employeeId}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export async function updateEmployee(data) {
	const reqBody = {
		shopID: data.shopId,
		...data.data,
	}
	const res = await apiClient.put(`/employee/${data.employeeId}`, reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function getEmployeeShop(data) {
	const res = await apiClient.get('/employee/myshop', {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export async function getEmployeePendingRequests(data) {
	const res = await apiClient.get('/employee/join-requests', {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export async function getEmployeeTransactions(data) {
	const res = await apiClient.get(`/checkout/sold-by/${data.data.userId}`, {
		headers: {
			Authorization: data.token,
		},
		params: {
			shopId: data.shopId,
		},
	})
	return res.data
}
