import 'react-native-gesture-handler'
import { Drawer } from 'expo-router/drawer'
import { View, TouchableOpacity, Text, InteractionManager } from 'react-native'
import Fontisto from '@expo/vector-icons/Fontisto'
import { useLocalization } from '../../../../src/localization/localizationContext'
import CustomDrawerContent from '../../../../src/components/CustomDrawerContent'
import { DrawerActions } from '@react-navigation/native'
import { useAuth } from '../../../../src/context/AuthContext'
import { router, useFocusEffect } from 'expo-router'
import { useMemo, useCallback } from 'react'

export default function SalesLayout() {
	const { loc } = useLocalization()
	const { authState } = useAuth()

	// Memoize header components for better performance
	const headerStyle = useMemo(
		() => ({
			backgroundColor: '#195FE1',
			borderBottomWidth: 1,
			borderBottomColor: '#E1E1E120',
		}),
		[]
	)

	const HeaderTitle = useMemo(
		() =>
			({ children }) => (
				<Text className="text-lg font-semibold text-white text-center">
					{children}
				</Text>
			),
		[]
	)

	// Memoize navigation handlers
	const handleGoBack = useCallback((navigation) => {
		navigation.goBack()
	}, [])

	const handleToggleDrawer = useCallback((navigation) => {
		navigation.dispatch(DrawerActions.toggleDrawer())
	}, [])

	// Defer subscription check to not block initial render
	useFocusEffect(
		useCallback(() => {
			if (authState?.isSubscriptionValid === false) {
				InteractionManager.runAfterInteractions(() => {
					router.replace('/home/subscriptionBuy')
				})
			}
		}, [authState?.isSubscriptionValid])
	)

	return (
		<Drawer
			drawerContent={(props) => <CustomDrawerContent {...props} />}
			screenOptions={({ navigation: drawerNavigation }) => ({
				headerStyle,
				headerTintColor: 'white',
				headerTitleAlign: 'center',
				headerTitle: HeaderTitle,
			})}
		>
			<Drawer.Screen
				name="index"
				options={({ navigation: drawerNavigation }) => ({
					headerTitle: loc.t('tabs.notes'),
					headerLeft: () => (
						<TouchableOpacity
							onPress={() => handleGoBack(drawerNavigation)}
							className="ml-4"
						>
							<Fontisto name="angle-left" size={22} color="white" />
						</TouchableOpacity>
					),
					headerRight: () => (
						<View className="flex-row items-center mr-5">
							<TouchableOpacity
								onPress={() => handleToggleDrawer(drawerNavigation)}
							>
								<Fontisto name="nav-icon-a" size={20} color="white" />
							</TouchableOpacity>
						</View>
					),
				})}
			/>
		</Drawer>
	)
}
