import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getAllMessage } from '../../../../../src/controllers/message'
import useApi from '../../../../../src/hooks/useApi'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import ContentLoader, { Rect } from 'react-content-loader/native'

const MessageHistoryPage = () => {
	const { loc } = useLocalization()
	const { translateNumber, translateAmount, translatePhone } =
		useNumberTranslator()
	const { fetchData } = useApi()
	const [messages, setMessages] = useState([])
	const [loading, setLoading] = useState(false)
	const [selectedMessage, setSelectedMessage] = useState(null)
	const [showModal, setShowModal] = useState(false)

	useEffect(() => {
		fetchMessages()
	}, [])

	const fetchMessages = async () => {
		setLoading(true)
		try {
			const result = await fetchData(getAllMessage, {})
			if (result.success) {
				setMessages(result.data || [])
			}
		} catch (error) {
			console.error('Error fetching messages:', error)
		} finally {
			setLoading(false)
		}
	}

	const formatDate = (dateString) => {
		const date = new Date(dateString)
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		})
	}

	const formatTime = (dateString) => {
		const date = new Date(dateString)
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true,
		})
	}

	const getApprovalStatusColor = (status) => {
		switch (status) {
			case 'APPROVED':
				return 'text-green-600'
			case 'PENDING':
				return 'text-yellow-600'
			case 'REJECTED':
				return 'text-red-600'
			default:
				return 'text-gray-600'
		}
	}

	const getSentStatusColor = (status) => {
		switch (status) {
			case 'SUCCESS':
				return 'text-green-600'
			case 'PENDING':
				return 'text-yellow-600'
			case 'FAILED':
				return 'text-red-600'
			default:
				return 'text-gray-600'
		}
	}

	const getApprovalStatusBgColor = (status) => {
		switch (status) {
			case 'APPROVED':
				return 'bg-green-100'
			case 'PENDING':
				return 'bg-yellow-100'
			case 'REJECTED':
				return 'bg-red-100'
			default:
				return 'bg-gray-100'
		}
	}

	const getSentStatusBgColor = (status) => {
		switch (status) {
			case 'SUCCESS':
				return 'bg-green-100'
			case 'PENDING':
				return 'bg-yellow-100'
			case 'FAILED':
				return 'bg-red-100'
			default:
				return 'bg-gray-100'
		}
	}

	const openMessageModal = (message) => {
		setSelectedMessage(message)
		setShowModal(true)
	}

	const MessageCard = ({ message }) => (
		<View className="bg-white rounded-lg border border-gray-200 shadow-sm mb-3 p-4">
			<View className="flex-row">
				{/* Date Column */}
				<View className="flex-1">
					<Text className="text-xs text-gray-500">
						{formatTime(message.scheduledAt)}
					</Text>
					<Text className="text-sm font-semibold text-gray-800 mt-1">
						{formatDate(message.scheduledAt)}
					</Text>
					<Text className="text-xs text-gray-500 mt-1">
						{loc.t('message.history.recipients') || 'Recipients'}:{' '}
						{translateNumber(message.phoneNumbers.length)}
					</Text>
				</View>

				{/* Status Column */}
				<View className="flex-2 mx-4">
					<View className="flex-row mb-2">
						<View
							className={`px-2 py-1 rounded-full mr-2 ${getApprovalStatusBgColor(
								message.approvalStatus
							)}`}
						>
							<Text
								className={`text-xs font-medium ${getApprovalStatusColor(
									message.approvalStatus
								)}`}
							>
								{loc.t(
									`message.history.approval.${message.approvalStatus.toLowerCase()}`
								) || message.approvalStatus}
							</Text>
						</View>
					</View>
					<View className="flex-row">
						<View
							className={`px-2 py-1 rounded-full ${getSentStatusBgColor(
								message.sentStatus
							)}`}
						>
							<Text
								className={`text-xs font-medium ${getSentStatusColor(
									message.sentStatus
								)}`}
							>
								{loc.t(
									`message.history.sent.${message.sentStatus.toLowerCase()}`
								) || message.sentStatus}
							</Text>
						</View>
					</View>
				</View>

				{/* Info Icon */}
				<TouchableOpacity
					onPress={() => openMessageModal(message)}
					className="items-center justify-center"
				>
					<MaterialIcons name="info-outline" size={24} color="#6B7280" />
				</TouchableOpacity>
			</View>
		</View>
	)

	const MessageDetailModal = () => (
		<Modal
			visible={showModal}
			transparent={true}
			animationType="fade"
			onRequestClose={() => setShowModal(false)}
		>
			<View className="flex-1 bg-black/50 justify-center items-center px-4">
				<View className="bg-white rounded-xl w-full max-w-md max-h-5/6">
					{/* Modal Header */}
					<View className="flex-row justify-between items-center p-4 border-b border-gray-200">
						<Text className="text-xl font-bold text-gray-800">
							{loc.t('message.history.messageDetails') || 'Message Details'}
						</Text>
						<TouchableOpacity
							onPress={() => setShowModal(false)}
							className="p-2"
						>
							<MaterialIcons name="close" size={24} color="#6B7280" />
						</TouchableOpacity>
					</View>

					{selectedMessage && (
						<ScrollView className="p-4">
							{/* Message Content */}
							<View className="mb-4">
								<Text className="text-sm font-semibold text-gray-700 mb-2">
									{loc.t('message.history.messageContent') || 'Message Content'}
								</Text>
								<View className="bg-gray-50 p-3 rounded-lg">
									<Text className="text-gray-800">
										{selectedMessage.message}
									</Text>
								</View>
							</View>

							{/* Schedule Information */}
							<View className="mb-4">
								<Text className="text-sm font-semibold text-gray-700 mb-2">
									{loc.t('message.history.scheduleInfo') ||
										'Schedule Information'}
								</Text>
								<View className="bg-gray-50 p-3 rounded-lg">
									<Text className="text-gray-600">
										{loc.t('message.history.scheduledAt') || 'Scheduled At'}:{' '}
										{formatDate(selectedMessage.scheduledAt)} at{' '}
										{formatTime(selectedMessage.scheduledAt)}
									</Text>
									<Text className="text-gray-600 mt-1">
										{loc.t('message.history.createdAt') || 'Created At'}:{' '}
										{formatDate(selectedMessage.createdAt)} at{' '}
										{formatTime(selectedMessage.createdAt)}
									</Text>
								</View>
							</View>

							{/* Status Information */}
							<View className="mb-4">
								<Text className="text-sm font-semibold text-gray-700 mb-2">
									{loc.t('message.history.statusInfo') || 'Status Information'}
								</Text>
								<View className="bg-gray-50 p-3 rounded-lg">
									<View className="flex-row items-center mb-2">
										<Text className="text-gray-600 mr-2">
											{loc.t('message.history.approvalStatus') ||
												'Approval Status'}
											:
										</Text>
										<View
											className={`px-2 py-1 rounded-full ${getApprovalStatusBgColor(
												selectedMessage.approvalStatus
											)}`}
										>
											<Text
												className={`text-xs font-medium ${getApprovalStatusColor(
													selectedMessage.approvalStatus
												)}`}
											>
												{loc.t(
													`message.history.approval.${selectedMessage.approvalStatus.toLowerCase()}`
												) || selectedMessage.approvalStatus}
											</Text>
										</View>
									</View>
									<View className="flex-row items-center">
										<Text className="text-gray-600 mr-2">
											{loc.t('message.history.sentStatus') || 'Sent Status'}:
										</Text>
										<View
											className={`px-2 py-1 rounded-full ${getSentStatusBgColor(
												selectedMessage.sentStatus
											)}`}
										>
											<Text
												className={`text-xs font-medium ${getSentStatusColor(
													selectedMessage.sentStatus
												)}`}
											>
												{loc.t(
													`message.history.sent.${selectedMessage.sentStatus.toLowerCase()}`
												) || selectedMessage.sentStatus}
											</Text>
										</View>
									</View>
								</View>
							</View>

							{/* Recipients */}
							<View className="mb-4">
								<Text className="text-sm font-semibold text-gray-700 mb-2">
									{loc.t('message.history.recipients') || 'Recipients'} (
									{translateNumber(selectedMessage.phoneNumbers.length)})
								</Text>
								<View className="bg-gray-50 p-3 rounded-lg">
									{selectedMessage.phoneNumbers.map((phone, index) => (
										<Text key={index} className="text-gray-600 mb-1">
											• {translatePhone(phone)}
										</Text>
									))}
								</View>
							</View>

							{/* Cost Information */}
							<View className="mb-4">
								<Text className="text-sm font-semibold text-gray-700 mb-2">
									{loc.t('message.history.costInfo') || 'Cost Information'}
								</Text>
								<View className="bg-gray-50 p-3 rounded-lg">
									<Text className="text-gray-600">
										{loc.t('message.history.totalCost') || 'Total Cost'}:{' '}
										{translateNumber(selectedMessage.totalCost)}{' '}
										{loc.t('message.history.credits') || 'Credits'}
									</Text>
								</View>
							</View>
						</ScrollView>
					)}
				</View>
			</View>
		</Modal>
	)

	return (
		<SafeAreaView className="flex-1 bg-gray-50">
			<View className="px-4 pt-4 pb-2"></View>

			{loading ? (
				<ScrollView className="flex-1 px-4">
					{[1, 2, 3, 4, 5].map((item) => (
						<ContentLoader
							key={item}
							width="100%"
							height={120}
							backgroundColor="#f3f4f6"
							foregroundColor="#e5e7eb"
							style={{ marginBottom: 12 }}
						>
							<Rect x="0" y="0" rx="8" ry="8" width="100%" height="120" />
						</ContentLoader>
					))}
				</ScrollView>
			) : messages.length === 0 ? (
				<View className="flex-1 justify-center items-center px-4">
					<MaterialIcons name="message" size={64} color="#D1D5DB" />
					<Text className="text-lg font-medium text-gray-600 mt-4 text-center">
						{loc.t('message.history.noMessages') || 'No messages found'}
					</Text>
					<Text className="text-sm text-gray-500 mt-2 text-center">
						{loc.t('message.history.noMessagesDesc') ||
							'Your sent messages will appear here'}
					</Text>
				</View>
			) : (
				<ScrollView className="flex-1 px-4">
					{messages.map((message) => (
						<MessageCard key={message.id} message={message} />
					))}
				</ScrollView>
			)}

			<MessageDetailModal />
		</SafeAreaView>
	)
}

export default MessageHistoryPage
