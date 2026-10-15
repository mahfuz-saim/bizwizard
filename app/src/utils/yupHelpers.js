// @dead-code tag not needed — this file is shared helper for Yup transforms
// Ponytail ladder: stdlib reuse — centralize repeated number transform
export const numberTransform =
	(toEnglishNumbers, fallback) => (value, originalValue) => {
		if (
			originalValue === '' ||
			originalValue === null ||
			originalValue === undefined
		)
			return fallback
		const englishValue = toEnglishNumbers(String(originalValue))
		const parsed = parseFloat(englishValue)
		return isNaN(parsed) ? undefined : parsed
	}

export const intTransform = (toEnglishNumbers, fallback) =>
	numberTransform(toEnglishNumbers, fallback)
