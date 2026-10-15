import apiClient from './apiClient'

//From our database for a specific shop
async function getOneProductFromShop(data) {
	const res = await apiClient.get(`/inventory/${data.data.barcode}`, {
		headers: {
			Authorization: data.token,
		},
		params: {
			shopID: data.shopId,
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
 *     searchTerm?: string,
 *     barcode?: string
 *     sortBy?: string, //lowStock
 *     sortOrder?: asc|desc
 *     includeProduct? : true|false
 *   }
 * }
 */
async function getAllProductsFromShop(data) {
	const params = data?.data || {}

	const query = {
		page: params.page,
		limit: params.limit,
		searchTerm: params.searchTerm,
		barcode: params.barcode,
		sortBy: params.sortBy,
		sortOrder: params.sortOrder,
		includeProduct: params.includeProduct,
	}

	const res = await apiClient.get(`/shop/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
		params: query,
	})
	return res.data
}

async function getAllLotsFromVariant(data) {
	const res = await apiClient.get(`/product/all-lot/${data.data}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

async function getProductFromInventoryDatabase(data) {
	const res = await apiClient.get(`/inventory/${data.data.barcode}`, {
		headers: {
			Authorization: data.token,
		},
		params: {
			shopID: data.shopId,
		},
	})
	return res.data
}

async function addProductToShop(data) {
	const product = data.data
	const reqBody = {
		shopID: data.shopId,
		...product,
	}
	const res = await apiClient.post('/product', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

async function createProductWithVariants(data) {
	const payload = data.data
	const reqBody = {
		shopID: data.shopId,
		...payload,
	}
	// ensure shopID from payload doesn't override
	reqBody.shopID = data.shopId
	const res = await apiClient.post('/product/catalog', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

async function updateLot(data) {
	const res = await apiClient.put(
		`/product/lot/${data.data.id}`,
		data.data.lotData,
		{
			headers: {
				Authorization: data.token,
				'Content-Type': 'application/json',
			},
		}
	)
	return res.data
}

async function updateProduct(data) {
	const { id, data: reqBody } = data.data

	const res = await apiClient.put(`/product/${data.data.id}`, reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

async function deleteLot(data) {
	const reqBody = {
		reason: data.data.reason,
		lossType: data.data.lossType,
		lossAmount: data.data.lossAmount,
		note: data.data.note,
		lotId: data.data.lotId,
		stock: data.data.stock,
	}

	const res = await apiClient.delete('/product/lot', {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
		data: reqBody,
	})
	return res.data
}

async function deleteProduct(data) {
	const res = await apiClient.delete(`/product/${data.data.productId}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

async function getProductByVariantCode(data) {
	const res = await apiClient.get(`/product/variant/${data.data.variantCode}`, {
		headers: {
			Authorization: data.token,
		},
		params: {
			shopId: data.shopId,
		},
	})
	return res.data
}

async function getProductByOCR(data) {
	const params = data?.data || {}

	const query = {
		shopId: data.shopId,
		searchTerm: params.searchTerm, //pname, variantCode, variantName
	}

	const res = await apiClient.get('/product/ocr/', {
		headers: {
			Authorization: data.token,
		},
		params: query,
	})
	return res.data
}

async function getProductbyID(data) {
	const res = await apiClient.get(`/product/id/${data.data.productId}`, {
		headers: {
			Authorization: data.token,
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
 *     sortBy?: string, //lowStock
 *     sortOrder?: asc|desc
 *   }
 * }
 */
async function getAllInventory(data) {
	const params = data?.data || {}

	const query = {
		page: params.page,
		limit: params.limit,
		sortBy: params.sortBy,
		sortOrder: params.sortOrder,
	}

	const res = await apiClient.get('/inventory/', {
		headers: {
			Authorization: data.token,
		},
		params: query,
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
 *     sortBy?: string, //lowStock
 *     sortOrder?: asc|desc
 *   }
 * }
 */
async function getAllLotFromShop(data) {
	const params = data?.data || {}

	const query = {
		page: params.page,
		limit: params.limit,
		sortBy: params.sortBy,
		sortOrder: params.sortOrder,
	}

	const res = await apiClient.get(`/shop/all-lot/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
		params: query,
	})
	return res.data
}

async function getProductByVariantId(data) {
	const variatnId = data.data.variantId
	let includeLot = true
	if (data.data?.includeLot === false) {
		includeLot = false
	}
	let includeProduct = true
	if (data.data?.includeProduct === false) {
		includeProduct = false
	}

	const res = await apiClient.get(`/product/variant/id/${variatnId}`, {
		headers: {
			Authorization: data.token,
		},
		params: {
			includeLot,
			includeProduct,
		},
	})
	return res.data
}

async function getLotById(data) {
	const res = await apiClient.get(`/product/lot/${data.data.lotId}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export {
	getOneProductFromShop,
	getAllProductsFromShop,
	getAllLotsFromVariant,
	getProductFromInventoryDatabase,
	addProductToShop,
	createProductWithVariants,
	deleteProduct,
	updateLot,
	updateProduct,
	deleteLot,
	getProductByVariantCode,
	getProductbyID,
	getProductByOCR,
	getAllInventory,
	getAllLotFromShop,
	getProductByVariantId,
	getLotById,
}
