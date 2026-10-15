import React, { useState, useMemo } from 'react'
import { useEffect } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	ToastAndroid,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker from '@react-native-community/datetimepicker'
import useApi from '../../../../../src/hooks/useApi'
import { sendManyMessages } from '../../../../../src/controllers/message'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import { getShopInfo } from '../../../../../src/controllers/shop'
import { useRouter } from 'expo-router'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import CustomerSelectionScreen from './customerSelection.jsx'
import { ConfirmModal } from '../../../../../src/components/AlertModal'

// GSM 7-bit character set
const GSM_7BIT_CHARS =
	'@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'

// Unicode emoji regex
const emojiRegex = /\p{Extended_Pictographic}/u

function isGsmCharacter(char) {
	return GSM_7BIT_CHARS.includes(char)
}

function isUnicodeMessage(text) {
	for (let i = 0; i < text.length; i++) {
		const char = text[i]
		if (!isGsmCharacter(char) || emojiRegex.test(char)) {
			return true
		}
	}
	return false
}

function countSmsProgress(text) {
	const length = text.length

	// SMS segment limit - 65 characters per SMS
	const perSegment = 65
	const parts = length === 0 ? 1 : Math.ceil(length / perSegment)
	const totalLimit = parts * perSegment

	return {
		currentCount: length,
		totalLimit,
		parts,
	}
}

