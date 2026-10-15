import apiClient from './apiClient'

/**
 * data - func param
 * data {
 *   token:string,
 *   shopId:string,
 *   data:{
 *     page?: number,
 *     limit?: number,
 *     searchTerm?: string, // user name or phone number
 *     sortBy?: string, // e.g., "createdAt" or "amount"
 *     date?: Date
 *   }
 * }
 */
export async function getAllDebt(data) {
	const params = data?.data || {}

	const query = {
		page: params.page,
		limit: params.limit,
		searchTerm: params.searchTerm,
		sortBy: params.sortBy,
		date: params?.date
			? new Date(params.date).toISOString().split('T')[0]
			: undefined,
		includeCompleted: params.includeCompleted,
		status: params.status,
	}

	const res = await apiClient.get(`/debt/all/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
		params: query,
	})
	return res.data
}

export async function getSingleDebt(data) {
	const res = await apiClient.get(`/checkout/${data.data.id}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export async function resolveSingle(data) {
	const res = await apiClient.post('/debt/resolve', data.data, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function resolveBulk(data) {
	const reqBody = {
		...data.data,
		shopId: data.shopId,
	}
	const res = await apiClient.post('/debt/bulk-resolve', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function getUserDebt(data) {
	const res = await apiClient.post('/debt/user', data.data, {
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
 *   "buyerId": "c0acda34-2a1b-4c79-a3b1-909c7d5e0c1b",
 *   "shopId": "shop-001",
 *   "amount": 12,
 *   "paidAmount": 0
}
 */
const addPreviousDebt = async (params) => {
	const payload = params.data
	const reqBody = {
		buyerId: payload.buyerId,
		shopId: params.shopId,
		amount: payload.amount,
		paidAmount: payload.paidAmount,
	}
	const res = await apiClient.post('/debt/add-previous-debt', reqBody, {
		headers: {
			Authorization: params.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function getDebtLedger(data) {
	const res = await apiClient.get(
		`/debt/ledger/${data.shopId}/${data.data.buyerId}`,
		{
			headers: {
				Authorization: data.token,
			},
		}
	)
	return res.data
}

export const debtController = {
	resolveBulk,
	resolveSingle,
	getAllDebt,
	getSingleDebt,
	getUserDebt,
	addPreviousDebt,
	getDebtLedger,
}
