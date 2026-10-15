import React, {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'

import {
	View,
	Text,
	TouchableOpacity,
	FlatList,
	StyleSheet,
	Dimensions,
	Platform,
	BackHandler,
	Animated,
	Easing,
	ActivityIndicator,
	Keyboard,
	TextInput,
	ToastAndroid,
} from 'react-native'

import MaterialIcons from 'react-native-vector-icons/MaterialIcons'

import {
	BottomSheetBackdrop,
	BottomSheetModal,
	BottomSheetScrollView,
} from '@gorhom/bottom-sheet'

import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useLocalization } from '../../localization/localizationContext'
import { deleteExpense, updateExpense } from '../../controllers/expense'
import useApi from '../../hooks/useApi'
import { cleanString } from '../CleanString'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import { DeleteModal } from '../AlertModal'

// Pure helpers hoisted to module scope so memoized sub-components (e.g.
// TransactionRow) can safely reference them without relying on closure capture
// from the parent component.
function formatDateValue(dateString) {
	if (!dateString) return '-'
	const date = new Date(dateString)
	if (isNaN(date.getTime())) return '-'
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})
}

export default function ExpenseDetails({
	visible,
	onClose,
	items = { general: [], salary: [] },
	onItemsUpdated,
}) {
	const { loc } = useLocalization()
	const { translateNumber, translateAmount } = useNumberTranslator()
	const insets = useSafeAreaInsets()
	const bottomSheetModalRef = useRef(null)
	const closingRef = useRef(false)
	const [isGeneralExpanded, setIsGeneralExpanded] = useState(true)
	const [isSalaryExpanded, setIsSalaryExpanded] = useState(false)
	const generalExpandAnim = useRef(new Animated.Value(1)).current
	const salaryExpandAnim = useRef(new Animated.Value(0)).current
	const [selectedItem, setSelectedItem] = useState(null)
	const [isDeleting, setIsDeleting] = useState(false)
	const [showDeleteModal, setShowDeleteModal] = useState(false)
	const [sheetItems, setSheetItems] = useState(items)
	const [editingField, setEditingField] = useState(null)
	const [editFormData, setEditFormData] = useState({
		name: '',
		amount: '',
		description: '',
	})
	const [validationErrors, setValidationErrors] = useState({})
	const [touchedFields, setTouchedFields] = useState({})
	const [isSavingField, setIsSavingField] = useState(false)
	const { fetchData } = useApi()

	const snapPoints = useMemo(() => ['75%', '90%'], [])
	const generalItems = sheetItems.general || []
	const salaryItems = sheetItems.salary || []
	const generalTotal = useMemo(
		() =>
			generalItems.reduce((total, item) => total + Number(item.amount || 0), 0),
		[generalItems]
	)
	const salaryTotal = useMemo(
		() =>
			salaryItems.reduce((total, item) => total + Number(item.amount || 0), 0),
		[salaryItems]
	)

	const closeSheet = useCallback(() => {
		closingRef.current = true
		bottomSheetModalRef.current?.dismiss()
	}, [])

	useEffect(() => {
		setSheetItems({
			general: items.general || [],
			salary: items.salary || [],
		})
	}, [items])

	useEffect(() => {
		if (visible) {
			const timer = setTimeout(() => {
				bottomSheetModalRef.current?.present()
			}, 50)

			return () => clearTimeout(timer)
		}

		bottomSheetModalRef.current?.dismiss()
	}, [visible])

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

	const toggleGeneralExpanded = useCallback(() => {
		setIsGeneralExpanded(!isGeneralExpanded)
		Animated.timing(generalExpandAnim, {
			toValue: isGeneralExpanded ? 0 : 1,
			duration: 300,
			easing: Easing.inOut(Easing.ease),
			useNativeDriver: false,
		}).start()
	}, [isGeneralExpanded, generalExpandAnim])

	const toggleSalaryExpanded = useCallback(() => {
		setIsSalaryExpanded(!isSalaryExpanded)
		Animated.timing(salaryExpandAnim, {
			toValue: isSalaryExpanded ? 0 : 1,
			duration: 300,
			easing: Easing.inOut(Easing.ease),
			useNativeDriver: false,
		}).start()
	}, [isSalaryExpanded, salaryExpandAnim])

	const formatAmount = useCallback(
		(value) =>
			translateAmount(Number(String(value || '').replace(/,/g, '')).toString()),
		[translateAmount]
	)

	const formatDate = useCallback(
		(dateString) => {
			if (!dateString) return '-'

			return translateNumber(
				new Date(dateString).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
				})
			)
		},
		[translateNumber]
	)

	const getExpenseTypeLabel = useCallback(
		(item) => {
			const type = item?.expenseType || item?.type

			if (type === 'EMPLOYEE_SALARY' || type === 'SALARY') {
				return loc.t('expense.employeeSalary') || 'Salary'
			}

			return loc.t('expense.otherExpenses') || 'Other Expenses'
		},
		[loc]
	)

	const handleInfoPress = useCallback((item) => {
		setSelectedItem(item)
		setEditingField(null)
		setValidationErrors({})
		setTouchedFields({})
		setEditFormData({
			name: item?.name || '',
			amount: item?.amount?.toString() || '',
			description: item?.description || '',
		})
	}, [])

	const handleBackToList = useCallback(() => {
		setSelectedItem(null)
		setEditingField(null)
		setValidationErrors({})
		setTouchedFields({})
	}, [])

	const handleEditField = useCallback(
		(fieldName) => {
			setEditingField(fieldName)
			setValidationErrors({})
			setTouchedFields({})
			setEditFormData({
				name: selectedItem?.name || '',
				amount: selectedItem?.amount?.toString() || '',
				description: selectedItem?.description || '',
			})
		},
		[selectedItem]
	)

	const handleCancelEdit = useCallback(() => {
		Keyboard.dismiss()
		setEditingField(null)
		setValidationErrors({})
		setTouchedFields({})
		setEditFormData({
			name: selectedItem?.name || '',
			amount: selectedItem?.amount?.toString() || '',
			description: selectedItem?.description || '',
		})
	}, [selectedItem])

	const validateField = useCallback(
		(fieldName) => {
			const errors = {}
			const name = cleanString(editFormData.name || '')
			const amountValue = Number(
				String(editFormData.amount || '').replace(/,/g, '')
			)
			const description = cleanString(editFormData.description || '')

			if (fieldName === 'name' && !name) {
				errors.name = loc.t('expense.causeRequired') || 'Please enter a cause'
			}

			if (
				fieldName === 'amount' &&
				(!Number.isFinite(amountValue) || amountValue <= 0)
			) {
				errors.amount =
					loc.t('expense.amountRequired') || 'Please enter a valid amount'
			}

			if (fieldName === 'description' && !description) {
				errors.description =
					loc.t('expense.descriptionRequired') || 'Please enter a description'
			}

			return errors
		},
		[editFormData, loc]
	)

	const handleBlur = useCallback(
		(fieldName) => {
			setTouchedFields((prev) => ({ ...prev, [fieldName]: true }))

			const fieldErrors = validateField(fieldName)
			setValidationErrors((prev) => {
				const newErrors = { ...prev }
				if (fieldErrors[fieldName]) {
					newErrors[fieldName] = fieldErrors[fieldName]
				} else {
					delete newErrors[fieldName]
				}
				return newErrors
			})
		},
		[validateField]
	)

	const getExpenseId = useCallback((item) => {
		return item?.expenseID || item?.expenseId || item?.expense?.id
	}, [])

	const handleSaveField = useCallback(
		async (fieldName) => {
			if (selectedItem?.id == null) return

			const fieldErrors = validateField(fieldName)
			if (fieldErrors[fieldName]) {
				setTouchedFields((prev) => ({ ...prev, [fieldName]: true }))
				setValidationErrors(fieldErrors)
				return
			}

			const amountValue = Number(
				String(editFormData.amount || '').replace(/,/g, '')
			)
			const updatedItem = {
				name: cleanString(editFormData.name || ''),
				amount: amountValue,
				description: cleanString(editFormData.description || ''),
			}
			const expenseId = getExpenseId(selectedItem)
			if (!expenseId) {
				ToastAndroid.show(
					loc.t('expense.updateError') || 'Failed to update expense',
					ToastAndroid.SHORT
				)
				return
			}

			const updatedExpense = {
				items: [
					{
						id: selectedItem.id,
						amount: updatedItem.amount,
						description: updatedItem.description,
						name: updatedItem.name,
					},
				],
			}

			setIsSavingField(true)

			try {
				const result = await fetchData(updateExpense, {
					id: expenseId,
					data: updatedExpense,
				})

				if (result?.success === false || !result) {
					ToastAndroid.show(
						result?.message ||
							loc.t('expense.updateError') ||
							'Failed to update expense',
						ToastAndroid.SHORT
					)
					return
				}

				setSelectedItem((prev) => ({
					...prev,
					...updatedItem,
				}))
				const updatedItems = {
					general: generalItems.map((item) =>
						item.id === selectedItem.id ? { ...item, ...updatedItem } : item
					),
					salary: salaryItems.map((item) =>
						item.id === selectedItem.id ? { ...item, ...updatedItem } : item
					),
				}
				setSheetItems(updatedItems)
				setEditingField(null)
				setValidationErrors({})
				setTouchedFields({})
				onItemsUpdated?.(updatedItems)
				ToastAndroid.show(
					loc.t('expense.updateSuccess') || 'Expense updated successfully',
					ToastAndroid.SHORT
				)
			} catch (error) {
				console.error('Update error:', error)
				ToastAndroid.show(
					error?.message ||
						loc.t('expense.updateError') ||
						'Failed to update expense',
					ToastAndroid.SHORT
				)
			} finally {
				setIsSavingField(false)
			}
		},
		[
			editFormData,
			fetchData,
			generalItems,
			getExpenseId,
			loc,
			onItemsUpdated,
			salaryItems,
			selectedItem,
			validateField,
		]
	)

	const handleDeleteExpense = useCallback(() => {
		setShowDeleteModal(true)
	}, [])

	const confirmDeleteExpense = useCallback(async () => {
		if (selectedItem?.id == null) return

		setIsDeleting(true)

		try {
			const result = await fetchData(deleteExpense, {
				id: selectedItem.id,
			})

			if (result?.success === false || !result) {
				ToastAndroid.show(
					result?.message ||
						loc.t('expense.deleteError') ||
						'Failed to delete expense',
					ToastAndroid.SHORT
				)
				return
			}

			const updatedItems = {
				general: generalItems.filter((item) => item.id !== selectedItem.id),
				salary: salaryItems.filter((item) => item.id !== selectedItem.id),
			}

			setSheetItems(updatedItems)
			setSelectedItem(null)
			setEditingField(null)
			setShowDeleteModal(false)
			onItemsUpdated?.(updatedItems)
		} catch (error) {
			console.error('Delete error:', error)
			ToastAndroid.show(
				error?.message ||
					loc.t('expense.deleteError') ||
					'Failed to delete expense',
				ToastAndroid.SHORT
			)
		} finally {
			setIsDeleting(false)
		}
	}, [fetchData, generalItems, loc, onItemsUpdated, salaryItems, selectedItem])

	const transactionKeyExtractor = useCallback(
		(item) => item.id?.toString() ?? '',
		[]
	)
	// Approximate fixed row height for getItemLayout. Allows FlatList to skip layout
	// measurements when rendering windowed rows. transactionItem (padding 16*2 +
	// marginVertical 4*2) + transactionHeader with date (~20px) + transactionDetails
	// (~24px) + transactionName (~16px + marginTop 6) ~= 110.
	const TRANSACTION_ROW_HEIGHT = 110
	const getTransactionItemLayout = useCallback(
		(data, index) => ({
			length: TRANSACTION_ROW_HEIGHT,
			offset: TRANSACTION_ROW_HEIGHT * index,
			index,
		}),
		[]
	)

	const renderListItem = useCallback(
		({ item }) => (
			<TransactionRow
				name={item.name || '-'}
				formattedDate={formatDate(item.date || item.createdAt)}
				formattedAmount={formatAmount(item.amount)}
				onInfoPress={() => handleInfoPress(item)}
			/>
		),
		[handleInfoPress, formatDate, formatAmount]
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
							{loc.t('expense.expenseDetails') || 'Expense Details'}
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

				<BottomSheetScrollView
					showsVerticalScrollIndicator={false}
					bounces={true}
					contentContainerStyle={styles.scrollContent}
				>
					<View style={styles.container}>
						{selectedItem ? (
							// Detail View
							<View style={styles.detailView}>
								<View style={styles.section}>
									<Text style={styles.sectionTitle}>
										{loc.t('expense.expenseDetails') || 'Expense Details'}
									</Text>
									<View style={styles.infoContainer}>
										<View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('expense.cause') || 'Cause'}
											</Text>
											{editingField === 'name' ? (
												<>
													<TextInput
														style={styles.editInput}
														value={editFormData.name}
														onChangeText={(text) =>
															setEditFormData((prev) => ({
																...prev,
																name: text,
															}))
														}
														onBlur={() => handleBlur('name')}
														placeholder={loc.t('expense.cause') || 'Cause'}
														placeholderTextColor="rgba(0,0,0,0.54)"
														autoFocus
													/>
													<TouchableOpacity
														onPress={() => handleSaveField('name')}
														style={styles.saveIconButton}
														activeOpacity={0.7}
														disabled={isSavingField}
													>
														<MaterialIcons
															name={isSavingField ? 'hourglass-empty' : 'check'}
															size={16}
															color="#22c55e"
														/>
													</TouchableOpacity>
													<TouchableOpacity
														onPress={handleCancelEdit}
														style={styles.cancelIconButton}
														activeOpacity={0.7}
														disabled={isSavingField}
													>
														<MaterialIcons
															name="close"
															size={16}
															color="#EF4444"
														/>
													</TouchableOpacity>
													{touchedFields.name && validationErrors.name && (
														<Text style={styles.errorText}>
															{validationErrors.name}
														</Text>
													)}
												</>
											) : (
												<>
													<Text style={styles.infoValue}>
														{selectedItem.name || '-'}
													</Text>
													<TouchableOpacity
														onPress={() => handleEditField('name')}
														style={styles.editIconButton}
														activeOpacity={0.7}
													>
														<MaterialIcons
															name="edit"
															size={14}
															color="#195FE1"
														/>
													</TouchableOpacity>
												</>
											)}
										</View>

										<View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('expense.amount') || 'Amount'}
											</Text>
											{editingField === 'amount' ? (
												<>
													<TextInput
														style={styles.editInput}
														value={editFormData.amount}
														onChangeText={(text) =>
															setEditFormData((prev) => ({
																...prev,
																amount: text,
															}))
														}
														onBlur={() => handleBlur('amount')}
														placeholder={
															loc.t('expense.amountPlaceholder') || '700'
														}
														placeholderTextColor="rgba(0,0,0,0.54)"
														keyboardType="decimal-pad"
														autoFocus
													/>
													<TouchableOpacity
														onPress={() => handleSaveField('amount')}
														style={styles.saveIconButton}
														activeOpacity={0.7}
														disabled={isSavingField}
													>
														<MaterialIcons
															name={isSavingField ? 'hourglass-empty' : 'check'}
															size={16}
															color="#22c55e"
														/>
													</TouchableOpacity>
													<TouchableOpacity
														onPress={handleCancelEdit}
														style={styles.cancelIconButton}
														activeOpacity={0.7}
														disabled={isSavingField}
													>
														<MaterialIcons
															name="close"
															size={16}
															color="#EF4444"
														/>
													</TouchableOpacity>
													{touchedFields.amount && validationErrors.amount && (
														<Text style={styles.errorText}>
															{validationErrors.amount}
														</Text>
													)}
												</>
											) : (
												<>
													<Text style={styles.infoValue}>
														{formatAmount(selectedItem.amount)}
													</Text>
													<TouchableOpacity
														onPress={() => handleEditField('amount')}
														style={styles.editIconButton}
														activeOpacity={0.7}
													>
														<MaterialIcons
															name="edit"
															size={14}
															color="#195FE1"
														/>
													</TouchableOpacity>
												</>
											)}
										</View>

										<View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('expense.description') || 'Description'}
											</Text>
											{editingField === 'description' ? (
												<>
													<TextInput
														style={[styles.editInput, styles.descriptionInput]}
														value={editFormData.description}
														onChangeText={(text) =>
															setEditFormData((prev) => ({
																...prev,
																description: text,
															}))
														}
														onBlur={() => handleBlur('description')}
														placeholder={
															loc.t('expense.descriptionPlaceholder') ||
															'Add description (optional)'
														}
														placeholderTextColor="rgba(0,0,0,0.54)"
														multiline
														numberOfLines={3}
														autoFocus
													/>
													<TouchableOpacity
														onPress={() => handleSaveField('description')}
														style={styles.saveIconButton}
														activeOpacity={0.7}
														disabled={isSavingField}
													>
														<MaterialIcons
															name={isSavingField ? 'hourglass-empty' : 'check'}
															size={16}
															color="#22c55e"
														/>
													</TouchableOpacity>
													<TouchableOpacity
														onPress={handleCancelEdit}
														style={styles.cancelIconButton}
														activeOpacity={0.7}
														disabled={isSavingField}
													>
														<MaterialIcons
															name="close"
															size={16}
															color="#EF4444"
														/>
													</TouchableOpacity>
													{touchedFields.description &&
														validationErrors.description && (
															<Text style={styles.errorText}>
																{validationErrors.description}
															</Text>
														)}
												</>
											) : (
												<>
													<Text style={styles.infoValue}>
														{selectedItem.description || '-'}
													</Text>
													<TouchableOpacity
														onPress={() => handleEditField('description')}
														style={styles.editIconButton}
														activeOpacity={0.7}
													>
														<MaterialIcons
															name="edit"
															size={14}
															color="#195FE1"
														/>
													</TouchableOpacity>
												</>
											)}
										</View>

										<View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('expense.type') || 'Expense Type'}
											</Text>
											<Text style={styles.infoValue}>
												{getExpenseTypeLabel(selectedItem)}
											</Text>
										</View>

										<View style={styles.infoItem}>
											<Text style={styles.infoLabel}>
												{loc.t('expense.date') || 'Date'}
											</Text>
											<Text style={styles.infoValue}>
												{formatDate(
													selectedItem.date || selectedItem.createdAt
												)}
											</Text>
										</View>
									</View>

									{!editingField && (
										<View style={styles.actionButtonsContainer}>
											<TouchableOpacity
												onPress={handleBackToList}
												disabled={isDeleting}
												style={styles.editButton}
												activeOpacity={0.7}
											>
												<MaterialIcons
													name="receipt"
													size={18}
													color="#FFFFFF"
												/>
												<Text style={styles.editButtonText}>
													{loc.t('customer.transactions.backToList') ||
														'Back to List'}
												</Text>
											</TouchableOpacity>

											<TouchableOpacity
												onPress={handleDeleteExpense}
												disabled={isDeleting}
												style={styles.deleteButton}
												activeOpacity={0.7}
											>
												{isDeleting ? (
													<ActivityIndicator size="small" color="#FFFFFF" />
												) : (
													<>
														<MaterialIcons
															name="delete"
															size={18}
															color="#FFFFFF"
														/>
														<Text style={styles.deleteButtonText}>
															{loc.t('common.delete') || 'Delete'}
														</Text>
													</>
												)}
											</TouchableOpacity>
										</View>
									)}
								</View>
							</View>
						) : (
							// List View
							<>
								{!generalItems.length && !salaryItems.length ? (
									<View style={styles.section}>
										<View style={styles.emptyContainer}>
											<MaterialIcons
												name="receipt-long"
												size={48}
												color="#94A3B8"
											/>

											<Text style={styles.emptyText}>
												{loc.t('expense.noExpenditureData') ||
													'No expense data found'}
											</Text>
										</View>
									</View>
								) : (
									<>
										{generalItems.length > 0 && (
											<View style={styles.section}>
												<TouchableOpacity
													onPress={toggleGeneralExpanded}
													style={styles.sectionHeader}
													activeOpacity={0.7}
												>
													<View style={styles.sectionHeaderLeft}>
														<MaterialIcons
															name="receipt"
															size={20}
															color="#195FE1"
														/>
														<Text style={styles.sectionTitle}>
															{loc.t('expense.otherExpenses') ||
																'Other Expenses'}
														</Text>
														<Text style={styles.sectionTotalText}>
															{formatAmount(generalTotal)}
														</Text>
													</View>
													<Animated.View
														style={{
															transform: [
																{
																	rotate: generalExpandAnim.interpolate({
																		inputRange: [0, 1],
																		outputRange: ['0deg', '180deg'],
																	}),
																},
															],
														}}
													>
														<MaterialIcons
															name="expand-more"
															size={24}
															color="#195FE1"
														/>
													</Animated.View>
												</TouchableOpacity>

												{isGeneralExpanded && (
													<View>
														<FlatList
															data={generalItems}
															keyExtractor={transactionKeyExtractor}
															getItemLayout={getTransactionItemLayout}
															renderItem={renderListItem}
															scrollEnabled={false}
															contentContainerStyle={styles.listContent}
															initialNumToRender={10}
															maxToRenderPerBatch={10}
															windowSize={5}
															removeClippedSubviews
														/>
													</View>
												)}
											</View>
										)}

										{salaryItems.length > 0 && (
											<View style={styles.section}>
												<TouchableOpacity
													onPress={toggleSalaryExpanded}
													style={styles.sectionHeader}
													activeOpacity={0.7}
												>
													<View style={styles.sectionHeaderLeft}>
														<MaterialIcons
															name="attach-money"
															size={20}
															color="#195FE1"
														/>
														<Text style={styles.sectionTitle}>
															{loc.t('expense.employeeSalary') ||
																'Employee Salary'}
														</Text>
														<Text style={styles.sectionTotalText}>
															{formatAmount(salaryTotal)}
														</Text>
													</View>
													<Animated.View
														style={{
															transform: [
																{
																	rotate: salaryExpandAnim.interpolate({
																		inputRange: [0, 1],
																		outputRange: ['0deg', '180deg'],
																	}),
																},
															],
														}}
													>
														<MaterialIcons
															name="expand-more"
															size={24}
															color="#195FE1"
														/>
													</Animated.View>
												</TouchableOpacity>

												{isSalaryExpanded && (
													<View>
														<FlatList
															data={salaryItems}
															keyExtractor={transactionKeyExtractor}
															getItemLayout={getTransactionItemLayout}
															renderItem={renderListItem}
															scrollEnabled={false}
															contentContainerStyle={styles.listContent}
															initialNumToRender={10}
															maxToRenderPerBatch={10}
															windowSize={5}
															removeClippedSubviews
														/>
													</View>
												)}
											</View>
										)}
									</>
								)}
							</>
						)}
					</View>
				</BottomSheetScrollView>
			</BottomSheetModal>
			<DeleteModal
				visible={showDeleteModal}
				onClose={() => {
					if (!isDeleting) {
						setShowDeleteModal(false)
					}
				}}
				onConfirm={confirmDeleteExpense}
				title={loc.t('expense.confirmDelete') || 'Delete Expense'}
				subtitle={
					loc.t('expense.deleteConfirmMessage') ||
					'Are you sure you want to delete this expense?'
				}
			/>
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

	scrollContent: {
		flexGrow: 1,
		paddingBottom: 20,
	},

	container: {
		padding: 16,
		paddingTop: 0,
	},

	listItemContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 12,
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		marginBottom: 8,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.08)',
	},

	listItemContent: {
		flex: 1,
		marginRight: 12,
	},

	itemNameSimple: {
		fontSize: 14,
		fontWeight: '600',
		color: '#111827',
		marginBottom: 4,
	},

	amountTextSimple: {
		fontSize: 13,
		fontWeight: '600',
		color: '#195FE1',
	},

	infoButton: {
		padding: 8,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},

	detailView: {
		paddingBottom: 20,
	},

	detailField: {
		marginBottom: 16,
	},

	fieldLabel: {
		fontSize: 12,
		fontWeight: '600',
		color: '#6B7280',
		marginBottom: 4,
		textTransform: 'uppercase',
	},

	fieldValue: {
		fontSize: 14,
		fontWeight: '500',
		color: '#111827',
	},

	amountValueDetail: {
		fontSize: 16,
		fontWeight: '700',
		color: '#195FE1',
	},

	infoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0, 0, 0, 0.1)',
	},

	editableFieldRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		flex: 1,
		gap: 8,
	},

	editFieldRow: {
		flexDirection: 'row',
		alignItems: 'center',
		flex: 1,
		gap: 8,
	},

	editIcon: {
		padding: 6,
		borderRadius: 6,
		backgroundColor: 'rgba(25, 95, 225, 0.1)',
		justifyContent: 'center',
		alignItems: 'center',
		width: 32,
		height: 32,
	},

	saveIcon: {
		padding: 6,
		borderRadius: 6,
		backgroundColor: 'rgba(34, 197, 94, 0.1)',
		justifyContent: 'center',
		alignItems: 'center',
		width: 32,
		height: 32,
	},

	cancelIcon: {
		padding: 6,
		borderRadius: 6,
		backgroundColor: 'rgba(239, 68, 68, 0.1)',
		justifyContent: 'center',
		alignItems: 'center',
		width: 32,
		height: 32,
	},

	editInput: {
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingRight: 72,
		paddingVertical: 12,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		fontSize: 16,
		color: '#333333',
		minHeight: 44,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 2,
	},

	descriptionInput: {
		minHeight: 80,
		textAlignVertical: 'top',
	},

	infoLabel: {
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

	card: {
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.12)',
	},

	actionButtonsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 12,
		paddingTop: 4,
		paddingBottom: 8,
	},

	deleteButton: {
		flex: 1,
		flexDirection: 'row',
		backgroundColor: '#EF4444',
		borderRadius: 8,
		padding: 14,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		elevation: 3,
	},

	deleteButtonText: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 14,
	},

	editButton: {
		flex: 1,
		flexDirection: 'row',
		backgroundColor: '#195FE1',
		borderRadius: 8,
		padding: 14,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		elevation: 3,
	},

	editButtonText: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 14,
	},

	section: {
		padding: 12,
		borderRadius: 8,
		marginBottom: 12,
	},

	sectionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 12,
		backgroundColor: 'rgba(25, 95, 225, 0.08)',
		borderRadius: 8,
		marginBottom: 8,
	},

	sectionHeaderLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		flex: 1,
		flexWrap: 'wrap',
	},

	sectionTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#195FE1',
		marginBottom: 12,
		textAlign: 'center',
	},

	sectionTotalText: {
		fontSize: 14,
		fontWeight: '600',
		color: '#195FE1',
		marginBottom: 12,
	},

	fieldContainer: {
		backgroundColor: '#FFFFFF',
		padding: 16,
		borderRadius: 12,
	},

	infoContainer: {
		backgroundColor: 'transparent',
		borderRadius: 12,
		padding: 0,
	},

	infoItem: {
		marginBottom: 16,
		position: 'relative',
		paddingTop: 8,
	},

	infoValue: {
		fontSize: 16,
		color: '#333333',
		fontWeight: '500',
		backgroundColor: '#FFFFFF',
		padding: 12,
		paddingRight: 40,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		minHeight: 44,
		textAlignVertical: 'center',
	},

	editIconButton: {
		position: 'absolute',
		top: 8,
		right: 8,
		padding: 4,
		borderRadius: 6,
		backgroundColor: 'transparent',
		justifyContent: 'center',
		alignItems: 'center',
		width: 28,
		height: 28,
		zIndex: 11,
	},

	saveIconButton: {
		position: 'absolute',
		top: 8,
		right: 40,
		padding: 4,
		borderRadius: 6,
		backgroundColor: 'transparent',
		justifyContent: 'center',
		alignItems: 'center',
		width: 28,
		height: 28,
		zIndex: 11,
	},

	cancelIconButton: {
		position: 'absolute',
		top: 8,
		right: 8,
		padding: 4,
		borderRadius: 6,
		backgroundColor: 'transparent',
		justifyContent: 'center',
		alignItems: 'center',
		width: 28,
		height: 28,
		zIndex: 11,
	},

	errorText: {
		color: '#ff0033',
		fontSize: 12,
		marginTop: 4,
		marginLeft: 4,
	},

	transactionItem: {
		backgroundColor: '#FFFFFF',
		marginHorizontal: 8,
		marginVertical: 4,
		padding: 16,
		borderRadius: 12,
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.1,
		shadowRadius: 2,
	},

	transactionHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},

	transactionInfo: {
		flex: 1,
		marginRight: 12,
	},

	transactionDate: {
		fontSize: 14,
		color: '#6B7280',
		marginBottom: 4,
		fontWeight: '500',
	},

	transactionDetails: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 12,
	},

	transactionAmount: {
		fontSize: 18,
		fontWeight: '700',
		color: '#111827',
		flex: 1,
	},

	transactionName: {
		fontSize: 13,
		fontWeight: '500',
		color: '#6B7280',
		marginTop: 6,
	},

	statusBadge: {
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 8,
		alignSelf: 'flex-start',
		backgroundColor: '#195FE1',
	},

	statusText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#FFFFFF',
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

	listContent: {
		paddingBottom: 20,
	},

	emptyContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 60,
	},

	emptyText: {
		marginTop: 12,
		fontSize: 14,
		color: '#64748B',
		textAlign: 'center',
	},
})

// Memoized row component for the expense-detail FlatLists.
// Extracted from the previous inline `renderListItem` so each row can bail out
// of re-render when its `item` reference is stable.
// Defined at module scope (alongside styles), so it receives `formatDate` and
// `formatAmount` as props instead of capturing them from the parent closure.
const TransactionRow = memo(function TransactionRow({
	name,
	formattedDate,
	formattedAmount,
	onInfoPress,
}) {
	return (
		<View style={styles.transactionItem}>
			<View style={styles.transactionHeader}>
				<View style={styles.transactionInfo}>
					<Text style={styles.transactionDate}>{formattedDate}</Text>
					<View style={styles.transactionDetails}>
						<Text style={styles.transactionAmount} numberOfLines={1}>
							{formattedAmount}
						</Text>
					</View>
					<Text style={styles.transactionName} numberOfLines={1}>
						{name}
					</Text>
				</View>
				<TouchableOpacity
					onPress={onInfoPress}
					style={styles.infoButton}
					activeOpacity={0.7}
				>
					<MaterialIcons name="info-outline" size={20} color="#6B7280" />
				</TouchableOpacity>
			</View>
		</View>
	)
})
