import { Stack } from 'expo-router'
import { useLocalization } from '../../../src/localization/localizationContext'

export default function SharedLayout() {
	return (
		<Stack>
			<Stack.Screen name="shops" options={{ headerShown: false }} />
			<Stack.Screen name="settings" options={{ headerShown: false }} />
			<Stack.Screen name="help" options={{ headerShown: false }} />
			<Stack.Screen name="notification" options={{ headerShown: false }} />
			<Stack.Screen name="sync" options={{ headerShown: false }} />
			<Stack.Screen name="kyc" options={{ headerShown: false }} />
			<Stack.Screen name="tutorial" options={{ headerShown: false }} />
		</Stack>
	)
}
