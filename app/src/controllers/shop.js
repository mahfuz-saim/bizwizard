import apiClient from './apiClient'

async function sellProduct(data) {
	const products = data.data.cartProducts
	const cart = data.data.cart
	let items = []
	products.forEach((product) => {
		items.push({
			lotId: product.lotId,
			quantity: Number(product.quantity),
			discountAmount: Number(product.discountAmount) || 0,
			discountPercentage: Number(product.discountPercentage) || 0,
			discountType: product.discountType || 'PERCENTAGE',
		})
	})
	const reqBody = {
		shopID: data.shopId,
		status: cart.isDraft ? 'UNPAID' : 'PAID',
		items: items,
		discountAmount: Number(cart.discountAmount) || 0,
		discountPercentage: Number(cart.discountPercentage) || 0,
		discountType: cart.discountType || 'PERCENTAGE',
		...cart.txnInfo,
	}
	if (cart?.buyerID) {
		reqBody.buyerID = cart.buyerID
	}

	if (cart?.paidAmount) {
		reqBody.paidAmount = cart.paidAmount
	}

	const res = await apiClient.post('/checkout', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

async function getShopDetails(data) {
	const res = await apiClient.get(`/shop/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

async function addShop(data) {
	const res = await apiClient.post('/shop', data.data, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

async function getShops(data) {
	const res = await apiClient.get('/shop', {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

async function getShopInfo(data) {
	const res = await apiClient.get(`/shop/get-info/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

async function getShopCategory(data) {
	const res = await apiClient.get('/shop/all-category')
	return res.data
}

export async function addCreditToShop(data) {
	const product = data.data
	const reqBody = {
		shopID: data.shopId,
		...product,
	}
	const res = await apiClient.post('/credit/request-topup', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

async function getJoinRequests(data) {
	const res = await apiClient.get(`/shop/employee-requests/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

async function updateEmployeeJoinRequest(data) {
	const res = await apiClient.post('/shop/employee-requests', data.data, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

async function fetchAllSubscriptions(data) {
	const res = await apiClient.get('/subscription', {
		headers: {
			'Content-Type': 'application/json',
			Authorization: data.token,
		},
	})
	return res.data
}

async function fetchActiveSubscriptions(data) {
	const res = await apiClient.get(`/subscription/${data.shopId}`, {
		headers: {
			'Content-Type': 'application/json',
			Authorization: data.token,
		},
	})
	return res.data
}

async function quickSellProduct(data) {
	const { customItems, lotItems, cart } = data.data
	const parsedCustomItems = customItems.map((item) => ({
		...item,
		quantity: Number(item.quantity),
		unitPrice: Number(item.unitPrice),
	}))
	const parsedLotItems = lotItems.map((item) => ({
		...item,
		quantity: Number(item.quantity),
	}))
	const reqBody = {
		shopID: data.shopId,
		status: cart.isDraft ? 'UNPAID' : 'PAID',
		discountAmount: Number(cart?.discountAmount) || 0,
		discountPercentage: Number(cart?.discountPercentage) || 0,
		discountType: cart.discountType || 'PERCENTAGE',
		...cart.txnInfo,
		isDraft: cart.isDraft,
		items: parsedLotItems,
		customItems: parsedCustomItems,
	}

	const res = await apiClient.post('/checkout', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export {
	sellProduct,
	getShopDetails,
	addShop,
	getShops,
	getShopInfo,
	getShopCategory,
	getJoinRequests,
	updateEmployeeJoinRequest,
	fetchAllSubscriptions,
}

export const shopController = {
	sellProduct,
	getShopDetails,
	addShop,
	getShops,
	getShopInfo,
	getShopCategory,
	getJoinRequests,
	updateEmployeeJoinRequest,
	fetchAllSubscriptions,
	fetchActiveSubscriptions,
	quickSellProduct,
}
