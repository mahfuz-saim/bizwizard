import apiClient from './apiClient'

export async function addCustomer(data) {
	const reqBody = {
		...data.data.payload,
		shopID: data.shopId,
	}
	const res = await apiClient.post('/buyer/add-buyer', reqBody, {
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
 *	 //from hook
 *   token:string,
 *   shopId:string,
 *   //from component
 *   data:{
 *     searchTerm?: string, // user name or phone number
 *     customTag? string[], // custom tags to filter customers
 *     systemTag? string[], // system tags to filter customers
 *   }
 * }
 */
export async function getAllCustomer(data) {
	const params = data?.data || {}

	const query = {
		searchTerm: params.searchTerm,
		customTag: params.customTag,
		systemTag: params.systemTag,
		limit: params.limit || 10,
		page: params.page || 1,
	}

	const res = await apiClient.get(`/buyer/shop-buyer/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
		params: query,
	})
	return res.data
}

export async function deleteCustomer(data) {
	const res = await apiClient.delete(
		`/buyer/shop-buyer/${data.data.customerId}`,
		{
			headers: {
				Authorization: data.token,
			},
		}
	)
	return res.data
}

export async function updateCustomer(data) {
	const reqBody = {
		...data.data.payload,
		shopID: data.shopId,
	}
	const res = await apiClient.put('/buyer/shop-buyer', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function getAllTags(data) {
	const res = await apiClient.get(`/shop/tag/${data.shopId}`, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function getAllCheckouts(data) {
	const res = await apiClient.get(`/buyer/checkout/${data.data.buyerId}`, {
		headers: {
			Authorization: data.token,
		},
		params: {
			shopId: data.shopId,
		},
	})
	return res.data
}
