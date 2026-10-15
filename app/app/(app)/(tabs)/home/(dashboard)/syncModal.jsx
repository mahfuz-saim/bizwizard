import React, { useState, useRef } from 'react'
import {
	Modal,
	View,
	Text,
	ActivityIndicator,
	TouchableOpacity,
	StyleSheet,
	TouchableWithoutFeedback,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import useApi from '../../../../../src/hooks/useApi'
import {
	getAllInventory,
	getAllProductsFromShop,
	getAllLotFromShop,
} from '../../../../../src/controllers/product'
import { localProductController } from '../../../../../src/controllers/offline/product'

export default function SyncModal({ visible, onSyncComplete }) {
	const { loc } = useLocalization()
	const { fetchData } = useApi()

	const [currentStep, setCurrentStep] = useState(0) // 0: not started, 1: products, 2: variants, 3: lots
	const [progress, setProgress] = useState(0)
	const [variantProgress, setVariantProgress] = useState(0)
	const [lotProgress, setLotProgress] = useState(0)
	const [remoteTotal, setRemoteTotal] = useState(0)
	const [variantRemoteTotal, setVariantRemoteTotal] = useState(0)
	const [lotRemoteTotal, setLotRemoteTotal] = useState(0)
	const [error, setError] = useState('')
	const [isSyncing, setIsSyncing] = useState(false)
	const syncInProgress = useRef(false)

	const syncProducts = async () => {
		setCurrentStep(1)
		setError('')
		setProgress(0)
		setRemoteTotal(0)
		let currentPage = 1
		let limit = 50
		let sortBy = null
		let sortOrder = null
		let totalFetched = 0

		while (syncInProgress.current) {
			const res = await fetchData(getAllInventory, {
				page: currentPage,
				limit: limit,
				sortBy: sortBy,
				sortOrder: sortOrder,
			})

			if (!res.success) {
				throw new Error(res?.message || 'Failed to fetch products')
			}

			if (currentPage === 1) {
				setRemoteTotal(res.data.meta.total)
			}

			try {
				await localProductController.upsertIntoInventory(res.data.data)
			} catch (err) {
				throw new Error(err?.message || 'Error saving products locally')
			}

			totalFetched += res.data.data.length
			setProgress(totalFetched)

			if (res.data.data.length === 0) break
			if (totalFetched >= res.data.meta.total) break

			currentPage += 1
		}
	}

	const syncShopVariants = async () => {
		setCurrentStep(2)
		setVariantProgress(0)
		setVariantRemoteTotal(0)
		let currentPage = 1
		let limit = 30
		let sortBy = null
		let sortOrder = null
		let totalFetched = 0

		while (syncInProgress.current) {
			const res = await fetchData(getAllProductsFromShop, {
				page: currentPage,
				limit: limit,
				sortBy: sortBy,
				sortOrder: sortOrder,
				includeProduct: false,
			})

			if (!res.success) {
				throw new Error(res?.message || 'Failed to fetch variants')
			}

			if (currentPage === 1) {
				setVariantRemoteTotal(res.data.meta.total)
			}

			try {
				await localProductController.upsertIntoShopVariant(res.data.data)
			} catch (err) {
				throw new Error(err?.message || 'Error saving variants locally')
			}

			totalFetched += res.data.data.length
			setVariantProgress(totalFetched)

			if (res.data.data.length === 0) break
			if (totalFetched >= res.data.meta.total) break

			currentPage += 1
		}
	}

	const syncShopLots = async () => {
		setCurrentStep(3)
		setLotProgress(0)
		setLotRemoteTotal(0)
		let currentPage = 1
		let limit = 30
		let sortBy = null
		let sortOrder = null
		let totalFetched = 0

		while (syncInProgress.current) {
			const res = await fetchData(getAllLotFromShop, {
				page: currentPage,
				limit: limit,
				sortBy: sortBy,
				sortOrder: sortOrder,
			})

			if (!res.success) {
				throw new Error(res?.message || 'Failed to fetch lots')
			}

			if (currentPage === 1) {
				setLotRemoteTotal(res.data.meta.total)
			}

			try {
				await localProductController.upsertIntoLot(res.data.data)
			} catch (err) {
				throw new Error(err?.message || 'Error saving lots locally')
			}

			totalFetched += res.data.data.length
			setLotProgress(totalFetched)

			if (res.data.data.length === 0) break
			if (totalFetched >= res.data.meta.total) break

			currentPage += 1
		}
	}

	const handleSync = async () => {
		setIsSyncing(true)
		setError('')
		syncInProgress.current = true

		try {
			// Step 1: Sync Products
			await syncProducts()

			// Step 2: Sync Variants
			await syncShopVariants()

			// Step 3: Sync Lots
			await syncShopLots()

			// Sync complete
			setCurrentStep(0)
			syncInProgress.current = false
			setIsSyncing(false)

			// Notify parent that sync is complete
			if (onSyncComplete) {
				onSyncComplete(true)
			}
		} catch (err) {
			setError(err?.message || 'Sync failed')
			syncInProgress.current = false
			setIsSyncing(false)
		}
	}

	const handleRetry = () => {
		handleSync()
	}

	const getStepProgress = () => {
		switch (currentStep) {
			case 1:
				return remoteTotal > 0
					? Math.min((progress / remoteTotal) * 100, 100)
					: 0
			case 2:
				return variantRemoteTotal > 0
					? Math.min((variantProgress / variantRemoteTotal) * 100, 100)
					: 0
			case 3:
				return lotRemoteTotal > 0
					? Math.min((lotProgress / lotRemoteTotal) * 100, 100)
					: 0
			default:
				return 0
		}
	}

	const getStepTitle = () => {
		switch (currentStep) {
			case 1:
				return loc.t('sync.syncingProducts') || 'Syncing Products'
			case 2:
				return loc.t('sync.syncingVariants') || 'Syncing Variants'
			case 3:
				return loc.t('sync.syncingLots') || 'Syncing Lots'
			default:
				return ''
		}
	}

	const getStepCount = () => {
		switch (currentStep) {
			case 1:
				return `${progress} / ${remoteTotal}`
			case 2:
				return `${variantProgress} / ${variantRemoteTotal}`
			case 3:
				return `${lotProgress} / ${lotRemoteTotal}`
			default:
				return ''
		}
	}

	// Auto-start sync when modal becomes visible
	React.useEffect(() => {
		if (visible && !isSyncing && currentStep === 0 && !error) {
			handleSync()
		}
	}, [visible])

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="fade"
			onRequestClose={() => {
				// Prevent closing while syncing
			}}
		>
			<TouchableWithoutFeedback onPress={() => {}}>
				<View style={styles.modalBackdrop}>
					<TouchableWithoutFeedback onPress={() => {}}>
						<View style={styles.modalContent}>
							{/* Error State */}
							{error && !isSyncing ? (
								<>
									<MaterialIcons
										name="error"
										size={48}
										color="#EF4444"
										style={styles.icon}
									/>
									<Text style={styles.title}>
										{loc.t('sync.error') || 'Sync Failed'}
									</Text>
									<Text style={styles.subtitle}>{error}</Text>

									{/* Retry Button */}
									<View style={styles.singleButtonContainer}>
										<TouchableOpacity
											style={[styles.button, styles.retryButton]}
											onPress={handleRetry}
											activeOpacity={0.8}
										>
											<Text style={styles.retryButtonText}>
												{loc.t('sync.tryAgain') || 'Try Again'}
											</Text>
										</TouchableOpacity>
									</View>
								</>
							) : (
								<>
									{/* Header */}
									<MaterialIcons
										name="cloud-download"
										size={48}
										color="#177DFF"
										style={styles.icon}
									/>
									<Text style={styles.title}>
										{loc.t('sync.modalTitleFirst') || 'Downloading Data'}
									</Text>
									<Text style={styles.subtitle}>
										{loc.t('sync.firstSyncNote') ||
											'This is required for first-time setup'}
									</Text>

									{/* Step Indicator */}
									<View style={styles.stepContainer}>
										<Text style={styles.stepTitle}>{getStepTitle()}</Text>
										<Text style={styles.stepInfo}>
											{loc.t('sync.step') || 'Step'} {currentStep}/3
										</Text>

										{/* Progress Bar */}
										<View style={styles.progressBarContainer}>
											<View
												style={[
													styles.progressBar,
													{ width: `${getStepProgress()}%` },
												]}
											/>
										</View>

										{/* Progress Percentage */}
										<View style={styles.progressTextContainer}>
											<Text style={styles.progressCount}>{getStepCount()}</Text>
											<Text style={styles.progressPercent}>
												{Math.round(getStepProgress())}%
											</Text>
										</View>
									</View>

									{/* Overall Progress Dots */}
									<View style={styles.dotsContainer}>
										<View
											style={[
												styles.dot,
												currentStep >= 1
													? styles.dotActive
													: styles.dotInactive,
											]}
										/>
										<View
											style={[
												styles.dot,
												currentStep >= 2
													? styles.dotActive
													: styles.dotInactive,
											]}
										/>
										<View
											style={[
												styles.dot,
												currentStep >= 3
													? styles.dotActive
													: styles.dotInactive,
											]}
										/>
									</View>

									{/* Loading Indicator */}
									<View style={styles.loadingContainer}>
										<ActivityIndicator size="large" color="#177DFF" />
										<Text style={styles.loadingText}>
											{loc.t('sync.pleaseWait') || 'Please wait...'}
										</Text>
										<Text style={styles.warningText}>
											{loc.t('sync.doNotClose') ||
												'Please do not close this screen'}
										</Text>
									</View>
								</>
							)}
						</View>
					</TouchableWithoutFeedback>
				</View>
			</TouchableWithoutFeedback>
		</Modal>
	)
}

