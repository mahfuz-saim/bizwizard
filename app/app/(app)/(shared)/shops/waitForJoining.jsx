import React, { useState } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	KeyboardAvoidingView,
	Platform,
	StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRoute, useNavigation } from '@react-navigation/native'
import { useLocalization } from '../../../../src/localization/localizationContext'
import { statusBarColor, barStyleMode } from '../../../../src/constants'

const waitForJoining = () => {
	const route = useRoute()
	const navigation = useNavigation()
	const { shopId } = route.params || {}
	const [isRefreshing, setIsRefreshing] = useState(false)
	const { loc } = useLocalization()

	const handleRefresh = async () => {
		setIsRefreshing(true)

		try {
			// TODO: Implement checking shop join request status
			// This will be implemented later as mentioned in requirements
		} catch (error) {
			console.error('🚨 Error checking join status:', error)
		} finally {
			setIsRefreshing(false)
		}
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			className="flex-1"
		>
			<SafeAreaView className="flex-1 bg-[#F0F8FF]">
				<View className="flex-1 px-6 justify-between">
					<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />

					<View className="h-16" />

					<View className="items-center">
						<Image
							source={require('../../../../assets/bebsapati-logo.png')}
							style={{
								width: 225,
								height: 150,
							}}
							resizeMode="contain"
						/>
					</View>

					<View className="items-center justify-center flex-1">
						<View className="w-full items-center">
							<Text className="text-2xl font-medium text-gray-700 text-center">
								{loc.t('shop.waitingForApproval')}
							</Text>

							<Text className="text-gray-500 text-center my-6 px-4">
								{loc.t('shop.joinRequestSent')} {shopId}
							</Text>

							<Image
								source={require('../../../../assets/waiting-illustration.png')}
								style={{
									width: 180,
									height: 180,
								}}
								resizeMode="contain"
							/>

							<Text className="text-gray-500 text-center my-6 px-4">
								{loc.t('shop.shopOwnerApproval')}
							</Text>

							<TouchableOpacity
								onPress={handleRefresh}
								disabled={isRefreshing}
								className="w-full p-4 rounded-full mt-8 bg-[#195FE1]"
							>
								<Text className="text-white text-center text-lg font-medium">
									{isRefreshing
										? loc.t('common.refreshing')
										: loc.t('common.refresh')}
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={() => navigation.navigate('joinShop', {})}
								className="mt-4"
							>
								<Text className="text-[#195FE1] text-center">
									{loc.t('shop.tryAnotherShop')}
								</Text>
							</TouchableOpacity>
						</View>
					</View>

					<View className="h-16" />
				</View>
			</SafeAreaView>
		</KeyboardAvoidingView>
	)
}

export default waitForJoining