const MessagePage = () => {
	const { loc } = useLocalization()
	const { translateNumber, translatePhone } = useNumberTranslator()
	const { fetchData } = useApi()
	const router = useRouter()
	const [message, setMessage] = useState('')
	const [selectedUsers, setSelectedUsers] = useState([])
	const [selectedDateTime, setSelectedDateTime] = useState(null)
	const [showDatePicker, setShowDatePicker] = useState(false)
	const [showTimePicker, setShowTimePicker] = useState(false)
	const [tempDate, setTempDate] = useState(new Date())
	const [shopInfo, setShopInfo] = useState(null)
	const [showCustomerSelection, setShowCustomerSelection] = useState(false)
	const [selectedCustomers, setSelectedCustomers] = useState([]) // Full customer objects for display
	const [creditError, setCreditError] = useState('')
	const [showKycModal, setShowKycModal] = useState(false)
	const [showInstructionModal, setShowInstructionModal] = useState(false)
	const [hasReadInstructions, setHasReadInstructions] = useState(false)

	useEffect(() => {
		const fetchShopInfo = async () => {
			const result = await fetchData(getShopInfo, {})
			if (result.success) {
				setShopInfo(result.data)
			}
		}
		fetchShopInfo()
	}, [])

	// Date and time picker handlers
	const handleDateChange = (event, selectedDate) => {
		// Always hide the picker first
		setShowDatePicker(false)

		// Handle dismissal
		if (event.type === 'dismissed' || !selectedDate) {
			return
		}

		// Update temp date and show time picker
		setTempDate(selectedDate)
		// Small delay to ensure smooth transition between pickers
		setTimeout(() => {
			setShowTimePicker(true)
		}, 50)
	}

	const handleTimeChange = (event, selectedTime) => {
		// Always hide the picker first
		setShowTimePicker(false)

		// Handle dismissal
		if (event.type === 'dismissed' || !selectedTime) {
			return
		}

		// Combine the date from tempDate with the selected time
		const finalDateTime = new Date(tempDate)
		finalDateTime.setHours(selectedTime.getHours())
		finalDateTime.setMinutes(selectedTime.getMinutes())
		finalDateTime.setSeconds(0)
		finalDateTime.setMilliseconds(0)

		// Validate that the selected time is at least 2 hours from now
		const now = new Date()
		const minimumDateTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now

		if (finalDateTime < minimumDateTime) {
			ToastAndroid.show(
				loc.t('message.minimumScheduleTime') ||
					'Schedule time must be at least 2 hours from now',
				ToastAndroid.LONG
			)
			return
		}

		setSelectedDateTime(finalDateTime)
	}

	const openDateTimePicker = () => {
		// Set initial date to current date/time or existing selection
		const initialDate = selectedDateTime || new Date()
		setTempDate(initialDate)
		setShowDatePicker(true)
	}

	const formatDate = (date) => {
		if (!date) return loc.t('message.selectDateTime') || 'Select Date'
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		})
	}

	const formatTime = (date) => {
		if (!date) return ''
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
		})
	}

	const formatDateTime = (date) => {
		if (!date) return loc.t('message.selectDateTime') || 'Select date and time'
		return `${formatDate(date)} at ${formatTime(date)}`
	}

	// Handle adding customers from selection screen
	const handleAddCustomers = (customers) => {
		// Update selected customers for display
		const newCustomers = customers.filter(
			(customer) =>
				!selectedCustomers.some(
					(existing) => existing.buyerID === customer.buyerID
				)
		)
		setSelectedCustomers((prev) => [...prev, ...newCustomers])

		// Update selected user IDs for API
		const newUserIds = newCustomers.map((customer) => customer.buyerID)
		setSelectedUsers((prev) => [...prev, ...newUserIds])
	}

	// Remove customer from selection
	const removeCustomer = (customerId) => {
		setSelectedCustomers((prev) =>
			prev.filter((customer) => customer.buyerID !== customerId)
		)
		setSelectedUsers((prev) => prev.filter((id) => id !== customerId))
	}

	const handleSubmit = async () => {
		// Calculate total credits needed
		const totalCreditsNeeded = smsInfo.parts * selectedCustomers.length
		const availableCredits = shopInfo?.credit || 0

		// Check if enough credits are available
		if (totalCreditsNeeded > availableCredits) {
			const creditsNeeded = totalCreditsNeeded - availableCredits
			setCreditError(
				loc.t('message.insufficientCredits') ||
					`You need ${creditsNeeded} more credits to send this message. Please add credits first.`
			)
			// Replace placeholders if localization uses them
			const errorMessage = (
				loc.t('message.insufficientCredits') ||
				`You need ${creditsNeeded} more credits to send this message. Please add credits first.`
			).replace('{credits}', translateNumber(creditsNeeded))

			setCreditError(errorMessage)
			return
		}

		// Clear any previous credit error
		setCreditError('')

		const data = {
			msgBody: message,
			receiverId: selectedUsers,
			scheduledAt: selectedDateTime,
		}
		const result = await fetchData(sendManyMessages, data)
		if (!result.success) {
			if (result.message === 'KYC_ERR') {
				setShowKycModal(true)
			} else {
				ToastAndroid.show(
					loc.t('message.sendFailed') || 'Failed to send message',
					ToastAndroid.SHORT
				)
			}
		} else {
			ToastAndroid.show(
				loc.t('message.sendSuccess') || 'Message scheduled successfully',
				ToastAndroid.SHORT
			)
		}
		handleCancel()
	}

	const handleCancel = () => {
		setMessage('')
		setSelectedUsers([])
		setSelectedCustomers([])
		setSelectedDateTime(null)
		setCreditError('')
		setHasReadInstructions(false)
	}

	const handleCreditPress = () => {
		router.push('./message/credit')
	}

	const handlePastCampaignsPress = () => {
		router.push('./message/history')
	}

	// Calculate SMS character count
	const smsInfo = useMemo(() => countSmsProgress(message), [message])

	// Calculate total credits needed
	const totalCreditsNeeded = useMemo(() => {
		return smsInfo.parts * selectedCustomers.length
	}, [smsInfo.parts, selectedCustomers.length])

	// Check if form is valid and has enough credits
	const canSendMessage = useMemo(() => {
		return (
			message.trim() &&
			selectedCustomers.length > 0 &&
			selectedDateTime &&
			totalCreditsNeeded <= (shopInfo?.credit || 0) &&
			hasReadInstructions
		)
	}, [
		message,
		selectedCustomers.length,
		selectedDateTime,
		totalCreditsNeeded,
		shopInfo?.credit,
		hasReadInstructions,
	])

	// Get minimum date (2 hours from now)
	const minimumDate = useMemo(() => {
		const now = new Date()
		const minimumDateTime = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now
		// Set to start of the day for date picker
		const minDate = new Date(minimumDateTime)
		minDate.setHours(0, 0, 0, 0)
		return minDate
	}, [])

	const renderCalendar = () => {
		const days = getMonthDays(currentYear, currentMonth)
		const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

		return (
			<View className="bg-white rounded-lg p-4">
				{/* Month/Year Header */}
				<View className="flex-row justify-between items-center mb-4">
					<TouchableOpacity
						onPress={() => {
							if (currentMonth === 0) {
								setCurrentMonth(11)
								setCurrentYear(currentYear - 1)
							} else {
								setCurrentMonth(currentMonth - 1)
							}
						}}
						className="p-2"
					>
						<Text className="text-xl text-blue-600">‹</Text>
					</TouchableOpacity>

					<Text className="text-lg font-semibold text-gray-800">
						{monthNames[currentMonth]} {translateNumber(currentYear)}
					</Text>

					<TouchableOpacity
						onPress={() => {
							if (currentMonth === 11) {
								setCurrentMonth(0)
								setCurrentYear(currentYear + 1)
							} else {
								setCurrentMonth(currentMonth + 1)
							}
						}}
						className="p-2"
					>
						<Text className="text-xl text-blue-600">›</Text>
					</TouchableOpacity>
				</View>

				{/* Day Names */}
				<View className="flex-row mb-2">
					{dayNames.map((day) => (
						<View key={day} className="flex-1 items-center py-2">
							<Text className="text-sm font-medium text-gray-600">{day}</Text>
						</View>
					))}
				</View>

				{/* Calendar Grid */}
				<View className="flex-row flex-wrap">
					{days.map((date, index) => (
						<View
							key={index}
							className="w-1/7 aspect-square p-1"
							style={{ width: '14.28%' }}
						>
							{date && (
								<TouchableOpacity
									className={`flex-1 items-center justify-center rounded-lg ${
										isDateDisabled(date)
											? 'bg-gray-100'
											: selectedDate &&
												  selectedDate.toDateString() === date.toDateString()
												? 'bg-blue-500'
												: 'bg-gray-50 hover:bg-blue-100'
									}`}
									onPress={() => !isDateDisabled(date) && setSelectedDate(date)}
									disabled={isDateDisabled(date)}
								>
									<Text
										className={`text-sm ${
											isDateDisabled(date)
												? 'text-gray-400'
												: selectedDate &&
													  selectedDate.toDateString() === date.toDateString()
													? 'text-white font-semibold'
													: 'text-gray-800'
										}`}
									>
										{translateNumber(date.getDate())}
									</Text>
								</TouchableOpacity>
							)}
						</View>
					))}
				</View>
			</View>
		)
	}

	const renderTimePicker = () => {
		return (
			<View className="bg-white rounded-lg p-6">
				<Text className="text-lg font-semibold text-gray-800 mb-4 text-center">
					{loc.t('message.timePickerTitle') || 'Select Time'}
				</Text>

				<View className="flex-row items-center justify-center">
					{/* Hour Picker */}
					<View className="items-center mr-4">
						<Text className="text-sm text-gray-600 mb-2">
							{loc.t('message.hourLabel') || 'Hour'}
						</Text>
						<ScrollView
							className="h-32 w-16"
							showsVerticalScrollIndicator={false}
							snapToInterval={40}
							decelerationRate="fast"
						>
							{hours.map((hour) => (
								<TouchableOpacity
									key={hour}
									className={`h-10 items-center justify-center rounded ${
										selectedTime.hour === hour ? 'bg-blue-500' : 'bg-gray-100'
									}`}
									onPress={() => setSelectedTime({ ...selectedTime, hour })}
									style={{ marginBottom: 4 }}
								>
									<Text
										className={`text-lg ${
											selectedTime.hour === hour
												? 'text-white font-semibold'
												: 'text-gray-800'
										}`}
									>
										{translateNumber(hour)}
									</Text>
								</TouchableOpacity>
							))}
						</ScrollView>
					</View>

					<Text className="text-2xl font-bold text-gray-800 mr-4">:</Text>

					{/* Minute Picker */}
					<View className="items-center mr-4">
						<Text className="text-sm text-gray-600 mb-2">
							{loc.t('message.minuteLabel') || 'Minute'}
						</Text>
						<ScrollView
							className="h-32 w-16"
							showsVerticalScrollIndicator={false}
							snapToInterval={40}
							decelerationRate="fast"
						>
							{minutes
								.filter((m) => m % 5 === 0)
								.map((minute) => (
									<TouchableOpacity
										key={minute}
										className={`h-10 items-center justify-center rounded ${
											selectedTime.minute === minute
												? 'bg-blue-500'
												: 'bg-gray-100'
										}`}
										onPress={() => setSelectedTime({ ...selectedTime, minute })}
										style={{ marginBottom: 4 }}
									>
										<Text
											className={`text-lg ${
												selectedTime.minute === minute
													? 'text-white font-semibold'
													: 'text-gray-800'
											}`}
										>
											{translateNumber(minute.toString().padStart(2, '0'))}
										</Text>
									</TouchableOpacity>
								))}
						</ScrollView>
					</View>

					{/* AM/PM Picker */}
					<View className="items-center">
						<Text className="text-sm text-gray-600 mb-2">
							{loc.t('message.periodLabel') || 'Period'}
						</Text>
						<View className="h-32 justify-center">
							{['AM', 'PM'].map((period) => (
								<TouchableOpacity
									key={period}
									className={`h-12 w-16 items-center justify-center rounded mb-2 ${
										selectedTime.period === period
											? 'bg-blue-500'
											: 'bg-gray-100'
									}`}
									onPress={() => setSelectedTime({ ...selectedTime, period })}
								>
									<Text
										className={`text-lg ${
											selectedTime.period === period
												? 'text-white font-semibold'
												: 'text-gray-800'
										}`}
									>
										{period}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>
				</View>

				<View className="mt-6">
					<Text className="text-center text-lg font-medium text-gray-800">
						{loc.t('message.selectedLabel') || 'Selected:'}{' '}
						{formatTime(selectedTime)}
					</Text>
				</View>
			</View>
		)
	}

	return (
		<SafeAreaView className="flex-1 bg-gray-50">
			<ScrollView>
				<View className="flex-1 px-4 py-2">
					{/* Message Input Box */}
					<View className="mb-6">
						<View className="flex-row items-center justify-between pb-2">
							<Text className="text-base font-semibold text-gray-700">
								{loc.t('message.messageLabel') || 'Message'}
							</Text>
							{/* Credit Display */}
							<View className="flex-row justify-end">
								<TouchableOpacity
									onPress={handleCreditPress}
									className="flex-row items-center bg-white rounded-lg border border-gray-200 shadow-sm px-3 py-2"
								>
									<MaterialCommunityIcons
										name="wallet"
										size={16}
										color="#F59E0B"
										style={{ marginRight: 4 }}
									/>
									<View className="mr-2">
										<Text className="text-sm font-semibold text-gray-800">
											{translateNumber(shopInfo?.credit || 0)}
										</Text>
									</View>
									<MaterialIcons
										name="add-circle-outline"
										size={18}
										color="#3CB043"
									/>
								</TouchableOpacity>
							</View>
						</View>
						<View className="bg-white rounded-lg border border-gray-200 shadow-sm">
							<TextInput
								className="p-4 text-gray-800 text-base min-h-32"
								placeholder={
									loc.t('message.messagePlaceholder') ||
									'Type your message here...'
								}
								placeholderTextColor="#9CA3AF"
								multiline
								textAlignVertical="top"
								value={message}
								onChangeText={setMessage}
							/>
						</View>
						<View className="flex-row justify-between items-center mt-2">
							<View className="flex-row items-center">
								<Text className="text-sm text-gray-500">
									{translateNumber(smsInfo.currentCount)}/
									{translateNumber(smsInfo.totalLimit)}{' '}
									{loc.t('message.charactersCount') || 'characters'}
								</Text>
								{smsInfo.parts > 1 && (
									<Text className="text-xs text-blue-600 font-medium ml-3">
										{translateNumber(smsInfo.parts)}{' '}
										{loc.t('message.parts') || 'parts'}
									</Text>
								)}
							</View>
							<TouchableOpacity
								onPress={() => setShowInstructionModal(true)}
								className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
							>
								<Text className="text-blue-600 text-xs font-medium">
									{loc.t('message.instructionButton') || 'Message Instructions'}
								</Text>
							</TouchableOpacity>
						</View>
						<Text className="text-xs text-gray-500 mt-2">
							{loc.t('message.shopNameRequirement') ||
								'You must add shop name in your message'}
						</Text>
					</View>
					{/* Schedule Time Section */}
					<View className="mb-6">
						<Text className="text-base font-semibold text-gray-700 mb-3">
							{loc.t('message.scheduleTimeLabel') || 'Schedule Time'}
						</Text>
						<TouchableOpacity
							className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex-row justify-between items-center"
							onPress={openDateTimePicker}
						>
							<Text
								className={`text-base ${
									selectedDateTime ? 'text-gray-800' : 'text-gray-500'
								}`}
							>
								{formatDateTime(selectedDateTime)}
							</Text>
							<Text className="text-blue-600 text-lg">📅</Text>
						</TouchableOpacity>
						<Text className="text-xs text-gray-500 mt-2">
							{loc.t('message.minimumScheduleTimeNote') ||
								'Minimum 2 hours from now'}
						</Text>
					</View>

					{/* Selected Recipients Preview */}
					{selectedCustomers.length > 0 && (
						<View className="mb-6">
							<View className="flex-row justify-between items-center mb-3">
								<Text className="text-base font-semibold text-gray-700">
									{loc.t('message.selectedRecipientsLabel') ||
										'Selected Recipients'}
								</Text>
								<Text className="text-sm text-blue-600 font-medium">
									{translateNumber(selectedCustomers.length)}{' '}
									{loc.t('message.selectedCount') || 'selected'}
								</Text>
							</View>
							<View className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									className="flex-row"
								>
									{selectedCustomers.map((customer, index) => (
										<View
											key={customer.buyerID}
											className="bg-blue-50 rounded-lg p-3 mr-3 flex-row items-center"
											style={{ minWidth: 150 }}
										>
											<View className="flex-1">
												<Text
													className="text-sm font-medium text-blue-800"
													numberOfLines={1}
												>
													{customer.name}
												</Text>
												<Text
													className="text-xs text-blue-600"
													numberOfLines={1}
												>
													{translatePhone(customer.number)}
												</Text>
											</View>
											<TouchableOpacity
												onPress={() => removeCustomer(customer.buyerID)}
												className="ml-2 p-1"
											>
												<MaterialCommunityIcons
													name="close-circle"
													size={18}
													color="#DC2626"
												/>
											</TouchableOpacity>
										</View>
									))}
								</ScrollView>
							</View>
						</View>
					)}
					{/* Credit Error Message */}
					{creditError && (
						<View className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
							<View className="flex-row items-start">
								<MaterialCommunityIcons
									name="alert-circle"
									size={20}
									color="#DC2626"
									style={{ marginRight: 8, marginTop: 2 }}
								/>
								<View className="flex-1">
									<Text className="text-red-700 text-sm font-medium mb-1">
										{loc.t('message.insufficientCreditsTitle') ||
											'Insufficient Credits'}
									</Text>
									<Text className="text-red-600 text-sm">{creditError}</Text>
								</View>
							</View>
							<TouchableOpacity
								className="mt-3 bg-red-600 rounded-lg py-2 px-4 self-start"
								onPress={handleCreditPress}
							>
								<Text className="text-white text-sm font-medium">
									{loc.t('message.addCreditsButton') || 'Add Credits'}
								</Text>
							</TouchableOpacity>
						</View>
					)}
					{/* Total Credits Info */}
					{message.trim() && selectedCustomers.length > 0 && (
						<View className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
							<View className="flex-row justify-between items-center">
								<Text className="text-blue-700 text-sm font-medium">
									{loc.t('message.totalCreditsNeeded') ||
										'Total Credits Needed:'}
								</Text>
								<Text className="text-blue-800 text-base font-bold">
									{translateNumber(totalCreditsNeeded)}
								</Text>
							</View>
							<Text className="text-blue-600 text-xs mt-1">
								{translateNumber(smsInfo.parts)}{' '}
								{loc.t('message.parts') || 'parts'} ×{' '}
								{translateNumber(selectedCustomers.length)}{' '}
								{loc.t('message.customers') || 'customers'}
							</Text>
						</View>
					)}
					{/* Checkbox for Instructions */}
					<View className="mb-4">
						<TouchableOpacity
							onPress={() => setHasReadInstructions(!hasReadInstructions)}
							className="flex-row items-center"
						>
							<View
								className={`w-5 h-5 border-2 rounded mr-2 items-center justify-center ${
									hasReadInstructions
										? 'bg-blue-600 border-blue-600'
										: 'bg-white border-gray-300'
								}`}
							>
								{hasReadInstructions && (
									<MaterialIcons name="check" size={16} color="white" />
								)}
							</View>
							<Text className="text-sm text-gray-700" numberOfLines={1}>
								{loc.t('message.readInstructionsCheckbox') ||
									'I have read the instructions'}
							</Text>
						</TouchableOpacity>
					</View>
					{/* Action Buttons */}
					<View className="flex-row">
						<TouchableOpacity
							className="flex-1 bg-blue-600 rounded-lg py-4 items-center mr-3 flex-row justify-center"
							onPress={() => setShowCustomerSelection(true)}
						>
							<MaterialCommunityIcons
								name="account-plus"
								size={20}
								color="white"
								style={{ marginRight: 8 }}
							/>
							<Text className="text-white font-semibold text-base">
								{loc.t('message.addCustomerButton') || 'Add Customer'}
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							className={`flex-1 py-4 rounded-lg items-center ${
								canSendMessage ? 'bg-green-600' : 'bg-gray-300'
							}`}
							onPress={handleSubmit}
							disabled={!canSendMessage}
						>
							<Text
								numberOfLines={1}
								className={`font-semibold text-base ${
									canSendMessage ? 'text-white' : 'text-gray-500'
								}`}
							>
								{loc.t('message.sendButton') || 'Send Message'}
							</Text>
						</TouchableOpacity>
					</View>
				</View>

				{/* Past Campaigns Button */}
				<View className="items-center mt-8 mb-4">
					<TouchableOpacity onPress={handlePastCampaignsPress}>
						<Text
							className="text-blue-600 text-base font-medium"
							numberOfLines={1}
							textBreakStrategy="simple"
						>
							{loc.t('message.pastCampaigns') || 'Past Campaigns'}
						</Text>
					</TouchableOpacity>
				</View>

				{/* Date Picker */}
				{showDatePicker && (
					<DateTimePicker
						value={tempDate}
						mode="date"
						display="default"
						onChange={handleDateChange}
						minimumDate={minimumDate}
					/>
				)}

				{/* Time Picker */}
				{showTimePicker && (
					<DateTimePicker
						value={tempDate}
						mode="time"
						display="default"
						onChange={handleTimeChange}
						is24Hour={false}
					/>
				)}

				{/* Customer Selection Modal */}
				<CustomerSelectionScreen
					visible={showCustomerSelection}
					onClose={() => setShowCustomerSelection(false)}
					onAddCustomers={handleAddCustomers}
					existingSelectedUsers={selectedUsers}
				/>

				{/* Message Instructions Modal */}
				<ConfirmModal
					visible={showInstructionModal}
					onClose={() => setShowInstructionModal(false)}
					onConfirm={() => setShowInstructionModal(false)}
					title={loc.t('message.instruction.title') || 'Message Instructions'}
					subtitle={
						loc.t('message.instruction.text') ||
						"বিটিআরসি'র নিয়ম অনুযায়ী সকল ধরণের প্রোমোশনাল এসএমএস অবশ্যই বাংলায় (ইউনিকোড) হতে হবে। এ ক্ষেত্রে যে কোন নিউমেরিক ডিজিট (টাকার পারিমান, মোবাইল নম্বর, অর্ডার নম্বর) ওয়েব ইউআরএল, ইমেইল আইডি, পাসওয়ার্ড ইত্যাদি তথ্য ইংরেজিতে হতে পারে। তবে এসএমএস টেমপ্লেট অবশ্যই বাংলায় হতে হবে। নিয়ম না মেনে মেসেজ না লিখলে রিকুয়েস্ট বাতিল করা হবে।\n\nAs per BTRC rules all types of promotional SMS must be in Bengali (Unicode). In this case, any numeric digit (amount, mobile number, order number), web URL, email ID, password, etc. information can be in English. But the SMS template must be in Bengali. Your request will be declined if this rule is not properly followed."
					}
					confirmText={loc.t('message.instruction.closeButton') || 'Got it'}
					hideCancelButton={true}
					iconName="info"
					iconColor="#3B82F6"
					confirmButtonColor="#3B82F6"
				/>

				{/* KYC Verification Modal */}
				<ConfirmModal
					visible={showKycModal}
					onClose={() => setShowKycModal(false)}
					onConfirm={() => {
						setShowKycModal(false)
						router.push('/kyc')
					}}
					title={loc.t('message.kyc.errorTitle') || 'KYC Verification Required'}
					subtitle={
						loc.t('message.kyc.errorMessage') ||
						'Your account needs to be KYC verified to send messages. Please complete the KYC process.'
					}
					confirmText={loc.t('message.kyc.proceedButton') || 'Proceed to KYC'}
					cancelText={loc.t('message.kyc.laterButton') || 'Maybe Later'}
					iconName="verified-user"
					iconColor="#F59E0B"
					confirmButtonColor="#177DFF"
				/>
			</ScrollView>
		</SafeAreaView>
	)
}

export default MessagePage