const styles = StyleSheet.create({
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	modalContent: {
		backgroundColor: '#F0F8FF',
		borderRadius: 12,
		padding: 24,
		width: '100%',
		maxWidth: 340,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	icon: {
		marginBottom: 16,
	},
	title: {
		fontSize: 18,
		fontWeight: '600',
		color: '#1F2937',
		textAlign: 'center',
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 14,
		color: '#6B7280',
		textAlign: 'center',
		marginBottom: 24,
		lineHeight: 20,
	},
	stepContainer: {
		width: '100%',
		marginBottom: 16,
	},
	stepTitle: {
		fontSize: 15,
		fontWeight: '600',
		color: '#1F2937',
		textAlign: 'center',
		marginBottom: 8,
	},
	stepInfo: {
		fontSize: 13,
		color: '#6B7280',
		textAlign: 'center',
		marginBottom: 12,
	},
	progressBarContainer: {
		width: '100%',
		height: 12,
		backgroundColor: '#E5E7EB',
		borderRadius: 6,
		overflow: 'hidden',
		marginBottom: 8,
	},
	progressBar: {
		height: '100%',
		backgroundColor: '#177DFF',
		borderRadius: 6,
	},
	progressTextContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		width: '100%',
	},
	progressCount: {
		fontSize: 12,
		color: '#6B7280',
	},
	progressPercent: {
		fontSize: 12,
		fontWeight: '600',
		color: '#177DFF',
	},
	dotsContainer: {
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		gap: 8,
		marginBottom: 20,
	},
	dot: {
		width: 12,
		height: 12,
		borderRadius: 6,
	},
	dotActive: {
		backgroundColor: '#177DFF',
	},
	dotInactive: {
		backgroundColor: '#D1D5DB',
	},
	loadingContainer: {
		alignItems: 'center',
		width: '100%',
	},
	loadingText: {
		fontSize: 14,
		color: '#6B7280',
		textAlign: 'center',
		marginTop: 12,
	},
	warningText: {
		fontSize: 12,
		color: '#9CA3AF',
		textAlign: 'center',
		marginTop: 8,
	},
	singleButtonContainer: {
		width: '100%',
	},
	button: {
		width: '100%',
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 44,
		marginBottom: 12,
	},
	retryButton: {
		backgroundColor: '#177DFF',
	},
	retryButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
})
