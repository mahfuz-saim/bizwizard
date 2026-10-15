import React, { useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'

/**
 * Shared BottomSheet chrome for product forms
 * Handles backdrop, header, present/dismiss via visible prop
 */
const ProductFormSheet = React.forwardRef(function ProductFormSheet(
	{
		visible,
		onClose,
		onDismiss,
		snapPoints,
		title,
		subtitle,
		children,
		enablePanDownToClose = false,
	},
	ref
) {
	const { loc } = useLocalization()

	const renderBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="none"
				onPress={() => onClose?.()}
			/>
		),
		[onClose]
	)

	useEffect(() => {
		if (!visible) {
			ref.current?.dismiss()
			return
		}
		const timer = setTimeout(() => ref.current?.present(), 50)
		return () => clearTimeout(timer)
	}, [visible, ref])

	useEffect(() => {
		if (!visible) ref.current?.dismiss()
	}, [visible, ref])

	if (!visible) return null

	return (
		<BottomSheetModal
			ref={ref}
			snapPoints={snapPoints}
			enablePanDownToClose={enablePanDownToClose}
			backdropComponent={renderBackdrop}
			// Extend the sheet to its maximum snap point while the keyboard is open, so
			// the fields and buttons never end up behind it. "interactive" only offsets
			// the sheet, and on Android with adjustResize it does not move it at all.
			// "restore" below brings it back to the previous snap point on blur.
			keyboardBehavior="extend"
			keyboardBlurBehavior="restore"
			android_keyboardInputMode="adjustResize"
			backgroundStyle={styles.bottomSheetBackground}
			handleIndicatorStyle={styles.handleIndicator}
			enableDynamicSizing={false}
			onDismiss={onDismiss}
		>
			<View style={styles.headerContainer}>
				<View style={styles.modalHeader}>
					<Text style={styles.modalHeaderTitle}>
						{title || loc.t('productForm.modalTitle')}
					</Text>
					<TouchableOpacity
						onPress={() => onClose?.()}
						style={styles.infoCloseButton}
						activeOpacity={0.7}
					>
						<MaterialIcons name="close" size={16} color="#6B7280" />
					</TouchableOpacity>
				</View>
				{subtitle ? (
					<Text style={styles.headerSubtitle}>{subtitle}</Text>
				) : null}
			</View>
			{children}
		</BottomSheetModal>
	)
})

export default ProductFormSheet

const styles = StyleSheet.create({
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
	headerContainer: {
		backgroundColor: '#F0F8FF',
		paddingHorizontal: 16,
		paddingBottom: 16,
		borderBottomWidth: 2,
		borderBottomColor: 'rgba(0,0,0,0.08)',
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
	},
	modalHeaderTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#195FE1',
	},
	headerSubtitle: {
		fontSize: 12,
		color: '#6B7280',
		marginTop: 4,
		lineHeight: 16,
	},
	infoCloseButton: {
		width: 28,
		height: 28,
		backgroundColor: '#E5E7EB',
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
