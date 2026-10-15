// @dead-code — 2026-09-24 knip+grep: 0 active imports, candidate for removal (kept per request)
import { NativeModules } from 'react-native'

const { WidgetModule } = NativeModules

export const useWidget = () => {
	const updateWidget = async () => {
		try {
			if (WidgetModule) {
				const result = await WidgetModule.updateWidget()
				console.log('Widget update result:', result)
				return result
			} else {
				console.log('WidgetModule not available')
				return null
			}
		} catch (error) {
			console.error('Error updating widget:', error)
			throw error
		}
	}

	const isWidgetSupported = async () => {
		try {
			if (WidgetModule) {
				return await WidgetModule.isWidgetSupported()
			}
			return false
		} catch (error) {
			console.error('Error checking widget support:', error)
			return false
		}
	}

	return {
		updateWidget,
		isWidgetSupported,
	}
}

export default useWidget
