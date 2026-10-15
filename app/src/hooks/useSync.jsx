import { useCallback } from 'react'
import { localProductController } from '../controllers/offline/product'
import {
	getLotById,
	getOneProductFromShop,
	getProductByVariantId,
} from '../controllers/product'
import useApi from './useApi'

export default function useSync() {
	const { fetchData } = useApi()

	const handleSync = useCallback(
		async (items) => {
			for (const item of items) {
				if (item.entity === 'PRODUCT') {
					if (item.operation === 'DELETE') {
						//NOTE: implement later
					} else if (item.operation === 'UPDATE') {
						const barcode = item.id
						const result = await fetchData(
							getOneProductFromShop,
							{ barcode: barcode },
							localProductController.getProductbyID,
							'write'
						)
					}
				}

				if (item.entity === 'VARIANT') {
					if (item.operation === 'DELETE') {
						//NOTE: implement later
					} else if (item.operation === 'UPDATE') {
						const variantId = item.id
						const result = await fetchData(
							getProductByVariantId,
							{ variantId: variantId },
							localProductController.getProductByVariantId,
							'write'
						)
					}
				}

				if (item.entity === 'LOT') {
					if (item.operation === 'DELETE') {
						await localProductController.deleteLotById(item.id)
					} else if (item.operation === 'UPDATE') {
						const lotId = item.id
						const result = await fetchData(
							getLotById,
							{ lotId: lotId },
							localProductController.getLotById,
							'write'
						)
					}
				}
			}
		},
		[fetchData]
	)

	return {
		handleSync,
	}
}
