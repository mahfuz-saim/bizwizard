import React, { useState, useEffect, useMemo, useCallback, memo } from 'react'
import {
	View,
	Text,
	FlatList,
	TouchableOpacity,
	RefreshControl,
	ToastAndroid,
	Modal,
	Dimensions,
	StyleSheet,
} from 'react-native'
import { Ionicons, MaterialIcons } from '@expo/vector-icons'
import ContentLoader, { Rect } from 'react-content-loader/native'
import useApi from '../../../../src/hooks/useApi'
import { notificationController } from '../../../../src/controllers/notification'
import { useLocalization } from '../../../../src/localization/localizationContext'

const { width } = Dimensions.get('window')

// Memoized skeleton loader for better performance
const NotificationSkeleton = memo(() => (
	<View style={styles.skeletonContainer}>
		<ContentLoader
			speed={2}
			width={width - 32}
			height={80}
			viewBox={`0 0 ${width - 32} 80`}
			backgroundColor="#f3f3f3"
			foregroundColor="#ecebeb"
		>
			<Rect x="16" y="16" rx="4" ry="4" width="200" height="16" />
			<Rect x="16" y="40" rx="3" ry="3" width="100" height="12" />
			<Rect x={width - 80} y="20" rx="50" ry="50" width="12" height="12" />
		</ContentLoader>
	</View>
))

// Memoized notification item for better performance
const NotificationItem = memo(({ item, onPress, formatDate, loc }) => {
	const handlePress = useCallback(() => {
		onPress(item)
	}, [item, onPress])

	return (
		<TouchableOpacity
			onPress={handlePress}
			style={[
				styles.notificationItem,
				item.isRead ? styles.readNotification : styles.unreadNotification,
			]}
		>
			<View style={styles.notificationContent}>
				<View style={styles.notificationHeader}>
					<View style={styles.notificationTextContainer}>
						<Text style={styles.notificationTitle} numberOfLines={2}>
							{item.title}
						</Text>
						<Text style={styles.notificationTime}>
							{formatDate(item.createdAt)}
						</Text>
					</View>
					{!item.isRead && <View style={styles.unreadIndicator} />}
				</View>
			</View>
		</TouchableOpacity>
	)
})

// Memoized empty state component
const EmptyState = memo(({ loc }) => (
	<View style={styles.emptyStateContainer}>
		<View style={styles.emptyStateIcon}>
			<Ionicons name="notifications-outline" size={40} color="#9CA3AF" />
		</View>
		<Text style={styles.emptyStateTitle}>
			{loc?.t('notifications.noNotifications') || 'No notifications'}
		</Text>
		<Text style={styles.emptyStateDescription}>
			{loc?.t('notifications.allCaughtUp') ||
				"You're all caught up! We'll notify you when there's something new."}
		</Text>
	</View>
))

// Memoized notification modal
const NotificationModal = memo(({ visible, notification, onClose, loc }) => {
	const formatTime = useCallback((timestamp) => {
		return new Date(timestamp).toLocaleString()
	}, [])

	const handleClose = useCallback(() => {
		onClose()
	}, [onClose])

	if (!notification) return null

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={handleClose}
		>
			<View style={styles.modalOverlay}>
				<View
					style={[styles.modalContainer, { width: Math.min(width - 40, 400) }]}
				>
					{/* Header */}
					<View style={styles.modalHeader}>
						<View style={styles.modalHeaderLeft}>
							<Ionicons name="notifications" size={24} color="#195FE1" />
							<Text style={styles.modalHeaderTitle}>
								{loc?.t('notifications.readNotification') || 'New Notification'}
							</Text>
						</View>
						<TouchableOpacity onPress={handleClose} style={styles.closeButton}>
							<MaterialIcons name="close" size={24} color="#6B7280" />
						</TouchableOpacity>
					</View>

					{/* Content */}
					<View style={styles.modalContent}>
						{/* Title */}
						<View style={styles.modalTitleContainer}>
							<Text style={styles.modalTitle}>
								{notification.title ||
									loc?.t('notifications.noTitle') ||
									'No Title'}
							</Text>
						</View>

						{/* Body */}
						<View style={styles.modalBodyContainer}>
							<Text style={styles.modalBody}>
								{notification.body ||
									loc?.t('notifications.noMessage') ||
									'No Message'}
							</Text>
						</View>

						{/* Time */}
						<View style={styles.modalTimeContainer}>
							<MaterialIcons name="access-time" size={16} color="#6B7280" />
							<Text style={styles.modalTime}>
								{formatTime(notification.createdAt)}
							</Text>
						</View>
					</View>

					{/* Actions */}
					<View style={styles.modalActions}>
						<TouchableOpacity onPress={handleClose} style={styles.okayButton}>
							<Text style={styles.okayButtonText}>
								{loc?.t('common.okay') || 'Okay'}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	)
})

