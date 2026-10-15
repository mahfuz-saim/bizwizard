import {
	convertToEnglishNumbers,
	convertToBengaliNumbers,
} from '../components/translateNumber'

export const displayLocalizedNumber = (value) => {
	if (!value && value !== 0) return ''
	return convertToBengaliNumbers(value.toString())
}

export const handleNumericInput = (value, setFieldValue, fieldName) => {
	const englishValue = convertToEnglishNumbers(value)
	setFieldValue(fieldName, englishValue)
}

// For lowStock-style fields that should be integer digits only
export const handleDigitsOnly = (value, setFieldValue, fieldName) => {
	const englishValue = convertToEnglishNumbers(value)
	const numericValue = englishValue.replace(/[^0-9]/g, '')
	setFieldValue(fieldName, numericValue)
}
