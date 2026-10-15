import { eq, sql, and, or, like, desc, asc } from 'drizzle-orm'
import { db } from '../../../db/client'
import { dbSchema } from '../../../db/schema'
import {
	ApiResponse,
	syncItemsEnum,
	syncStatusEnum,
	withTryCatch,
} from './Utils'

// db helpers
const upsertIntoInventory = async (product) => {
	if (!product || (Array.isArray(product) && !product.length)) {
		return
	}

	const { inventory: inventoryTable, syncStatus } = dbSchema

	await db
		.insert(inventoryTable)
		.values(product)
		.onConflictDoUpdate({
			target: inventoryTable.barcode,
			set: {
				productName: sql`excluded.productName`,
				measuringUnit: sql`excluded.measuringUnit`,
				genericName: sql`excluded.genericName`,
				image: sql`excluded.image`,
				category: sql`excluded.category`,
				createdAt: sql`excluded.createdAt`,
				updatedAt: sql`excluded.updatedAt`,
				isPrivate: sql`excluded.isPrivate`,
			},
		})
		.returning()

	await db
		.insert(syncStatus)
		.values({
			syncItem: syncItemsEnum.PRODUCT,
			syncedAt: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: syncStatus.syncItem,
			set: {
				syncedAt: new Date().toISOString(),
			},
		})
}

const upsertIntoShopVariant = async (variant) => {
	if (!variant || (Array.isArray(variant) && !variant.length)) {
		return
	}

	const { shopVariants: shopVariantTable, syncStatus } = dbSchema
	await db
		.insert(shopVariantTable)
		.values(variant)
		.onConflictDoUpdate({
			target: shopVariantTable.id,
			set: {
				productID: sql`excluded.productID`,
				shopID: sql`excluded.shopID`,
				variantName: sql`excluded.variantName`,
				variantCode: sql`excluded.variantCode`,
				packOf: sql`excluded.packOf`,
				name: sql`excluded.name`,
				lowStock: sql`excluded.lowStock`,
				lowStockSMS: sql`excluded.lowStockSMS`,
				lastSoldDate: sql`excluded.lastSoldDate`,
				notifyAfterNotSold: sql`excluded.notifyAfterNotSold`,
				notifyBeforeExp: sql`excluded.notifyBeforeExp`,
				notifyAt: sql`excluded.notifyAt`,
				notSoldSMS: sql`excluded.notSoldSMS`,
				createdAt: sql`excluded.createdAt`,
				updatedAt: sql`excluded.updatedAt`,
				totalProducts: sql`excluded.totalProducts`,
			},
		})

	await db
		.insert(syncStatus)
		.values({
			syncItem: syncItemsEnum.VARIANT,
			syncedAt: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: syncStatus.syncItem,
			set: {
				syncedAt: new Date().toISOString(),
			},
		})
}

const upsertIntoLot = async (lot) => {
	if (!lot || (Array.isArray(lot) && !lot.length)) {
		return
	}

	const { lot: lotTable, syncStatus } = dbSchema
	await db
		.insert(lotTable)
		.values(lot)
		.onConflictDoUpdate({
			target: lotTable.id,
			set: {
				stock: sql`excluded.stock`,
				mrp: sql`excluded.mrp`,
				isMRPDefault: sql`excluded.isMRPDefault`,
				retail: sql`excluded.retail`,
				includeVAT: sql`excluded.includeVAT`,
				buyPrice: sql`excluded.buyPrice`,
				sellPrice: sql`excluded.sellPrice`,
				vat: sql`excluded.vat`,
				mfgDate: sql`excluded.mfgDate`,
				expDate: sql`excluded.expDate`,
				locationAtStore: sql`excluded.locationAtStore`,
				note: sql`excluded.note`,
				shopVariantId: sql`excluded.shopVariantId`,
				status: sql`excluded.status`,
				createdAt: sql`excluded.createdAt`,
			},
		})

	await db
		.insert(syncStatus)
		.values({
			syncItem: syncItemsEnum.LOT,
			syncedAt: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: syncStatus.syncItem,
			set: {
				syncedAt: new Date().toISOString(),
			},
		})
}

