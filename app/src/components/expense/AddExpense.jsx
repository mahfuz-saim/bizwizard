import {
	Alert,
	FlatList,
	KeyboardAvoidingView,
	Modal,
	Dimensions,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	ToastAndroid,
	TouchableOpacity,
	View,
	BackHandler,
} from 'react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import {
	BottomSheetBackdrop,
	BottomSheetModal,
	BottomSheetScrollView,
	BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalization } from '../../localization/localizationContext'
import useApi from '../../hooks/useApi'
import { createExpense } from '../../controllers/expense'
import { cleanString } from '../CleanString'

function buildMonthYear(date = new Date()) {
	const month = date.toLocaleString('en-US', { month: 'long' }).toUpperCase()
	const year = date.getFullYear()
	return `${month}-${year}`
}

function buildMonthLabel(date = new Date()) {
	return date.toLocaleString('en-US', {
		month: 'long',
		year: 'numeric',
	})
}

function buildMonthOptions(monthCount = 24) {
	const currentDate = new Date()
	const options = []

	for (
		let offset = -Math.floor(monthCount / 2);
		offset <= Math.ceil(monthCount / 2);
		offset++
	) {
		const date = new Date(
			currentDate.getFullYear(),
			currentDate.getMonth() + offset,
			1
		)
		options.push({
			label: buildMonthLabel(date),
			value: buildMonthYear(date),
			date,
		})
	}

	return options
}

