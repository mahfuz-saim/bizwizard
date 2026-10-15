import {
	View,
	Text,
	Modal,
	TouchableOpacity,
	FlatList,
	Animated,
	Dimensions,
	StyleSheet,
	ScrollView,
	Image,
} from 'react-native'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'

const { height: screenHeight } = Dimensions.get('window')

// Stable FlatList key extractor. Module-scope so FlatList keeps the same
// reference across renders and rows are tracked by product id.
const productKeyExtractor = (item) => item?.id?.toString() ?? ''

// Memo'd row rendered by the FlatList. Receives primitive props only so
// unrelated parent re-renders (e.g. a fresh products array reference from a
// re-fetch) don't bust memoization for rows whose data hasn't changed.
const ProductItem = memo(function ProductItem({
	id,
	productName,
	barcode,
	image,
	measuringUnit,
	category,
	isPrivate,
	index,
	barcodeLabel,
	unitLabel,
	categoryLabel,
	privateLabel,
	categoryOther,
	categoryFood,
	categoryBeverage,
	categoryMedicine,
	onSelect,
	onInfoPress,
}) {
	return (
		<TouchableOpacity
			onPress={onSelect}
			style={styles.productItemContainer}
			activeOpacity={0.7}
		>
			<View style={styles.productItem}>
				<View style={styles.productHeader}>
					<View style={styles.productMainInfo}>
						<Text style={styles.productName} numberOfLines={2}>
							{productName}
						</Text>
						<Text style={styles.productBarcode}>
							{barcodeLabel}: {barcode}
						</Text>
					</View>
					<View style={styles.headerRight}>
						{image ? (
							<Image source={{ uri: image }} style={styles.productImage} />
						) : null}
						<TouchableOpacity
							onPress={onInfoPress}
							style={styles.infoButton}
							activeOpacity={0.7}
						>
							<MaterialIcons name="info-outline" size={18} color="#6B7280" />
						</TouchableOpacity>
					</View>
				</View>
				<View style={styles.productDetails}>
					<View style={styles.detailRow}>
						<Text style={styles.productDetailText}>
							<Text style={styles.productDetailLabel}>{unitLabel}:</Text>{' '}
							{measuringUnit}
						</Text>
						<Text style={styles.productDetailText}>
							<Text style={styles.productDetailLabel}>{categoryLabel}:</Text>{' '}
							{getCategoryLabelStatic(
								category,
								categoryOther,
								categoryFood,
								categoryBeverage,
								categoryMedicine
							)}
						</Text>
					</View>
					{isPrivate ? (
						<Text style={styles.privateText}>🔒 {privateLabel}</Text>
					) : null}
				</View>
			</View>
		</TouchableOpacity>
	)
})

// Module-scope helper so ProductItem doesn't need to close over `loc`.
// Falls back to the raw category string if a translation is missing.
function getCategoryLabelStatic(
	category,
	categoryOther,
	categoryFood,
	categoryBeverage,
	categoryMedicine
) {
	switch (category) {
		case 'OTHER':
			return categoryOther || 'Other'
		case 'FOOD':
			return categoryFood || 'Food'
		case 'BEVERAGE':
			return categoryBeverage || 'Beverage'
		case 'MEDICINE':
			return categoryMedicine || 'Medicine'
		default:
			return category
	}
}

