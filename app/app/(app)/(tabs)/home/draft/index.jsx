import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
	Text,
	View,
	Image,
	FlatList,
	TouchableOpacity,
	ToastAndroid,
	Dimensions,
	StyleSheet,
	BackHandler,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import ContentLoader, { Rect } from 'react-content-loader/native'
import {
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetBackdrop,
} from '@gorhom/bottom-sheet'
import { DeleteModal } from '../../../../../src/components/AlertModal.jsx'
import useApi from '../../../../../src/hooks/useApi.jsx'
import {
	getAllDraft,
	deleteDraft,
} from '../../../../../src/controllers/draft.js'
import { useFocusEffect, router } from 'expo-router'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'

const { height: screenHeight } = Dimensions.get('window')

const getAvatarColor = (name) => {
	const colors = [
		'#1f2937',
		'#7c2d12',
		'#be123c',
		'#a21caf',
		'#7c3aed',
		'#2563eb',
		'#0891b2',
		'#059669',
		'#ca8a04',
		'#dc2626',
		'#9333ea',
		'#0d9488',
	]
	let hash = 0
	const safeName = name || 'Unknown'
	for (let i = 0; i < safeName.length; i++) {
		hash = safeName.charCodeAt(i) + ((hash << 5) - hash)
	}
	return colors[Math.abs(hash) % colors.length]
}

const ProductThumbnail = ({ image, name, size = 28 }) => {
	const [imageError, setImageError] = useState(false)
	const firstLetter = name ? name.charAt(0).toUpperCase() : '?'
	const backgroundColor = getAvatarColor(name || '')

	const renderAvatar = () => (
		<View
			style={{
				width: size,
				height: size,
				backgroundColor,
				borderRadius: size / 2,
				justifyContent: 'center',
				alignItems: 'center',
				flexShrink: 0,
			}}
		>
			<Text style={{ fontSize: size * 0.4, fontWeight: '500', color: 'white' }}>
				{firstLetter}
			</Text>
		</View>
	)

	if (!image || imageError) return renderAvatar()

	return (
		<Image
			source={{ uri: image }}
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				flexShrink: 0,
			}}
			onError={() => setImageError(true)}
			resizeMode="cover"
		/>
	)
}

