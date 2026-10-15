import 'react-native-gesture-handler'
import { Drawer } from 'expo-router/drawer'
import { View, TouchableOpacity, Text } from 'react-native'
import Fontisto from '@expo/vector-icons/Fontisto'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import { useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'

export default function DraftLayout() {
	const navigation = useNavigation()
	const { loc } = useLocalization()

	const onToggle = () => {
		navigation.dispatch(DrawerActions.toggleDrawer())
	}
	return (
		<Drawer
			screenOptions={{
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
				headerLeft: () => (
					<TouchableOpacity
						onPress={() => navigation.goBack()}
						className="ml-4"
					>
						<Fontisto name="angle-left" size={22} color="white" />
					</TouchableOpacity>
				),
				headerRight: () => (
					<View className="flex-row items-center mr-5">
						<TouchableOpacity onPress={onToggle}>
							<Fontisto name="nav-icon-a" size={20} color="white" />
						</TouchableOpacity>
					</View>
				),
			}}
		>
			<Drawer.Screen
				name="index"
				options={{
					headerTitle: loc.t('draft.headerTitle'),
				}}
			/>
		</Drawer>
	)
}
