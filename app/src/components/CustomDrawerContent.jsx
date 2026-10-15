import { DrawerContentScrollView } from '@react-navigation/drawer'
import { useRouter, usePathname } from 'expo-router'
import {
	View,
	Text,
	TextInput,
	Pressable,
	TouchableOpacity,
	StyleSheet,
} from 'react-native'
import { Ionicons, Feather, AntDesign } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'
import { useLocalization } from '../localization/localizationContext'

export default function CustomDrawerContent(props) {
	const router = useRouter()
	const pathname = usePathname()
	const { logOutUser } = useAuth()
	const { loc } = useLocalization()

	// Helper function to determine if a route is active
	const isActive = (route) => {
		return pathname === route
	}

	const navigateTo = (route) => {
		router.replace(route)
	}

	// Drawer item renderer with icon support
	const renderDrawerItem = (label, route, IconComponent, iconName) => {
		const active = isActive(route)

		return (
			<Pressable
				className={`py-3 px-4 my-0.5 ${active ? 'bg-blue-500 rounded' : ''}`}
				onPress={() => navigateTo(route)}
			>
				<View className="flex-row items-center">
					<IconComponent
						name={iconName}
						size={20}
						color={active ? '#fff' : '#333'}
					/>
					<Text
						className={`ml-2 text-base ${
							active ? 'text-white font-medium' : 'text-gray-800'
						}`}
					>
						{label}
					</Text>
				</View>
			</Pressable>
		)
	}

	return (
		<DrawerContentScrollView {...props} className="flex-1 bg-gray-100">
			{/* Search Bar */}
			{/* <View className="flex-row p-3 items-center">
				<View className="flex-1 flex-row items-center bg-white rounded p-2">
					<Ionicons name="search-outline" size={20} color="#777" />
					<TextInput
						placeholder={loc.t('drawer.search')}
						className="flex-1 h-10 pl-2"
					/>
				</View>
				<Pressable className="bg-blue-500 px-3 py-2 rounded">
					<Text className="text-white font-medium">
						{loc.t('drawer.searchButton')}
					</Text>
				</Pressable>
			</View> */}

			{/* General Section */}
			<View className="mb-4">
				<Text className="text-xs font-medium text-gray-500 mt-2 mb-2 pl-4">
					{loc.t('drawer.general')}
				</Text>
				{renderDrawerItem(
					loc.t('drawer.home'),
					'/home',
					Ionicons,
					'home-outline'
				)}
				{renderDrawerItem(
					loc.t('drawer.manageShops'),
					'/shops',
					Ionicons,
					'grid-outline'
				)}
				{renderDrawerItem(
					loc.t('drawer.recentSales'),
					'/sales',
					Feather,
					'file-text'
				)}
				{/* {renderDrawerItem('Reports', '/reports', Feather, 'bar-chart-2')}
                {renderDrawerItem('Quick Actions', '/quick-actions', Feather, 'zap')} */}
				{renderDrawerItem(
					loc.t('drawer.referralRewards'),
					'/profile/referral-rewards',
					Feather,
					'gift'
				)}

				{renderDrawerItem(
					loc.t('drawer.settings'),
					'/settings',
					Ionicons,
					'settings-outline'
				)}
				{/* {renderDrawerItem(loc.t('kyc.title'), '/kyc', Feather, 'file-text')} */}

				{/* {renderDrawerItem(
					loc.t('drawer.syncProducts'),
					'/sync',
					AntDesign,
					'sync'
				)} */}
			</View>

			{/* Support Section */}
			<View className="mb-4">
				<Text className="text-xs font-medium text-gray-500 mt-2 mb-2 pl-4">
					{loc.t('drawer.support')}
				</Text>

				{renderDrawerItem(
					loc.t('tutorial.title'),
					'/tutorial',
					Feather,
					'book-open'
				)}
				{renderDrawerItem(
					loc.t('drawer.help'),
					'/help',
					Feather,
					'help-circle'
				)}
			</View>

			{/* Logout Section */}
			<View className="mt-auto mb-4 px-4">
				<TouchableOpacity
					style={styles.logoutButton}
					onPress={() => {
						logOutUser()
					}}
				>
					<Feather name="log-out" size={20} color="white" />
					<Text style={styles.logoutText}>{loc.t('drawer.logOut')}</Text>
				</TouchableOpacity>
			</View>
		</DrawerContentScrollView>
	)
}

const styles = StyleSheet.create({
	logoutButton: {
		paddingVertical: 16,
		backgroundColor: '#EF4444',
		borderRadius: 25,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	logoutText: {
		marginLeft: 8,
		color: 'white',
		fontWeight: '500',
		fontSize: 16,
	},
})
