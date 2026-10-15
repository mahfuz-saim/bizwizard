import {
	Text,
	TouchableOpacity,
	View,
	ScrollView,
	StatusBar,
	StyleSheet,
	Linking,
	ToastAndroid,
	Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { BackHandler } from 'react-native'
import { useLocalization } from '../../../../src/localization/localizationContext'
import { statusBarColor, barStyleMode } from '../../../../src/constants'

export default function HelpSupportScreen() {
	const { loc } = useLocalization()
	const router = useRouter()

	const supportOptions = [
		{
			id: 'call',
			name: loc.t('help.callNow'),
			description: loc.t('help.callDescription'),
			icon: require('../../../../assets/helpIcons/call.png'),
			action: () => handleCall(),
			backgroundColor: 'rgba(59, 130, 246, 0.1)',
			borderColor: 'rgba(59, 130, 246, 0.2)',
		},
		{
			id: 'whatsapp',
			name: loc.t('help.whatsApp'),
			description: loc.t('help.whatsAppDescription'),
			icon: require('../../../../assets/helpIcons/whatsapp.png'),
			action: () => handleWhatsApp(),
			backgroundColor: 'rgba(59, 130, 246, 0.1)', // blue
			borderColor: 'rgba(59, 130, 246, 0.2)',
		},
		{
			id: 'messenger',
			name: loc.t('help.facebookMessenger'),
			description: loc.t('help.messengerDescription'),
			icon: require('../../../../assets/helpIcons/messenger.png'),
			action: () => handleMessenger(),
			backgroundColor: 'rgba(59, 130, 246, 0.1)', // blue
			borderColor: 'rgba(59, 130, 246, 0.2)',
		},
	]

	// const aiAssistantOptions = [
	// 	{
	// 		id: 'chatbot',
	// 		name: loc.t('help.chatBot') || 'AI Chat Assistant',
	// 		description:
	// 			loc.t('help.chatBotDescription') ||
	// 			'Get instant help from our AI assistant',
	// 		icon: '🤖',
	// 		action: () => handleChatBot(),
	// 		backgroundColor: 'rgba(99, 102, 241, 0.1)', // indigo
	// 		borderColor: 'rgba(99, 102, 241, 0.2)',
	// 	},
	// ]

	// Handle Android back button
	useEffect(() => {
		const backAction = () => {
			router.push('/home')
			return true
		}

		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			backAction
		)

		return () => backHandler.remove()
	}, [router])

	const handleCall = async () => {
		const phoneNumber = '+8801897601120'
		const url = `tel:${phoneNumber}`

		try {
			const supported = await Linking.canOpenURL(url)
			if (supported) {
				await Linking.openURL(url)
			} else {
				ToastAndroid.show(
					loc.t('help.phoneNotAvailable') || 'Phone app not available',
					ToastAndroid.LONG
				)
			}
		} catch (error) {
			ToastAndroid.show(
				loc.t('help.unableToCall') || 'Unable to make call',
				ToastAndroid.LONG
			)
		}
	}

	const handleWhatsApp = async () => {
		const phoneNumber = '+8801897601120'
		const url = `whatsapp://send?phone=${phoneNumber}`

		try {
			const supported = await Linking.canOpenURL(url)
			if (supported) {
				await Linking.openURL(url)
			} else {
				// Fallback to web WhatsApp
				const webUrl = `https://wa.me/${phoneNumber}`
				await Linking.openURL(webUrl)
			}
		} catch (error) {
			ToastAndroid.show(
				loc.t('help.unableToOpenWhatsApp') || 'Unable to open WhatsApp',
				ToastAndroid.LONG
			)
		}
	}

	const handleMessenger = async () => {
		const messengerUrl = 'https://m.me/bebsapati0'

		try {
			const supported = await Linking.canOpenURL(messengerUrl)
			if (supported) {
				await Linking.openURL(messengerUrl)
			} else {
				ToastAndroid.show(
					loc.t('help.unableToOpenMessenger') || 'Unable to open Messenger',
					ToastAndroid.LONG
				)
			}
		} catch (error) {
			ToastAndroid.show(
				loc.t('help.unableToOpenMessenger') || 'Unable to open Messenger',
				ToastAndroid.LONG
			)
		}
	}

	const renderSupportCard = (options) => (
		<View style={styles.supportSection}>
			{/* <View style={styles.headerContainer}>
				<View style={styles.titleContainer}>
					<Text style={styles.title}>{title}</Text>
				</View>
			</View> */}

			<View style={styles.supportCard}>
				{options.map((option, index) => (
					<TouchableOpacity
						key={option.id}
						onPress={option.action}
						style={[
							styles.supportItem,
							index !== options.length - 1 && styles.supportItemBorder,
							{
								backgroundColor: option.backgroundColor,
							},
						]}
						activeOpacity={0.65}
					>
						{/* Subtle gradient overlay */}
						<View
							style={[
								styles.activeOverlay,
								{ backgroundColor: option.borderColor },
							]}
						/>

						<View style={styles.supportContent}>
							<View style={styles.iconContainer}>
								<Image source={option.icon} style={styles.iconImage} />
							</View>
							<View style={styles.textContainer}>
								<Text style={styles.optionName}>{option.name}</Text>
								<Text style={styles.optionDescription}>
									{option.description}
								</Text>
							</View>
							<View style={styles.arrowContainer}>
								<Text style={styles.arrow}>→</Text>
							</View>
						</View>
					</TouchableOpacity>
				))}
			</View>
		</View>
	)

	return (
		<ScrollView style={styles.container}>
			<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />

			{/* Support Content */}
			<View style={styles.content}>
				{/* Contact Support Section */}
				{renderSupportCard(supportOptions)}
				{/* {loc.t('help.contactSupport')} */}
				{/* AI Assistant Section */}
				{/* {renderSupportCard(
					aiAssistantOptions,
					loc.t('help.aiAssistant') || 'AI Assistant'
				)} */}
			</View>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F0F8FF', // bg-bgColor equivalent
	},
	header: {
		paddingHorizontal: 24,
		paddingTop: 32,
		paddingBottom: 16,
		backgroundColor: '#ffffff',
		borderBottomWidth: 1,
		borderBottomColor: '#f1f5f9',
	},
	headerTitle: {
		fontSize: 28,
		fontWeight: 'bold',
		color: '#111827',
		marginBottom: 8,
	},
	headerSubtitle: {
		fontSize: 16,
		color: '#6b7280',
		fontWeight: '500',
	},
	content: {
		paddingHorizontal: 24, // px-6
		paddingBottom: 24, // pb-6
		paddingTop: 24,
	},
	supportSection: {
		marginBottom: 32, // mb-8
	},
	headerContainer: {
		marginBottom: 16, // mb-4
	},
	titleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 8, // mb-2
	},
	title: {
		fontSize: 20, // text-xl
		fontWeight: 'bold',
		color: '#111827', // text-gray-900
	},
	supportCard: {
		backgroundColor: '#ffffff',
		borderRadius: 16, // rounded-2xl
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 4,
		},
		shadowOpacity: 0.1,
		shadowRadius: 12,
		elevation: 8, // shadow-lg
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.5)', // border-white/50
		overflow: 'hidden',
	},
	supportItem: {
		paddingHorizontal: 20, // px-5
		paddingVertical: 20, // py-5
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		position: 'relative',
		overflow: 'hidden',
	},
	supportItemBorder: {
		borderBottomWidth: 1,
		borderBottomColor: '#f9fafb', // border-gray-50
	},
	activeOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		opacity: 0.1,
	},
	supportContent: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
		zIndex: 10,
	},
	iconContainer: {
		width: 48, // w-12
		height: 48, // h-12
		borderRadius: 12, // rounded-xl
		backgroundColor: '#f3f4f6', // bg-gray-100
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 16, // mr-4
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 2, // shadow-sm
	},
	iconImage: {
		width: 28,
		height: 28,
		resizeMode: 'contain',
	},
	icon: {
		fontSize: 24, // text-2xl
	},
	textContainer: {
		flex: 1,
	},
	optionName: {
		fontSize: 16, // text-base
		fontWeight: '600', // font-semibold
		color: '#111827', // text-gray-900
		marginBottom: 4, // mb-1
	},
	optionDescription: {
		fontSize: 14, // text-sm
		color: '#6b7280', // text-gray-500
		fontWeight: '500', // font-medium
	},
	arrowContainer: {
		marginLeft: 12,
	},
	arrow: {
		fontSize: 18,
		color: '#9ca3af',
		fontWeight: 'bold',
	},
	infoSection: {
		marginTop: 16,
	},
	infoCard: {
		backgroundColor: '#ffffff',
		borderRadius: 12,
		padding: 20,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.05,
		shadowRadius: 8,
		elevation: 4,
		borderWidth: 1,
		borderColor: '#f1f5f9',
	},
	infoTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#111827',
		marginBottom: 12,
	},
	infoText: {
		fontSize: 14,
		color: '#6b7280',
		lineHeight: 20,
		fontWeight: '500',
	},
})
