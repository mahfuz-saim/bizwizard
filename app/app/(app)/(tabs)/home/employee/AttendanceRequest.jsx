import React, { useState, useEffect } from 'react'
import {
	View,
	Text,
	FlatList,
	TouchableOpacity,
	RefreshControl,
	StatusBar,
	StyleSheet,
	Dimensions,
	ToastAndroid,
} from 'react-native'
import AntDesign from '@expo/vector-icons/AntDesign'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { DeleteModal } from '../../../../../src/components/AlertModal.jsx'
import { attendanceController } from '../../../../../src/controllers/attendance'
import useApi from '../../../../../src/hooks/useApi'
import { useLocalization } from '../../../../../src/localization/localizationContext'

const { width: screenWidth } = Dimensions.get('window')

const AttendanceRequestsScreen = () => {
	const { fetchData } = useApi()
	const { loc } = useLocalization()

	const [attendanceRequests, setAttendanceRequests] = useState([])
	const [loading, setLoading] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const [showConfirmModal, setShowConfirmModal] = useState(false)
	const [pendingAction, setPendingAction] = useState(null)

	useEffect(() => {
		fetchAttendanceRequests()
	}, [])

	const fetchAttendanceRequests = async () => {
		setLoading(true)
		try {
			const result = await fetchData(
				attendanceController.getPendingAttendance,
				{}
			)
			if (!result?.success) {
				console.error('Failed to fetch attendance requests:', result?.message)
				setAttendanceRequests([])
				setLoading(false)
				return
			}

			setAttendanceRequests(result.data ?? [])
			setLoading(false)
		} catch (error) {
			console.error('Error fetching attendance requests:', error)
			setLoading(false)
		}
	}

	const onRefresh = async () => {
		setRefreshing(true)
		await fetchAttendanceRequests()
		setRefreshing(false)
	}

	const updateAttendanceStatus = async (attendanceId, inStatus, outStatus) => {
		try {
			// Update local state
			setAttendanceRequests((prev) =>
				prev.map((request) =>
					request.id === attendanceId
						? { ...request, inStatus, outStatus }
						: request
				)
			)

			ToastAndroid.show(
				loc.t('attendance.requests.updateSuccess') || 'Success',
				ToastAndroid.SHORT
			)
		} catch (error) {
			console.error('Error updating attendance:', error)
			ToastAndroid.show(
				loc.t('attendance.requests.updateError') || 'Error',
				ToastAndroid.SHORT
			)
		}
	}

	const handleApprove = async (request, type) => {
		const newInStatus = type === 'in' ? 'PRESENT' : request.inStatus
		const newOutStatus = type === 'out' ? 'PRESENT' : request.outStatus

		const actionText = `${loc.t('attendance.requests.approve')} ${
			type === 'in'
				? loc.t('attendance.requests.clockInRequest').toLowerCase()
				: loc.t('attendance.requests.clockOutRequest').toLowerCase()
		} for ${request.Employee.name}`

		setPendingAction({
			type: 'approve',
			request,
			requestType: type,
			newInStatus,
			newOutStatus,
			title: loc.t('attendance.requests.approve'),
			subtitle: `${loc.t('attendance.requests.confirmAction')} ${actionText}?`,
		})
		setShowConfirmModal(true)
	}

	const handleReject = async (request, type) => {
		const newInStatus = type === 'in' ? 'ABSENT' : request.inStatus
		const newOutStatus = type === 'out' ? 'ABSENT' : request.outStatus

		const actionText = `${loc.t('attendance.requests.reject')} ${
			type === 'in'
				? loc.t('attendance.requests.clockInRequest').toLowerCase()
				: loc.t('attendance.requests.clockOutRequest').toLowerCase()
		} for ${request.Employee.name}`

		setPendingAction({
			type: 'reject',
			request,
			requestType: type,
			newInStatus,
			newOutStatus,
			title: loc.t('attendance.requests.reject'),
			subtitle: `${loc.t('attendance.requests.confirmAction')} ${actionText}?`,
		})
		setShowConfirmModal(true)
	}

	const handleConfirmAction = async () => {
		if (!pendingAction) return

		const { request, newInStatus, newOutStatus } = pendingAction
		const params = {
			attendanceId: request.id,
			inStatus: newInStatus,
			outStatus: newOutStatus,
		}

		try {
			await fetchData(attendanceController.handleAttendanceRequest, params)
			updateAttendanceStatus(request.id, newInStatus, newOutStatus)
		} catch (error) {
			ToastAndroid.show(
				loc.t('attendance.requests.updateError') ||
					'Failed to update attendance',
				ToastAndroid.SHORT
			)
		} finally {
			setShowConfirmModal(false)
			setPendingAction(null)
		}
	}

	const formatTime = (dateTime) => {
		if (!dateTime) return '--:--'
		return new Date(dateTime).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		})
	}

	const formatDate = (dateTime) => {
		return new Date(dateTime).toLocaleDateString([], {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
		})
	}

	const getStatusColor = (status) => {
		switch (status) {
			case 'REQUESTED':
				return 'text-orange-600 bg-orange-50'
			case 'PRESENT':
				return 'text-green-600 bg-green-50'
			case 'ABSENT':
				return 'text-red-600 bg-red-50'
			case 'LATE':
				return 'text-yellow-600 bg-yellow-50'
			case 'PENDING':
				return 'text-gray-600 bg-gray-50'
			default:
				return 'text-gray-600 bg-gray-50'
		}
	}

	const hasRequestedStatus = (request) => {
		return request.inStatus === 'REQUESTED' || request.outStatus === 'REQUESTED'
	}

	const filteredRequests = attendanceRequests.filter(hasRequestedStatus)

	const renderRequestItem = ({ item: request, index }) => {
		return (
			<View style={[styles.requestCard, { marginTop: index === 0 ? 0 : 12 }]}>
				<View style={styles.cardHeader}>
					<View style={styles.avatarContainer}>
						<Text style={styles.avatarText}>
							{request.Employee.name.charAt(0).toUpperCase()}
						</Text>
					</View>
					<View style={styles.userInfo}>
						<Text style={styles.userName}>{request.Employee.name}</Text>
						<Text style={styles.userPhone}>{request.Employee.email}</Text>
						<View style={styles.statusBadge}>
							<Text style={styles.statusText}>{formatDate(request.date)}</Text>
						</View>
					</View>
				</View>

				{/* Clock In Section */}
				{request.inStatus === 'REQUESTED' && (
					<View style={styles.requestSection}>
						<View style={styles.requestHeader}>
							<View style={styles.requestType}>
								<View style={[styles.dot, { backgroundColor: '#10B981' }]} />
								<Text style={styles.requestTypeText}>
									{loc.t('attendance.requests.clockInRequest')}
								</Text>
							</View>
							<Text style={styles.timeText}>{formatTime(request.inTime)}</Text>
						</View>
						<View style={styles.actionContainer}>
							<TouchableOpacity
								style={[styles.actionButton, styles.approveButton]}
								onPress={() => handleApprove(request, 'in')}
								activeOpacity={0.8}
							>
								<AntDesign name="check" size={18} color="#ffffff" />
								<Text style={styles.approveButtonText}>
									{loc.t('attendance.requests.approve')}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.actionButton, styles.rejectButton]}
								onPress={() => handleReject(request, 'in')}
								activeOpacity={0.8}
							>
								<AntDesign name="close" size={18} color="#ffffff" />
								<Text style={styles.rejectButtonText}>
									{loc.t('attendance.requests.reject')}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				)}

				{/* Clock Out Section */}
				{request.outStatus === 'REQUESTED' && (
					<View
						style={[
							styles.requestSection,
							request.inStatus === 'REQUESTED' && styles.borderTop,
						]}
					>
						<View style={styles.requestHeader}>
							<View style={styles.requestType}>
								<View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
								<Text style={styles.requestTypeText}>
									{loc.t('attendance.requests.clockOutRequest')}
								</Text>
							</View>
							<Text style={styles.timeText}>{formatTime(request.outTime)}</Text>
						</View>
						<View style={styles.actionContainer}>
							<TouchableOpacity
								style={[styles.actionButton, styles.approveButton]}
								onPress={() => handleApprove(request, 'out')}
								activeOpacity={0.8}
							>
								<AntDesign name="check" size={18} color="#ffffff" />
								<Text style={styles.approveButtonText}>
									{loc.t('attendance.requests.approve')}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.actionButton, styles.rejectButton]}
								onPress={() => handleReject(request, 'out')}
								activeOpacity={0.8}
							>
								<AntDesign name="close" size={18} color="#ffffff" />
								<Text style={styles.rejectButtonText}>
									{loc.t('attendance.requests.reject')}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				)}
			</View>
		)
	}

	const renderEmptyState = () => (
		<View style={styles.emptyContainer}>
			<AntDesign name="clockcircleo" size={80} color="#D1D5DB" />
			<Text style={styles.emptyTitle}>
				{loc.t('attendance.requests.noPendingRequests')}
			</Text>
			<Text style={styles.emptySubtitle}>
				{loc.t('attendance.requests.allRequestsProcessed')}
			</Text>
		</View>
	)

	const renderHeader = () => (
		<View style={styles.headerContainer}>
			<View style={styles.headerContent}>
				<Text style={styles.headerSubtitle}>
					{filteredRequests.length}{' '}
					{loc.t('attendance.requests.pendingRequest')}
					{filteredRequests.length !== 1
						? loc.t('attendance.requests.pluralSuffix')
						: ''}
				</Text>
				<TouchableOpacity
					style={styles.refreshButton}
					onPress={fetchAttendanceRequests}
					activeOpacity={0.7}
				>
					<MaterialIcons name="refresh" size={24} color="#6592E5" />
				</TouchableOpacity>
			</View>
		</View>
	)

	const getStatusStyle = (status) => {
		switch (status) {
			case 'REQUESTED':
				return { backgroundColor: '#FEF3C7' }
			case 'PRESENT':
				return { backgroundColor: '#D1FAE5' }
			case 'ABSENT':
				return { backgroundColor: '#FEE2E2' }
			case 'LATE':
				return { backgroundColor: '#FEF3C7' }
			case 'PENDING':
				return { backgroundColor: '#F3F4F6' }
			default:
				return { backgroundColor: '#F3F4F6' }
		}
	}

	const getStatusTextStyle = (status) => {
		switch (status) {
			case 'REQUESTED':
				return { color: '#D97706' }
			case 'PRESENT':
				return { color: '#065F46' }
			case 'ABSENT':
				return { color: '#DC2626' }
			case 'LATE':
				return { color: '#D97706' }
			case 'PENDING':
				return { color: '#6B7280' }
			default:
				return { color: '#6B7280' }
		}
	}

	return (
		<View style={styles.container}>
			<StatusBar barStyle="light-content" backgroundColor="#195FE1" />

			{renderHeader()}

			<View style={styles.contentContainer}>
				{loading ? (
					<View style={styles.loadingContainer}>
						<Text style={styles.loadingText}>
							{loc.t('attendance.requests.loadingRequests')}
						</Text>
					</View>
				) : (
					<FlatList
						data={filteredRequests}
						keyExtractor={(item) => item.id}
						renderItem={renderRequestItem}
						ListEmptyComponent={renderEmptyState}
						contentContainerStyle={styles.listContainer}
						showsVerticalScrollIndicator={false}
						refreshControl={
							<RefreshControl
								refreshing={refreshing}
								onRefresh={onRefresh}
								colors={['#195FE1']}
								tintColor="#195FE1"
							/>
						}
					/>
				)}
			</View>

			{/* Confirmation Modal */}
			<DeleteModal
				visible={showConfirmModal}
				onClose={() => {
					setShowConfirmModal(false)
					setPendingAction(null)
				}}
				onConfirm={handleConfirmAction}
				title={
					pendingAction?.title || loc.t('attendance.requests.confirmAction')
				}
				subtitle={
					pendingAction?.subtitle || loc.t('attendance.requests.confirmAction')
				}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F8FAFC',
	},
	headerContainer: {
		backgroundColor: '#195FE1',
		paddingTop: 10,
		paddingBottom: 10,
		paddingHorizontal: 20,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-end',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 3.84,
		elevation: 5,
	},
	headerContent: {
		flex: 1,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	headerSubtitle: {
		fontSize: 16,
		color: '#E5E7EB',
	},
	refreshButton: {
		width: 44,
		height: 44,
		backgroundColor: 'rgba(255, 255, 255, 0.2)',
		borderRadius: 22,
		alignItems: 'center',
		justifyContent: 'center',
	},
	contentContainer: {
		flex: 1,
		paddingTop: 20,
	},
	listContainer: {
		paddingHorizontal: 16,
		paddingBottom: 20,
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	loadingText: {
		fontSize: 16,
		color: '#6B7280',
		marginTop: 16,
	},
	emptyContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 40,
		paddingVertical: 60,
	},
	emptyTitle: {
		fontSize: 24,
		fontWeight: '600',
		color: '#374151',
		marginTop: 16,
		marginBottom: 8,
		textAlign: 'center',
	},
	emptySubtitle: {
		fontSize: 16,
		color: '#6B7280',
		textAlign: 'center',
		lineHeight: 24,
	},
	requestCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		padding: 20,
		marginBottom: 16,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 3.84,
		elevation: 5,
		borderLeftWidth: 4,
		borderLeftColor: '#195FE1',
	},
	cardHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 16,
	},
	avatarContainer: {
		width: 50,
		height: 50,
		borderRadius: 25,
		backgroundColor: '#195FE1',
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 16,
	},
	avatarText: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#FFFFFF',
	},
	userInfo: {
		flex: 1,
	},
	userName: {
		fontSize: 18,
		fontWeight: '600',
		color: '#1F2937',
		marginBottom: 4,
	},
	userPhone: {
		fontSize: 14,
		color: '#6B7280',
		marginBottom: 8,
	},
	statusBadge: {
		backgroundColor: '#FEF3C7',
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 12,
		alignSelf: 'flex-start',
	},
	statusText: {
		fontSize: 12,
		fontWeight: '500',
		color: '#D97706',
	},
	requestSection: {
		marginBottom: 16,
	},
	borderTop: {
		borderTopWidth: 1,
		borderTopColor: '#F3F4F6',
		paddingTop: 16,
	},
	requestHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 12,
	},
	requestType: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		marginRight: 8,
	},
	requestTypeText: {
		fontSize: 14,
		fontWeight: '500',
		color: '#374151',
	},
	timeText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#111827',
	},
	actionContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
	},
	actionButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 12,
		gap: 8,
	},
	approveButton: {
		backgroundColor: '#10B981',
	},
	rejectButton: {
		backgroundColor: '#EF4444',
	},
	approveButtonText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '600',
	},
	rejectButtonText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '600',
	},
})

export default AttendanceRequestsScreen