const getProductFromInventoryDatabase = withTryCatch(
	async (payload, operation) => {
		const { inventory: inventoryTable } = dbSchema
		if (operation === 'read') {
			const { barcode, shopID: sidA, shopId: sidB } = payload
			const shopID = sidA ?? sidB
			const result = await db.query.inventory.findFirst({
				where: eq(inventoryTable.barcode, barcode),
				with: {
					variants: shopID
						? { where: eq(dbSchema.shopVariants.shopID, shopID) }
						: true,
				},
			})
			if (!result) {
				throw new Error('no data')
			}
			return ApiResponse({
				success: true,
				message: 'Product get successfull',
				data: result,
			})
		} else if (operation === 'write') {
			const { variants, ...product } = payload

			await upsertIntoInventory(product)

			for (const item of variants) {
				await upsertIntoShopVariant(item)
			}

			return ApiResponse({
				success: true,
				message: 'Product stored successfully',
			})
		}
	}
)

const getProductbyID = withTryCatch(async (payload, operation) => {
	const { inventory: inventoryTable } = dbSchema

	if (operation === 'read') {
		const result = await db.query.inventory.findFirst({
			where: eq(inventoryTable.id, payload.productId),
		})
		if (!result) {
			throw new Error('no data')
		}
	} else if (operation === 'write') {
		await upsertIntoInventory(payload)
		return ApiResponse({
			success: true,
			message: 'Product stored successfully',
		})
	}
})

const getProductByVariantCode = withTryCatch(async (data, operation) => {
	const { shopVariants: shopVariantTable } = dbSchema
	if (operation === 'read') {
		const shopID = data.shopID ?? data.shopId
		const variantCodeCond = eq(shopVariantTable.variantCode, data.variantCode)
		const whereClause = shopID
			? and(variantCodeCond, eq(shopVariantTable.shopID, shopID))
			: variantCodeCond
		const result = await db.query.shopVariants.findFirst({
			where: whereClause,
			with: {
				product: true,
			},
		})

		if (!result || result.length === 0) {
			throw new Error('no data')
		}
		return ApiResponse({
			success: true,
			message: 'Product get successfull',
			data: result,
		})
	} else if (operation === 'write') {
		const { Lot, product, ...variant } = data

		await upsertIntoShopVariant(variant)
		await upsertIntoInventory(product)
		await upsertIntoLot(Lot)

		return ApiResponse({
			success: true,
			message: 'Product stored successfully',
		})
	}
})

const getLotByVariantId = withTryCatch(async (payload, operation) => {
	const { lot: lotTable } = dbSchema
	if (operation === 'read') {
		const shopVariantId = payload
		const result = await db.query.lot.findMany({
			where: and(
				eq(lotTable.shopVariantId, shopVariantId),
				eq(lotTable.status, 'ACTIVE')
			),
		})

		if (!result || result.length === 0) {
			throw new Error('no data')
		}
		return ApiResponse({
			success: true,
			message: 'Let Fetch successfull',
			data: result,
		})
	} else if (operation === 'write') {
		await upsertIntoLot(payload)

		return ApiResponse({
			success: true,
			message: 'Lot Stored successfully',
		})
	}
})

const getProductByVariantId = withTryCatch(async (data, operation) => {
	const { shopVariants: shopVariantTable } = dbSchema
	if (operation === 'read') {
		const result = await db.query.shopVariants.findFirst({
			where: eq(shopVariantTable.id, data.variantId),
			with: {
				product: true,
			},
		})

		if (!result || result.length === 0) {
			throw new Error('no data')
		}
		return ApiResponse({
			success: true,
			message: 'Product get successfull',
			data: result,
		})
	} else if (operation === 'write') {
		const { Lot, product, ...variant } = data

		await upsertIntoShopVariant(variant)
		await upsertIntoInventory(product)
		await upsertIntoLot(Lot)

		return ApiResponse({
			success: true,
			message: 'Product stored successfully',
		})
	}
})

