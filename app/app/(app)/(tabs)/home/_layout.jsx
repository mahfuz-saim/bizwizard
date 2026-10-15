import 'react-native-gesture-handler'
import { Drawer } from 'expo-router/drawer'
import CustomDrawerContent from '../../../../src/components/CustomDrawerContent'
import { useAuth } from '../../../../src/context/AuthContext'
import { router, useFocusEffect, usePathname } from 'expo-router'
import { useCallback, useMemo } from 'react'

export default function HomeLayout() {
	const { authState } = useAuth()
	const path = usePathname()

	// Memoize screen options for better performance
	const screenOptions = useMemo(
		() => ({
			headerShown: false,
		}),
		[]
	)

	// Defer subscription check to not block initial render
	useFocusEffect(
		useCallback(() => {
			const isSubscriptionPage =
				path === '/home/subscriptionBuy' ||
				path === '/home/subscriptionBuy/PaymentPage'

			if (authState?.isSubscriptionValid === false && !isSubscriptionPage) {
				router.replace('/home/subscriptionBuy')
			}
		}, [authState?.isSubscriptionValid, path])
	)

	return (
		<Drawer drawerContent={(props) => <CustomDrawerContent {...props} />}>
			<Drawer.Screen name="(dashboard)" options={screenOptions} />
			<Drawer.Screen name="inventory" options={screenOptions} />
			<Drawer.Screen name="transactions" options={screenOptions} />
			<Drawer.Screen name="calculator" options={screenOptions} />
			<Drawer.Screen name="customer" options={screenOptions} />
			<Drawer.Screen name="employee" options={screenOptions} />
			<Drawer.Screen name="pickup" options={screenOptions} />
			<Drawer.Screen name="draft" options={screenOptions} />
			<Drawer.Screen name="supplier" options={screenOptions} />
			<Drawer.Screen name="debt" options={screenOptions} />
			<Drawer.Screen name="message" options={screenOptions} />
			<Drawer.Screen name="report" options={screenOptions} />
			<Drawer.Screen name="expense" options={screenOptions} />
			<Drawer.Screen name="subscriptionBuy" options={screenOptions} />
		</Drawer>
	)
}
