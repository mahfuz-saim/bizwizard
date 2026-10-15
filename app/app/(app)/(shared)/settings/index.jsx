import {
	Text,
	TouchableOpacity,
	View,
	ScrollView,
	StatusBar,
	StyleSheet,
	TextInput,
	ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useEffect, useState, useRef } from 'react'
import { BackHandler } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useLocalization } from '../../../../src/localization/localizationContext'
import { statusBarColor, barStyleMode } from '../../../../src/constants'
import useApi from '../../../../src/hooks/useApi'
import { getConfig, setConfig } from '../../../../src/controllers/app'
import { useNumberTranslator } from '../../../../src/hooks/useNumberTranslator'

export default function SettingsScreen() {
	const { loc, changeLocale, currentLocale } = useLocalization()
	const router = useRouter()
	const { fetchData } = useApi()
	const { translateNumber, toEnglishNumbers } = useNumberTranslator()

	// State for config values
	const [expiryThreshold, setExpiryThreshold] = useState('')
	const [lowStockThreshold, setLowStockThreshold] = useState('')
	const [notSoldDaysThreshold, setNotSoldDaysThreshold] = useState('')
	const [editingExpiry, setEditingExpiry] = useState(false)
	const [editingLowStock, setEditingLowStock] = useState(false)
	const [editingNotSoldDays, setEditingNotSoldDays] = useState(false)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)

	// Refs for TextInputs
	const lowStockInputRef = useRef(null)
	const expiryInputRef = useRef(null)
	const notSoldDaysInputRef = useRef(null)

	// Fetch config on mount
	useEffect(() => {
		const loadConfig = async () => {
			try {
				const result = await fetchData(getConfig, {})
				console.log('Config fetched:', result)
				if (result?.data) {
					setExpiryThreshold(
						result.data.defaultExpirationThreshold?.toString() || ''
					)
					setLowStockThreshold(
						result.data.defaultLowStockThreshold?.toString() || ''
					)
					setNotSoldDaysThreshold(
						result.data.defaultNotSoldThreshold?.toString() || ''
					)
				}
			} catch (error) {
				console.error('Error loading config:', error)
			} finally {
				setLoading(false)
			}
		}
		loadConfig()
	}, [])

	// Handle Android back button
	useEffect(() => {
		const backAction = () => {
			router.push('/home')
			return true
		}

		const backHandler = BackHandler.addEventListener(
			'hardwareBackPress',
			backAction
		)

		return () => backHandler.remove()
	}, [router])

	// Save config
	const saveConfig = async (field, value) => {
		if (!value || isNaN(value)) return

		setSaving(true)
		try {
			const params = {
				defaultExpirationThreshold:
					field === 'expiry'
						? parseInt(value) || 0
						: parseInt(expiryThreshold) || 0,
				defaultLowStockThreshold:
					field === 'lowStock'
						? parseInt(value) || 0
						: parseInt(lowStockThreshold) || 0,
				defaultNotSoldThreshold:
					field === 'notSoldDays'
						? parseInt(value) || 0
						: parseInt(notSoldDaysThreshold) || 0,
			}

			await fetchData(setConfig, { params })

			if (field === 'expiry') {
				setEditingExpiry(false)
			} else if (field === 'lowStock') {
				setEditingLowStock(false)
			} else if (field === 'notSoldDays') {
				setEditingNotSoldDays(false)
			}
		} catch (error) {
			console.error('Error saving config:', error)
		} finally {
			setSaving(false)
		}
	}

	return (
		<ScrollView style={styles.container}>
			<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />

			{/* Settings Content */}
			<View style={styles.content}>
				{loading ? (
					<ActivityIndicator size="large" color="#3b82f6" />
				) : (
					<>
						{/* Language Section */}
						<View style={styles.section}>
							<View style={styles.card}>
								<View style={styles.row}>
									<Text style={styles.label}>
										{currentLocale === 'en' ? 'Language' : 'ভাষা'}
									</Text>
									<View style={styles.toggleContainer}>
										<TouchableOpacity
											onPress={() => changeLocale('en')}
											style={[
												styles.toggleButton,
												styles.toggleButtonLeft,
												currentLocale === 'en' && styles.toggleButtonActive,
											]}
											activeOpacity={0.7}
										>
											<Text
												style={[
													styles.toggleText,
													currentLocale === 'en' && styles.toggleTextActive,
												]}
											>
												EN
											</Text>
										</TouchableOpacity>
										<TouchableOpacity
											onPress={() => changeLocale('bn')}
											style={[
												styles.toggleButton,
												styles.toggleButtonRight,
												currentLocale === 'bn' && styles.toggleButtonActive,
											]}
											activeOpacity={0.7}
										>
											<Text
												style={[
													styles.toggleText,
													currentLocale === 'bn' && styles.toggleTextActive,
												]}
											>
												বাং
											</Text>
										</TouchableOpacity>
									</View>
								</View>
							</View>
						</View>

						{/* Default Low Stock Quantity Section */}
						<View style={styles.section}>
							<View style={styles.card}>
								<View style={styles.row}>
									<Text style={styles.label}>
										{loc.t('settings.defaultLowStock')}
									</Text>
									<View style={styles.inputWrapper}>
										<TextInput
											ref={lowStockInputRef}
											style={[
												styles.input,
												editingLowStock && styles.inputEditing,
											]}
											value={
												lowStockThreshold
													? translateNumber(lowStockThreshold)
													: ''
											}
											onChangeText={(text) => {
												const englishValue = toEnglishNumbers(text)
												const numericValue = englishValue.replace(/[^0-9]/g, '')
												setLowStockThreshold(numericValue)
											}}
											editable={editingLowStock}
											keyboardType="numeric"
											placeholder="0"
										/>
										<TouchableOpacity
											onPress={() => {
												if (editingLowStock) {
													saveConfig('lowStock', lowStockThreshold)
												} else {
													setEditingLowStock(true)
													setTimeout(
														() => lowStockInputRef.current?.focus(),
														100
													)
												}
											}}
											style={styles.iconButtonInside}
											disabled={saving}
										>
											{saving && editingLowStock ? (
												<ActivityIndicator size="small" color="#3b82f6" />
											) : editingLowStock ? (
												<Feather name="check" size={18} color="#10b981" />
											) : (
												<Feather name="edit-2" size={16} color="#6b7280" />
											)}
										</TouchableOpacity>
									</View>
								</View>
							</View>
						</View>

						{/* Default Notify Before Expiry Days Section */}
						<View style={styles.section}>
							<View style={styles.card}>
								<View style={styles.row}>
									<Text style={styles.label}>
										{loc.t('settings.defaultExpiryNotify')}
									</Text>
									<View style={styles.inputWrapper}>
										<TextInput
											ref={expiryInputRef}
											style={[
												styles.input,
												editingExpiry && styles.inputEditing,
											]}
											value={
												expiryThreshold ? translateNumber(expiryThreshold) : ''
											}
											onChangeText={(text) => {
												const englishValue = toEnglishNumbers(text)
												const numericValue = englishValue.replace(/[^0-9]/g, '')
												setExpiryThreshold(numericValue)
											}}
											editable={editingExpiry}
											keyboardType="numeric"
											placeholder="0"
										/>
										<TouchableOpacity
											onPress={() => {
												if (editingExpiry) {
													saveConfig('expiry', expiryThreshold)
												} else {
													setEditingExpiry(true)
													setTimeout(() => expiryInputRef.current?.focus(), 100)
												}
											}}
											style={styles.iconButtonInside}
											disabled={saving}
										>
											{saving && editingExpiry ? (
												<ActivityIndicator size="small" color="#3b82f6" />
											) : editingExpiry ? (
												<Feather name="check" size={18} color="#10b981" />
											) : (
												<Feather name="edit-2" size={16} color="#6b7280" />
											)}
										</TouchableOpacity>
									</View>
								</View>
							</View>
						</View>

						{/* Not Sold For Notification Days Section */}
						<View style={styles.section}>
							<View style={styles.card}>
								<View style={styles.row}>
									<Text style={styles.label}>
										{loc.t('settings.defaultNotSoldNotify')}
									</Text>
									<View style={styles.inputWrapper}>
										<TextInput
											ref={notSoldDaysInputRef}
											style={[
												styles.input,
												editingNotSoldDays && styles.inputEditing,
											]}
											value={
												notSoldDaysThreshold
													? translateNumber(notSoldDaysThreshold)
													: ''
											}
											onChangeText={(text) => {
												const englishValue = toEnglishNumbers(text)
												const numericValue = englishValue.replace(/[^0-9]/g, '')
												setNotSoldDaysThreshold(numericValue)
											}}
											editable={editingNotSoldDays}
											keyboardType="numeric"
											placeholder="0"
										/>
										<TouchableOpacity
											onPress={() => {
												if (editingNotSoldDays) {
													saveConfig('notSoldDays', notSoldDaysThreshold)
												} else {
													setEditingNotSoldDays(true)
													setTimeout(
														() => notSoldDaysInputRef.current?.focus(),
														100
													)
												}
											}}
											style={styles.iconButtonInside}
											disabled={saving}
										>
											{saving && editingNotSoldDays ? (
												<ActivityIndicator size="small" color="#3b82f6" />
											) : editingNotSoldDays ? (
												<Feather name="check" size={18} color="#10b981" />
											) : (
												<Feather name="edit-2" size={16} color="#6b7280" />
											)}
										</TouchableOpacity>
									</View>
								</View>
							</View>
						</View>

						{/* KYC Verification Section */}
						<View style={styles.section}>
							<TouchableOpacity
								style={styles.card}
								onPress={() => router.push('/kyc')}
								activeOpacity={0.7}
							>
								<View style={styles.row}>
									<Text style={styles.label}>
										{currentLocale === 'en'
											? 'KYC Verification'
											: 'কেওয়াইসি যাচাইকরণ'}
									</Text>
									<Feather name="chevron-right" size={20} color="#6b7280" />
								</View>
							</TouchableOpacity>
						</View>
					</>
				)}
			</View>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f8f9fa',
	},
	content: {
		paddingHorizontal: 24,
		paddingTop: 24,
		paddingBottom: 24,
	},
	section: {
		marginBottom: 16,
	},
	card: {
		backgroundColor: '#ffffff',
		borderRadius: 16,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 4,
		},
		shadowOpacity: 0.1,
		shadowRadius: 12,
		elevation: 8,
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.5)',
		overflow: 'hidden',
		paddingHorizontal: 20,
		paddingVertical: 14,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	label: {
		fontSize: 14,
		fontWeight: '600',
		color: '#111827',
		flex: 1,
	},
	inputWrapper: {
		position: 'relative',
		flexDirection: 'row',
		alignItems: 'center',
	},
	input: {
		backgroundColor: '#f3f4f6',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingRight: 40,
		paddingVertical: 8,
		minWidth: 90,
		textAlign: 'center',
		fontSize: 14,
		fontWeight: '600',
		color: '#6b7280',
		borderWidth: 1,
		borderColor: 'transparent',
	},
	inputEditing: {
		backgroundColor: '#ffffff',
		borderColor: '#3b82f6',
		color: '#111827',
	},
	iconButtonInside: {
		position: 'absolute',
		right: 8,
		padding: 4,
	},
	toggleContainer: {
		flexDirection: 'row',
		backgroundColor: '#f3f4f6',
		borderRadius: 10,
		padding: 3,
	},
	toggleButton: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		alignItems: 'center',
		justifyContent: 'center',
		minWidth: 55,
	},
	toggleButtonLeft: {
		borderTopLeftRadius: 8,
		borderBottomLeftRadius: 8,
	},
	toggleButtonRight: {
		borderTopRightRadius: 8,
		borderBottomRightRadius: 8,
	},
	toggleButtonActive: {
		backgroundColor: '#3b82f6',
		shadowColor: '#3b82f6',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 3,
	},
	toggleText: {
		fontSize: 14,
		fontWeight: '600',
		color: '#6b7280',
	},
	toggleTextActive: {
		color: '#ffffff',
	},
})
