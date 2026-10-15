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

export default function MessageLayout() {
	const navigation = useNavigation()
	const { loc } = useLocalization()
	const [showHelpModal, setShowHelpModal] = useState(false)
	const messageTutorialUrl = 'https://www.youtube.com/watch?v=_vshs3L84c4'

	const onToggle = () => {
		navigation.dispatch(DrawerActions.toggleDrawer())
	}

	const handleHelpPress = () => {
		setShowHelpModal(true)
	}

	const handleHelpConfirm = () => {
		setShowHelpModal(false)
		Linking.openURL(messageTutorialUrl)
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
					name="index"
					options={{
						headerTitle: loc.t('message.headerTitle'),
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
									onPress={handleHelpPress}
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
					name="history"
					options={{
						headerTitle: loc.t('message.history.headerTitle'),
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
					name="credit"
					options={{
						headerTitle: loc.t('credit.headerTitle'),
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
					name="paymentPage"
					options={{
						headerTitle: loc.t('subscriptionBuy.PaymentPage.headerTitle'),
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
			</Drawer>
			<HelpModal
				visible={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				onConfirm={handleHelpConfirm}
			/>
		</>
	)
}
