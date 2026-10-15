// @dead-code — 2026-09-24 knip+grep: 0 active imports, candidate for removal (kept per request)
import {
	View,
	Text,
	Modal,
	TouchableOpacity,
	TextInput,
	ScrollView,
	StyleSheet,
	Switch,
} from 'react-native'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { Formik } from 'formik'
import * as Yup from 'yup'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'

export default function LotForm({ visible, lot, onSave, onCancel }) {
	const { loc } = useLocalization()
	const { translateNumber } = useNumberTranslator()

	// Validation schema
	const validationSchema = Yup.object().shape({
		stock: Yup.number()
			.min(0, 'Stock must be a positive number')
			.nullable()
			.transform((value, originalValue) =>
				originalValue === '' ? null : value
			),
		mrp: Yup.number()
			.min(0, 'MRP must be a positive number')
			.nullable()
			.transform((value, originalValue) =>
				originalValue === '' ? null : value
			),
		retail: Yup.number()
			.min(0, 'Retail price must be a positive number')
			.nullable()
			.transform((value, originalValue) =>
				originalValue === '' ? null : value
			),
		buyPrice: Yup.number()
			.min(0, 'Buy price must be a positive number')
			.nullable()
			.transform((value, originalValue) =>
				originalValue === '' ? null : value
			),
		sellPrice: Yup.number()
			.min(0, 'Sell price must be a positive number')
			.nullable()
			.transform((value, originalValue) =>
				originalValue === '' ? null : value
			),
		vat: Yup.number()
			.min(0, 'VAT must be between 0 and 100')
			.max(100, 'VAT must be between 0 and 100')
			.nullable()
			.transform((value, originalValue) =>
				originalValue === '' ? null : value
			),
		mfgDate: Yup.string()
			.matches(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in DD-MM-YYYY format')
			.test('valid-date', 'Invalid date', function (value) {
				if (!value) return true
				const date = new Date(value)
				return !isNaN(date.getTime())
			})
			.nullable(),
		expDate: Yup.string()
			.matches(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in DD-MM-YYYY format')
			.test('valid-date', 'Invalid date', function (value) {
				if (!value) return true
				const date = new Date(value)
				return !isNaN(date.getTime())
			})
			.test(
				'after-mfg',
				'Expiry date must be after manufacturing date',
				function (value) {
					const { mfgDate } = this.parent
					if (!value || !mfgDate) return true
					return new Date(value) > new Date(mfgDate)
				}
			)
			.nullable(),
		locationAtStore: Yup.string().nullable(),
		note: Yup.string().nullable(),
		isMRPDefault: Yup.boolean(),
		includeVAT: Yup.boolean(),
	})

	// Initial values
	const getInitialValues = () => ({
		stock: lot?.stock?.toString() || '',
		mrp: lot?.mrp?.toString() || '',
		isMRPDefault: lot?.isMRPDefault || false,
		retail: lot?.retail?.toString() || '',
		includeVAT: lot?.includeVAT || false,
		buyPrice: lot?.buyPrice?.toString() || '',
		sellPrice: lot?.sellPrice?.toString() || '',
		vat: lot?.vat?.toString() || '',
		mfgDate: lot?.mfgDate ? formatDateForInput(new Date(lot.mfgDate)) : '',
		expDate: lot?.expDate ? formatDateForInput(new Date(lot.expDate)) : '',
		locationAtStore: lot?.locationAtStore || '',
		note: lot?.note || '',
	})

	// Helper functions
	const formatDateForInput = (date) => {
		if (!date) return ''
		const year = date.getFullYear()
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const day = String(date.getDate()).padStart(2, '0')
		return `${year}-${month}-${day}`
	}

	const parseDate = (dateString) => {
		if (!dateString) return null
		const date = new Date(dateString)
		return isNaN(date.getTime()) ? null : date
	}

	const closeForm = () => {
		onCancel()
	}

	const handleSubmit = (values) => {
		// Prepare data for API
		const updateData = {}

		if (values.stock) updateData.stock = Number(values.stock)
		if (values.mrp) updateData.mrp = Number(values.mrp)
		updateData.isMRPDefault = values.isMRPDefault
		if (values.retail) updateData.retail = Number(values.retail)
		updateData.includeVAT = values.includeVAT
		if (values.buyPrice) updateData.buyPrice = Number(values.buyPrice)
		if (values.sellPrice) updateData.sellPrice = Number(values.sellPrice)
		if (values.vat) updateData.vat = Number(values.vat)
		if (values.mfgDate) updateData.mfgDate = parseDate(values.mfgDate)
		if (values.expDate) updateData.expDate = parseDate(values.expDate)
		if (values.locationAtStore?.trim())
			updateData.locationAtStore = values.locationAtStore.trim()
		if (values.note?.trim()) updateData.note = values.note.trim()

		onSave(updateData)
		closeForm()
	}

	if (!visible) return null

	return (
		<Modal
			transparent={true}
			visible={visible}
			animationType="slide"
			onRequestClose={closeForm}
		>
			<View style={styles.modalContainer}>
				<TouchableOpacity
					style={styles.backdrop}
					activeOpacity={1}
					onPress={closeForm}
				/>

				<View style={styles.modalContent}>
					<View style={styles.handleContainer}>
						<View style={styles.handleBar} />
					</View>

					<View style={styles.header}>
						<Text style={styles.headerTitle}>
							{loc.t('lotSelector.editLot')}{' '}
							{lot?.lotIndex ? translateNumber(lot.lotIndex) : ''}
						</Text>
						<TouchableOpacity
							onPress={closeForm}
							style={styles.closeButton}
							activeOpacity={0.7}
						>
							<MaterialIcons name="close" size={18} color="#6B7280" />
						</TouchableOpacity>
					</View>

					<Formik
						initialValues={getInitialValues()}
						validationSchema={validationSchema}
						onSubmit={handleSubmit}
						enableReinitialize={true}
					>
						{({
							values,
							errors,
							touched,
							handleChange,
							handleBlur,
							handleSubmit,
							setFieldValue,
							isValid,
						}) => (
							<>
								<ScrollView
									style={styles.scrollContent}
									contentContainerStyle={styles.scrollContentContainer}
									showsVerticalScrollIndicator={false}
									keyboardShouldPersistTaps="handled"
								>
									<View style={styles.formContainer}>
										{/* Stock */}
										<View style={styles.formGroup}>
											<Text style={styles.label}>
												{loc.t('lotSelector.amount')} (
												{loc.t('lotSelector.units')})
											</Text>
											<TextInput
												style={[
													styles.input,
													errors.stock && touched.stock && styles.inputError,
												]}
												value={values.stock}
												onChangeText={handleChange('stock')}
												onBlur={handleBlur('stock')}
												keyboardType="numeric"
												placeholder="0"
											/>
											{errors.stock && touched.stock && (
												<Text style={styles.errorText}>{errors.stock}</Text>
											)}
										</View>

										{/* Buy Price */}
										<View style={styles.formGroup}>
											<Text style={styles.label}>
												{loc.t('lotSelector.buyPrice')}
											</Text>
											<TextInput
												style={[
													styles.input,
													errors.buyPrice &&
														touched.buyPrice &&
														styles.inputError,
												]}
												value={values.buyPrice}
												onChangeText={handleChange('buyPrice')}
												onBlur={handleBlur('buyPrice')}
												keyboardType="numeric"
												placeholder="0.00"
											/>
											{errors.buyPrice && touched.buyPrice && (
												<Text style={styles.errorText}>{errors.buyPrice}</Text>
											)}
										</View>

										{/* Sell Price */}
										<View style={styles.formGroup}>
											<Text style={styles.label}>
												{loc.t('lotSelector.sellPrice')}
											</Text>
											<TextInput
												style={[
													styles.input,
													errors.sellPrice &&
														touched.sellPrice &&
														styles.inputError,
												]}
												value={values.sellPrice}
												onChangeText={handleChange('sellPrice')}
												onBlur={handleBlur('sellPrice')}
												keyboardType="numeric"
												placeholder="0.00"
											/>
											{errors.sellPrice && touched.sellPrice && (
												<Text style={styles.errorText}>{errors.sellPrice}</Text>
											)}
										</View>

										{/* MRP */}
										<View style={styles.formGroup}>
											<Text style={styles.label}>
												{loc.t('lotSelector.mrp')}
											</Text>
											<TextInput
												style={[
													styles.input,
													errors.mrp && touched.mrp && styles.inputError,
												]}
												value={values.mrp}
												onChangeText={handleChange('mrp')}
												onBlur={handleBlur('mrp')}
												keyboardType="numeric"
												placeholder="0.00"
											/>
											{errors.mrp && touched.mrp && (
												<Text style={styles.errorText}>{errors.mrp}</Text>
											)}

											<View style={styles.switchRow}>
												<Text style={styles.switchLabel}>
													Use as default MRP
												</Text>
												<Switch
													value={values.isMRPDefault}
													onValueChange={(value) =>
														setFieldValue('isMRPDefault', value)
													}
													trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
													thumbColor={
														values.isMRPDefault ? '#FFFFFF' : '#F3F4F6'
													}
												/>
											</View>
										</View>

										{/* Retail */}
										<View style={styles.formGroup}>
											<Text style={styles.label}>
												{loc.t('lotSelector.retail')}
											</Text>
											<TextInput
												style={[
													styles.input,
													errors.retail && touched.retail && styles.inputError,
												]}
												value={values.retail}
												onChangeText={handleChange('retail')}
												onBlur={handleBlur('retail')}
												keyboardType="numeric"
												placeholder="0.00"
											/>
											{errors.retail && touched.retail && (
												<Text style={styles.errorText}>{errors.retail}</Text>
											)}
										</View>

										{/* VAT */}
										<View style={styles.formGroup}>
											<Text style={styles.label}>
												{loc.t('lotSelector.vat')} (%)
											</Text>
											<TextInput
												style={[
													styles.input,
													errors.vat && touched.vat && styles.inputError,
												]}
												value={values.vat}
												onChangeText={handleChange('vat')}
												onBlur={handleBlur('vat')}
												keyboardType="numeric"
												placeholder="0"
											/>
											{errors.vat && touched.vat && (
												<Text style={styles.errorText}>{errors.vat}</Text>
											)}

											<View style={styles.switchRow}>
												<Text style={styles.switchLabel}>
													{loc.t('lotSelector.vatIncluded')}
												</Text>
												<Switch
													value={values.includeVAT}
													onValueChange={(value) =>
														setFieldValue('includeVAT', value)
													}
													trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
													thumbColor={values.includeVAT ? '#FFFFFF' : '#F3F4F6'}
												/>
											</View>
										</View>

										{/* Manufacturing Date */}
										<View style={styles.formGroup}>
											<Text style={styles.label}>
												{loc.t('lotSelector.manufacturingDate')}
											</Text>
											<TextInput
												style={[
													styles.input,
													errors.mfgDate &&
														touched.mfgDate &&
														styles.inputError,
												]}
												value={values.mfgDate}
												onChangeText={handleChange('mfgDate')}
												onBlur={handleBlur('mfgDate')}
												placeholder="DD-MM-YYYY"
												placeholderTextColor="#9CA3AF"
											/>
											{errors.mfgDate && touched.mfgDate && (
												<Text style={styles.errorText}>{errors.mfgDate}</Text>
											)}
										</View>

										{/* Expiry Date */}
										<View style={styles.formGroup}>
											<Text style={styles.label}>
												{loc.t('lotSelector.expiryDate')}
											</Text>
											<TextInput
												style={[
													styles.input,
													errors.expDate &&
														touched.expDate &&
														styles.inputError,
												]}
												value={values.expDate}
												onChangeText={handleChange('expDate')}
												onBlur={handleBlur('expDate')}
												placeholder="DD-MM-YYYY"
												placeholderTextColor="#9CA3AF"
											/>
											{errors.expDate && touched.expDate && (
												<Text style={styles.errorText}>{errors.expDate}</Text>
											)}
										</View>

										{/* Store Location */}
										<View style={styles.formGroup}>
											<Text style={styles.label}>
												{loc.t('lotSelector.storeLocation')}
											</Text>
											<TextInput
												style={styles.input}
												value={values.locationAtStore}
												onChangeText={handleChange('locationAtStore')}
												onBlur={handleBlur('locationAtStore')}
												placeholder="Enter location..."
											/>
										</View>

										{/* Note */}
										<View style={styles.formGroup}>
											<Text style={styles.label}>
												{loc.t('lotSelector.note')}
											</Text>
											<TextInput
												style={[styles.input, styles.textArea]}
												value={values.note}
												onChangeText={handleChange('note')}
												onBlur={handleBlur('note')}
												placeholder="Enter notes..."
												multiline
												numberOfLines={3}
												textAlignVertical="top"
											/>
										</View>
									</View>
								</ScrollView>

								{/* Action Buttons */}
								<View style={styles.actionButtons}>
									<TouchableOpacity
										style={styles.cancelButton}
										onPress={closeForm}
										activeOpacity={0.7}
									>
										<Text style={styles.cancelButtonText}>
											{loc.t('lotSelector.cancel')}
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[
											styles.saveButton,
											!isValid && styles.saveButtonDisabled,
										]}
										onPress={handleSubmit}
										activeOpacity={0.7}
										disabled={!isValid}
									>
										<Text
											style={[
												styles.saveButtonText,
												!isValid && styles.saveButtonTextDisabled,
											]}
										>
											{loc.t('lotSelector.save')}
										</Text>
									</TouchableOpacity>
								</View>
							</>
						)}
					</Formik>
				</View>
			</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	backdrop: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	modalContent: {
		flex: 1,
		backgroundColor: '#FFFFFF',
		marginTop: 50,
		borderTopLeftRadius: 25,
		borderTopRightRadius: 25,
	},
	handleContainer: {
		alignItems: 'center',
		paddingVertical: 12,
		backgroundColor: '#F9FAFB',
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
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingVertical: 16,
		backgroundColor: '#F9FAFB',
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#111827',
		flex: 1,
	},
	closeButton: {
		width: 32,
		height: 32,
		backgroundColor: '#E5E7EB',
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	scrollContent: {
		flex: 1,
	},
	scrollContentContainer: {
		flexGrow: 1,
	},
	formContainer: {
		padding: 20,
		flex: 1,
	},
	formGroup: {
		marginBottom: 20,
	},
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: '#374151',
		marginBottom: 8,
	},
	input: {
		borderWidth: 1,
		borderColor: '#D1D5DB',
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 12,
		fontSize: 16,
		color: '#111827',
		backgroundColor: '#FFFFFF',
	},
	inputError: {
		borderColor: '#DC2626',
	},
	textArea: {
		height: 80,
		textAlignVertical: 'top',
	},
	switchRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 8,
		paddingVertical: 4,
	},
	switchLabel: {
		fontSize: 14,
		color: '#6B7280',
		flex: 1,
	},
	errorText: {
		color: '#DC2626',
		fontSize: 12,
		marginTop: 4,
	},
	actionButtons: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingVertical: 16,
		paddingBottom: 20,
		borderTopWidth: 1,
		borderTopColor: '#E5E7EB',
		backgroundColor: '#F9FAFB',
	},
	cancelButton: {
		flex: 1,
		backgroundColor: '#FFFFFF',
		borderWidth: 1,
		borderColor: '#D1D5DB',
		paddingVertical: 12,
		borderRadius: 8,
		marginRight: 8,
		alignItems: 'center',
	},
	saveButton: {
		flex: 1,
		backgroundColor: '#059669',
		paddingVertical: 12,
		borderRadius: 8,
		marginLeft: 8,
		alignItems: 'center',
	},
	saveButtonDisabled: {
		backgroundColor: '#D1D5DB',
		opacity: 0.5,
	},
	cancelButtonText: {
		color: '#374151',
		fontSize: 16,
		fontWeight: '600',
	},
	saveButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	saveButtonTextDisabled: {
		color: '#9CA3AF',
	},
})