export default function ProductSelector({
	products,
	handleProductSelect,
	cancelScanFlow,
}) {
	const slideAnim = useRef(new Animated.Value(screenHeight)).current
	const [selectedProductInfo, setSelectedProductInfo] = useState(null)
	const [showInfoModal, setShowInfoModal] = useState(false)
	const { loc } = useLocalization()
	const { translateNumber } = useNumberTranslator()

	useEffect(() => {
		Animated.timing(slideAnim, {
			toValue: 0,
			duration: 300,
			useNativeDriver: true,
		}).start()
	}, [])

	const closeModal = () => {
		Animated.timing(slideAnim, {
			toValue: screenHeight,
			duration: 250,
			useNativeDriver: true,
		}).start(() => {
			cancelScanFlow()
		})
	}

	const handleBackdropPress = () => {
		closeModal()
	}

	const formatDate = useCallback(
		(dateString) => {
			if (!dateString) return null
			const date = new Date(dateString)
			const formattedDate = date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			})
			return translateNumber(formattedDate)
		},
		[translateNumber]
	)

	const handleInfoPress = useCallback((item, index) => {
		setSelectedProductInfo({ ...item, productIndex: index + 1 })
		setShowInfoModal(true)
	}, [])

	const closeInfoModal = () => {
		setShowInfoModal(false)
		setSelectedProductInfo(null)
	}

	const getCategoryLabel = useCallback(
		(category) => {
			switch (category) {
				case 'OTHER':
					return loc.t('productSelector.categoryOther') || 'Other'
				case 'FOOD':
					return loc.t('productSelector.categoryFood') || 'Food'
				case 'BEVERAGE':
					return loc.t('productSelector.categoryBeverage') || 'Beverage'
				case 'MEDICINE':
					return loc.t('productSelector.categoryMedicine') || 'Medicine'
				default:
					return category
			}
		},
		[loc]
	)

	// Resolved, stable string props for the row. These come from `loc.t(...)`,
	// which is locale-keyed; we resolve once per render into primitives so the
	// memoized ProductItem sees stable strings across re-renders.
	const barcodeLabel = loc.t('productSelector.barcode')
	const unitLabel = loc.t('productSelector.unit')
	const categoryLabel = loc.t('productSelector.category')
	const privateLabel = loc.t('productSelector.private')
	const categoryOther = loc.t('productSelector.categoryOther')
	const categoryFood = loc.t('productSelector.categoryFood')
	const categoryBeverage = loc.t('productSelector.categoryBeverage')
	const categoryMedicine = loc.t('productSelector.categoryMedicine')

	const renderItem = useCallback(
		({ item, index }) => (
			<ProductItem
				id={item.id}
				productName={item.productName}
				barcode={translateNumber(item.barcode)}
				image={item.image}
				measuringUnit={item.measuringUnit}
				category={item.category}
				isPrivate={!!item.isPrivate}
				index={index}
				barcodeLabel={barcodeLabel}
				unitLabel={unitLabel}
				categoryLabel={categoryLabel}
				privateLabel={privateLabel}
				categoryOther={categoryOther}
				categoryFood={categoryFood}
				categoryBeverage={categoryBeverage}
				categoryMedicine={categoryMedicine}
				onSelect={() => handleProductSelect(item)}
				onInfoPress={() => handleInfoPress(item, index)}
			/>
		),
		[
			handleProductSelect,
			handleInfoPress,
			translateNumber,
			barcodeLabel,
			unitLabel,
			categoryLabel,
			privateLabel,
			categoryOther,
			categoryFood,
			categoryBeverage,
			categoryMedicine,
		]
	)

	const InfoModal = () => {
		if (!selectedProductInfo) return null

		return (
			<Modal
				transparent={true}
				visible={showInfoModal}
				animationType="fade"
				onRequestClose={closeInfoModal}
			>
				<View style={styles.infoModalContainer}>
					<TouchableOpacity
						style={styles.infoBackdrop}
						activeOpacity={1}
						onPress={closeInfoModal}
					/>
					<View style={styles.infoModalContent}>
						<View style={styles.infoHeader}>
							<Text style={styles.infoTitle}>
								{selectedProductInfo.productName}
							</Text>
							<TouchableOpacity
								onPress={closeInfoModal}
								style={styles.infoCloseButton}
								activeOpacity={0.7}
							>
								<MaterialIcons name="close" size={20} color="#6B7280" />
							</TouchableOpacity>
						</View>

						<ScrollView
							style={styles.infoModalScrollContent}
							showsVerticalScrollIndicator={false}
							bounces={false}
						>
							<View style={styles.infoContent}>
								{selectedProductInfo.image && (
									<View style={styles.infoImageContainer}>
										<Image
											source={{ uri: selectedProductInfo.image }}
											style={styles.infoProductImage}
										/>
									</View>
								)}

								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>
										{loc.t('productSelector.id')}:
									</Text>
									<Text style={styles.infoValue}>{selectedProductInfo.id}</Text>
								</View>

								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>
										{loc.t('productSelector.name')}:
									</Text>
									<Text style={styles.infoValue}>
										{selectedProductInfo.productName}
									</Text>
								</View>

								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>
										{loc.t('productSelector.barcode')}:
									</Text>
									<Text style={styles.infoValue}>
										{translateNumber(selectedProductInfo.barcode)}
									</Text>
								</View>

								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>
										{loc.t('productSelector.unit')}:
									</Text>
									<Text style={styles.infoValue}>
										{selectedProductInfo.measuringUnit}
									</Text>
								</View>

								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>
										{loc.t('productSelector.category')}:
									</Text>
									<Text style={styles.infoValue}>
										{getCategoryLabel(selectedProductInfo.category)}
									</Text>
								</View>

								<View style={styles.infoRow}>
									<Text style={styles.infoLabel}>
										{loc.t('productSelector.private')}:
									</Text>
									<Text style={styles.infoValue}>
										{selectedProductInfo.isPrivate
											? loc.t('productSelector.yes')
											: loc.t('productSelector.no')}
									</Text>
								</View>

								{selectedProductInfo.createdAt && (
									<View style={styles.infoRow}>
										<Text style={styles.infoLabel}>
											{loc.t('productSelector.createdAt')}:
										</Text>
										<Text style={styles.infoValue}>
											{formatDate(selectedProductInfo.createdAt)}
										</Text>
									</View>
								)}

								{selectedProductInfo.updatedAt && (
									<View style={styles.infoRow}>
										<Text style={styles.infoLabel}>
											{loc.t('productSelector.updatedAt')}:
										</Text>
										<Text style={styles.infoValue}>
											{formatDate(selectedProductInfo.updatedAt)}
										</Text>
									</View>
								)}
							</View>
						</ScrollView>

						{/* Button Row */}
						<View style={styles.infoModalButtonRow}>
							<TouchableOpacity
								style={[styles.infoModalButton, styles.backButton]}
								activeOpacity={0.7}
								onPress={closeInfoModal}
							>
								<Text
									style={[styles.infoModalButtonText, styles.backButtonText]}
								>
									{loc.t('productSelector.back')}
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								style={[styles.infoModalButton, styles.selectButton]}
								activeOpacity={0.7}
								onPress={() => {
									handleProductSelect(selectedProductInfo)
									closeInfoModal()
								}}
							>
								<Text
									style={[styles.infoModalButtonText, styles.selectButtonText]}
								>
									{loc.t('productSelector.select')}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		)
	}

	return (
		<>
			<Modal
				transparent={true}
				visible={true}
				animationType="fade"
				onRequestClose={closeModal}
			>
				<View style={styles.modalContainer}>
					<TouchableOpacity
						style={styles.backdrop}
						activeOpacity={1}
						onPress={handleBackdropPress}
					/>

					<Animated.View
						style={[
							styles.modalContent,
							{
								transform: [{ translateY: slideAnim }],
								maxHeight: screenHeight * 0.85,
							},
						]}
					>
						<View style={styles.handleContainer}>
							<View style={styles.handleBar} />
						</View>

						<View style={styles.header}>
							<View style={styles.headerTextContainer}>
								<Text
									style={styles.headerTitle}
									numberOfLines={1}
									ellipsizeMode="tail"
								>
									{loc.t('productSelector.selectProduct')}
								</Text>
								<Text
									style={styles.headerSubtitle}
									numberOfLines={2}
									ellipsizeMode="tail"
								>
									{loc.t('productSelector.chooseFromList')}
								</Text>
							</View>
							<TouchableOpacity
								onPress={closeModal}
								style={styles.closeButton}
								activeOpacity={0.7}
							>
								<MaterialIcons name="close" size={18} color="#6B7280" />
							</TouchableOpacity>
						</View>

						<View style={styles.contentContainer}>
							{products && products.length > 0 ? (
								<FlatList
									data={products}
									renderItem={renderItem}
									keyExtractor={productKeyExtractor}
									showsVerticalScrollIndicator={false}
									contentContainerStyle={styles.flatListContent}
									style={[styles.flatList, { maxHeight: screenHeight * 0.55 }]}
								/>
							) : (
								<View style={styles.emptyContainer}>
									<Text style={styles.emptyText}>
										{loc.t('productSelector.noProductsAvailable')}
									</Text>
								</View>
							)}

							<View style={styles.buttonContainer}>
								<TouchableOpacity
									onPress={closeModal}
									style={styles.cancelButton}
									activeOpacity={0.8}
								>
									<Text style={styles.cancelButtonText}>
										{loc.t('productSelector.cancel')}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</Animated.View>
				</View>
			</Modal>

			<InfoModal />
		</>
	)
}

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		justifyContent: 'flex-end',
		minHeight: '50%',
	},
	backdrop: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	modalContent: {
		backgroundColor: '#6592E5',
		width: '100%',
		borderTopLeftRadius: 25,
		borderTopRightRadius: 25,
		overflow: 'hidden',
	},
	handleContainer: {
		alignItems: 'center',
		paddingVertical: 12,
	},
	handleBar: {
		width: 40,
		height: 4,
		backgroundColor: '#D1D5DB',
		borderRadius: 2,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		paddingHorizontal: 24,
		paddingBottom: 16,
	},
	headerTextContainer: {
		flex: 1,
		flexShrink: 1,
		marginRight: 8,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#FFFFFF',
		flexShrink: 1,
	},
	headerSubtitle: {
		fontSize: 14,
		color: '#E5E7EB',
		marginTop: 2,
		flexShrink: 1,
	},
	closeButton: {
		width: 32,
		height: 32,
		backgroundColor: '#E5E7EB',
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	contentContainer: {
		paddingHorizontal: 16,
		paddingBottom: 16,
	},
	flatList: {},
	flatListContent: {
		paddingBottom: 20,
	},
	emptyContainer: {
		alignItems: 'center',
		paddingVertical: 40,
	},
	emptyText: {
		color: '#FFFFFF',
		fontSize: 16,
		opacity: 0.8,
	},
	productItemContainer: {
		marginHorizontal: 16,
		marginBottom: 12,
	},
	productItem: {
		backgroundColor: '#FFFFFF',
		padding: 20,
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
	productHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 8,
	},
	productMainInfo: {
		flex: 1,
		marginRight: 12,
	},
	productName: {
		fontSize: 18,
		fontWeight: '600',
		color: '#111827',
		marginBottom: 4,
	},
	productBarcode: {
		fontSize: 12,
		color: '#6B7280',
	},
	headerRight: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	productImage: {
		width: 40,
		height: 40,
		borderRadius: 8,
		backgroundColor: '#F3F4F6',
	},
	infoButton: {
		width: 28,
		height: 28,
		backgroundColor: '#F3F4F6',
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
	productDetails: {
		gap: 4,
	},
	detailRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	productDetailText: {
		color: '#6B7280',
		fontSize: 14,
	},
	productDetailLabel: {
		fontWeight: '500',
	},
	privateText: {
		color: '#D97706',
		fontSize: 12,
		fontWeight: '600',
		marginTop: 4,
	},
	buttonContainer: {
		marginTop: 16,
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
	},
	cancelButton: {
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#D1D5DB',
		paddingVertical: 12,
		borderRadius: 30,
		width: '100%',
	},
	cancelButtonText: {
		color: '#374151',
		textAlign: 'center',
		fontSize: 18,
		fontWeight: '500',
	},
	// Info Modal Styles
	infoModalContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	infoBackdrop: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	infoModalContent: {
		backgroundColor: '#FFFFFF',
		margin: 20,
		borderRadius: 16,
		maxHeight: screenHeight * 0.7,
		width: '90%',
		maxWidth: 400,
	},
	infoHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 20,
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
	},
	infoModalScrollContent: {
		flexGrow: 1,
	},
	infoTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#111827',
		flex: 1,
		marginRight: 8,
	},
	infoCloseButton: {
		width: 32,
		height: 32,
		backgroundColor: '#F3F4F6',
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	infoContent: {
		padding: 20,
	},
	infoImageContainer: {
		alignItems: 'center',
		marginBottom: 16,
	},
	infoProductImage: {
		width: 80,
		height: 80,
		borderRadius: 12,
		backgroundColor: '#F3F4F6',
	},
	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: '#F3F4F6',
	},
	infoLabel: {
		fontSize: 14,
		fontWeight: '500',
		color: '#374151',
		flex: 1,
	},
	infoValue: {
		fontSize: 14,
		color: '#6B7280',
		flex: 1,
		textAlign: 'right',
	},
	infoModalButtonRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderTopWidth: 1,
		borderTopColor: '#E5E7EB',
		backgroundColor: '#FAFAFA',
	},
	infoModalButton: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	backButton: {
		backgroundColor: '#E5E7EB',
		marginRight: 8,
	},
	selectButton: {
		backgroundColor: '#2563EB',
		marginLeft: 8,
	},
	infoModalButtonText: {
		fontSize: 16,
		fontWeight: '600',
	},
	backButtonText: {
		color: '#374151',
	},
	selectButtonText: {
		color: '#FFFFFF',
	},
})