export default function AddExpense({ visible, onClose, onSuccess }) {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const insets = useSafeAreaInsets()
	const bottomSheetModalRef = useRef(null)
	const closingRef = useRef(false)

	const monthOptions = useMemo(() => buildMonthOptions(24), [])
	const currentMonthOption = useMemo(() => {
		const currentMonthValue = buildMonthYear(new Date())
		return (
			monthOptions.find((option) => option.value === currentMonthValue) ||
			monthOptions[0]
		)
	}, [monthOptions])

	const [selectedMonth, setSelectedMonth] = useState(currentMonthOption)
	const [monthSelectorVisible, setMonthSelectorVisible] = useState(false)
	const [typeSelectorVisible, setTypeSelectorVisible] = useState(false)
	const typeOptions = useMemo(
		() => [
			{
				label: loc.t('expense.typeSalary') || 'Salary',
				value: 'EMPLOYEE_SALARY',
			},
			{
				label: loc.t('expense.typeGeneral') || 'Other Expenses',
				value: 'GENERAL',
			},
		],
		[loc]
	)
	const [selectedType, setSelectedType] = useState(typeOptions[1])
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [formValues, setFormValues] = useState({
		cause: '',
		description: '',
		amount: '',
	})

	const snapPoints = useMemo(() => ['70%', '88%'], [])

	const resetForm = useCallback(() => {
		setSelectedMonth(currentMonthOption)
		setSelectedType(typeOptions[1])
		setFormValues({
			cause: '',
			description: '',
			amount: '',
		})
		setMonthSelectorVisible(false)
		setTypeSelectorVisible(false)
	}, [currentMonthOption, typeOptions])

	const closeSheet = useCallback(() => {
		closingRef.current = true
		bottomSheetModalRef.current?.dismiss()
	}, [])

	useEffect(() => {
		if (visible) {
			resetForm()
			const timer = setTimeout(() => {
				bottomSheetModalRef.current?.present()
			}, 50)
			return () => clearTimeout(timer)
		}

		bottomSheetModalRef.current?.dismiss()
		setMonthSelectorVisible(false)
	}, [visible, resetForm])

	useEffect(() => {
		if (!visible) return

		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			() => {
				closeSheet()
				return true
			}
		)

		return () => backHandler.remove()
	}, [closeSheet, visible])

	const renderBackdrop = useCallback(
		(props) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="none"
				onPress={() => closeSheet()}
			/>
		),
		[closeSheet]
	)

	const handleSheetChanges = useCallback(
		(index) => {
			if (index === -1) {
				if (closingRef.current) {
					closingRef.current = false
				}
				onClose?.()
			}
		},
		[onClose]
	)

	const handleSubmit = useCallback(async () => {
		const cause = cleanString(formValues.cause || '')
		const description = cleanString(formValues.description || '')
		const amountValue = Number(
			String(formValues.amount || '').replace(/,/g, '')
		)

		if (!cause) {
			const isSalary = selectedType?.value === 'EMPLOYEE_SALARY'
			ToastAndroid.show(
				isSalary
					? loc.t('expense.nameRequired') || 'Please enter a name'
					: loc.t('expense.causeRequired') || 'Please enter a cause',
				ToastAndroid.SHORT
			)
			return
		}

		if (!Number.isFinite(amountValue) || amountValue <= 0) {
			ToastAndroid.show(
				loc.t('expense.amountRequired') || 'Please enter a valid amount',
				ToastAndroid.SHORT
			)
			return
		}

		setIsSubmitting(true)
		try {
			const month = selectedMonth?.date
				? selectedMonth.date.getMonth() + 1
				: new Date().getMonth() + 1
			const year = selectedMonth?.date
				? selectedMonth.date.getFullYear()
				: new Date().getFullYear()

			const payload = {
				month,
				year,
				items: [
					{
						amount: amountValue,
						name: cause,
						description,
						expenseType: selectedType?.value || 'GENERAL',
					},
				],
			}

			const result = await fetchData(createExpense, payload)

			if (result?.success === false) {
				ToastAndroid.show(
					result?.message ||
						loc.t('expense.saveFailed') ||
						'Failed to add expense',
					ToastAndroid.SHORT
				)
				return
			}

			ToastAndroid.show(
				loc.t('expense.addSuccess') || 'Expense added successfully',
				ToastAndroid.SHORT
			)
			onSuccess?.(result)
			closeSheet()
		} catch (error) {
			ToastAndroid.show(
				error?.message ||
					loc.t('expense.saveFailed') ||
					'Failed to add expense',
				ToastAndroid.SHORT
			)
		} finally {
			setIsSubmitting(false)
		}
	}, [
		closeSheet,
		fetchData,
		formValues,
		loc,
		onSuccess,
		selectedMonth.value,
		selectedType.value,
	])

	const monthKeyExtractor = useCallback((item) => item.value, [])
	const typeKeyExtractor = useCallback((item) => item.value, [])
	const getMonthItemLayout = useCallback(
		(_data, index) => ({ length: 48, offset: 48 * index, index }),
		[]
	)
	const getTypeItemLayout = useCallback(
		(_data, index) => ({ length: 48, offset: 48 * index, index }),
		[]
	)

	const handleSelectMonth = useCallback((item) => {
		setSelectedMonth(item)
		setMonthSelectorVisible(false)
	}, [])

	const handleSelectType = useCallback((item) => {
		setSelectedType(item)
		setTypeSelectorVisible(false)
	}, [])

	const renderMonthItem = useCallback(
		({ item }) => (
			<MonthOptionRow
				item={item}
				isSelected={item.value === selectedMonth.value}
				onPress={handleSelectMonth}
				textStyle={styles.monthItemText}
				selectedTextStyle={styles.monthItemTextSelected}
			/>
		),
		[
			selectedMonth.value,
			handleSelectMonth,
			styles.monthItemText,
			styles.monthItemTextSelected,
		]
	)

	const renderTypeItem = useCallback(
		({ item }) => (
			<MonthOptionRow
				item={item}
				isSelected={item.value === selectedType.value}
				onPress={handleSelectType}
				textStyle={styles.monthItemText}
				selectedTextStyle={styles.monthItemTextSelected}
			/>
		),
		[
			selectedType.value,
			handleSelectType,
			styles.monthItemText,
			styles.monthItemTextSelected,
		]
	)

	if (!visible) return null

	return (
		<>
			<BottomSheetModal
				ref={bottomSheetModalRef}
				snapPoints={snapPoints}
				enablePanDownToClose={false}
				backdropComponent={renderBackdrop}
				onChange={handleSheetChanges}
				keyboardBehavior={Platform.OS === 'ios' ? 'extend' : 'interactive'}
				keyboardBlurBehavior="restore"
				android_keyboardInputMode="adjustResize"
				maxDynamicContentSize={Math.round(
					Dimensions.get('window').height * 0.9
				)}
				bottomInset={insets.bottom}
				backgroundStyle={styles.bottomSheetBackground}
				handleIndicatorStyle={styles.handleIndicator}
			>
				<View style={styles.headerContainer}>
					<View style={styles.header}>
						<Text style={styles.headerTitle}>
							{loc.t('expense.addBtn') || 'Add Expense'}
						</Text>
						<TouchableOpacity
							onPress={() => closeSheet()}
							style={styles.closeButton}
							activeOpacity={0.7}
						>
							<MaterialIcons name="close" size={16} color="#6B7280" />
						</TouchableOpacity>
					</View>
				</View>

				<KeyboardAvoidingView
					style={styles.keyboardAvoidingView}
					behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
					keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
				>
					<BottomSheetScrollView
						showsVerticalScrollIndicator={false}
						bounces={true}
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={styles.scrollContent}
					>
						<View style={styles.container}>
							<View style={styles.section}>
								<View style={styles.fieldContainer}>
									<Text style={styles.overlayLabel}>
										{loc.t('expense.month') || 'Month'} *
									</Text>
									<TouchableOpacity
										style={styles.selector}
										onPress={() => setMonthSelectorVisible(true)}
										activeOpacity={0.8}
									>
										<Text style={styles.selectorText}>
											{selectedMonth.label}
										</Text>
										<MaterialIcons
											name="arrow-drop-down"
											size={24}
											color="#195FE1"
										/>
									</TouchableOpacity>
								</View>

								<View style={styles.fieldContainer}>
									<Text style={styles.overlayLabel}>
										{loc.t('expense.type') || 'Expense Type'}
									</Text>
									<TouchableOpacity
										style={styles.selector}
										onPress={() => setTypeSelectorVisible(true)}
										activeOpacity={0.8}
									>
										<Text style={styles.selectorText}>
											{selectedType.label}
										</Text>
										<MaterialIcons
											name="arrow-drop-down"
											size={24}
											color="#195FE1"
										/>
									</TouchableOpacity>
								</View>

								<View style={styles.fieldContainer}>
									<Text style={styles.overlayLabel}>
										{selectedType?.value === 'EMPLOYEE_SALARY'
											? loc.t('expense.name') || 'Name'
											: loc.t('expense.cause') || 'Cause'}{' '}
										*
									</Text>
									<BottomSheetTextInput
										style={styles.input}
										placeholder={
											selectedType?.value === 'EMPLOYEE_SALARY'
												? loc.t('expense.namePlaceholder') || 'Employee Name'
												: loc.t('expense.causePlaceholder') || 'Fuel'
										}
										placeholderTextColor="rgba(0,0,0,0.54)"
										onChangeText={(text) =>
											setFormValues((prev) => ({ ...prev, cause: text }))
										}
										returnKeyType="next"
									/>
								</View>

								<View style={styles.fieldContainer}>
									<Text style={styles.overlayLabel}>
										{loc.t('expense.description') || 'Description'}
									</Text>
									<BottomSheetTextInput
										style={[styles.input, styles.textArea]}
										placeholder={
											loc.t('expense.descriptionPlaceholder') ||
											'Boxes and tape'
										}
										placeholderTextColor="rgba(0,0,0,0.54)"
										value={formValues.description}
										onChangeText={(text) =>
											setFormValues((prev) => ({ ...prev, description: text }))
										}
										multiline
										numberOfLines={3}
										textAlignVertical="top"
									/>
								</View>

								<View style={styles.fieldContainer}>
									<Text style={styles.overlayLabel}>
										{loc.t('expense.amount') || 'Amount'} *
									</Text>
									<BottomSheetTextInput
										style={styles.input}
										placeholder={loc.t('expense.amountPlaceholder') || '700'}
										placeholderTextColor="rgba(0,0,0,0.54)"
										value={formValues.amount}
										onChangeText={(text) =>
											setFormValues((prev) => ({ ...prev, amount: text }))
										}
										keyboardType="numeric"
									/>
								</View>
							</View>

							<View style={styles.buttonContainer}>
								<TouchableOpacity
									style={[
										styles.button,
										styles.submitButton,
										isSubmitting && styles.disabledButton,
									]}
									onPress={isSubmitting ? undefined : handleSubmit}
									activeOpacity={isSubmitting ? 1 : 0.8}
									disabled={isSubmitting}
								>
									<Text style={styles.submitButtonText}>
										{isSubmitting
											? loc.t('saving') || 'Saving...'
											: loc.t('expense.addBtn') || 'Add Expense'}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</BottomSheetScrollView>
				</KeyboardAvoidingView>
			</BottomSheetModal>

			<Modal
				visible={monthSelectorVisible}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setMonthSelectorVisible(false)}
			>
				<Pressable
					style={styles.monthBackdrop}
					onPress={() => setMonthSelectorVisible(false)}
				>
					<Pressable
						style={styles.monthMenu}
						onPress={(event) => event.stopPropagation()}
					>
						<View style={styles.monthMenuHeader}>
							<Text style={styles.monthMenuTitle}>
								{loc.t('expense.selectMonth') || 'Select month'}
							</Text>
							<TouchableOpacity onPress={() => setMonthSelectorVisible(false)}>
								<MaterialIcons name="close" size={18} color="#6B7280" />
							</TouchableOpacity>
						</View>

						<FlatList
							data={monthOptions}
							keyExtractor={monthKeyExtractor}
							getItemLayout={getMonthItemLayout}
							style={styles.monthList}
							showsVerticalScrollIndicator={false}
							renderItem={renderMonthItem}
							initialNumToRender={12}
							maxToRenderPerBatch={12}
							windowSize={5}
							removeClippedSubviews
						/>
					</Pressable>
				</Pressable>
			</Modal>

			<Modal
				visible={typeSelectorVisible}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setTypeSelectorVisible(false)}
			>
				<Pressable
					style={styles.monthBackdrop}
					onPress={() => setTypeSelectorVisible(false)}
				>
					<Pressable
						style={styles.monthMenu}
						onPress={(event) => event.stopPropagation()}
					>
						<View style={styles.monthMenuHeader}>
							<Text style={styles.monthMenuTitle}>
								{loc.t('expense.type') || 'Expense Type'}
							</Text>
							<TouchableOpacity onPress={() => setTypeSelectorVisible(false)}>
								<MaterialIcons name="close" size={18} color="#6B7280" />
							</TouchableOpacity>
						</View>

						<FlatList
							data={typeOptions}
							keyExtractor={typeKeyExtractor}
							getItemLayout={getTypeItemLayout}
							style={styles.monthList}
							showsVerticalScrollIndicator={false}
							renderItem={renderTypeItem}
							initialNumToRender={8}
							maxToRenderPerBatch={8}
							windowSize={3}
							removeClippedSubviews
						/>
					</Pressable>
				</Pressable>
			</Modal>
		</>
	)
}

