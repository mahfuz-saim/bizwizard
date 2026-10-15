import React from 'react'
import {
	Modal,
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Linking,
	ToastAndroid,
	Image,
} from 'react-native'
import { useLocalization } from '../localization/localizationContext'

const HelpModal = ({ visible, onClose }) => {
	const { loc } = useLocalization()

	const handleCall = async () => {
		const phoneNumber = '+8801897601120'
		const url = `tel:${phoneNumber}`

		try {
			const supported = await Linking.canOpenURL(url)
			if (supported) {
				await Linking.openURL(url)
				onClose()
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
				onClose()
			} else {
				// Fallback to web WhatsApp
				const webUrl = `https://wa.me/${phoneNumber}`
				await Linking.openURL(webUrl)
				onClose()
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
				onClose()
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

	const supportOptions = [
		{
			id: 'call',
			name: loc.t('help.callNow'),
			icon: require('../../assets/helpIcons/call.png'),
			action: handleCall,
		},
		{
			id: 'whatsapp',
			name: loc.t('help.whatsApp'),
			icon: require('../../assets/helpIcons/whatsapp.png'),
			action: handleWhatsApp,
		},
		{
			id: 'messenger',
			name: loc.t('help.facebookMessenger'),
			icon: require('../../assets/helpIcons/messenger.png'),
			action: handleMessenger,
		},
	]

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="fade"
			onRequestClose={onClose}
		>
			<View style={styles.overlay}>
				<View style={styles.modalContainer}>
					{/* Header */}
					<View style={styles.header}>
						<Text style={styles.title}>{loc.t('help.headerTitle')}</Text>
						<TouchableOpacity onPress={onClose} style={styles.closeButton}>
							<Text style={styles.closeButtonText}>✕</Text>
						</TouchableOpacity>
					</View>

					{/* Support Options */}
					<View style={styles.supportRow}>
						{supportOptions.map((option) => (
							<TouchableOpacity
								key={option.id}
								onPress={option.action}
								style={styles.supportItem}
								activeOpacity={0.7}
							>
								<View style={styles.iconContainer}>
									<Image source={option.icon} style={styles.iconImage} />
								</View>
								<Text style={styles.optionName}>{option.name}</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>
			</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.3)',
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 20,
	},
	modalContainer: {
		backgroundColor: 'rgba(255, 255, 255, 0.95)',
		borderRadius: 20,
		width: '100%',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 10,
		},
		shadowOpacity: 0.25,
		shadowRadius: 25,
		elevation: 25,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 24,
		paddingTop: 12,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(241, 245, 249, 0.8)',
	},
	title: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#111827',
		flex: 1,
	},
	closeButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: 'rgba(243, 244, 246, 0.8)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	closeButtonText: {
		fontSize: 16,
		color: '#6b7280',
		fontWeight: 'bold',
	},
	supportRow: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		width: '100%',
		paddingVertical: 10,
		paddingHorizontal: 20,
	},
	supportItem: {
		alignItems: 'center',
		paddingHorizontal: 15,
		paddingVertical: 15,
	},
	iconContainer: {
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: '#ffffff',
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 8,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	iconImage: {
		width: 35,
		height: 35,
		resizeMode: 'contain',
	},
	optionName: {
		fontSize: 12,
		fontWeight: '600',
		color: '#111827',
		textAlign: 'center',
		marginTop: 4,
	},
})

export default HelpModal
