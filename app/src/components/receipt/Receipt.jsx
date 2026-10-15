import { Modal, View, Text, TouchableOpacity, ToastAndroid } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import GenerateReceiptHtml from './ReceiptHtml'
import { printToFileAsync } from 'expo-print'
import { shareAsync } from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { usePermission } from '../../context/PermissionContext'
import { useLocalization } from '../../localization/localizationContext'

export default function Receipt(props) {
	const { getStoragePermission } = usePermission()
	const { isVisible, setIsVisible, resetCart, shopName, receiptData } = props
	const { loc } = useLocalization()

	function generateFileName() {
		const date = new Date() // Get the current date and time

		// Get hours, minutes, and format for AM/PM
		let hours = date.getHours()
		let minutes = date.getMinutes()
		let ampm = hours >= 12 ? 'PM' : 'AM'
		hours = hours % 12
		hours = hours ? hours : 12 // the hour '0' should be '12'
		minutes = minutes < 10 ? '0' + minutes : minutes

		// Get day, month, and year
		const day = date.getDate()
		const month = date.getMonth() + 1 // Months are 0-indexed
		const year = date.getFullYear()

		// Format date as: hh:mm am/pm_dd-mm-yyyy
		const formattedDate = `${hours}-${minutes} ${ampm} ${
			day < 10 ? '0' + day : day
		}-${month < 10 ? '0' + month : month}-${year}`

		return formattedDate
	}

	const save = async (uri, filename, mimetype) => {
		const permittedFolder = await getStoragePermission()

		const base64 = await FileSystem.readAsStringAsync(uri, {
			encoding: FileSystem.EncodingType.Base64,
		})
		await FileSystem.StorageAccessFramework.createFileAsync(
			permittedFolder,
			filename,
			mimetype
		)
			.then(async (uri) => {
				await FileSystem.writeAsStringAsync(uri, base64, {
					encoding: FileSystem.EncodingType.Base64,
				})
			})
			.catch((e) => console.log('🚀 err ', e))

		ToastAndroid.show(loc.t('receipt.downloaded'), ToastAndroid.SHORT)
	}

	const handleGenerateReceipt = async (action) => {
		const receiptHtml = GenerateReceiptHtml({
			checkOutData: receiptData,
		})

		const file = await printToFileAsync({
			html: receiptHtml,
			base64: true,
		})

		if (action === 'share') {
			await shareAsync(file.uri)
		} else if (action === 'download') {
			await save(file.uri, `${generateFileName()}.pdf`, 'application/pdf')
		}

		setIsVisible(false)
		resetCart()
	}

	const ActionButton = ({
		onPress,
		title,
		icon,
		color = '#195FE1',
		textColor = '#FFFFFF',
	}) => (
		<TouchableOpacity
			onPress={onPress}
			className="flex-row items-center justify-center py-4 px-6 rounded-lg mb-3"
			style={{ backgroundColor: color }}
			activeOpacity={0.8}
		>
			<MaterialIcons name={icon} size={20} color={textColor} />
			<Text
				className="ml-2 font-semibold text-base"
				style={{ color: textColor }}
			>
				{title}
			</Text>
		</TouchableOpacity>
	)

	return (
		<Modal animationType="fade" transparent={true} visible={isVisible}>
			<View className="flex-1 bg-black/50 justify-center items-center px-4">
				<View className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
					{/* Header */}
					<View className="items-center mb-6">
						<View className="bg-green-100 p-3 rounded-full mb-3">
							<MaterialIcons name="receipt" size={32} color="#10B981" />
						</View>
						<Text
							className="text-xl font-bold text-gray-800 mb-1"
							numberOfLines={1}
						>
							{loc.t('receipt.title')}
						</Text>
						<Text className="text-gray-500 text-center" numberOfLines={1}>
							{loc.t('receipt.subtitle')}
						</Text>
					</View>

					{/* Action Buttons */}
					<View className="mb-4">
						<ActionButton
							onPress={() => handleGenerateReceipt('download')}
							title={loc.t('receipt.download')}
							icon="download"
							color="#10B981"
						/>

						<ActionButton
							onPress={() => handleGenerateReceipt('share')}
							title={loc.t('receipt.share')}
							icon="share"
							color="#3B82F6"
						/>

						<ActionButton
							onPress={() => {
								setIsVisible(false)
								resetCart()
							}}
							title={loc.t('receipt.close')}
							icon="close"
							color="#EF4444"
						/>
					</View>
				</View>
			</View>
		</Modal>
	)
}
