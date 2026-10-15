import {
	View,
	Text,
	TouchableOpacity,
	Dimensions,
	StyleSheet,
	BackHandler,
} from 'react-native'
import { useEffect, useRef, useCallback, useMemo } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import {
	BottomSheetModal,
	BottomSheetBackdrop,
	BottomSheetFlatList,
} from '@gorhom/bottom-sheet'

const { height: screenHeight } = Dimensions.get('window')

export default function VariantSelector({
	variants,
	handleVariantSelection,
	cancelScanFlow,
	showCreate = true,
	ref,
}) {
	const { loc } = useLocalization()
	const { translateNumber } = useNumberTranslator()

	// Snap points for bottom sheet
	const snapPoints = useMemo(() => ['50%', '75%'], [])

	// Open bottom sheet on mount
	useEffect(() => {
		const timer = setTimeout(() => {
			ref.current?.present()
		}, 50)

		return () => clearTimeout(timer)
	}, [])

	const closeModal = useCallback(() => {
		ref.current?.dismiss()
		setTimeout(() => {
			cancelScanFlow()
		}, 150)
	}, [cancelScanFlow])

	// Handle hardware back button
	useEffect(() => {
		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			() => {
				closeModal()
				return true
			}
		)

		return () => backHandler.remove()
	}, [closeModal])

	// Render backdrop component
	const renderBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="none"
				onPress={() => closeModal()}
			/>
		),
		[closeModal]
	)

	// Render variant item with modern design
	const renderVariantItem = useCallback(
		({ item }) => {
			return (
				<TouchableOpacity
					onPress={() => handleVariantSelection(item)}
					style={styles.variantItemContainer}
					activeOpacity={0.7}
				>
					<View style={styles.variantItem}>
						<View style={styles.variantHeader}>
							<Text style={styles.variantName}>{item.name}</Text>
							<View style={styles.itemCountBadge}>
								<Text style={styles.itemCountText}>
									{translateNumber(item.totalProducts)}{' '}
									{loc.t('variantSelector.items')}
								</Text>
							</View>
						</View>
						<View style={styles.variantDetails}>
							<Text style={styles.variantDetailText}>
								<Text style={styles.variantDetailLabel}>
									{loc.t('variantSelector.variant')}:
								</Text>{' '}
								{item.variantName}
							</Text>
							<Text style={styles.variantDetailText}>
								<Text style={styles.variantDetailLabel}>
									{loc.t('variantSelector.code')}:
								</Text>{' '}
								{translateNumber(item.variantCode)}
							</Text>
						</View>
					</View>
				</TouchableOpacity>
			)
		},
		[handleVariantSelection, translateNumber, loc]
	)

	// Key extractor for FlatList
	const keyExtractor = useCallback((item) => item.id.toString(), [])

	return (
		<BottomSheetModal
			ref={ref}
			index={0}
			snapPoints={snapPoints}
			enablePanDownToClose={true}
			enableDynamicSizing={false}
			backdropComponent={renderBackdrop}
			backgroundStyle={styles.bottomSheetBackground}
			handleIndicatorStyle={styles.handleIndicator}
			onDismiss={() => ref.current?.dismiss()}
		>
			{/* Header */}
			<View style={styles.header}>
				<View style={styles.headerTextContainer}>
					<Text style={styles.headerTitle}>
						{loc.t('variantSelector.selectVariant')}
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

			{/* Scrollable Content */}
			<View style={styles.contentContainer}>
				{variants && variants.length > 0 ? (
					<BottomSheetFlatList
						data={variants}
						renderItem={renderVariantItem}
						keyExtractor={keyExtractor}
						showsVerticalScrollIndicator={false}
						contentContainerStyle={styles.flatListContent}
					/>
				) : (
					<View style={styles.emptyContainer}>
						<Text style={styles.emptyText}>
							{loc.t('variantSelector.noVariantsAvailable') ||
								'No variants available'}
						</Text>
					</View>
				)}

				{showCreate && (
					<View style={styles.buttonContainer}>
						<TouchableOpacity
							onPress={closeModal}
							style={styles.cancelButton}
							activeOpacity={0.8}
						>
							<Text style={styles.cancelButtonText}>
								{loc.t('variantSelector.cancel')}
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							onPress={() => handleVariantSelection(null)}
							style={styles.createButton}
							activeOpacity={0.8}
						>
							<Text style={styles.createButtonText}>
								{loc.t('variantSelector.createVariant')}
							</Text>
						</TouchableOpacity>
					</View>
				)}
			</View>
		</BottomSheetModal>
	)
}

const styles = StyleSheet.create({
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF',
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
	},
	handleIndicator: {
		backgroundColor: '#195FE1',
		width: 40,
		height: 4,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		paddingHorizontal: 16,
		paddingTop: 8,
		paddingBottom: 8,
		backgroundColor: '#F0F8FF',
		borderBottomWidth: 2,
		borderBottomColor: 'rgba(0, 0, 0, 0.08)',
		marginBottom: 8,
	},
	headerTextContainer: {
		flex: 1,
		flexShrink: 1,
		marginRight: 8,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#195FE1',
		flexShrink: 1,
	},
	closeButton: {
		width: 32,
		height: 32,
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.1)',
	},
	contentContainer: {
		paddingHorizontal: 16,
		paddingBottom: 16,
		backgroundColor: '#F0F8FF',
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
		color: '#195FE1',
		fontSize: 16,
		opacity: 0.7,
	},
	variantItemContainer: {
		marginBottom: 12,
	},
	variantItem: {
		backgroundColor: '#FFFFFF',
		paddingHorizontal: 20,
		paddingVertical: 12,
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
		borderColor: '#195FE1',
	},
	variantHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		marginBottom: 8,
	},
	variantName: {
		fontSize: 18,
		fontWeight: '600',
		color: '#111827', // text-gray-900
		flex: 1,
	},
	itemCountBadge: {
		backgroundColor: '#EFF6FF', // bg-blue-50
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 12,
	},
	itemCountText: {
		color: '#2563EB', // text-blue-600
		fontSize: 14,
		fontWeight: '500',
	},
	variantDetails: {
		gap: 4,
	},
	variantDetailText: {
		color: '#6B7280',
		fontSize: 14,
	},
	variantDetailLabel: {
		fontWeight: '500',
	},
	buttonContainer: {
		marginTop: 4,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		gap: 8,
	},
	createButton: {
		backgroundColor: '#195FE1',
		paddingVertical: 14,
		borderRadius: 8,
		flex: 1,
		alignItems: 'center',
	},
	createButtonText: {
		color: '#FFFFFF',
		textAlign: 'center',
		fontSize: 16,
		fontWeight: '600',
	},
	cancelButton: {
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#195FE1',
		paddingVertical: 14,
		borderRadius: 8,
		flex: 1,
		alignItems: 'center',
	},
	cancelButtonText: {
		color: '#195FE1',
		textAlign: 'center',
		fontSize: 16,
		fontWeight: '600',
	},
})
