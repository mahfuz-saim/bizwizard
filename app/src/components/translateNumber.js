/**
 * Number Translator Utility
 * Converts English numbers to Bengali numbers based on locale
 */

// Mapping of English digits to Bengali digits
const englishToBengaliMap = {
	0: '০',
	1: '১',
	2: '২',
	3: '৩',
	4: '৪',
	5: '৫',
	6: '৬',
	7: '৭',
	8: '৮',
	9: '৯',
}

// Mapping of Bengali digits to English digits (for reverse conversion if needed)
const bengaliToEnglishMap = {
	'০': '0',
	'১': '1',
	'২': '2',
	'৩': '3',
	'৪': '4',
	'৫': '5',
	'৬': '6',
	'৭': '7',
	'৮': '8',
	'৯': '9',
}

/**
 * Converts English numbers to Bengali numbers
 * @param {string|number} input - The input containing numbers to convert
 * @returns {string} - String with Bengali numbers
 */
export const convertToBengaliNumbers = (input) => {
	if (input === null || input === undefined) {
		return ''
	}

	const stringInput = String(input)

	return stringInput.replace(/[0-9]/g, (digit) => {
		return englishToBengaliMap[digit] || digit
	})
}

/**
 * Converts Bengali numbers to English numbers
 * @param {string} input - The input containing Bengali numbers to convert
 * @returns {string} - String with English numbers
 */
export const convertToEnglishNumbers = (input) => {
	if (input === null || input === undefined) {
		return ''
	}

	const stringInput = String(input)

	return stringInput.replace(/[০-৯]/g, (digit) => {
		return bengaliToEnglishMap[digit] || digit
	})
}

/**
 * Translates numbers based on current locale
 * @param {string|number} input - The input containing numbers
 * @param {string} locale - Current locale ('bn' for Bengali, 'en' for English)
 * @returns {string} - Translated string
 */
export const translateNumbers = (input, locale) => {
	if (input === null || input === undefined) {
		return ''
	}

	// If locale is Bengali ('bn'), convert to Bengali numbers
	if (locale === 'bn' || locale === 'bengali' || locale === 'bangla') {
		return convertToBengaliNumbers(input)
	}

	// For English or any other locale, return as is (numbers should already be in English)
	return String(input)
}

/**
 * Formats and translates phone numbers
 * @param {string} phoneNumber - Phone number to format
 * @param {string} locale - Current locale
 * @returns {string} - Formatted and translated phone number
 */
export const translatePhoneNumber = (phoneNumber, locale) => {
	if (!phoneNumber) {
		return ''
	}

	// Clean the phone number (remove any non-digit characters except +)
	const cleanNumber = String(phoneNumber).replace(/[^\d+]/g, '')

	return translateNumbers(cleanNumber, locale)
}

/**
 * Formats and translates currency amounts
 * @param {number|string} amount - Amount to format
 * @param {string} locale - Current locale
 * @param {object} options - Formatting options
 * @returns {string} - Formatted and translated currency
 */
export const translateCurrency = (amount, locale, options = {}) => {
	if (amount === null || amount === undefined) {
		return translateNumbers('0', locale)
	}

	const {
		showCurrency = true,
		currencySymbol = '৳',
		decimalPlaces = 2,
		useCommas = true,
	} = options

	let formattedAmount = Number(amount).toFixed(decimalPlaces)

	// Add commas for thousands separator if requested
	if (useCommas) {
		formattedAmount = formattedAmount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	}

	// Translate numbers based on locale
	const translatedAmount = translateNumbers(formattedAmount, locale)

	// Add currency symbol if requested
	if (showCurrency) {
		return `${currencySymbol} ${translatedAmount}`
	}

	return translatedAmount
}

/**
 * Formats and translates date numbers
 * @param {Date|string} date - Date to format
 * @param {string} locale - Current locale
 * @param {object} options - Formatting options
 * @returns {string} - Formatted and translated date
 */
export const translateDate = (date, locale, options = {}) => {
	if (!date) {
		return ''
	}

	const { format = 'DD/MM/YYYY', separator = '/' } = options

	const dateObj = new Date(date)

	if (isNaN(dateObj.getTime())) {
		return ''
	}

	const day = String(dateObj.getDate()).padStart(2, '0')
	const month = String(dateObj.getMonth() + 1).padStart(2, '0')
	const year = String(dateObj.getFullYear())

	let formattedDate
	switch (format.toLowerCase()) {
		case 'dd/mm/yyyy':
			formattedDate = `${day}${separator}${month}${separator}${year}`
			break
		case 'mm/dd/yyyy':
			formattedDate = `${month}${separator}${day}${separator}${year}`
			break
		case 'yyyy/mm/dd':
			formattedDate = `${year}${separator}${month}${separator}${day}`
			break
		default:
			formattedDate = `${day}${separator}${month}${separator}${year}`
	}

	return translateNumbers(formattedDate, locale)
}

/**
 * Formats and translates time
 * @param {Date|string} time - Time to format
 * @param {string} locale - Current locale
 * @param {object} options - Formatting options
 * @returns {string} - Formatted and translated time
 */
export const translateTime = (time, locale, options = {}) => {
	if (!time) {
		return ''
	}

	const { format24Hour = false, showSeconds = false } = options

	const timeObj = new Date(time)

	if (isNaN(timeObj.getTime())) {
		return ''
	}

	let hours = timeObj.getHours()
	const minutes = String(timeObj.getMinutes()).padStart(2, '0')
	const seconds = String(timeObj.getSeconds()).padStart(2, '0')

	let formattedTime
	let ampm = ''

	if (format24Hour) {
		formattedTime = `${String(hours).padStart(2, '0')}:${minutes}`
	} else {
		ampm = hours >= 12 ? ' PM' : ' AM'
		hours = hours % 12
		hours = hours ? hours : 12 // 0 should be 12
		formattedTime = `${hours}:${minutes}`
	}

	if (showSeconds) {
		formattedTime += `:${seconds}`
	}

	formattedTime += ampm

	return translateNumbers(formattedTime, locale)
}

/**
 * Utility function to check if a string contains Bengali numbers
 * @param {string} input - Input string to check
 * @returns {boolean} - True if contains Bengali numbers
 */
export const containsBengaliNumbers = (input) => {
	if (!input) return false
	return /[০-৯]/.test(String(input))
}

/**
 * Utility function to check if a string contains English numbers
 * @param {string} input - Input string to check
 * @returns {boolean} - True if contains English numbers
 */
export const containsEnglishNumbers = (input) => {
	if (!input) return false
	return /[0-9]/.test(String(input))
}

/**
 * Default export object with all functions
 */
export default {
	convertToBengaliNumbers,
	convertToEnglishNumbers,
	translateNumbers,
	translatePhoneNumber,
	translateCurrency,
	translateDate,
	translateTime,
	containsBengaliNumbers,
	containsEnglishNumbers,
}