const getLotById = withTryCatch(async (payload, operation) => {
	const { lot: lotTable } = dbSchema
	if (operation === 'read') {
		const lotId = payload

		const result = await db.query.lot.findMany({
			where: eq(lotTable.id, lotId),
		})

		if (!result || result.length === 0) {
			throw new Error('no data')
		}
		return ApiResponse({
			success: true,
			message: 'Let Fetch successfull',
			data: result,
		})
	} else if (operation === 'write') {
		await upsertIntoLot(payload)

		return ApiResponse({
			success: true,
			message: 'Lot Stored successfully',
		})
	}
})

const getProductsFromShop = withTryCatch(async (data, operation) => {
	const { shopVariants: shopVariantTable, inventory: inventoryTable } = dbSchema
	if (operation === 'read') {
		/**
		 *     page?: number,
		 *     limit?: number,
		 *     searchTerm?: string,
		 *     barcode?: string
		 *     sortBy?: string, //lowStock
		 *     sortOrder?: asc|desc
		 */
		const {
			page = 1,
			limit = 10,
			searchTerm,
			barcode,
			sortBy,
			sortOrder = 'asc',
			shopID: _shopID,
			shopId: _shopId,
		} = data
		const shopID = _shopID ?? _shopId

		const offset = (page - 1) * limit
		const conditions = []

		// shopID filter (required)
		if (shopID) {
			conditions.push(eq(shopVariantTable.shopID, shopID))
		}

		// searchTerm: search in variant name or product name (shopVariant fields) - case insensitive
		if (searchTerm) {
			const searchLower = searchTerm.toLowerCase()
			conditions.push(
				or(
					sql`lower(${shopVariantTable.name}) LIKE ${`%${searchLower}%`}`,
					sql`lower(${shopVariantTable.variantName}) LIKE ${`%${searchLower}%`}`
				)
			)
		} // Build the where clause
		const whereClause = conditions.length > 0 ? and(...conditions) : undefined

		// If barcode is provided, search in inventory table and join with shopVariants
		let result
		if (barcode) {
			// Find product by barcode in inventory table
			const product = await db.query.inventory.findFirst({
				where: eq(inventoryTable.barcode, barcode),
				with: {
					variants: true,
				},
			})

			if (!product || !product.variants || product.variants.length === 0) {
				throw new Error('no data')
			}

			// Filter variants by shopID if provided
			let variants = product.variants
			if (shopID) {
				variants = variants.filter((v) => v.shopID === shopID)
			}

			if (variants.length === 0) {
				throw new Error('no data')
			}

			result = variants.map((variant) => ({
				...variant,
				product: product,
			}))
		} else {
			// Regular query without barcode
			result = await db.query.shopVariants.findMany({
				where: whereClause,
				with: {
					product: true,
				},
				limit: limit,
				offset: offset,
				orderBy: sortBy
					? sortOrder === 'desc'
						? desc(shopVariantTable[sortBy])
						: asc(shopVariantTable[sortBy])
					: undefined,
			})

			if (!result || result.length === 0) {
				throw new Error('no data')
			}
		}

		return ApiResponse({
			success: true,
			message: 'Products fetched successfully',
			data: {
				data: result,
				meta: {
					page,
					limit,
					total: result.length,
				},
			},
		})
	} else if (operation === 'write') {
		// Remote list -> persist to local for offline (supports {data:[...]} or [...] )
		const list = Array.isArray(data?.data)
			? data.data
			: Array.isArray(data)
				? data
				: []
		if (!list.length)
			return ApiResponse({ success: true, message: 'No data to store' })
		for (const item of list) {
			try {
				if (item.product) await upsertIntoInventory(item.product)
				const { product, Lot, ...variant } = item
				if (variant?.id) await upsertIntoShopVariant(variant)
				if (Lot) await upsertIntoLot(Lot)
			} catch (e) {
				console.log('getProductsFromShop write error', e?.message)
			}
		}
		return ApiResponse({
			success: true,
			message: 'Products stored successfully',
		})
	}
})

