export const ApiResponse = ({ success, message, data = null, meta = null }) => {
	return {
		success: success,
		message: message || null,
		data: data || null,
		...(meta && {
			meta: {
				page: meta.page,
				limit: meta.limit,
				total: meta.total,
			},
		}),
	}
}

export function withTryCatch(fn) {
	return async (...args) => {
		try {
			return await fn(...args)
		} catch (err) {
			console.log('🚀 withTryCatch err : ', err)
			return ApiResponse({ success: false, message: err.message })
		}
	}
}

export const syncItemsEnum = Object.freeze({
	PRODUCT: 'product',
	VARIANT: 'variant',
	LOT: 'lot',
})

export const syncStatusEnum = Object.freeze({
	PENDING: 'pending',
	SUCCESS: 'success',
	FAILED: 'failed',
	PARTIAL: 'partial',
})

export const configEnum = Object.freeze({
	IS_FIRST_RUN: 'isFirstRun',
	IS_FIST_SYNC_DONE: 'isFirstSyncDone',
})
