import { Redirect, Stack } from 'expo-router'
import '../../global.css'
import { useAuth } from '../../src/context/AuthContext'

export default function AppLayout() {
	const { authState } = useAuth()
	if (!authState.authenticated) {
		return <Redirect href="/login"></Redirect>
	}
	return (
		<Stack>
			<Stack.Screen
				name="(tabs)"
				options={{ headerShown: false }}
			></Stack.Screen>
			<Stack.Screen
				name="(shared)"
				options={{ headerShown: false }}
			></Stack.Screen>
		</Stack>
	)
}
