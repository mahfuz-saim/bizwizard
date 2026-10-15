import { sqliteTable, real, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { configEnum, syncStatusEnum } from '../src/controllers/offline/Utils'

export const inventory = sqliteTable('inventory', {
	id: text().primaryKey().notNull().default(`(lower(hex(randomblob(16))))`), // UUID simulation in SQLite
	productName: text().notNull(),
	barcode: text().notNull().unique(),
	measuringUnit: text().notNull(),
	genericName: text(),
	image: text(),
	category: text().notNull().default('OTHER'),
	createdAt: text().notNull().default('CURRENT_TIMESTAMP'),
	updatedAt: text().notNull().default('CURRENT_TIMESTAMP'),
	isPrivate: integer({ mode: 'boolean' }).notNull().default(false),
})

export const inventoryRelations = relations(inventory, ({ many }) => ({
	variants: many(shopVariants),
	// Add CheckoutItem and PickupItem relations when available
}))

// db/schema/shopVariant.ts

export const shopVariants = sqliteTable(
	'shop_variants',
	{
		id: text().primaryKey().notNull().default(`(lower(hex(randomblob(16))))`),
		productID: text(),
		name: text(),
		variantName: text(),
		variantCode: text(),
		packOf: integer(),
		shopID: text().notNull(),
		lowStock: integer(),
		lowStockSMS: integer({ mode: 'boolean' }),
		lastSoldDate: text(),
		notifyAfterNotSold: integer(),
		notifyBeforeExp: integer(),
		notifyAt: text(),
		notSoldSMS: integer({ mode: 'boolean' }),
		createdAt: text().notNull().default('CURRENT_TIMESTAMP'),
		updatedAt: text().notNull().default('CURRENT_TIMESTAMP'),
		totalProducts: integer().notNull().default(0),
	},
	(table) => ({
		uniqueShopVariant: {
			columns: [table.shopID, table.variantCode],
			unique: true,
		},
	})
)

export const shopVariantRelations = relations(shopVariants, ({ one }) => ({
	product: one(inventory, {
		fields: [shopVariants.productID],
		references: [inventory.id],
	}),
}))

export const shop = sqliteTable('shop', {
	id: text().primaryKey().notNull().default(`(lower(hex(randomblob(16))))`),
	shopName: text(),
	contact: text(),
	tradeLicense: text(),
	category: text(),
	shopCode: text(), //?      @unique
	//address      :Address?
	ownerID: text(),
	createdAt: text().notNull().default('CURRENT_TIMESTAMP'),
	updatedAt: text().notNull().default('CURRENT_TIMESTAMP'),
})

export const lot = sqliteTable('lots', {
	id: text().primaryKey().notNull().default(`(lower(hex(randomblob(16))))`), // simulate UUID
	stock: integer().notNull(),
	mrp: real().notNull(),
	isMRPDefault: integer({ mode: 'boolean' }).notNull().default(false),
	retail: real().notNull(),
	includeVAT: integer({ mode: 'boolean' }).notNull().default(false),
	buyPrice: real().notNull(),
	sellPrice: real().notNull(),
	vat: real(),
	mfgDate: text(), // ISO string for DateTime
	expDate: text(),
	locationAtStore: text(),
	note: text(),
	shopVariantId: text().notNull(),
	status: text().notNull().default('ACTIVE'),
	createdAt: text().notNull().default('CURRENT_TIMESTAMP'),
})

// define relations
export const lotRelations = relations(lot, ({ one }) => ({
	shopVariant: one(shopVariants, {
		fields: [lot.shopVariantId],
		references: [shopVariants.id],
	}),
}))

export const syncStatus = sqliteTable('syncStatus', {
	id: integer().primaryKey(),
	syncItem: text().notNull().unique(),
	syncedAt: text().notNull().default('CURRENT_TIMESTAMP'),
	syncStatus: text('syncStatus', { enum: syncStatusEnum })
		.notNull()
		.default(syncStatusEnum.PENDING),
})

export const configTable = sqliteTable('config', {
	key: text({ enum: configEnum }).primaryKey(),
	value: text().notNull(),
})

export const syncCheckpoint = sqliteTable(
	'sync_checkpoint',
	{
		id: integer().primaryKey({ autoIncrement: true }),
		shopId: text().notNull(), // 'GLOBAL' for inventory
		entity: text().notNull(), // 'product' | 'variant' | 'lot'
		currentPage: integer().notNull().default(0),
		pageSize: integer().notNull(),
		total: integer().notNull().default(0),
		status: text().notNull().default('pending'), // pending | syncing | done | error
		updatedAt: text().notNull().default('CURRENT_TIMESTAMP'),
	},
	(table) => ({
		uniqueShopEntity: {
			columns: [table.shopId, table.entity],
			unique: true,
		},
	})
)

export const dbSchema = {
	inventory,
	shopVariants,
	shop,
	lot,
	syncStatus,
	configTable,
	syncCheckpoint,
}