export default function Draft() {
	const { fetchData } = useApi()
	const { loc } = useLocalization()
	const { translateNumber, translateAmount } = useNumberTranslator()
	const [draftOrders, setDraftOrders] = useState([])
	const [selectedDraft, setSelectedDraft] = useState(null)
	const [loading, setLoading] = useState(true)
	const [showDeleteModal, setShowDeleteModal] = useState(false)
	const [draftToDelete, setDraftToDelete] = useState(null)
	const bottomSheetModalRef = useRef(null)
	const snapPoints = useMemo(() => ['85%'], [])

	useFocusEffect(
		useCallback(() => {
			async function fetchDraftOrders() {
				try {
					setLoading(true)
					const res = await fetchData(getAllDraft, {})
					if (!res.success) {
						ToastAndroid.show(
							loc.t('draft.fetchError') || 'Failed to fetch draft orders',
							ToastAndroid.SHORT
						)
						return
					}
					setDraftOrders(res.data)
				} catch (err) {
					console.error('Error fetching draft orders:', err)
					ToastAndroid.show(
						loc.t('draft.fetchError') || 'Failed to fetch draft orders',
						ToastAndroid.SHORT
					)
				} finally {
					setLoading(false)
				}
			}
			fetchDraftOrders()
		}, [])
	)

	const formatPrice = (price) => {
		return translateAmount(price, {
			currencySymbol: '৳',
			decimalPlaces: 2,
		})
	}

	useEffect(() => {
		if (!selectedDraft) return
		const subscription = BackHandler.addEventListener(
			'hardwareBackPress',
			() => {
				closeModal()
				return true
			}
		)
		return () => subscription.remove()
	}, [selectedDraft])

	const openModal = (draft) => {
		setSelectedDraft(draft)
		bottomSheetModalRef.current?.present()
	}

	const closeModal = () => {
		bottomSheetModalRef.current?.dismiss()
	}

	const handleSheetDismiss = () => {
		setSelectedDraft(null)
	}

	const renderBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="close"
			/>
		),
		[]
	)

	const handleDeleteDraft = (draftId) => {
		setDraftToDelete(draftId)
		setShowDeleteModal(true)
	}

	const confirmDeleteDraft = async () => {
		if (!draftToDelete) return

		try {
			const res = await fetchData(deleteDraft, { id: draftToDelete })
			if (res.success) {
				setDraftOrders((prev) =>
					prev.filter((draft) => draft.id !== draftToDelete)
				)
				closeModal()
				ToastAndroid.show(
					loc.t('draft.deleteSuccess') || 'Draft deleted successfully',
					ToastAndroid.SHORT
				)
			} else {
				ToastAndroid.show(
					loc.t('draft.deleteError') || 'Failed to delete draft',
					ToastAndroid.SHORT
				)
			}
		} catch (err) {
			console.error('Error deleting draft:', err)
			ToastAndroid.show(
				loc.t('draft.deleteError') || 'Failed to delete draft',
				ToastAndroid.SHORT
			)
		} finally {
			setShowDeleteModal(false)
			setDraftToDelete(null)
		}
	}

	const getBuyerName = (draft, index) => {
		if (draft.buyerID) {
			return draft.buyer.Shops[0].name
		}
		// Count walking-by customers (those without buyerID)
		const walkingByCustomers = draftOrders.filter((d) => !d.buyerID)
		const walkingByIndex = walkingByCustomers.findIndex(
			(d) => d.id === draft.id
		)
		return `${loc.t('draft.walkingByCustomer')} ${translateNumber(
			walkingByIndex >= 0 ? walkingByIndex + 1 : 1
		)}`
	}

	const renderSkeletonItem = () => (
		<View className="bg-white mx-4 mb-2 p-4 rounded-lg shadow-sm border border-gray-200">
			<ContentLoader
				speed={2}
				width={350}
				height={60}
				viewBox="0 0 350 60"
				backgroundColor="#f3f3f3"
				foregroundColor="#ecebeb"
			>
				<Rect x="0" y="8" rx="4" ry="4" width="200" height="16" />
				<Rect x="0" y="32" rx="4" ry="4" width="150" height="12" />
				<Rect x="280" y="8" rx="4" ry="4" width="70" height="20" />
			</ContentLoader>
		</View>
	)

	const renderDraftItem = ({ item: draft, index }) => {
		return (
			<TouchableOpacity
				onPress={() => openModal(draft)}
				activeOpacity={0.7}
				className="bg-white mx-4 mb-2 p-4 rounded-lg shadow-sm border border-gray-200"
			>
				<View className="flex-row items-center justify-between">
					<View className="flex-1">
						<View className="flex-row items-center justify-between mb-1">
							<View className="flex-col items-start">
								<Text className="text-base font-medium text-gray-800">
									{getBuyerName(draft, index)}
								</Text>
								<Text className="text-sm text-gray-500">
									{translateNumber(draft.totalQuantity)}{' '}
									{loc.t('draft.itemsInCart')}
								</Text>
							</View>
							<Text className="text-lg font-semibold text-gray-900">
								{formatPrice(draft.totalPrice)}
							</Text>
						</View>
					</View>
				</View>
			</TouchableOpacity>
		)
	}

	const renderTableRow = (product, index) => (
		<View
			key={product.id}
			style={[
				styles.tableRow,
				{ backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F0F8FF' },
			]}
		>
			<View style={styles.productNameCell}>
				<ProductThumbnail
					image={product.Lot?.ShopVariant?.productImage || null}
					name={product.Lot?.ShopVariant?.name}
					size={28}
				/>
				<View style={styles.productInfo}>
					<Text
						style={styles.productNameText}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{product.Lot?.ShopVariant.name || loc.t('draft.unknownProduct')}
					</Text>
					{product.Lot?.ShopVariant.variantName ? (
						<Text
							style={styles.variantNameText}
							numberOfLines={1}
							ellipsizeMode="tail"
						>
							{product.Lot.ShopVariant.variantName}
						</Text>
					) : null}
				</View>
			</View>
			<View style={styles.quantityCell}>
				<Text style={styles.quantityText}>
					{translateNumber(product.quantity)}
				</Text>
			</View>
			<View style={styles.priceCell}>
				<Text style={styles.priceText}>
					{formatPrice(product.Lot?.sellPrice || 0)}
				</Text>
			</View>
		</View>
	)

	const renderModal = () => {
		return (
			<BottomSheetModal
				ref={bottomSheetModalRef}
				snapPoints={snapPoints}
				enablePanDownToClose={true}
				backdropComponent={renderBackdrop}
				backgroundStyle={styles.bottomSheetBackground}
				handleIndicatorStyle={styles.handleIndicator}
				enableDynamicSizing={false}
				onDismiss={handleSheetDismiss}
			>
				{/* Header */}
				<View style={styles.headerContainer}>
					<View style={styles.header}>
						<View style={styles.headerLeft}>
							<Text style={styles.headerTitle}>
								{loc.t('draft.orderDetails')}
							</Text>
							{selectedDraft && (
								<Text style={styles.headerSubtitle}>
									{loc.t('draft.customer')}:{' '}
									{selectedDraft.buyerID &&
									selectedDraft.buyer?.Shops?.[0]?.name
										? selectedDraft.buyer.Shops[0].name
										: loc.t('draft.walkingByCustomer')}
								</Text>
							)}
						</View>
						<TouchableOpacity
							onPress={closeModal}
							style={styles.closeButton}
							activeOpacity={0.7}
						>
							<MaterialIcons name="close" size={16} color="#6B7280" />
						</TouchableOpacity>
					</View>
				</View>

				{selectedDraft && (
					<BottomSheetScrollView
						showsVerticalScrollIndicator={false}
						contentContainerStyle={styles.contentContainer}
					>
						{/* Table */}
						<View style={styles.tableContainer}>
							{/* Table Header */}
							<View style={styles.tableHeader}>
								<View style={styles.productNameCell}>
									<Text style={styles.headerCellText} numberOfLines={1}>
										{loc.t('draft.product')}
									</Text>
								</View>
								<View style={styles.quantityCell}>
									<Text style={styles.headerCellText} numberOfLines={1}>
										{loc.t('draft.qty')}
									</Text>
								</View>
								<View style={styles.priceCell}>
									<Text style={styles.headerCellText} numberOfLines={1}>
										{loc.t('draft.price')}
									</Text>
								</View>
							</View>

							{/* Table Rows */}
							{selectedDraft.items.map((product, index) =>
								renderTableRow(product, index)
							)}
						</View>

						{/* Total */}
						<View style={styles.totalContainer}>
							<Text style={styles.totalLabel}>
								{loc.t('draft.totalAmount')}:
							</Text>
							<Text style={styles.totalAmount}>
								{formatPrice(selectedDraft.totalPrice)}
							</Text>
						</View>

						{/* Action Buttons */}
						<View style={styles.buttonContainer}>
							<TouchableOpacity
								onPress={() => handleDeleteDraft(selectedDraft.id)}
								style={styles.deleteButton}
								activeOpacity={0.8}
							>
								<Text style={styles.deleteButtonText}>
									{loc.t('draft.delete')}
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={() => {
									router.push({
										pathname: '/home/transactions/sell',
										params: {
											draftId: selectedDraft.id.toString(),
											loadFromDraft: 'true',
										},
									})
									closeModal()
								}}
								style={styles.processButton}
								activeOpacity={0.8}
							>
								<Text style={styles.processButtonText}>
									{loc.t('draft.process')}
								</Text>
							</TouchableOpacity>
						</View>
					</BottomSheetScrollView>
				)}
			</BottomSheetModal>
		)
	}

	return (
		<View className="flex-1 bg-bgColor">
			{loading ? (
				<View className="flex-1" style={{ paddingVertical: 16 }}>
					{[...Array(5)].map((_, index) => (
						<View key={index}>{renderSkeletonItem()}</View>
					))}
				</View>
			) : (
				<FlatList
					data={draftOrders}
					renderItem={renderDraftItem}
					keyExtractor={(item) => item.id}
					className="flex-1"
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingVertical: 16 }}
					ListEmptyComponent={() => (
						<View className="flex-1 justify-center items-center mt-20">
							<MaterialIcons name="save" size={64} color="#9CA3AF" />
							<Text className="text-gray-500 text-lg mt-4">
								{loc.t('draft.noDraftsFound')}
							</Text>
						</View>
					)}
				/>
			)}

			{renderModal()}

			{/* Delete Confirmation Modal */}
			<DeleteModal
				visible={showDeleteModal}
				onClose={() => {
					setShowDeleteModal(false)
					setDraftToDelete(null)
				}}
				onConfirm={confirmDeleteDraft}
				title={loc.t('draft.deleteDraft') || 'Delete Draft'}
				subtitle={
					loc.t('draft.deleteConfirmation') ||
					'Are you sure you want to delete this draft?'
				}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	// BottomSheet
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF',
		borderTopLeftRadius: 25,
		borderTopRightRadius: 25,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: -2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	handleIndicator: {
		backgroundColor: '#195FE1',
		width: 30,
		height: 3,
		borderRadius: 2,
	},
	// Header
	headerContainer: {
		backgroundColor: '#F0F8FF',
		paddingHorizontal: 20,
		paddingBottom: 14,
		borderBottomWidth: 2,
		borderBottomColor: 'rgba(0,0,0,0.08)',
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
	},
	headerLeft: {
		flex: 1,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#195FE1',
	},
	headerSubtitle: {
		fontSize: 14,
		color: '#374151',
		marginTop: 2,
	},
	closeButton: {
		width: 28,
		height: 28,
		backgroundColor: '#E5E7EB',
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
	// Content
	contentContainer: {
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 32,
	},
	// Table
	tableContainer: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		overflow: 'hidden',
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	tableHeader: {
		flexDirection: 'row',
		backgroundColor: '#EFF6FF',
		borderBottomWidth: 1,
		borderBottomColor: '#BFDBFE',
		paddingVertical: 10,
	},
	tableBody: {
		maxHeight: screenHeight * 0.4,
	},
	tableRow: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: '#F3F4F6',
	},
	productNameCell: {
		flex: 3,
		paddingHorizontal: 10,
		paddingVertical: 8,
		justifyContent: 'flex-start',
		alignItems: 'center',
		flexDirection: 'row',
	},
	productInfo: {
		flex: 1,
		marginLeft: 8,
		justifyContent: 'center',
	},
	quantityCell: {
		flex: 1,
		paddingHorizontal: 6,
		paddingVertical: 8,
		justifyContent: 'center',
		alignItems: 'center',
	},
	priceCell: {
		flex: 1.5,
		paddingHorizontal: 10,
		paddingVertical: 8,
		justifyContent: 'center',
		alignItems: 'flex-end',
	},
	headerCellText: {
		fontSize: 13,
		fontWeight: '700',
		color: '#195FE1',
	},
	productNameText: {
		fontSize: 13,
		color: '#111827',
		fontWeight: '500',
	},
	variantNameText: {
		fontSize: 11,
		color: '#6B7280',
		fontWeight: '400',
		marginTop: 1,
	},
	quantityText: {
		fontSize: 14,
		color: '#111827',
		fontWeight: '600',
		textAlign: 'center',
	},
	priceText: {
		fontSize: 14,
		color: '#111827',
		fontWeight: '600',
	},
	// Total
	totalContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		backgroundColor: '#FFFFFF',
		paddingHorizontal: 16,
		paddingVertical: 14,
		marginTop: 12,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	totalLabel: {
		fontSize: 16,
		fontWeight: '600',
		color: '#374151',
	},
	totalAmount: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#111827',
	},
	// Buttons
	buttonContainer: {
		marginTop: 16,
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
	},
	deleteButton: {
		backgroundColor: '#EF4444',
		paddingVertical: 14,
		borderRadius: 24,
		flex: 1,
		alignItems: 'center',
		elevation: 1,
	},
	deleteButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	processButton: {
		backgroundColor: '#195FE1',
		paddingVertical: 14,
		borderRadius: 24,
		flex: 1,
		alignItems: 'center',
		elevation: 1,
	},
	processButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
})
