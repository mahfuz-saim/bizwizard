import { useCallback } from 'react'
import { useLocalization } from '../localization/localizationContext.jsx'
import {
	translateNumbers,
	translatePhoneNumber,
	translateCurrency,
	translateDate,
	translateTime,
	convertToEnglishNumbers,
} from '../components/translateNumber.js'

export const useNumberTranslator = () => {
	const { loc } = useLocalization()
	const currentLocale = loc.locale || 'en'

	const translateNumber = useCallback(
		(number) => {
			return translateNumbers(number, currentLocale)
		},
		[currentLocale]
	)

	const translatePhone = useCallback(
		(phoneNumber) => {
			return translatePhoneNumber(phoneNumber, currentLocale)
		},
		[currentLocale]
	)

	const translateAmount = useCallback(
		(amount, options = {}) => {
			return translateCurrency(amount, currentLocale, options)
		},
		[currentLocale]
	)

	const translateDateString = useCallback(
		(date, options = {}) => {
			return translateDate(date, currentLocale, options)
		},
		[currentLocale]
	)

	const translateTimeString = useCallback(
		(time, options = {}) => {
			return translateTime(time, currentLocale, options)
		},
		[currentLocale]
	)

	// New functions for converting to English for backend/receipt purposes
	const toEnglishNumbers = useCallback((input) => {
		return convertToEnglishNumbers(input)
	}, [])

	const prepareForBackend = useCallback((data) => {
		// Fields that should NOT be converted to numbers (UUIDs, IDs, etc.)
		const excludeFromConversion = [
			'buyerID',
			'buyerId',
			'sellerID',
			'sellerId',
			'userID',
			'userId',
			'shopID',
			'shopId',
			'productID',
			'productId',
			'lotId',
			'lotID',
			'variantId',
			'variantID',
			'id',
			'ID',
			'uuid',
			'UUID',
			'transactionId',
			'transactionID',
			'receiptId',
			'receiptID',
			'draftId',
			'draftID',
			'customerId',
			'customerID',
			'supplierId',
			'supplierID',
		]

		if (Array.isArray(data)) {
			// Handle cart data array
			return data.map((item) => ({
				...item,
				quantity:
					parseFloat(
						convertToEnglishNumbers(item.quantity?.toString() || '0')
					) || 0,
				sellPrice:
					parseFloat(
						convertToEnglishNumbers(item.sellPrice?.toString() || '0')
					) || 0,
				unitPrice:
					parseFloat(
						convertToEnglishNumbers(
							item.unitPrice?.toString() || item.sellPrice?.toString() || '0'
						)
					) || 0,
				barcode: convertToEnglishNumbers(item.barcode?.toString() || ''),
			}))
		} else if (typeof data === 'object' && data !== null) {
			// Handle single object
			const result = { ...data }
			Object.keys(result).forEach((key) => {
				// Skip conversion for excluded fields (UUIDs, IDs, etc.)
				if (excludeFromConversion.includes(key)) {
					// Keep the original value as-is
					return
				}

				if (
					typeof result[key] === 'string' ||
					typeof result[key] === 'number'
				) {
					const converted = convertToEnglishNumbers(result[key].toString())
					// Try to parse as number if it looks like a number
					const asNumber = parseFloat(converted)
					result[key] =
						!isNaN(asNumber) && converted.trim() !== '' ? asNumber : converted
				}
			})
			return result
		} else {
			// Handle primitive values (string/number)
			const converted = convertToEnglishNumbers(data?.toString() || '')
			const asNumber = parseFloat(converted)
			return !isNaN(asNumber) && converted.trim() !== '' ? asNumber : converted
		}
	}, [])

	const prepareReceiptData = useCallback(
		(cartData) => {
			return prepareForBackend(cartData)
		},
		[prepareForBackend]
	)

	const prepareReceiptTotal = useCallback((total) => {
		const converted = convertToEnglishNumbers(total?.toString() || '0')
		const parsed = parseFloat(converted)
		return isNaN(parsed) ? 0 : parsed
	}, [])

	return {
		translateNumber,
		translatePhone,
		translateAmount,
		translateDate: translateDateString,
		translateTime: translateTimeString,
		toEnglishNumbers,
		prepareForBackend,
		prepareReceiptData,
		prepareReceiptTotal,
		currentLocale,
	}
}

export default useNumberTranslator