const Notification = () => {
	const [notifications, setNotifications] = useState([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [selectedNotification, setSelectedNotification] = useState(null)
	const [modalVisible, setModalVisible] = useState(false)
	const { fetchData } = useApi()
	const { loc } = useLocalization()

	// Memoized format date function to prevent re-creation
	const formatDate = useCallback(
		(dateString) => {
			const date = new Date(dateString)
			const now = new Date()
			const diffInHours = (now - date) / (1000 * 60 * 60)

			if (diffInHours < 1) {
				return loc?.t('notifications.justNow') || 'Just now'
			} else if (diffInHours < 24) {
				return `${Math.floor(diffInHours)}${
					loc?.t('notifications.hoursAgo') || 'h ago'
				}`
			} else if (diffInHours < 48) {
				return loc?.t('notifications.yesterday') || 'Yesterday'
			} else {
				return date.toLocaleDateString()
			}
		},
		[loc]
	)

	// Fetch notifications on component mount
	useEffect(() => {
		fetchNotifications()
	}, [])

	const fetchNotifications = useCallback(async () => {
		try {
			setLoading(true)
			const response = await fetchData(
				notificationController.getAllNotifications,
				{}
			)
			if (response?.data) {
				// Show all notifications, both read and unread
				// Add isRead property based on ReadStatus array
				const notificationsWithReadStatus = response.data.map(
					(notification) => ({
						...notification,
						isRead:
							notification.ReadStatus &&
							notification.ReadStatus.length > 0 &&
							notification.ReadStatus[0].isRead,
					})
				)
				setNotifications(notificationsWithReadStatus)
			}
		} catch (error) {
			console.error('Error fetching notifications:', error)
			ToastAndroid.show(
				loc?.t('notifications.loadError') || 'Failed to load notifications',
				ToastAndroid.SHORT
			)
		} finally {
			setLoading(false)
		}
	}, [fetchData, loc])

	const handleRefresh = useCallback(async () => {
		setRefreshing(true)
		await fetchNotifications()
		setRefreshing(false)
	}, [fetchNotifications])

	const handleNotificationPress = useCallback(
		async (notification) => {
			// If notification is unread, mark it as read
			if (!notification.isRead) {
				try {
					const response = await fetchData(
						notificationController.markNotificationAsRead,
						{ id: notification.id }
					)

					if (response?.data) {
						// Update the notification in the list to mark it as read
						setNotifications((prevNotifications) =>
							prevNotifications.map((notif) =>
								notif.id === notification.id
									? { ...notif, isRead: true }
									: notif
							)
						)
					}
				} catch (error) {
					console.error('Error marking notification as read:', error)
				}
			}

			// Show the notification modal
			setSelectedNotification(notification)
			setModalVisible(true)
		},
		[fetchData]
	)

	const handleCloseModal = useCallback(() => {
		setModalVisible(false)
		setSelectedNotification(null)
	}, [])

	// Memoized render functions
	const renderNotificationItem = useCallback(
		({ item }) => (
			<NotificationItem
				item={item}
				onPress={handleNotificationPress}
				formatDate={formatDate}
				loc={loc}
			/>
		),
		[handleNotificationPress, formatDate, loc]
	)

	const renderEmptyState = useCallback(() => <EmptyState loc={loc} />, [loc])

	// Memoized skeleton loader for list
	const renderSkeletonItem = useCallback(() => <NotificationSkeleton />, [])

	// Memoized skeleton data for loading state
	const skeletonData = useMemo(
		() =>
			Array(6)
				.fill(null)
				.map((_, index) => ({ id: `skeleton-${index}` })),
		[]
	)

	// Memoized refresh control
	const refreshControl = useMemo(
		() => (
			<RefreshControl
				refreshing={refreshing}
				onRefresh={handleRefresh}
				colors={['#177DFF']}
				tintColor="#177DFF"
			/>
		),
		[refreshing, handleRefresh]
	)

	// Memoized key extractor
	const keyExtractor = useCallback((item) => item.id, [])

	// Memoized getItemLayout for better performance
	const getItemLayout = useCallback(
		(data, index) => ({
			length: 92, // Height of each item (80 + 12 margin)
			offset: 92 * index,
			index,
		}),
		[]
	)

	if (loading) {
		return (
			<View style={styles.container}>
				<FlatList
					data={skeletonData}
					keyExtractor={keyExtractor}
					renderItem={renderSkeletonItem}
					contentContainerStyle={styles.listContainer}
					showsVerticalScrollIndicator={false}
					removeClippedSubviews={true}
					maxToRenderPerBatch={10}
					windowSize={10}
					initialNumToRender={6}
				/>
			</View>
		)
	}

	return (
		<View style={styles.container}>
			{/* Notifications List */}
			<FlatList
				data={notifications}
				keyExtractor={keyExtractor}
				renderItem={renderNotificationItem}
				contentContainerStyle={styles.listContainer}
				refreshControl={refreshControl}
				ListEmptyComponent={renderEmptyState}
				showsVerticalScrollIndicator={false}
				removeClippedSubviews={true}
				maxToRenderPerBatch={10}
				windowSize={10}
				initialNumToRender={8}
				getItemLayout={getItemLayout}
			/>

			<NotificationModal
				visible={modalVisible}
				notification={selectedNotification}
				onClose={handleCloseModal}
				loc={loc}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F9FAFB',
	},
	listContainer: {
		flexGrow: 1,
		paddingTop: 16,
		paddingBottom: 20,
	},
	skeletonContainer: {
		marginHorizontal: 16,
		marginBottom: 12,
		borderRadius: 12,
		backgroundColor: '#FFFFFF',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
	},
	notificationItem: {
		marginHorizontal: 16,
		marginBottom: 12,
		borderRadius: 12,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
		borderWidth: 1,
		borderColor: '#F3F4F6',
	},
	readNotification: {
		backgroundColor: '#F9FAFB',
	},
	unreadNotification: {
		backgroundColor: '#FFFFFF',
	},
	notificationContent: {
		padding: 16,
	},
	notificationHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	notificationTextContainer: {
		flex: 1,
		marginRight: 12,
	},
	notificationTitle: {
		color: '#111827',
		fontWeight: '600',
		fontSize: 16,
		marginBottom: 4,
	},
	notificationTime: {
		color: '#9CA3AF',
		fontSize: 12,
	},
	unreadIndicator: {
		width: 12,
		height: 12,
		backgroundColor: '#177DFF',
		borderRadius: 6,
	},
	emptyStateContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 24,
	},
	emptyStateIcon: {
		backgroundColor: '#F3F4F6',
		width: 96,
		height: 96,
		borderRadius: 48,
		justifyContent: 'center',
		alignItems: 'center',
		marginBottom: 16,
	},
	emptyStateTitle: {
		color: '#111827',
		fontSize: 20,
		fontWeight: '600',
		marginBottom: 8,
		textAlign: 'center',
	},
	emptyStateDescription: {
		color: '#6B7280',
		textAlign: 'center',
		lineHeight: 24,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 20,
	},
	modalContainer: {
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 10,
		},
		shadowOpacity: 0.25,
		shadowRadius: 20,
		elevation: 10,
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
	},
	modalHeaderLeft: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	modalHeaderTitle: {
		marginLeft: 8,
		fontSize: 18,
		fontWeight: '600',
		color: '#111827',
	},
	closeButton: {
		padding: 4,
	},
	modalContent: {
		padding: 20,
	},
	modalTitleContainer: {
		marginBottom: 20,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: '600',
		color: '#111827',
		lineHeight: 28,
	},
	modalBodyContainer: {
		marginBottom: 20,
	},
	modalBody: {
		fontSize: 16,
		color: '#374151',
		lineHeight: 24,
	},
	modalTimeContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	modalTime: {
		marginLeft: 6,
		fontSize: 14,
		color: '#6B7280',
	},
	modalActions: {
		padding: 20,
		borderTopWidth: 1,
		borderTopColor: '#E5E7EB',
	},
	okayButton: {
		backgroundColor: '#195FE1',
		paddingVertical: 12,
		borderRadius: 8,
		alignItems: 'center',
	},
	okayButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
})

export default memo(Notification)
