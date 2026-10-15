import React, { createContext, useContext, useState } from 'react'
import { I18n } from 'i18n-js'
import languages from './translations'
import * as SecureStore from 'expo-secure-store'

const LANG_KEY = 'app_language'
const LANGUAGES = {
	english: 'en',
	bangla: 'bn',
}

const LocalizationContext = createContext()

export const useLocalization = () => useContext(LocalizationContext)

export const LocalizationProvider = ({ children }) => {
	const prevLang = SecureStore.getItem(LANG_KEY)

	const [locale, setLocale] = useState(
		prevLang === 'en' ? LANGUAGES.english : LANGUAGES.bangla
	) // Default language is Bangla
	// Memoize the I18n instance so it doesn't get recreated on every render
	const locRef = React.useRef(null)
	if (!locRef.current) {
		locRef.current = new I18n(languages)
		locRef.current.enableFallback = true
	}
	// Always update the locale property, but keep the same object reference
	locRef.current.locale = locale

	const changeLocale = async (newLocale) => {
		await SecureStore.setItem(LANG_KEY, newLocale)
		setLocale(newLocale)
	}

	return (
		<LocalizationContext.Provider
			value={{ loc: locRef.current, changeLocale, currentLocale: locale }}
		>
			{children}
		</LocalizationContext.Provider>
	)
}
