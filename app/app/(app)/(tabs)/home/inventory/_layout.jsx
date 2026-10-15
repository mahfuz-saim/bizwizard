import 'react-native-gesture-handler'
import { Drawer } from 'expo-router/drawer'
import { View, TouchableOpacity, Text, Linking } from 'react-native'
import { useState } from 'react'
import Fontisto from '@expo/vector-icons/Fontisto'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import CustomDrawerContent from '../../../../../src/components/CustomDrawerContent'
import { useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { HelpModal } from '../../../../../src/components/AlertModal'

export default function InvenotryLayout() {
	const navigation = useNavigation()
	const { loc } = useLocalization()
	const [showAddHelpModal, setShowAddHelpModal] = useState(false)
	const [showDetailsHelpModal, setShowDetailsHelpModal] = useState(false)
	const inventoryAddTutorialUrl =
		'https://www.youtube.com/watch?v=e8DmSiegOcA-k'
	const inventoryDetailsTutorialUrl =
		'https://www.youtube.com/watch?v=nMn24zKrm-k'

	const onToggle = () => {
		navigation.dispatch(DrawerActions.toggleDrawer())
	}

	const handleAddHelpPress = () => {
		setShowAddHelpModal(true)
	}

	const handleAddHelpConfirm = () => {
		setShowAddHelpModal(false)
		Linking.openURL(inventoryAddTutorialUrl)
	}

	const handleDetailsHelpPress = () => {
		setShowDetailsHelpModal(true)
	}

	const handleDetailsHelpConfirm = () => {
		setShowDetailsHelpModal(false)
		Linking.openURL(inventoryDetailsTutorialUrl)
	}

	return (
		<>
			<Drawer
				drawerContent={(props) => <CustomDrawerContent {...props} />}
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
				}}
			>
				<Drawer.Screen
					name="details"
					options={{
						headerTitle: loc.t('inventory.details.headerTitle'),
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
								<TouchableOpacity
									onPress={handleDetailsHelpPress}
									style={{ marginHorizontal: 20 }}
								>
									<Fontisto name="question" size={20} color="white" />
								</TouchableOpacity>
								<TouchableOpacity onPress={onToggle}>
									<Fontisto name="nav-icon-a" size={20} color="white" />
								</TouchableOpacity>
							</View>
						),
					}}
				/>
				<Drawer.Screen
					name="ProductUpdateForm"
					options={{
						headerTitle: loc.t('quantityUpdate.headerTitle'),
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
				/>
				<Drawer.Screen
					name="add"
					options={{
						headerTitle: loc.t('inventory.add.headerTitle'),
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
								<TouchableOpacity
									onPress={handleAddHelpPress}
									style={{ marginHorizontal: 20 }}
								>
									<Fontisto name="question" size={20} color="white" />
								</TouchableOpacity>
								<TouchableOpacity onPress={onToggle}>
									<Fontisto name="nav-icon-a" size={20} color="white" />
								</TouchableOpacity>
							</View>
						),
					}}
				/>
			</Drawer>
			<HelpModal
				visible={showAddHelpModal}
				onClose={() => setShowAddHelpModal(false)}
				onConfirm={handleAddHelpConfirm}
			/>
			<HelpModal
				visible={showDetailsHelpModal}
				onClose={() => setShowDetailsHelpModal(false)}
				onConfirm={handleDetailsHelpConfirm}
			/>
		</>
	)
}
