import { Stack } from 'expo-router'

export default function SharedLayout() {
	return (
		<Stack>
			<Stack.Screen name="index" options={{ headerShown: false }} />
			<Stack.Screen name="addShop" options={{ headerShown: false }} />
			<Stack.Screen name="editShop" options={{ headerShown: false }} />
			<Stack.Screen name="joinShop" options={{ headerShown: false }} />
			<Stack.Screen name="waitForJoining" options={{ headerShown: false }} />
		</Stack>
	)
}
