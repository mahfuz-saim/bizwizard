import {
	View,
	Text,
	FlatList,
	TouchableOpacity,
	ToastAndroid,
	StyleSheet,
	Dimensions,
	RefreshControl,
	StatusBar,
} from 'react-native'
import { useState, useEffect } from 'react'
import { ConfirmModal } from '../../../../../src/components/AlertModal.jsx'
import useApi from '../../../../../src/hooks/useApi'
import {
	getJoinRequests,
	updateEmployeeJoinRequest,
} from '../../../../../src/controllers/shop'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import AntDesign from '@expo/vector-icons/AntDesign'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import { Modal } from 'react-native'
import { router } from 'expo-router'

export default function JoinRequests() {
	const { fetchData } = useApi()
	const { loc } = useLocalization()
	const [joinRequests, setJoinRequests] = useState([])
	const [refreshing, setRefreshing] = useState(false)
	const [loading, setLoading] = useState(true)
	const [showSubscriptionLimitModal, setShowSubscriptionLimitModal] =
		useState(false)
	const [showConfirmModal, setShowConfirmModal] = useState(false)
	const [pendingAction, setPendingAction] = useState(null)

	async function fetchRequests() {
		try {
			setRefreshing(true)
			const res = await fetchData(getJoinRequests, {})
			if (!res.success) {
				throw new Error('Failed to fetch join requests')
			}
			setJoinRequests(res.data)
		} catch (err) {
			console.error(err)
			ToastAndroid.show(
				loc.t('joinRequest.fetchError') || 'Failed to fetch join requests',
				ToastAndroid.SHORT
			)
		} finally {
			setRefreshing(false)
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchRequests()
	}, [])

	const handleJoinRequest = async (data, status) => {
		const payload = {
			shopId: data.shopID,
			employeeId: data.User.userID,
			status: status,
		}

		const title =
			status === 'ACCEPTED'
				? loc.t('joinRequest.acceptRequest')
				: loc.t('joinRequest.rejectRequest')

		const subtitle = `${loc.t('joinRequest.confirmAction')}`

		setPendingAction({ payload, status, title, subtitle })
		setShowConfirmModal(true)
	}

	const handleConfirmAction = async () => {
		if (!pendingAction) return

		const { payload, status } = pendingAction

		try {
			const result = await fetchData(updateEmployeeJoinRequest, payload)

			if (!result.success) {
				if (
					result?.message ===
					'You have reached the maximum number of employees allowed by your subscription plan.'
				) {
					setShowSubscriptionLimitModal(true)
				} else {
					ToastAndroid.show(
						loc.t('joinRequest.updateError') || 'Failed to update request',
						ToastAndroid.SHORT
					)
				}
			} else {
				ToastAndroid.show(
					`${loc.t('joinRequest.requestText')} ${
						status === 'ACCEPTED'
							? loc.t('joinRequest.accepted').toLowerCase()
							: loc.t('joinRequest.rejected').toLowerCase()
					} ${loc.t('joinRequest.successfully')}` ||
						'Request updated successfully',
					ToastAndroid.SHORT
				)
				await fetchRequests() // Refresh the list after updating
			}
		} catch (error) {
			ToastAndroid.show(
				loc.t('joinRequest.unexpectedError') || 'An unexpected error occurred',
				ToastAndroid.SHORT
			)
		} finally {
			setShowConfirmModal(false)
			setPendingAction(null)
		}
	}

	const renderRequestItem = ({ item: data, index }) => {
		return (
			<View style={[styles.requestCard, { marginTop: index === 0 ? 0 : 12 }]}>
				<View style={styles.cardHeader}>
					<View style={styles.avatarContainer}>
						<Text style={styles.avatarText}>
							{data.User.name.charAt(0).toUpperCase()}
						</Text>
					</View>
					<View style={styles.userInfo}>
						<Text style={styles.userName}>{data.User.name}</Text>
						<Text style={styles.userPhone}>{data.User.number}</Text>
						<View style={styles.statusBadge}>
							<Text style={styles.statusText}>
								{loc.t('joinRequest.pendingReview')}
							</Text>
						</View>
					</View>
				</View>

				<View style={styles.actionContainer}>
					<TouchableOpacity
						style={[styles.actionButton, styles.acceptButton]}
						onPress={() => handleJoinRequest(data, 'ACCEPTED')}
						activeOpacity={0.8}
					>
						<AntDesign name="check" size={18} color="#ffffff" />
						<Text style={styles.acceptButtonText}>
							{loc.t('joinRequest.accept')}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={[styles.actionButton, styles.rejectButton]}
						onPress={() => handleJoinRequest(data, 'REJECTED')}
						activeOpacity={0.8}
					>
						<AntDesign name="close" size={18} color="#ffffff" />
						<Text style={styles.rejectButtonText}>
							{loc.t('joinRequest.reject')}
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		)
	}

	const renderEmptyState = () => (
		<View style={styles.emptyContainer}>
			<MaterialIcons name="people-outline" size={80} color="#D1D5DB" />
			<Text style={styles.emptyTitle}>
				{loc.t('joinRequest.noPendingRequests')}
			</Text>
			<Text style={styles.emptySubtitle}>
				{loc.t('joinRequest.emptyStateMessage')}
			</Text>
		</View>
	)

	const renderHeader = () => (
		<View style={styles.headerContainer}>
			<View style={styles.headerContent}>
				<Text style={styles.headerSubtitle}>
					{joinRequests.length} {loc.t('joinRequest.pendingRequest')}
					{joinRequests.length !== 1 ? loc.t('joinRequest.pluralSuffix') : ''}
				</Text>
				<TouchableOpacity
					style={styles.refreshButton}
					onPress={fetchRequests}
					activeOpacity={0.7}
				>
					<MaterialIcons name="refresh" size={24} color="#6592E5" />
				</TouchableOpacity>
			</View>
		</View>
	)

	return (
		<View style={styles.container}>
			<StatusBar barStyle="light-content" backgroundColor="#6592E5" />

			{renderHeader()}

			<View style={styles.contentContainer}>
				{loading ? (
					<View style={styles.loadingContainer}>
						<Text style={styles.loadingText}>
							{loc.t('joinRequest.loadingRequests')}
						</Text>
					</View>
				) : (
					<FlatList
						data={joinRequests}
						keyExtractor={(item) => item.userID}
						renderItem={renderRequestItem}
						ListEmptyComponent={renderEmptyState}
						contentContainerStyle={styles.listContainer}
						showsVerticalScrollIndicator={false}
						refreshControl={
							<RefreshControl
								refreshing={refreshing}
								onRefresh={fetchRequests}
								colors={['#6592E5']}
								tintColor="#6592E5"
							/>
						}
					/>
				)}
			</View>

			{/* Subscription Limit Modal */}
			<Modal
				visible={showSubscriptionLimitModal}
				transparent
				animationType="fade"
				onRequestClose={() => setShowSubscriptionLimitModal(false)}
			>
				<View style={styles.modalBackdrop}>
					<View style={styles.modalContainer}>
						<Text style={styles.modalTitle}>
							{loc.t('joinRequest.subscriptionLimitTitle')}
						</Text>
						<Text style={styles.modalMessage}>
							{loc.t('joinRequest.subscriptionLimitMessage')}
						</Text>
						<View style={styles.modalActions}>
							<TouchableOpacity
								style={[styles.modalButton, styles.modalCancelButton]}
								onPress={() => setShowSubscriptionLimitModal(false)}
							>
								<Text style={styles.modalCancelText}>
									{loc.t('joinRequest.cancel')}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.modalButton, styles.modalPrimaryButton]}
								onPress={() => {
									setShowSubscriptionLimitModal(false)
									router.push('/home/subscriptionBuy')
								}}
							>
								<Text style={styles.modalPrimaryText}>
									{loc.t('joinRequest.buySubscription')}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>

			{/* Confirmation Modal */}
			<ConfirmModal
				visible={showConfirmModal}
				onClose={() => {
					setShowConfirmModal(false)
					setPendingAction(null)
				}}
				onConfirm={handleConfirmAction}
				title={pendingAction?.title || loc.t('joinRequest.confirmAction')}
				subtitle={pendingAction?.subtitle || loc.t('joinRequest.confirmAction')}
				confirmText={
					pendingAction?.status === 'ACCEPTED'
						? loc.t('joinRequest.accept')
						: loc.t('joinRequest.reject')
				}
				cancelText={loc.t('joinRequest.cancel')}
				iconName={
					pendingAction?.status === 'ACCEPTED' ? 'check-circle' : 'cancel'
				}
				iconColor={pendingAction?.status === 'ACCEPTED' ? '#10B981' : '#EF4444'}
				confirmButtonColor={
					pendingAction?.status === 'ACCEPTED' ? '#10B981' : '#EF4444'
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
	requestCard: {
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		padding: 20,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 3.84,
		elevation: 5,
		borderLeftWidth: 4,
		borderLeftColor: '#6592E5',
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
		backgroundColor: '#6592E5',
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
	acceptButton: {
		backgroundColor: '#10B981',
	},
	rejectButton: {
		backgroundColor: '#EF4444',
	},
	acceptButtonText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '600',
	},
	rejectButtonText: {
		color: '#FFFFFF',
		fontSize: 14,
		fontWeight: '600',
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
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.5)',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24,
	},
	modalContainer: {
		backgroundColor: '#FFFFFF',
		borderRadius: 20,
		padding: 24,
		width: '100%',
		maxWidth: 420,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 8,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: '700',
		color: '#111827',
		marginBottom: 12,
		textAlign: 'center',
	},
	modalMessage: {
		fontSize: 15,
		color: '#374151',
		lineHeight: 22,
		textAlign: 'center',
		marginBottom: 24,
	},
	modalActions: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
	},
	modalButton: {
		flex: 1,
		paddingVertical: 14,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	modalCancelButton: {
		backgroundColor: '#E5E7EB',
	},
	modalPrimaryButton: {
		backgroundColor: '#177DFF',
	},
	modalCancelText: {
		color: '#1F2937',
		fontSize: 15,
		fontWeight: '600',
	},
	modalPrimaryText: {
		color: '#FFFFFF',
		fontSize: 15,
		fontWeight: '600',
	},
})
