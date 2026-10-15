import React, { useState, useRef, useEffect } from 'react'
import {
	View,
	Text,
	Image,
	TouchableOpacity,
	TextInput,
	KeyboardAvoidingView,
	Platform,
	StatusBar,
	Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import useApi from '../../../../src/hooks/useApi'
import { joinShopRequest } from '../../../../src/controllers/employee'
import { useLocalization } from '../../../../src/localization/localizationContext'
import { statusBarColor, barStyleMode } from '../../../../src/constants'

const joinShop = () => {
	const navigation = useNavigation()
	const [shopId, setShopId] = useState(['', '', '', '', '', ''])
	const [isKeyboardVisible, setKeyboardVisible] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const inputRefs = useRef([])
	const { fetchData } = useApi()
	const { loc } = useLocalization()

	useEffect(() => {
		const keyboardDidShowListener = Keyboard.addListener(
			'keyboardDidShow',
			() => {
				setKeyboardVisible(true)
			}
		)
		const keyboardDidHideListener = Keyboard.addListener(
			'keyboardDidHide',
			() => {
				setKeyboardVisible(false)
			}
		)

		return () => {
			keyboardDidShowListener.remove()
			keyboardDidHideListener.remove()
		}
	}, [])

	const handleShopIdChange = (text, index) => {
		// Allow only alphanumeric characters
		const alphanumericText = text

		const newShopId = [...shopId]
		newShopId[index] = alphanumericText
		setShopId(newShopId)

		// Move to next input if current input is filled
		if (text.length !== 0 && index < 5) {
			inputRefs.current[index + 1].focus()
		}
	}

	const handleKeyPress = ({ nativeEvent }, index) => {
		if (nativeEvent.key === 'Backspace' && shopId[index] === '' && index > 0) {
			inputRefs.current[index - 1].focus()
		}
	}

	const handleJoinShop = async () => {
		const fullShopId = shopId.join('')

		if (fullShopId.length === 6) {
			setIsLoading(true)

			try {
				const params = {
					shopId: fullShopId,
				}

				const response = await fetchData(joinShopRequest, params)

				// If join shop request is successful, navigate to waiting screen
				navigation.navigate('waitForJoining', { shopId: fullShopId })
			} catch (error) {
				console.error('🚨 Error joining shop:', error)
				// Handle error here
			} finally {
				setIsLoading(false)
			}
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

					<View style={{ height: isKeyboardVisible ? 8 : 64 }} />

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
						<View className="w-full">
							{!isKeyboardVisible && (
								<>
									<Text className="text-2xl font-medium text-gray-700 text-center">
										{loc.t('joinShop.title')}
									</Text>
									<Text className="text-gray-500 text-center my-4">
										{loc.t('joinShop.enterShopId')}
									</Text>
								</>
							)}

							<View className="flex-row justify-center space-x-3 my-6">
								{[0, 1, 2, 3, 4, 5].map((index) => (
									<View key={`shopid-container-${index}`} className="w-10">
										<TextInput
											key={`shopid-${index}`}
											ref={(ref) => (inputRefs.current[index] = ref)}
											value={shopId[index]}
											onChangeText={(text) => handleShopIdChange(text, index)}
											onKeyPress={(e) => handleKeyPress(e, index)}
											keyboardType="default"
											autoCapitalize="characters"
											maxLength={1}
											className="w-10 h-12 text-center text-xl font-medium"
											autoFocus={index === 0}
										/>
										<View className="h-0.5 bg-gray-300 w-8 mx-auto mt-1" />
									</View>
								))}
							</View>

							<TouchableOpacity
								onPress={handleJoinShop}
								disabled={shopId.join('').length < 6 || isLoading}
								className={`w-full p-4 rounded-full mt-8 ${
									shopId.join('').length === 6 && !isLoading
										? 'bg-[#195FE1]'
										: 'bg-[#A6BDF7]'
								}`}
							>
								<Text className="text-white text-center text-lg font-medium">
									{isLoading
										? loc.t('joinShop.requesting')
										: loc.t('joinShop.requestToJoin')}
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

export default joinShop
