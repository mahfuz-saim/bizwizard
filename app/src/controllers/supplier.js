import apiClient from './apiClient'
export async function addSupplierToShop(params) {
	const reqBody = {
		shopId: params.shopId,
		name: params.data.name,
		number: params.data.number,
		company: params.data.company,
		comment: params.data.comment,
	}
	const res = await apiClient.post('/supplier/add-to-shop', reqBody, {
		headers: {
			Authorization: params.token,
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
export async function getAllSupplier(data) {
	const params = data?.data || {}

	const query = {
		searchTerm: params.searchTerm, // user name or phone number
		page: params.page,
		limit: params.limit,
		sortBy: params.sortBy, // e.g., "createdAt" or "amount"
		sortOrder: params.sortOrder,
	}

	const res = await apiClient.get(`/supplier/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
		params: query,
	})
	return res.data
}

export async function updateSupplierToShop(params) {
	const reqBody = {
		supplierId: params.data.supplierId,
		shopId: params.shopId,
		supplierName: params.data.payload.supplierName || params.data.payload.name,
		comment: params.data.payload.comment,
		company: params.data.company,
	}

	const res = await apiClient.put('/supplier', reqBody, {
		headers: {
			Authorization: params.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function deleteSupplier(data) {
	const res = await apiClient.delete(`/supplier/${data.data.supplierId}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export async function getSupplierProducts(data) {
	const res = await apiClient.get(`/shop/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
		params: {
			supplierId: data.data.data.supplierId,
		},
	})
	return res.data
}
