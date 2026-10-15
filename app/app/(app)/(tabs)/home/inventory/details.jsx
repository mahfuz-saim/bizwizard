import {
	FlatList,
	Text,
	TouchableOpacity,
	View,
	Modal,
	Pressable,
	ToastAndroid,
	BackHandler,
	Image,
} from 'react-native'
import SearchBar from '../../../../../src/components/searchBar.jsx'
import { useCallback, useMemo, useState, memo, useRef, useEffect } from 'react'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import {
	getAllProductsFromShop,
	getAllLotsFromVariant,
	createProductWithVariants,
	getProductFromInventoryDatabase,
	addProductToShop,
	updateLot,
} from '../../../../../src/controllers/product.js'
import useApi from '../../../../../src/hooks/useApi.jsx'
import { MaterialIcons, Ionicons } from '@expo/vector-icons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import LotSelector from '../../../../../src/components/inventory/LotSelector.jsx'
import ProductVariantForm from '../../../../../src/components/inventory/ProductVariantForm.jsx'
import ProductForm from '../../../../../src/components/inventory/productForm.jsx'
import VariantSelector from '../../../../../src/components/inventory/VariantSelector.jsx'
import { localProductController } from '../../../../../src/controllers/offline/product.js'

// Lightweight skeleton placeholder color (cached as constant)
const SKELETON_BG = '#E5E7EB' // gray-200

// Typing is debounced before the inventory list is re-queried (the search
// input debounces as well; this keeps the network calls down while typing)
const SEARCH_DEBOUNCE_MS = 250

// Product Row Skeleton Loader (lightweight View-based for instant render)
const ProductRowSkeleton = memo(() => (
	<View className="mx-2 py-3" style={{ height: 60 }} pointerEvents="none">
		<View style={{ flexDirection: 'row', alignItems: 'center' }}>
			<View
				style={{
					width: 32,
					height: 32,
					borderRadius: 16,
					backgroundColor: SKELETON_BG,
				}}
			/>
			<View style={{ marginLeft: 15, flex: 1 }}>
				<View
					style={{
						width: 150,
						height: 12,
						borderRadius: 4,
						backgroundColor: SKELETON_BG,
					}}
				/>
				<View
					style={{
						width: 100,
						height: 8,
						borderRadius: 4,
						backgroundColor: SKELETON_BG,
						marginTop: 8,
					}}
				/>
			</View>
			<View
				style={{
					width: 40,
					height: 10,
					borderRadius: 4,
					backgroundColor: SKELETON_BG,
				}}
			/>
		</View>
	</View>
))

// Precomputed skeleton rows for instant render (no allocation per render)
const SKELETON_ROWS = Array.from({ length: 8 }, (_, i) => i)

// Product List Skeleton Loader
const ProductListSkeleton = memo(() => (
	<View className="flex-1">
		{SKELETON_ROWS.map((index) => (
			<ProductRowSkeleton key={index} />
		))}
	</View>
))

// Hoisted avatar color palette (built once at module load)
const AVATAR_COLORS = [
	'#1f2937', // gray-800
	'#7c2d12', // orange-800
	'#be123c', // rose-700
	'#a21caf', // fuchsia-700
	'#7c3aed', // violet-600
	'#2563eb', // blue-600
	'#0891b2', // cyan-600
	'#059669', // emerald-600
	'#ca8a04', // yellow-600
	'#dc2626', // red-600
	'#9333ea', // purple-600
	'#0d9488', // teal-600
]

// Helper function to generate consistent random color based on product name
const getAvatarColor = (name) => {
	// Generate consistent hash from name
	let hash = 0
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash)
	}

	return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// Product Thumbnail Component (memoized to skip re-renders on parent updates)
const ProductThumbnail = memo(({ image, name, size = 40 }) => {
	const [imageLoading, setImageLoading] = useState(true)
	const [imageError, setImageError] = useState(false)
	const [showImage, setShowImage] = useState(false)

	const firstLetter = name ? name.charAt(0).toUpperCase() : '?'
	const backgroundColor = getAvatarColor(name || '')

	// Always show the default icon first, then overlay with image if it loads
	const renderDefaultIcon = () => (
		<View
			className="rounded-full justify-center items-center"
			style={{
				width: size,
				height: size,
				backgroundColor,
			}}
		>
			<Text className="font-medium text-white" style={{ fontSize: size * 0.4 }}>
				{firstLetter}
			</Text>
		</View>
	)

	if (!image || imageError || !showImage) {
		return renderDefaultIcon()
	}

	return (
		<View
			className="rounded-full overflow-hidden"
			style={{ width: size, height: size }}
		>
			{/* Show default icon while loading */}
			{imageLoading && renderDefaultIcon()}

			{/* Image overlay */}
			<Image
				source={{ uri: image }}
				style={{
					width: size,
					height: size,
					position: imageLoading ? 'absolute' : 'relative',
					opacity: imageLoading ? 0 : 1,
				}}
				onLoad={() => {
					setImageLoading(false)
					setShowImage(true)
				}}
				onError={() => {
					setImageError(true)
					setImageLoading(false)
					setShowImage(false)
				}}
				resizeMode="cover"
			/>
		</View>
	)
})

