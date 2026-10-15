import 'react-native-gesture-handler'
import { Drawer } from 'expo-router/drawer'
import { View, TouchableOpacity, Text } from 'react-native'
import Fontisto from '@expo/vector-icons/Fontisto'
import { useLocalization } from '../../../../src/localization/localizationContext'
import CustomDrawerContent from '../../../../src/components/CustomDrawerContent'
import { DrawerActions } from '@react-navigation/native'
import { router } from 'expo-router'

export default function SyncLayout() {
	const { loc } = useLocalization()

	return (
		<Drawer
			drawerContent={(props) => <CustomDrawerContent {...props} />}
			screenOptions={({ navigation: drawerNavigation }) => ({
				headerStyle: {
					backgroundColor: '#195FE1',
					borderBottomWidth: 1,
					borderBottomColor: '#E1E1E120',
				},
				headerTintColor: 'white',
				headerTitleAlign: 'center',
				headerTitle: ({ children }) => (
					<Text className="text-lg font-semibold text-white text-center">
						{children}
					</Text>
				),
			})}
		>
			<Drawer.Screen
				name="index"
				options={({ navigation: drawerNavigation }) => ({
					headerTitle: loc?.t('sync.headerTitle') || 'Sync',
					headerLeft: () => (
						<TouchableOpacity
							onPress={() => router.replace('/home')}
							className="ml-4"
						>
							<Fontisto name="angle-left" size={22} color="white" />
						</TouchableOpacity>
					),
					headerRight: () => (
						<View className="flex-row items-center mr-5">
							<TouchableOpacity
								onPress={() =>
									drawerNavigation.dispatch(DrawerActions.toggleDrawer())
								}
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