const styles = StyleSheet.create({
	bottomSheetBackground: {
		backgroundColor: '#F0F8FF',
		borderTopLeftRadius: 25,
		borderTopRightRadius: 25,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: -2,
		},
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
	keyboardAvoidingView: {
		flex: 1,
	},
	scrollContent: {
		flexGrow: 1,
		paddingBottom: 20,
	},
	container: {
		padding: 16,
		paddingTop: 0,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#195FE1',
	},
	closeButton: {
		width: 28,
		height: 28,
		backgroundColor: '#E5E7EB',
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
	section: {
		padding: 12,
		borderRadius: 8,
	},
	fieldContainer: {
		marginBottom: 16,
		position: 'relative',
		paddingTop: 8,
	},
	overlayLabel: {
		position: 'absolute',
		top: 0,
		left: 12,
		backgroundColor: '#F0F8FF',
		paddingHorizontal: 6,
		fontSize: 12,
		color: '#195FE1',
		fontWeight: '600',
		zIndex: 10,
		borderRadius: 8,
	},
	input: {
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		fontSize: 16,
		color: '#333333',
		minHeight: 44,
	},
	textArea: {
		minHeight: 80,
		paddingTop: 12,
		textAlignVertical: 'top',
	},
	selector: {
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		minHeight: 44,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	selectorText: {
		fontSize: 16,
		color: '#333333',
		flex: 1,
		paddingRight: 12,
	},
	buttonContainer: {
		flexDirection: 'column',
		justifyContent: 'center',
		gap: 12,
		marginTop: 0,
		paddingBottom: 8,
		paddingHorizontal: 12,
	},
	button: {
		padding: 12,
		borderRadius: 24,
		width: '100%',
		alignItems: 'center',
	},
	submitButton: {
		backgroundColor: '#195FE1',
	},
	disabledButton: {
		opacity: 0.7,
	},
	submitButtonText: {
		color: '#ffffff',
		fontWeight: '500',
		fontSize: 16,
	},
	monthBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.35)',
		justifyContent: 'center',
		padding: 20,
	},
	monthMenu: {
		backgroundColor: '#fff',
		borderRadius: 16,
		padding: 16,
		maxHeight: 420,
	},
	monthMenuHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 12,
	},
	monthMenuTitle: {
		fontSize: 16,
		fontWeight: '700',
		color: '#111827',
	},
	monthList: {
		maxHeight: 320,
	},
	monthItem: {
		paddingVertical: 12,
		paddingHorizontal: 12,
		borderRadius: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	monthItemSelected: {
		backgroundColor: '#E8F1FF',
	},
	monthItemText: {
		fontSize: 15,
		color: '#111827',
	},
	monthItemTextSelected: {
		fontWeight: '700',
		color: '#195FE1',
	},
})

const MonthOptionRow = memo(function MonthOptionRow({
	item,
	isSelected,
	onPress,
	textStyle,
	selectedTextStyle,
}) {
	return (
		<TouchableOpacity
			style={[styles.monthItem, isSelected && styles.monthItemSelected]}
			onPress={() => onPress(item)}
		>
			<Text style={[textStyle, isSelected && selectedTextStyle]}>
				{item.label}
			</Text>
			{isSelected && <MaterialIcons name="check" size={18} color="#195FE1" />}
		</TouchableOpacity>
	)
})
