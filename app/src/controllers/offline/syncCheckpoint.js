import { eq, and, sql } from 'drizzle-orm'
import { db } from '../../../db/client'
import { dbSchema } from '../../../db/schema'

// shopId: 'GLOBAL' for products, actual shopId for variant/lot
export async function getCheckpoint(shopId, entity) {
	try {
		const row = await db.query.syncCheckpoint.findFirst({
			where: and(
				eq(dbSchema.syncCheckpoint.shopId, shopId),
				eq(dbSchema.syncCheckpoint.entity, entity)
			),
		})
		return row || null
	} catch (e) {
		console.log('getCheckpoint error', e?.message)
		return null
	}
}

export async function upsertCheckpoint({
	shopId,
	entity,
	currentPage,
	pageSize,
	total,
	status,
}) {
	try {
		const now = new Date().toISOString()
		await db
			.insert(dbSchema.syncCheckpoint)
			.values({
				shopId,
				entity,
				currentPage,
				pageSize,
				total,
				status,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: [
					dbSchema.syncCheckpoint.shopId,
					dbSchema.syncCheckpoint.entity,
				],
				set: {
					currentPage: sql`excluded.currentPage`,
					pageSize: sql`excluded.pageSize`,
					total: sql`excluded.total`,
					status: sql`excluded.status`,
					updatedAt: sql`excluded.updatedAt`,
				},
			})
	} catch (e) {
		console.log('upsertCheckpoint error', e?.message)
	}
}

export async function isCheckpointDone(shopId, entity) {
	const row = await getCheckpoint(shopId, entity)
	return row?.status === 'done'
}
