import { eq, sql } from 'drizzle-orm'
import { db } from '../../../db/client'
import { dbSchema } from '../../../db/schema'
import { ApiResponse, withTryCatch } from './Utils'

const getConfigByKey = withTryCatch(async (key) => {
	const { configTable } = dbSchema
	const result = await db.query.configTable.findFirst({
		where: eq(configTable.key, key),
	})
	if (!result) {
		throw new Error('no data')
	}
	return ApiResponse({
		success: true,
		message: 'Product get successfull',
		data: result,
	})
})

const storeConfigByKey = withTryCatch(async (key, value) => {
	const { configTable } = dbSchema

	await db
		.insert(configTable)
		.values({ key, value })
		.onConflictDoUpdate({
			target: configTable.key,
			set: {
				value: sql`excluded.value`,
			},
		})
	return ApiResponse({
		success: true,
		message: 'Config stored successfully',
	})
})

const getAllConfig = withTryCatch(async () => {
	const { configTable } = dbSchema
	const result = await db.select().from(configTable).orderBy(configTable.key)
	if (!result) {
		throw new Error('no data')
	}
	return ApiResponse({
		success: true,
		message: 'Product get successfull',
		data: result,
	})
})

export const configController = {
	getConfigByKey,
	getAllConfig,
	storeConfigByKey,
}