// Hoisted lookup map for measuring unit keys (built once at module load)
const UNIT_VALUE_TO_KEY = {
	Bag: 'bag',
	Barrel: 'barrel',
	Bottle: 'bottle',
	'Box (box)': 'box',
	Carton: 'carton',
	'Dozen (doz)': 'dozen',
	'Feet (ft)': 'feet',
	'Meter (m)': 'meter',
	Yard: 'yard',
	'Kilogram (kg)': 'kilogram',
	Roll: 'roll',
	'Gram (g)': 'gram',
	'Litre (L)': 'litre',
	'Millilitre (mL)': 'millilitre',
	'Piece (pc)': 'piece',
	'Square feet (sq ft)': 'squareFeet',
	'Square meter (sq m)': 'squareMeter',
	'Square yard (sq yd)': 'squareYard',
	Ton: 'ton',
}

// Helper function to get localized measuring unit (uses hoisted maps)
const getMeasuringUnitLabel = (unitValue, loc) => {
	const key = UNIT_VALUE_TO_KEY[unitValue]
	if (!key) return unitValue || ''
	return loc.t(`productForm.${key}`)
}

export default function InventoryProducts() {
	const { loc } = useLocalization()
	const { translateNumber } = useNumberTranslator()
	const { fetchData } = useApi()
	const params = useLocalSearchParams()
	const [searchValue, setSearchValue] = useState('')
	const [productsData, setProductsData] = useState([])
	const [modalVisible, setModalVisible] = useState(false)
	const [selectedProduct, setSelectedProduct] = useState(null)
	const [lotSelectorVisible, setLotSelectorVisible] = useState(false)
	const [productLots, setProductLots] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [lastDataHash, setLastDataHash] = useState('')
	const lastDataHashRef = useRef('')
	// Sort & order UI state (functionality TODO)
	const [sortFilter, setSortFilter] = useState('none') // 'none' | 'lowStock' | 'expiringSoon'
	const [sortOrderAsc, setSortOrderAsc] = useState(true) // true = A→Z, false = Z→A (placeholder semantics)
	const [showSortMenu, setShowSortMenu] = useState(false)

	const [searchTerm, setSearchTerm] = useState('')
	// Catalog create (product+variants without lot)
	const catalogSheetRef = useRef(null)
	const [showCatalogForm, setShowCatalogForm] = useState(false)
	const [catalogInitialProduct, setCatalogInitialProduct] = useState(null)
	const [catalogPrefillBarcode, setCatalogPrefillBarcode] = useState('')

	// Quick-add flow (reuse add-product components, product pre-selected via + btn)
	const quickAddVariantRef = useRef(null)
	const quickAddProductRef = useRef(null)
	const [quickAddProduct, setQuickAddProduct] = useState(null)
	const [quickAddVariants, setQuickAddVariants] = useState(null)
	const [quickAddSelectedVariant, setQuickAddSelectedVariant] = useState(null)
	const [quickAddLots, setQuickAddLots] = useState(null)
	const [quickAddCurrentFlow, setQuickAddCurrentFlow] = useState(0) // 2=variant, 3=lot, 5=form
	const [quickAddShowFlow, setQuickAddShowFlow] = useState(false)

	// Generate a simple hash for data comparison
	const generateDataHash = useCallback((data) => {
		if (!data || !Array.isArray(data)) return ''

		// Create a hash based on essential fields that would indicate changes
		const hashString = data
			.map(
				(item) =>
					`${item.id}-${item.totalProducts}-${item.lowStock}-${
						item.lastSoldDate || ''
					}-${item.updatedAt || ''}`
			)
			.join('|')

		return hashString
	}, [])

	// Handle hardware back button and fetch data when page comes into focus
	useFocusEffect(
		useCallback(() => {
			// Always fetch fresh data when page comes into focus
			fetchShopProduct()

			const onBackPress = () => {
				router.push('/home')
				return true
			}

			const subscription = BackHandler.addEventListener(
				'hardwareBackPress',
				onBackPress
			)

			return () => subscription?.remove()
		}, [fetchShopProduct])
	)

	// Auto-open catalog form when redirected from Add Product (not-found flow)
	useEffect(() => {
		if (params?.openCreate === '1' || params?.openCreate === 1) {
			const barcode = params?.barcode ? String(params.barcode) : ''
			const productName = params?.productName ? String(params.productName) : ''
			// If barcode provided, try to prefill from global inventory
			if (barcode) {
				;(async () => {
					try {
						const r = await fetchData(
							getProductFromInventoryDatabase,
							{ barcode },
							localProductController.getProductFromInventoryDatabase,
							'read'
						)
						if (r?.success && r?.data) {
							const { variants, ...prod } = r.data
							setCatalogInitialProduct({
								id: prod.id,
								barcode: prod.barcode,
								productName: prod.productName,
								measuringUnit: prod.measuringUnit,
								genericName: prod.genericName,
								category: prod.category,
							})
						} else {
							setCatalogInitialProduct(productName ? { productName } : null)
						}
					} catch {
						setCatalogInitialProduct(productName ? { productName } : null)
					}
					setCatalogPrefillBarcode(barcode)
					setShowCatalogForm(true)
				})()
			} else {
				if (productName) setCatalogInitialProduct({ productName })
				setCatalogPrefillBarcode('')
				setShowCatalogForm(true)
			}
			// clear param so it doesn't reopen on next focus (replace without query)
			router.replace('/home/inventory/details')
		}
	}, [params?.openCreate, params?.barcode, params?.productName, fetchData])

	const openCatalogForm = useCallback((prefill = null) => {
		setCatalogInitialProduct(prefill)
		setCatalogPrefillBarcode(prefill?.barcode || '')
		setShowCatalogForm(true)
	}, [])

	const closeCatalogForm = useCallback(() => {
		setShowCatalogForm(false)
		setCatalogInitialProduct(null)
		setCatalogPrefillBarcode('')
	}, [])

	// Quick-add: reuse add-product flow with product pre-selected (Ponytail - reuse VariantSelector/LotSelector/ProductForm)
	const cancelQuickAdd = useCallback(() => {
		setQuickAddShowFlow(false)
		setQuickAddCurrentFlow(0)
		setQuickAddProduct(null)
		setQuickAddVariants(null)
		setQuickAddSelectedVariant(null)
		setQuickAddLots(null)
	}, [])

	const handleQuickAddPress = useCallback(
		async (item) => {
			try {
				const barcode = item.barcode || ''
				if (barcode) {
					const r = await fetchData(
						getProductFromInventoryDatabase,
						{ barcode },
						localProductController.getProductFromInventoryDatabase,
						'read'
					)
					if (r?.success && r?.data) {
						const { variants, ...prod } = r.data
						// ensure barcode fallback
						prod.barcode = prod.barcode || barcode
						prod.productName = prod.productName || item.productName || item.name
						setQuickAddProduct(prod)
						setQuickAddVariants(variants || [])
						setQuickAddLots(null)
						setQuickAddSelectedVariant(null)
						setQuickAddCurrentFlow(2)
						setQuickAddShowFlow(true)
						return
					}
				}
				// Fallback: use item itself as product + variant if inventory fetch failed
				setQuickAddProduct({
					id: item.productID,
					barcode: barcode,
					productName: item.productName || item.name,
					measuringUnit: item.measuringUnit,
					genericName: item.genericName || '',
					category: item.category || 'OTHER',
					image: item.image,
				})
				// Try fallback variants list as single item variant
				setQuickAddVariants([
					{
						id: item.id,
						variantName: item.variantName,
						variantCode: item.variantCode,
						packOf: item.packOf,
						lowStock: item.lowStock,
						lowStockSMS: item.lowStockSMS,
					},
				])
				setQuickAddCurrentFlow(2)
				setQuickAddShowFlow(true)
			} catch (e) {
				console.log('handleQuickAddPress error', e?.message)
				ToastAndroid.show(
					loc.t('inventory.details.fetchProductsError') ||
						'Failed to load product',
					ToastAndroid.SHORT
				)
			}
		},
		[fetchData, loc]
	)

	const handleQuickVariantSelection = useCallback(
		async (variant) => {
			if (variant === null) {
				// Create new variant for this product -> open catalog form prefilled
				setQuickAddShowFlow(false)
				openCatalogForm({
					id: quickAddProduct?.id,
					productName: quickAddProduct?.productName,
					barcode: quickAddProduct?.barcode,
					measuringUnit: quickAddProduct?.measuringUnit,
					genericName: quickAddProduct?.genericName,
					category: quickAddProduct?.category,
				})
				return
			}
			setQuickAddSelectedVariant(variant)
			try {
				const res = await fetchData(getAllLotsFromVariant, variant.id)
				if (res?.success && res?.data && res.data.length > 0) {
					setQuickAddLots(res.data)
					setQuickAddCurrentFlow(3)
				} else {
					setQuickAddLots([])
					setQuickAddCurrentFlow(5)
				}
			} catch (err) {
				console.log('fetch lots error', err?.message)
				setQuickAddLots([])
				setQuickAddCurrentFlow(5)
			}
		},
		[fetchData, quickAddProduct, openCatalogForm]
	)

	const handleQuickLotSelection = useCallback((lot) => {
		// Directly go to form pre-filled with lot? For quick lot view we go to form for new lot (edit lot qty uses LotSelector update, but quick-add is for new lot)
		// Reuse ProductForm for new lot: keep lot null to force full form with stock entry
		setQuickAddCurrentFlow(5)
	}, [])

	const handleQuickCreateNewLot = useCallback(() => {
		setQuickAddCurrentFlow(5)
	}, [])

	const handleQuickFormSubmit = useCallback(
		async (formData) => {
			try {
				function convertToISOString(dateStr) {
					if (!dateStr) return undefined
					const [day, month, year] = dateStr.split('/').map(Number)
					if (!day || !month || !year) return undefined
					const date = new Date(Date.UTC(year, month - 1, day))
					return date.toISOString()
				}
				if (formData.lot?.mfgDate)
					formData.lot.mfgDate = convertToISOString(formData.lot.mfgDate)
				if (formData.lot?.expDate)
					formData.lot.expDate = convertToISOString(formData.lot.expDate)
				const res = await fetchData(addProductToShop, formData)
				if (res?.success) {
					ToastAndroid.show(
						loc.t('productAddedToInventory') || 'Product added',
						ToastAndroid.SHORT
					)
					// Hybrid: optimistic prepend (uses returned lot/variant or fallback to formData)
					optimisticPrepend(res?.data, {
						...formData,
						name: formData.name || formData.product?.productName,
						barcode: formData.barcode || formData.product?.barcode,
						variants: formData.variant
							? [formData.variant]
							: formData.variants || [],
					})
					cancelQuickAdd()
					setTimeout(() => {
						backgroundReconcile()
					}, 400)
				} else {
					ToastAndroid.show(
						res?.error || loc.t('unknownError') || 'Failed',
						ToastAndroid.SHORT
					)
				}
			} catch (e) {
				console.log('quick form submit error', e?.message)
				ToastAndroid.show(
					loc.t('inventory.add.addProductError') || 'Error adding product',
					ToastAndroid.SHORT
				)
			}
		},
		[fetchData, loc, cancelQuickAdd, optimisticPrepend, backgroundReconcile]
	)

	const quickAddFlow = useMemo(
		() => [
			{
				id: 2,
				component: VariantSelector,
				getProps: () => ({
					variants: quickAddVariants,
					handleVariantSelection: handleQuickVariantSelection,
					cancelScanFlow: cancelQuickAdd,
					ref: quickAddVariantRef,
				}),
			},
			{
				id: 3,
				component: LotSelector,
				getProps: () => ({
					lots: quickAddLots,
					variant: quickAddSelectedVariant,
					handleLotSelection: handleQuickLotSelection,
					handleCreateNewLot: handleQuickCreateNewLot,
					cancelScanFlow: cancelQuickAdd,
					showCreate: true,
				}),
			},
			{
				id: 5,
				component: ProductForm,
				getProps: () => ({
					closeForm: cancelQuickAdd,
					handleFormSubmit: handleQuickFormSubmit,
					initialValues: {
						product: quickAddProduct,
						variant: quickAddSelectedVariant,
						lot: null,
					},
					ref: quickAddProductRef,
				}),
			},
		],
		[
			quickAddVariants,
			quickAddLots,
			quickAddSelectedVariant,
			quickAddProduct,
			handleQuickVariantSelection,
			handleQuickCreateNewLot,
			handleQuickLotSelection,
			handleQuickFormSubmit,
			cancelQuickAdd,
		]
	)

	const renderQuickAddFlow = useCallback(() => {
		const Current = quickAddFlow.find((s) => s.id === quickAddCurrentFlow)
		if (!Current) return null
		const Comp = Current.component
		const props = Current.getProps ? Current.getProps() : {}
		return <Comp {...props} />
	}, [quickAddFlow, quickAddCurrentFlow])

	// Fetch products data
	const transformData = (data) => {
		const transformedData = data.map((item) => ({
			id: item.id,
			productID: item.productID,
			name: item.name,
			productName: item.product?.productName || item.name,
			barcode: item.product?.barcode || '',
			genericName: item.product?.genericName || '',
			category: item.product?.category || 'OTHER',
			image: item.product?.image,
			variantName: item.variantName,
			variantCode: item.variantCode,
			totalProducts: item.totalProducts,
			measuringUnit: item.product?.measuringUnit,
			packOf: item.packOf,
			lowStock: item.lowStock,
			lowStockSMS: item.lowStockSMS,
			lastSoldDate: item.lastSoldDate,
			notifyAfterNotSold: item.notifyAfterNotSold,
			notifyBeforeExp: item.notifyBeforeExp,
			notSoldSMS: item.notSoldSMS,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
		}))
		return transformedData
	}

	// --- Hybrid refresh helpers (Ponytail: reuse transformData, local cache, minimal new code) ---
	const extractRowsFromApiResponse = useCallback((apiData, fallbackPayload) => {
		try {
			if (!apiData) return []
			let raw = []
			if (Array.isArray(apiData)) raw = apiData
			else if (Array.isArray(apiData?.variants))
				raw = apiData.variants.map((v) => ({
					...v,
					product: apiData.product || apiData.productData || fallbackPayload,
				}))
			else if (Array.isArray(apiData?.data)) raw = apiData.data
			else if (Array.isArray(apiData?.shopVariants)) raw = apiData.shopVariants
			else if (apiData?.product && apiData?.variants)
				raw = apiData.variants.map((v) => ({ ...v, product: apiData.product }))
			else if (apiData?.id && apiData?.productID) raw = [apiData]
			else if (fallbackPayload) {
				// Fallback: build rows from payload (catalog case: payload.variants)
				if (Array.isArray(fallbackPayload.variants)) {
					raw = fallbackPayload.variants.map((v, idx) => ({
						id: apiData?.variants?.[idx]?.id || `tmp-${Date.now()}-${idx}`,
						productID:
							apiData?.product?.id ||
							apiData?.id ||
							fallbackPayload.productID ||
							'tmp',
						name: fallbackPayload.name,
						variantName: v.variantName,
						variantCode: v.variantCode,
						packOf: v.packOf,
						lowStock: v.lowStock,
						lowStockSMS: v.lowStockSMS,
						notifyAfterNotSold: v.notifyAfterNotSold,
						notifyBeforeExp: v.notifyBeforeExp,
						notSoldSMS: v.notSoldSMS,
						product: {
							productName: fallbackPayload.name,
							barcode: fallbackPayload.barcode || '',
							genericName: fallbackPayload.genericName || '',
							category: fallbackPayload.category || 'OTHER',
							measuringUnit: fallbackPayload.measuringUnit,
						},
						totalProducts: 0,
						createdAt: new Date().toISOString(),
					}))
				} else {
					raw = [apiData]
				}
			}
			// Filter out invalid entries without id
			return raw.filter(Boolean)
		} catch (e) {
			console.log('extractRows error', e?.message)
			return []
		}
	}, [])

	const optimisticPrepend = useCallback(
		(apiData, fallbackPayload) => {
			try {
				const rawRows = extractRowsFromApiResponse(apiData, fallbackPayload)
				if (!rawRows.length) return false
				let rowsToPrepend = []
				try {
					rowsToPrepend = transformData(rawRows)
				} catch {
					rowsToPrepend = []
				}
				if (!rowsToPrepend.length) return false
				// Respect current search / sort: don't prepend if it would break view
				const q = (searchTerm || '').toLowerCase().trim()
				if (q) {
					const filtered = rowsToPrepend.filter(
						(r) =>
							(r.name || '').toLowerCase().includes(q) ||
							(r.variantName || '').toLowerCase().includes(q) ||
							(r.variantCode || '').toLowerCase().includes(q)
					)
					if (!filtered.length) return false // filtered out, rely on background fetch
					rowsToPrepend = filtered
				}
				if (sortFilter !== 'none') return false // sorted view, let background fetch resort
				setProductsData((prev) => {
					const seen = new Set(prev.map((p) => p.id))
					const fresh = rowsToPrepend.filter((r) => !seen.has(r.id))
					if (!fresh.length) return prev
					const merged = [...fresh, ...prev].slice(0, 100)
					const h = generateDataHash(merged)
					lastDataHashRef.current = h
					setLastDataHash(h)
					return merged
				})
				// Best-effort local persist for offline cache
				try {
					rawRows.forEach((r) => {
						if (r.product) localProductController.upsertIntoInventory(r.product)
						localProductController.upsertIntoShopVariant(r)
					})
				} catch {}
				return true
			} catch (e) {
				console.log('optimisticPrepend error', e?.message)
				return false
			}
		},
		[extractRowsFromApiResponse, searchTerm, sortFilter, generateDataHash]
	)

	const backgroundReconcile = useCallback(async () => {
		try {
			// Force remote via hook (auth + refresh handled) + skipLocal — bypasses cache-first read, but still auto-writes to local via enabled write path
			const params = {
				searchTerm,
				page: 1,
				limit: 100,
				sortOrder: sortOrderAsc ? 'asc' : 'desc',
				sortBy: sortFilter === 'lowStock' ? 'lowStock' : null,
			}
			const fresh = await fetchData(
				getAllProductsFromShop,
				params,
				localProductController.getProductsFromShop,
				'read',
				{ skipLocal: true }
			)
			if (fresh?.success && fresh?.data?.data) {
				const rows = transformData(fresh.data.data)
				const h = generateDataHash(rows)
				if (h !== lastDataHashRef.current) {
					lastDataHashRef.current = h
					setLastDataHash(h)
					setProductsData(rows)
				}
			}
		} catch (e) {
			console.log('backgroundReconcile error', e?.message)
		}
	}, [fetchData, searchTerm, sortOrderAsc, sortFilter, generateDataHash])

	const fetchShopProduct = useCallback(() => {
		async function fetchProducts() {
			try {
				// Don't show loading spinner for background fetches when we already have data
				if (productsData.length === 0) {
					setIsLoading(true)
				}

				const params = {
					searchTerm: searchTerm,
					page: 1,
					limit: 100,
					sortOrder: sortOrderAsc ? 'asc' : 'desc',
					sortBy: sortFilter === 'lowStock' ? 'lowStock' : null,
				}
				const res = await fetchData(
					getAllProductsFromShop,
					params,
					localProductController.getProductsFromShop,
					'read'
				)

				if (!res.success) {
					if (!res?.loggedOut) {
						ToastAndroid.show(
							loc.t('inventory.details.fetchProductsError'),
							ToastAndroid.SHORT
						)
					}
					return
				}

				// Transform the data to match our needs
				const transformedData = transformData(res.data.data)

				// Generate hash for the new data
				const newDataHash = generateDataHash(transformedData)

				// Only update if changed (use ref to avoid stale closure)
				if (newDataHash !== lastDataHashRef.current) {
					lastDataHashRef.current = newDataHash
					setLastDataHash(newDataHash)
					setProductsData(transformedData)
				}
			} catch (err) {
				console.error('Error fetching products:', err)
				ToastAndroid.show(
					loc.t('inventory.details.fetchProductsError'),
					ToastAndroid.SHORT
				)
			} finally {
				setIsLoading(false)
			}
		}
		fetchProducts()
	}, [
		sortOrderAsc,
		sortFilter,
		searchTerm,
		fetchData,
		loc,
		generateDataHash,
		productsData.length,
	])

	// Re-query as soon as the search term or the sort changes. The focus effect
	// above only runs when the screen gains focus, so without this the table kept
	// showing the previous rows: the term only took effect after leaving and
	// re-entering the page (or pulling to refresh).
	useEffect(() => {
		const timer = setTimeout(() => {
			fetchShopProduct()
		}, SEARCH_DEBOUNCE_MS)
		return () => clearTimeout(timer)
		// fetchShopProduct is deliberately not a dependency: its identity changes on
		// every fetch (it depends on productsData.length), which would loop. The
		// values that actually drive the query are listed instead.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchTerm, sortOrderAsc, sortFilter])

	const handleCatalogSubmit = useCallback(
		async (payload) => {
			try {
				if (catalogPrefillBarcode && !payload.barcode) {
					payload.barcode = catalogPrefillBarcode
				}
				const res = await fetchData(createProductWithVariants, payload)
				if (res?.success) {
					ToastAndroid.show(
						loc.t('inventory.details.productCreated') || 'Product created',
						ToastAndroid.SHORT
					)
					// Hybrid: instant prepend for perceived 0ms update (offline-capable) + background reconcile with server truth
					optimisticPrepend(res?.data, payload)
					closeCatalogForm()
					// Background reconcile after short delay to avoid racing with close animation
					setTimeout(() => {
						backgroundReconcile()
					}, 400)
				} else {
					ToastAndroid.show(
						res?.message ||
							loc.t('inventory.details.createFailed') ||
							'Failed to create product',
						ToastAndroid.SHORT
					)
				}
			} catch (e) {
				console.log('handleCatalogSubmit error', e?.message)
				ToastAndroid.show(
					e?.message || 'Failed to create product',
					ToastAndroid.SHORT
				)
			}
		},
		[
			fetchData,
			loc,
			closeCatalogForm,
			catalogPrefillBarcode,
			optimisticPrepend,
			backgroundReconcile,
		]
	)

	// Note: the search/sort refetch effect sits above, next to fetchShopProduct
	// - useFocusEffect alone only fires when the screen gains focus.

	// Stable key extractor for FlatList
	const keyExtractor = useCallback((item) => item.id.toString(), [])

	// Stable empty list component for FlatList
	const EmptyList = useCallback(
		() => (
			<View className="flex-1 justify-center items-center p-8">
				<Text className="text-gray-500 text-lg">
					{loc.t('inventory.details.noProductsFound')}
				</Text>
			</View>
		),
		[loc]
	)

	const handleEditProduct = useCallback((product) => {
		setModalVisible(false)
		router.push({
			pathname: '/home/inventory/ProductUpdateForm',
			params: {
				productData: JSON.stringify(product),
			},
		})
	}, [])

	const handleShowLots = async (product) => {
		setModalVisible(false)
		// Fetch lots for this product - you'll need to implement this API call
		try {
			const lotsRes = await fetchData(
				getAllLotsFromVariant,
				{
					productId: product.id,
				},
				localProductController.getLotByVariantId,
				'read'
			)
			if (lotsRes.success) {
				setProductLots(lotsRes.data)
				setLotSelectorVisible(true)
			}

			// For now, using mock data
			// setProductLots([])
			setLotSelectorVisible(true)
		} catch (err) {
			console.error('Error fetching lots:', err)
			ToastAndroid.show(
				loc.t('inventory.details.fetchLotsError'),
				ToastAndroid.SHORT
			)
		}
	}

	const handleLotSelection = (lot) => {
		setLotSelectorVisible(false)
	}

	const handleCreateNewLot = () => {
		setLotSelectorVisible(false)
		// Navigate to create new lot page
		router.push(`/home/inventory/lot/create?productId=${selectedProduct?.id}`)
	}

	const cancelLotSelector = () => {
		setLotSelectorVisible(false)
	}

	// Manual refresh function for pull-to-refresh
	const handleManualRefresh = useCallback(async () => {
		setIsRefreshing(true)
		await fetchShopProduct()
		setIsRefreshing(false)
	}, [fetchShopProduct])

	// Filter products based on search (memoized for FlatList stability)
	const filteredProducts = useMemo(() => {
		if (!searchValue) return productsData
		const q = searchValue.toLowerCase()
		return productsData.filter(
			(product) =>
				product.name.toLowerCase().includes(q) ||
				product.variantName.toLowerCase().includes(q) ||
				product.variantCode.toLowerCase().includes(q)
		)
	}, [productsData, searchValue])

	// Memoized row renderer (stable reference for FlatList renderItem)
	const productRow = useCallback(
		(data, isHeader = false) => {
			return (
				<View
					className={`flex-row mx-2 ${
						!isHeader ? 'border-b-slate-300 border-b-2' : ''
					} items-center py-3`}
				>
					{/* Product Name Column - Now includes thumbnail and variant info */}
					{isHeader ? (
						<View
							className="w-2/3 justify-start pr-1 pl-2"
							style={{ maxWidth: '66%' }}
						>
							<Text
								className="text-lg font-bold"
								numberOfLines={1}
								ellipsizeMode="tail"
							>
								{data.name}
							</Text>
						</View>
					) : (
						<TouchableOpacity
							className="w-2/3 justify-start pr-1 pl-2"
							style={{ maxWidth: '66%' }}
							onPress={() => handleEditProduct(data)}
							activeOpacity={0.7}
						>
							{data.id && (
								<View className="flex-row items-center">
									{/* Product Thumbnail */}
									<ProductThumbnail
										image={data.image}
										name={data.name}
										size={32}
									/>

									{/* Product Info */}
									<View className="flex-1 ml-3">
										<Text
											className="text-sm font-medium"
											numberOfLines={1}
											ellipsizeMode="tail"
										>
											{data.name}
										</Text>
										{data.variantName && (
											<Text
												className="text-xs text-gray-600"
												numberOfLines={1}
												ellipsizeMode="tail"
											>
												{data.variantName}
												{data.variantCode && ` (${data.variantCode})`}
											</Text>
										)}
									</View>
								</View>
							)}
						</TouchableOpacity>
					)}

					{/* Stock Column */}
					<View
						className="w-1/3 flex-row items-center pr-2"
						style={{ maxWidth: '34%' }}
					>
						{isHeader ? (
							<Text
								className="text-lg font-bold"
								numberOfLines={1}
								ellipsizeMode="tail"
							>
								{data.stock}
							</Text>
						) : (
							<>
								<View className="items-start" style={{ maxWidth: '75%' }}>
									<Text
										className="text-sm"
										numberOfLines={1}
										ellipsizeMode="tail"
										style={{ maxWidth: '100%' }}
									>
										<Text className="font-medium">
											{translateNumber(data.totalProducts)}
										</Text>
										{data.measuringUnit && (
											<Text className="text-sm text-gray-500 font-medium">
												{' '}
												{getMeasuringUnitLabel(data.measuringUnit, loc)}
											</Text>
										)}
									</Text>
								</View>
								<TouchableOpacity
									onPress={() => handleQuickAddPress(data)}
									activeOpacity={0.7}
									className="rounded-full w-7 h-7 items-center justify-center ml-1"
								>
									<MaterialIcons name="add" size={16} color="#16a34a" />
								</TouchableOpacity>
							</>
						)}
					</View>
				</View>
			)
		},
		[handleEditProduct, translateNumber, loc]
	)

	// Stable FlatList renderItem adapter (unwraps FlatList's {item, index} payload)
	const renderProductRow = useCallback(
		({ item }) => productRow(item),
		[productRow]
	)

	function renderProductModal() {
		if (!selectedProduct) return null

		return (
			<Modal
				animationType="fade"
				transparent={true}
				visible={modalVisible}
				onRequestClose={() => setModalVisible(false)}
			>
				<Pressable
					className="flex-1 justify-center items-center bg-black/50"
					onPress={() => setModalVisible(false)}
				>
					<Pressable
						className="bg-white p-6 rounded-lg w-4/5 shadow-lg"
						onPress={(e) => e.stopPropagation()}
					>
						<View className="flex-row justify-between items-center mb-4">
							<Text className="text-xl font-bold">
								{loc.t('inventory.details.productDetails')}
							</Text>
							<TouchableOpacity onPress={() => setModalVisible(false)}>
								<MaterialIcons name="close" size={18} color="black" />
							</TouchableOpacity>
						</View>

						<View className="mb-4">
							<Text className="text-gray-500">
								{loc.t('inventory.details.productName')}
							</Text>
							<Text className="text-lg">{selectedProduct.name}</Text>
						</View>

						<View className="mb-4">
							<Text className="text-gray-500">
								{loc.t('inventory.details.variant')}
							</Text>
							<Text className="text-lg">
								{selectedProduct.variantName} ({selectedProduct.variantCode})
							</Text>
						</View>

						<View className="mb-4">
							<Text className="text-gray-500">
								{loc.t('inventory.details.stockQuantity')}
							</Text>
							<Text className="text-lg">
								{translateNumber(selectedProduct.totalProducts)}
							</Text>
						</View>

						<View className="mb-4">
							<Text className="text-gray-500">
								{loc.t('inventory.details.packSize')}
							</Text>
							<Text className="text-lg">
								{translateNumber(selectedProduct.packOf)}
							</Text>
						</View>

						<View className="mb-4">
							<Text className="text-gray-500">
								{loc.t('inventory.details.lowStockAlert')}
							</Text>
							<Text className="text-lg">
								{translateNumber(selectedProduct.lowStock)}
							</Text>
						</View>

						<View className="mb-4">
							<Text className="text-gray-500">
								{loc.t('inventory.details.lowStockSMS')}
							</Text>
							<Text className="text-lg">
								{selectedProduct.lowStockSMS
									? loc.t('inventory.details.enabled')
									: loc.t('inventory.details.disabled')}
							</Text>
						</View>

						<View className="mb-4">
							<Text className="text-gray-500">
								{loc.t('inventory.details.notifyAfterNotSold')}
							</Text>
							<Text className="text-lg">
								{translateNumber(selectedProduct.notifyAfterNotSold)}
							</Text>
						</View>

						<View className="mb-4">
							<Text className="text-gray-500">
								{loc.t('inventory.details.notSoldSMS')}
							</Text>
							<Text className="text-lg">
								{selectedProduct.notSoldSMS
									? loc.t('inventory.details.enabled')
									: loc.t('inventory.details.disabled')}
							</Text>
						</View>

						{selectedProduct.lastSoldDate && (
							<View className="mb-4">
								<Text className="text-gray-500">
									{loc.t('inventory.details.lastSold')}
								</Text>
								<Text className="text-lg">
									{new Date(selectedProduct.lastSoldDate).toLocaleDateString()}
								</Text>
							</View>
						)}

						<View className="flex-row justify-end space-x-4 mt-4">
							<TouchableOpacity
								onPress={() => setModalVisible(false)}
								className="p-3 bg-gray-500 rounded-lg mr-2"
							>
								<Text className="text-white font-medium">
									{loc.t('inventory.details.close')}
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={() => handleShowLots(selectedProduct)}
								className="p-3 bg-green-500 rounded-lg"
							>
								<Text className="text-white font-medium">
									{loc.t('inventory.details.showLots')}
								</Text>
							</TouchableOpacity>
						</View>
					</Pressable>
				</Pressable>
			</Modal>
		)
	}

	return (
		<View className="flex-1">
			{/* Outside click catcher for sort menu */}
			{showSortMenu && (
				<Pressable
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						zIndex: 1999,
						backgroundColor: 'transparent',
					}}
					onPress={() => setShowSortMenu(false)}
				/>
			)}

			{/* Search Banner */}
			<View className="bg-primaryTheme p-4 border-b-4 border-b-pageHeaderFooterBorder">
				<View className="flex-row items-center">
					<View className="flex-1 mr-3">
						<SearchBar
							fetchSearchData={(query) => setSearchTerm(query)}
							onSelect={() => {}}
							placeholder={
								loc.t('inventory.details.searchPlaceholder') ||
								'Search Inventory...'
							}
							renderItem={() => null}
							debounceDelay={10}
							showSearchResult={false}
						/>
					</View>
					{/* Sort controls (UI only, functionality TODO) */}
					<View className="flex-row items-center" style={{ zIndex: 2000 }}>
						{/* Sort dropdown trigger */}
						<View className="relative" style={{ zIndex: 2100 }}>
							<Pressable
								className="bg-white px-3 py-4 rounded-xl border border-gray-300 flex-row items-center"
								onPress={() => setShowSortMenu((s) => !s)}
							>
								<TouchableOpacity
									onPress={() => setSortOrderAsc((p) => !p)}
									activeOpacity={0.7}
									className="mr-2"
								>
									<MaterialCommunityIcons
										name={
											sortOrderAsc
												? 'sort-alphabetical-ascending'
												: 'sort-alphabetical-descending'
										}
										size={20}
										color="#177DFF"
									/>
								</TouchableOpacity>
								<Text className="text-sm font-medium mr-1">
									{sortFilter === 'none'
										? loc.t('inventory.details.sortNone')
										: sortFilter === 'lowStock'
											? loc.t('inventory.details.sortLowStock')
											: loc.t('inventory.details.sortExpiringSoon')}
								</Text>
								<Ionicons
									name={showSortMenu ? 'chevron-up' : 'chevron-down'}
									size={16}
									color="#555"
								/>
								{sortFilter !== 'none' && (
									<TouchableOpacity
										onPress={() => {
											setSortFilter('none')
											// TODO: clear applied sort logic
										}}
										className="ml-1"
									>
										<Ionicons name="close-circle" size={18} color="#888888" />
									</TouchableOpacity>
								)}
							</Pressable>

							{/* Dropdown menu */}
							{showSortMenu && (
								<View
									className="absolute top-12 right-0 w-40 bg-white rounded-lg border border-gray-300 shadow-lg"
									style={{ zIndex: 2500, elevation: 16 }}
								>
									{[
										{ key: 'none', label: loc.t('inventory.details.sortNone') },
										{
											key: 'lowStock',
											label: loc.t('inventory.details.sortLowStock'),
										},
										{
											key: 'expiringSoon',
											label: loc.t('inventory.details.sortExpiringSoon'),
										},
									].map((opt, idx) => (
										<Pressable
											key={opt.key}
											className={`px-3 py-2 flex-row items-center ${
												idx !== 0 ? 'border-t border-gray-200' : ''
											}`}
											onPress={() => {
												setSortFilter(opt.key)
												setShowSortMenu(false)
												// TODO: trigger actual sort logic here
											}}
										>
											<Text className="text-sm flex-1">{opt.label}</Text>
											{sortFilter === opt.key && (
												<Ionicons name="checkmark" size={16} color="#177DFF" />
											)}
										</Pressable>
									))}
								</View>
							)}
						</View>
					</View>
				</View>
			</View>

			{/* Products List */}
			<View className="flex-1">
				{/* Table Header */}
				<View className="bg-tableRowHeaderBg">
					{productRow(
						{
							name: loc.t('inventory.details.product'),
							stock: loc.t('inventory.details.stock'),
						},
						true
					)}
				</View>

				{/* Products Data */}
				{isLoading ? (
					<ProductListSkeleton />
				) : (
					<FlatList
						data={filteredProducts}
						renderItem={renderProductRow}
						keyExtractor={keyExtractor}
						refreshing={isRefreshing}
						onRefresh={handleManualRefresh}
						initialNumToRender={12}
						maxToRenderPerBatch={12}
						windowSize={7}
						removeClippedSubviews
						ListEmptyComponent={EmptyList}
					/>
				)}
			</View>

			{/* Add Product Button — now opens catalog form (product+variants, no lot) */}
			<View>
				<TouchableOpacity onPress={() => openCatalogForm(null)}>
					<View className="bg-btnPrimary items-center rounded-full py-2 mx-4 mb-4">
						<Text className="text-xl mt-2 mb-2 text-white">
							{loc.t('inventory.details.addBtn')}
						</Text>
					</View>
				</TouchableOpacity>
			</View>

			{/* Product Details Modal */}
			{renderProductModal()}

			{/* Lot Selector Modal */}
			{lotSelectorVisible && selectedProduct && (
				<LotSelector
					lots={productLots}
					variant={selectedProduct}
					handleLotSelection={handleLotSelection}
					handleCreateNewLot={handleCreateNewLot}
					cancelScanFlow={cancelLotSelector}
				/>
			)}

			{/* Catalog Create — product + variants (no lot) */}
			{showCatalogForm && (
				<ProductVariantForm
					ref={catalogSheetRef}
					visible={showCatalogForm}
					initialProduct={
						catalogInitialProduct
							? {
									id: catalogInitialProduct.id,
									productName:
										catalogInitialProduct.productName ||
										catalogInitialProduct.name ||
										'',
									barcode:
										catalogInitialProduct.barcode ||
										catalogPrefillBarcode ||
										'',
									measuringUnit: catalogInitialProduct.measuringUnit || '',
									genericName: catalogInitialProduct.genericName || '',
									category: catalogInitialProduct.category || 'OTHER',
								}
							: catalogPrefillBarcode
								? { barcode: catalogPrefillBarcode }
								: null
					}
					handleSubmit={handleCatalogSubmit}
					closeForm={closeCatalogForm}
				/>
			)}
			{/* Quick-add flow from + btn (reuse add-product VariantSelector/LotSelector/ProductForm, product pre-selected) */}
			{quickAddShowFlow && renderQuickAddFlow()}
		</View>
	)
}
