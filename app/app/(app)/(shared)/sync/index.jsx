import {
	Text,
	TouchableOpacity,
	View,
	StatusBar,
	ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useLocalization } from '../../../../src/localization/localizationContext'
import { useSyncContext } from '../../../../src/context/SyncContext'
import { FontAwesome } from '@expo/vector-icons'

export default function ProductSync() {
	const { loc } = useLocalization()
	const router = useRouter()
	const { isSyncing, phase, progress, error, startSync } = useSyncContext()

	const handleUnifiedSync = () => {
		if (!isSyncing) {
			startSync()
		}
	}

	const getStepNumber = () => {
		if (phase === 'product') return 1
		if (phase === 'variant') return 2
		if (phase === 'lot') return 3
		return isSyncing ? 1 : 0
	}
	const currentStep = getStepNumber()

	const getStepTitle = () => {
		if (phase === 'product')
			return loc.t('sync.syncingProducts') || 'Syncing Products'
		if (phase === 'variant')
			return loc.t('sync.syncingVariants') || 'Syncing Variants'
		if (phase === 'lot') return loc.t('sync.syncingLots') || 'Syncing Lots'
		if (isSyncing) return loc.t('sync.syncing') || 'Syncing...'
		return ''
	}

	const getStepCount = () => {
		if (phase === 'product' && progress?.product)
			return `${progress.product.done || 0} / ${progress.product.total || 0}`
		if (phase === 'variant' && progress?.variant)
			return `${progress.variant.done || 0} / ${progress.variant.total || 0}`
		if (phase === 'lot' && progress?.lot)
			return `${progress.lot.done || 0} / ${progress.lot.total || 0}`
		return ''
	}

	const getStepProgress = () => {
		if (phase === 'product' && progress?.product?.total)
			return Math.min(
				(progress.product.done / progress.product.total) * 100,
				100
			)
		if (phase === 'variant' && progress?.variant?.total)
			return Math.min(
				(progress.variant.done / progress.variant.total) * 100,
				100
			)
		if (phase === 'lot' && progress?.lot?.total)
			return Math.min((progress.lot.done / progress.lot.total) * 100, 100)
		return isSyncing ? 5 : 0
	}

	// product is GLOBAL — once done we show synced, but manual resync still allowed
	const isProductDone =
		progress?.product?.done != null &&
		progress?.product?.total != null &&
		progress.product.done >= progress.product.total &&
		progress.product.total > 0

	return (
		<View className="flex-1 item bg-white px-6 py-8">
			<StatusBar barStyle="dark-content" />
			<View className="flex-row items-center mb-6">
				<FontAwesome name="refresh" size={28} color="#2563eb" />
				<Text className="ml-3 text-xl font-bold text-blue-700">
					{loc.t('sync.title') || 'Data Synchronization'}
				</Text>
			</View>

			<Text className="mb-6 text-gray-700 leading-6">
				{loc.t('sync.description') ||
					'Sync your cloud data with your device. This will download products, variants, and inventory lots.'}
			</Text>

			<Text className="mb-2 text-xs text-gray-500">
				{isSyncing
					? 'Sync runs in background — you can keep using the app. It will resume if the app is reopened.'
					: 'Tap to start. Products are synced once globally; variants/lots are per-shop.'}
			</Text>

			{/* Unified Sync Button — non-blocking */}
			<TouchableOpacity
				className={`bg-blue-600 rounded-lg py-4 mb-4 ${isSyncing ? 'opacity-50' : ''}`}
				onPress={handleUnifiedSync}
				disabled={isSyncing}
			>
				<View className="flex-row items-center justify-center">
					<FontAwesome name="cloud-download" size={22} color="#fff" />
					<Text className="ml-3 text-white font-semibold text-lg">
						{isSyncing
							? loc.t('sync.syncing') || 'Syncing...'
							: loc.t('sync.resync') || 'Sync Now'}
					</Text>
				</View>
			</TouchableOpacity>

			{/* Non-blocking progress card */}
			{isSyncing && (
				<View className="bg-white rounded-xl p-5 border border-blue-100 shadow-sm mb-4">
					<View className="items-center mb-3">
						<ActivityIndicator size="small" color="#2563eb" />
						<Text className="mt-2 text-base font-semibold text-gray-700">
							{getStepTitle()}
						</Text>
						<Text className="text-sm text-gray-500 mt-1">
							{loc.t('sync.step') || 'Step'} {currentStep}/3{' '}
							{getStepCount() ? `• ${getStepCount()}` : ''}
						</Text>
					</View>
					<View className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
						<View
							className="h-3 bg-blue-500"
							style={{ width: `${getStepProgress()}%` }}
						/>
					</View>
					<View className="flex-row justify-between">
						<Text className="text-xs text-gray-600">{getStepCount()}</Text>
						<Text className="text-xs font-semibold text-blue-600">
							{Math.round(getStepProgress())}%
						</Text>
					</View>
					<View className="flex-row justify-center gap-2 mt-3">
						<View
							className={`w-3 h-3 rounded-full ${currentStep >= 1 ? 'bg-blue-500' : 'bg-gray-300'}`}
						/>
						<View
							className={`w-3 h-3 rounded-full ${currentStep >= 2 ? 'bg-blue-500' : 'bg-gray-300'}`}
						/>
						<View
							className={`w-3 h-3 rounded-full ${currentStep >= 3 ? 'bg-blue-500' : 'bg-gray-300'}`}
						/>
					</View>
					<Text className="text-xs text-gray-400 text-center mt-3">
						{loc.t('sync.pleaseWait') || 'Please wait...'} — you can navigate
						away.
					</Text>
				</View>
			)}

			{/* Idle state info */}
			{!isSyncing && !error && (
				<View className="bg-blue-50 rounded-lg p-4 mb-4">
					<Text className="text-sm text-blue-800">
						{isProductDone ? '✓ ' : ''}
						Products:{' '}
						{progress?.product
							? `${progress.product.done}/${progress.product.total}`
							: 'not yet synced'}{' '}
						(global)
					</Text>
					<Text className="text-sm text-blue-800 mt-1">
						Variants:{' '}
						{progress?.variant
							? `${progress.variant.done}/${progress.variant.total}`
							: 'per-shop'}
					</Text>
					<Text className="text-sm text-blue-800 mt-1">
						Lots:{' '}
						{progress?.lot
							? `${progress.lot.done}/${progress.lot.total}`
							: 'per-shop'}
					</Text>
				</View>
			)}

			{error ? (
				<View className="bg-red-100 border border-red-400 rounded-lg p-4 mb-4">
					<View className="flex-row items-center">
						<FontAwesome name="exclamation-circle" size={20} color="#b91c1c" />
						<Text className="ml-2 text-red-700 font-semibold flex-1">
							{error}
						</Text>
					</View>
					<Text className="text-xs text-red-600 mt-2">
						Will resume automatically when you reopen the app or tap Sync again.
					</Text>
				</View>
			) : null}

			<TouchableOpacity
				className="mt-4 py-3 items-center"
				onPress={() => router.push('/home')}
			>
				<Text className="text-blue-600 font-semibold">
					{loc.t('common.backToHome') || 'Back to Home'}
				</Text>
			</TouchableOpacity>
		</View>
	)
}
