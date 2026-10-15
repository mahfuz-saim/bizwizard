import apiClient from './apiClient'

const getPreviousSales = async (params) => {
	const { queries } = params.data || {}
	const query = {
		shopId: params.shopId,
		page: queries?.page,
		limit: queries?.limit,
		searchTerm: queries?.searchTerm,
		sortBy: queries?.sortBy,
		date: queries?.date
			? new Date(params.date).toISOString().split('T')[0]
			: undefined,
	}

	const res = await apiClient.get('/checkout', {
		headers: {
			Authorization: params.token,
		},
		params: query,
	})
	return res.data
}

const getCheckoutDetails = async (params) => {
	const { checkoutId } = params.data
	const res = await apiClient.get(`/checkout/${checkoutId}`, {
		headers: {
			Authorization: params.token,
		},
	})
	return res.data
}
export const salesController = { getPreviousSales, getCheckoutDetails }