const READ_OPERATION = 'read'

// Fields of the local (device) inventory catalog that can be searched.
export const inventorySearchFields = Object.freeze({
	NAME: 'productName',
	GENERIC_NAME: 'genericName',
	BARCODE: 'barcode',
})

// Escape user input so `%` / `_` / `\` are treated as literals inside LIKE.
const escapeLikeTerm = (term) => String(term).replace(/([\\%_])/g, '\\$1')

/**
 * Search the pre-saved (synced) product catalog stored on the device.
 * `data` shape: { searchTerm?: string, field?: 'productName'|'genericName'|'barcode', limit?: number }
 * Returns an ApiResponse with an array of inventory rows (never touches the network).
 */
const searchInventoryProducts = withTryCatch(
	async (data, operation = READ_OPERATION) => {
		const { inventory: inventoryTable } = dbSchema
		// searching is read-only; anything else is a programming error
		if (operation && operation !== READ_OPERATION) {
			return ApiResponse({ success: false, message: 'Unsupported operation' })
		}

		const { searchTerm, field = inventorySearchFields.NAME, limit } = data || {}

		const term = String(searchTerm || '')
			.trim()
			.toLowerCase()

		if (!term) {
			return ApiResponse({
				success: true,
				message: 'Empty search term',
				data: [],
			})
		}

		const column =
			field === inventorySearchFields.GENERIC_NAME
				? inventoryTable.genericName
				: field === inventorySearchFields.BARCODE
					? inventoryTable.barcode
					: inventoryTable.productName

		const containsPattern = `%${escapeLikeTerm(term)}%`
		const startsWithPattern = `${escapeLikeTerm(term)}%`

		const query = db
			.select()
			.from(inventoryTable)
			.where(sql`lower(${column}) LIKE ${containsPattern} ESCAPE '\\'`)
			// names that start with the search term are ranked first
			.orderBy(
				sql`case when lower(${column}) LIKE ${startsWithPattern} ESCAPE '\\' then 0 else 1 end`,
				asc(inventoryTable.productName)
			)

		// no limit given means every match is wanted (the dropdown pages them for
		// rendering); a caller can still cap the query by passing a limit
		const rows =
			limit === undefined || limit === null || Number(limit) <= 0
				? await query
				: await query.limit(Number(limit))

		return ApiResponse({
			success: true,
			message: 'Products fetched from device catalog',
			data: rows,
		})
	}
)

const searchInventoryByName = (data, operation = READ_OPERATION) =>
	searchInventoryProducts(
		{ ...(data || {}), field: inventorySearchFields.NAME },
		operation
	)

const searchInventoryByGenericName = (data, operation = READ_OPERATION) =>
	searchInventoryProducts(
		{ ...(data || {}), field: inventorySearchFields.GENERIC_NAME },
		operation
	)

const deleteInventoryByBarcode = async (barcode) => {
	const { inventory: inventoryTable } = dbSchema
	await db.delete(inventoryTable).where(eq(inventoryTable.barcode, barcode))
}

const deleteShopVariantById = async (variantId) => {
	const { shopVariants: shopVariantTable } = dbSchema
	await db.delete(shopVariantTable).where(eq(shopVariantTable.id, variantId))
}

const deleteLotById = async (lotId) => {
	const { lot: lotTable } = dbSchema
	await db.delete(lotTable).where(eq(lotTable.id, lotId))
}

export const localProductController = {
	getProductFromInventoryDatabase,
	getProductbyID,
	getProductByVariantCode,
	upsertIntoInventory,
	upsertIntoShopVariant,
	upsertIntoLot,
	getLotByVariantId,
	getProductByVariantId,
	getLotById,
	getProductsFromShop,
	searchInventoryProducts,
	searchInventoryByName,
	searchInventoryByGenericName,
	deleteInventoryByBarcode,
	deleteShopVariantById,
	deleteLotById,
}
