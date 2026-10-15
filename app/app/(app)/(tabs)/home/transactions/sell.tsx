import {
	Pressable,
	ToastAndroid,
	Text,
	TouchableOpacity,
	View,
	FlatList,
	StyleSheet,
	Modal,
	Keyboard,
	Image,
	TextInput,
	KeyboardAvoidingView,
	Platform,
} from 'react-native'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { MaterialIcons } from '@expo/vector-icons'
import { CloseModal } from '../../../../../src/components/AlertModal.jsx'
import SearchBar from '../../../../../src/components/searchBar'
import { useState, useEffect, useCallback, useRef } from 'react'
import barCodeScanner from '../../../../../src/components/barCodeScanner'

import {
	getProductFromInventoryDatabase,
	getAllLotsFromVariant,
	getAllProductsFromShop,
	getProductByOCR,
	getProductbyID,
} from '../../../../../src/controllers/product'
import { sellProduct } from '../../../../../src/controllers/shop'
import {
	deleteDraft,
	getSingleDraft,
} from '../../../../../src/controllers/draft'
import Receipt from '../../../../../src/components/receipt/Receipt'

import { useLocalization } from '../../../../../src/localization/localizationContext'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import useApi from '../../../../../src/hooks/useApi'
import { useAuth } from '../../../../../src/context/AuthContext'

//camara permissions
import { useCameraPermissions } from 'expo-camera'
import VariantSelector from '../../../../../src/components/inventory/VariantSelector.jsx'
import LotSelector from '../../../../../src/components/inventory/LotSelector.jsx'
import BarCodeInput from '../../../../../src/components/inventory/BarcodeInput.jsx'
import QuantityForm from '../../../../../src/components/sell/QuantityForm.jsx'

import {
	Barcode,
	Keyboard as KeyboardIcon,
} from '../../../../../assets/index.jsx'

import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import SummaryPage from '../../../../../src/components/sell/SummaryPage.jsx'
import ProductSelector from '../../../../../src/components/inventory/ProductSelector.jsx'
import { localProductController } from '../../../../../src/controllers/offline/product.js'

// Helper function to generate consistent random color based on product name
const getAvatarColor = (name) => {
	const colors = [
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

	// Generate consistent hash from name
	let hash = 0
	const safeName = name || 'Unknown'
	for (let i = 0; i < safeName.length; i++) {
		hash = safeName.charCodeAt(i) + ((hash << 5) - hash)
	}

	return colors[Math.abs(hash) % colors.length]
}

// Product Thumbnail Componen
const ProductThumbnail = ({ image, name, size = 32 }) => {
	const [imageLoading, setImageLoading] = useState(true)
	const [imageError, setImageError] = useState(false)
	const [showImage, setShowImage] = useState(false)

	const firstLetter = name ? name.charAt(0).toUpperCase() : '?'
	const backgroundColor = getAvatarColor(name || '')

	// Always show the default icon first, then overlay with image if it loads
	const renderDefaultIcon = () => (
		<View
			style={{
				width: size,
				height: size,
				backgroundColor,
				borderRadius: size / 2,
				justifyContent: 'center',
				alignItems: 'center',
			}}
		>
			<Text style={{ fontSize: size * 0.4, fontWeight: '500', color: 'white' }}>
				{firstLetter}
			</Text>
		</View>
	)

	if (!image || imageError || !showImage) {
		return renderDefaultIcon()
	}

	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				overflow: 'hidden',
			}}
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
}

type CartProductType = {
	lotId: string
	sellPrice: number
	buyPrice: number
	originalPrice: number
	quantity: number
	discountAmount: number
	discountPercentage: number
	discountType: string
	productName: string
	variantName: string
	variantCode: string
	productImage: string
	measuringUnit: string
	stock: number
}

type NewProductType = {
	id: string
	barcode: string
	measuringUnit: string
	productName: string
	image: string
}

export default function Sell() {
	const { authState } = useAuth()
	const { loc } = useLocalization()
	const { translateNumber, translateAmount, prepareReceiptData } =
		useNumberTranslator()
	const { fetchData } = useApi()
	const searchBarRef = useRef(null)
	const discountUnitPriceRef = useRef(null)
	const [isSearchFocused, setIsSearchFocused] = useState(false)

	// When keyboard closes, ensure search bar loses focus and buttons return
	useEffect(() => {
		const onHide = () => {
			setIsSearchFocused(false)
			// blur the input if still focused
			searchBarRef.current?.blur && searchBarRef.current.blur()
		}
		const willHideSub = Keyboard.addListener('keyboardWillHide', onHide)
		return () => {
			willHideSub.remove()
		}
	}, [])

	const params = useLocalSearchParams()

	const [isScanning, setIsScanning] = useState(false)
	const [totalProducts, setTotalProducts] = useState(0)
	const [totalPrice, setTotalPrice] = useState(0)
	const [generateReceipt, setGenerateReceipt] = useState(false)
	const [cartProducts, setCartProducts] = useState<CartProductType[]>([])

	//camera permissions
	const [permission, requestPermission] = useCameraPermissions()

	//Store all variant array
	const [variantData, setVariantData] = useState(null)
	//Store all lot data for selected variant
	const [lotData, setLotData] = useState(null)
	//Store selected variant data
	const [selectedVariant, setSelectedVariant] = useState(null)
	//Store selected lot data
	const [selectedLot, setSelectedLot] = useState(null)
	const [selctedCustomer, setSelctedCustomer] = useState(null)
	// Add these state variables after your existing state declarations
	const [infoModalVisible, setInfoModalVisible] = useState(false)
	const [selectedProductInfo, setSelectedProductInfo] = useState(null)
	const [showClearModal, setShowClearModal] = useState(false)
	const [showProductNotFoundModal, setShowProductNotFoundModal] =
		useState(false)
	const [scannedBarcode, setScannedBarcode] = useState('')

	// Quantity edit modal states
	const [quantityEditModalVisible, setQuantityEditModalVisible] =
		useState(false)
	const [editingProduct, setEditingProduct] = useState(null)
	const [tempQuantity, setTempQuantity] = useState('')

	// Discount modal states
	const [discountModalVisible, setDiscountModalVisible] = useState(false)
	const [discountEditingProduct, setDiscountEditingProduct] = useState(null)
	const [tempUnitPrice, setTempUnitPrice] = useState('')
	const [tempTotalPrice, setTempTotalPrice] = useState('')
	const [tempUnitDiscount, setTempUnitDiscount] = useState('')
	const [tempTotalDiscount, setTempTotalDiscount] = useState('')

	// Inline quantity editing state
	const [editingQuantityId, setEditingQuantityId] = useState(null)
	const [inlineQuantityValue, setInlineQuantityValue] = useState('')

	const [newProductData, setNewProductData] = useState<NewProductType>({
		id: '',
		barcode: '',
		measuringUnit: '',
		productName: '',
		image: '',
	})
	//TODO : Fix the commented lines
	useFocusEffect(
		useCallback(() => {
			if (params.loadFromDraft === 'true' && params.draftId) {
				const fetchDraftData = async () => {
					try {
						const result = await fetchData(getSingleDraft, {
							id: params.draftId,
						})

						if (result.success && result.data) {
							//WARN: Deleting old draft item
							// uncomment the following in prod
							const deleteResponse = await fetchData(deleteDraft, {
								id: result.data.id,
							})
							//console.log('🚀 deleteResponse : ', deleteResponse)
							//
							// Transform draft products to cart products format
							const transformedProducts = result.data.items.map((product) => ({
								productName: product.Lot.ShopVariant.name || 'Draft Product', // You might need to fetch product name separately
								variantName: product.Lot.ShopVariant.variantName || '', // You might need to fetch variant info
								variantCode: product.Lot.ShopVariant.variantCode || null, // You might need to fetch variant info
								lotId: product.lotId,
								buyPrice: product.Lot.buyPrice,
								sellPrice: product.Lot.sellPrice,
								discountAmount: 0,
								discountPercentage: 0,
								discountType: 'PERCENTAGE',
								quantity: product.quantity,
							}))

							// Set the cart products
							setCartProducts(transformedProducts)
							resetProductSelection()
							setSelctedCustomer(result.data?.buyer?.userID || null)

							// Show success message
							ToastAndroid.show(
								loc.t('transactions.success.draftLoaded'),
								ToastAndroid.SHORT
							)
						}
					} catch (error) {
						console.error(' 101 Error fetching draft data:', error)
						ToastAndroid.show(
							loc.t('transactions.errors.draftLoadError'),
							ToastAndroid.SHORT
						)
					}
				}
				fetchDraftData()
			}
		}, [params.draftId, params.loadFromDraft])
	)

	const handleScan = async (barcode) => {
		setIsScanning(false)
		try {
			const result = await fetchData(
				getProductFromInventoryDatabase,
				{
					barcode: barcode,
				},
				localProductController.getProductFromInventoryDatabase,
				'read'
			)

			if (!result.success) {
				setScannedBarcode(barcode)
				setShowProductNotFoundModal(true)
				return
			}
			const { variants, ...productData } = result.data
			productData.barcode = productData.barcode || barcode

			setVariantData(variants)
			setNewProductData(productData)
			if (variants && variants.length === 1) {
				handleVariantSelection(variants[0], productData)
			} else {
				setCurrentFlow(2) // Show variant selector
			}
		} catch (error) {
			console.error('🚨 Error fetching product info:', error)
			ToastAndroid.show(
				loc.t('transactions.errors.productNotFound'),
				ToastAndroid.SHORT
			)
		}
	}

	const handleAddManually = () => {
		setShowProductNotFoundModal(false)
		setNewProductData({
			...newProductData,
			barcode: scannedBarcode,
		})
		// Note: setIsManual(true) might need to be implemented depending on your flow
		// For now, we'll show a toast that manual addition is not implemented
		ToastAndroid.show(
			loc.t('transactions.manualAddNotImplemented') ||
				'Manual product addition is not yet implemented',
			ToastAndroid.LONG
		)
	}

	const setProductData = async (variant) => {
		const result = await fetchData(
			getProductbyID,
			{
				productId: variant.productID,
			},
			localProductController.getProductbyID,
			'read'
		)

		if (!result.success) {
			console.error('🚨 Error fetching product data:', result.error)
			ToastAndroid.show(
				loc.t('transactions.errors.productDataError'),
				ToastAndroid.SHORT
			)
			return false
		}
		setNewProductData(result.data)
		return true
	}

	const handleVariantSelection = async (variant, product = null) => {
		setSelectedVariant(variant)

		try {
			// fetch product data and set to state
			const productDataResult = await setProductData(variant)
			if (!productDataResult) {
				// Error already handled in setProductData, just return
				return
			}

			// Fetch lots for the selected variant
			const result = await fetchData(
				getAllLotsFromVariant,
				variant.id,
				localProductController.getLotByVariantId,
				'read'
			)

			if (result.success && result.data && result.data.length > 0) {
				setLotData(result.data)

				// Auto-select if only 1 lot
				if (result.data.length === 1) {
					handleLotSelection(result.data[0], product, variant)
				} else {
					setCurrentFlow(3) // Show lot selector
				}
			} else {
				// No lots found, go directly to form to create new lot
				setLotData([])
				setCurrentFlow(5) // Show form
			}
		} catch (error) {
			console.error('🚨 Error fetching lots:', error)
			ToastAndroid.show(
				loc.t('transactions.errors.lotDataError'),
				ToastAndroid.SHORT
			)
			// On error, still show the form
			setCurrentFlow(5)
		}
	}

	function modifyCartItemQuantity(
		cartItem: CartProductType,
		qtyChange?: number,
		newQuantity?: number
	): CartProductType {
		let newQty: number
		if (qtyChange) {
			newQty = cartItem.quantity + qtyChange
		}
		if (newQuantity) {
			newQty = newQuantity
		}
		if (cartItem.stock >= newQty && newQty > 0) {
			cartItem.quantity = newQty

			return {
				...cartItem,
				quantity: newQty,
			}
		} else if (cartItem.stock < newQty && newQty > 0) {
			cartItem.quantity = cartItem.stock
			ToastAndroid.show(
				loc.t('transactions.errors.maxStockLimitReached'),
				ToastAndroid.SHORT
			)
		}
		return cartItem
	}

	const handleLotSelection = (lot, product = null, variant = null) => {
		if (!lot || !lot.id) {
			console.warn('Invalid lot data:', lot)
			return
		}
		if (lot.stock <= 0) {
			ToastAndroid.show(
				loc.t('transactions.errors.outOfStock'),
				ToastAndroid.SHORT
			)
			return
		}

		setCartProducts((prevProducts) => {
			const existing = prevProducts.find((item) => item.lotId === lot.id)
			if (existing) {
				// If product already exists, increment quantity
				return prevProducts.map((item) =>
					item.lotId === lot.id ? modifyCartItemQuantity(item, 1) : item
				)
			} else {
				// Add new product to cart with quantity 1
				const newCartProduct: CartProductType = {
					productName:
						lot?.Product?.name ||
						product?.productName ||
						newProductData?.productName ||
						'Unknown Product',
					variantName:
						lot.Product?.variant?.variantName ||
						variant?.variantName ||
						selectedVariant?.variantName ||
						null,
					variantCode:
						lot.Product?.variant?.code ||
						variant?.name ||
						selectedVariant?.variantCode ||
						null,
					productImage: lot.Product?.image || newProductData?.image || null,
					measuringUnit:
						lot.Product?.measuringUnit ||
						newProductData?.measuringUnit ||
						product?.measuringUnit ||
						null,
					lotId: lot.id,
					buyPrice: lot.buyPrice || 0,
					sellPrice: lot.sellPrice || 0,
					originalPrice: lot.sellPrice || 0, // Store original price for discount calculations
					discountAmount: 0,
					discountPercentage: 0,
					discountType: 'PERCENTAGE',
					quantity: 1,
					stock: lot.stock || 0,
				}
				return [...prevProducts, newCartProduct]
			}
		})

		resetProductSelection()

		// Close the sell flow and reset states
		setShowSellFlow(false)
		setCurrentFlow(0)
		setSelectedLot(null)
		setSelectedVariant(null)
		setLotData(null)
		setVariantData(null)
	}

	const handleOpenInfoModal = (product) => {
		setSelectedProductInfo(product)
		setInfoModalVisible(true)
	}

	// Quantity management functions
	const changeQuantity = (lotId, change) => {
		if (!lotId) return

		setCartProducts((prevProducts) => {
			return prevProducts.map((item) => {
				if (item.lotId === lotId) {
					const x = modifyCartItemQuantity(item, change)
					return x
				}
				return item
			})
		})
	}

	const openQuantityEditModal = (product) => {
		if (!product || product.quantity === undefined) return

		setEditingProduct(product)
		setTempQuantity(product.quantity.toString())
		setQuantityEditModalVisible(true)
	}

	const updateQuantity = () => {
		if (!editingProduct) return

		const newQuantity = Math.max(1, Number(tempQuantity) || 1)
		setCartProducts((prevProducts) => {
			return prevProducts.map((item) => {
				if (item.lotId === editingProduct.lotId) {
					return modifyCartItemQuantity(item, null, newQuantity)
				}
				return item
			})
		})
		setQuantityEditModalVisible(false)
		setEditingProduct(null)
		setTempQuantity('')
	}

	// Inline quantity editing functions
	const startInlineQuantityEdit = (product) => {
		setEditingQuantityId(product.lotId)
		setInlineQuantityValue(product.quantity.toString())
	}

	const finishInlineQuantityEdit = () => {
		if (!editingQuantityId) return

		const newQuantity = Math.max(1, Number(inlineQuantityValue) || 1)
		setCartProducts((prevProducts) => {
			return prevProducts.map((item) => {
				if (item.lotId === editingQuantityId) {
					return modifyCartItemQuantity(item, null, newQuantity)
				}
				return item
			})
		})
		setEditingQuantityId(null)
		setInlineQuantityValue('')
	}

	const cancelInlineQuantityEdit = () => {
		setEditingQuantityId(null)
		setInlineQuantityValue('')
	}

	// Discount management functions
	const openDiscountModal = (product) => {
		if (!product) return

		const originalPrice =
			product.originalPrice || product.buyPrice || product.sellPrice
		const currentUnitPrice = product.sellPrice
		const currentTotalPrice = currentUnitPrice * product.quantity
		const unitDiscount = originalPrice - currentUnitPrice
		const totalDiscount = unitDiscount * product.quantity

		setDiscountEditingProduct(product)
		setTempUnitPrice(currentUnitPrice.toString())
		setTempTotalPrice(currentTotalPrice.toString())
		setTempUnitDiscount(Math.max(0, unitDiscount).toString())
		setTempTotalDiscount(Math.max(0, totalDiscount).toString())
		setDiscountModalVisible(true)

		// Ensure keyboard opens after modal animation
		setTimeout(() => {
			discountUnitPriceRef.current?.focus()
		}, 300)
	}

	const updateUnitPrice = (newUnitPrice) => {
		const unitPrice = Number(newUnitPrice) || 0
		const quantity = discountEditingProduct?.quantity || 1
		const originalPrice =
			discountEditingProduct?.originalPrice ||
			discountEditingProduct?.buyPrice ||
			discountEditingProduct?.sellPrice ||
			0

		const totalPrice = unitPrice * quantity
		const unitDiscount = Math.max(0, originalPrice - unitPrice)
		const totalDiscount = unitDiscount * quantity

		setTempUnitPrice(newUnitPrice)
		setTempTotalPrice(
			totalPrice % 1 === 0 ? totalPrice.toString() : totalPrice.toFixed(2)
		)
		setTempUnitDiscount(
			unitDiscount % 1 === 0 ? unitDiscount.toString() : unitDiscount.toFixed(2)
		)
		setTempTotalDiscount(
			totalDiscount % 1 === 0
				? totalDiscount.toString()
				: totalDiscount.toFixed(2)
		)
	}

	const updateTotalPrice = (newTotalPrice) => {
		const totalPrice = Number(newTotalPrice) || 0
		const quantity = discountEditingProduct?.quantity || 1
		const originalPrice =
			discountEditingProduct?.originalPrice ||
			discountEditingProduct?.buyPrice ||
			discountEditingProduct?.sellPrice ||
			0

		const unitPrice = totalPrice / quantity
		const unitDiscount = Math.max(0, originalPrice - unitPrice)
		const totalDiscount = unitDiscount * quantity

		setTempTotalPrice(newTotalPrice)
		setTempUnitPrice(
			unitPrice % 1 === 0 ? unitPrice.toString() : unitPrice.toFixed(2)
		)
		setTempUnitDiscount(
			unitDiscount % 1 === 0 ? unitDiscount.toString() : unitDiscount.toFixed(2)
		)
		setTempTotalDiscount(
			totalDiscount % 1 === 0
				? totalDiscount.toString()
				: totalDiscount.toFixed(2)
		)
	}

	const updateUnitDiscount = (newUnitDiscount) => {
		const unitDiscount = Number(newUnitDiscount) || 0
		const quantity = discountEditingProduct?.quantity || 1
		const originalPrice =
			discountEditingProduct?.originalPrice ||
			discountEditingProduct?.buyPrice ||
			discountEditingProduct?.sellPrice ||
			0

		const unitPrice = Math.max(0, originalPrice - unitDiscount)
		const totalPrice = unitPrice * quantity
		const totalDiscount = unitDiscount * quantity

		setTempUnitDiscount(newUnitDiscount)
		setTempUnitPrice(
			unitPrice % 1 === 0 ? unitPrice.toString() : unitPrice.toFixed(2)
		)
		setTempTotalPrice(
			totalPrice % 1 === 0 ? totalPrice.toString() : totalPrice.toFixed(2)
		)
		setTempTotalDiscount(
			totalDiscount % 1 === 0
				? totalDiscount.toString()
				: totalDiscount.toFixed(2)
		)
	}

	const updateTotalDiscount = (newTotalDiscount) => {
		const totalDiscount = Number(newTotalDiscount) || 0
		const quantity = discountEditingProduct?.quantity || 1
		const originalPrice =
			discountEditingProduct?.originalPrice ||
			discountEditingProduct?.buyPrice ||
			discountEditingProduct?.sellPrice ||
			0

		const unitDiscount = totalDiscount / quantity
		const unitPrice = Math.max(0, originalPrice - unitDiscount)
		const totalPrice = unitPrice * quantity

		setTempTotalDiscount(newTotalDiscount)
		setTempUnitDiscount(
			unitDiscount % 1 === 0 ? unitDiscount.toString() : unitDiscount.toFixed(2)
		)
		setTempUnitPrice(
			unitPrice % 1 === 0 ? unitPrice.toString() : unitPrice.toFixed(2)
		)
		setTempTotalPrice(
			totalPrice % 1 === 0 ? totalPrice.toString() : totalPrice.toFixed(2)
		)
	}

	const applyDiscount = () => {
		if (!discountEditingProduct) return

		const newUnitPrice = Number(tempUnitPrice) || 0
		// Use original buy price if available, otherwise use the current sell price as original
		const originalPrice =
			discountEditingProduct.originalPrice ||
			discountEditingProduct.buyPrice ||
			discountEditingProduct.sellPrice

		// Calculate discount based on the difference from original price
		let discountAmount = 0
		let discountPercentage = 0

		if (newUnitPrice < originalPrice) {
			discountAmount = originalPrice - newUnitPrice
			discountPercentage = (discountAmount / originalPrice) * 100
		}

		setCartProducts((prevProducts) => {
			return prevProducts.map((item) => {
				if (item.lotId === discountEditingProduct.lotId) {
					return {
						...item,
						sellPrice: newUnitPrice,
						originalPrice: originalPrice, // Store original price for display
						discountAmount,
						discountPercentage,
						discountType: 'AMOUNT',
					}
				}
				return item
			})
		})
		setDiscountModalVisible(false)
		setDiscountEditingProduct(null)
		setTempUnitPrice('')
		setTempTotalPrice('')
		setTempUnitDiscount('')
		setTempTotalDiscount('')
	}

	const [receiptData, setReceiptData] = useState(null)
	const handleSell = async (cartdiscount, selectedCustomer, txnInfo) => {
		const { isDraft } = txnInfo

		if (selectedCustomer) {
			cartdiscount.buyerID = selectedCustomer
		}
		if (cartProducts.length > 0) {
			try {
				// Prepare data for backend (convert Bengali numbers to English)
				const backendCartProducts = prepareReceiptData(cartProducts)
				const backendCartDiscount = prepareReceiptData(cartdiscount)

				const result = await fetchData(sellProduct, {
					cartProducts: backendCartProducts,
					cart: { ...backendCartDiscount, txnInfo },
				})
				if (result.success == true) {
					if (isDraft) {
						ToastAndroid.show(
							loc.t('transactions.success.draftSaved'),
							ToastAndroid.SHORT
						)
						resetCart()
					} else {
						ToastAndroid.show(
							loc.t('transactions.success.productSold'),
							ToastAndroid.SHORT
						)
						setReceiptData(result.data)
						setGenerateReceipt(true)
					}
				} else {
					console.error('🚨 Sell operation failed:', result.error)
					if (isDraft) {
						ToastAndroid.show(
							loc.t('transactions.errors.draftSaveError'),
							ToastAndroid.SHORT
						)
					} else {
						ToastAndroid.show(
							loc.t('transactions.errors.sellError'),
							ToastAndroid.SHORT
						)
					}
				}
			} catch (error) {
				console.error('🚨 Error during sell operation:', error)
				ToastAndroid.show(
					loc.t('transactions.errors.networkError'),
					ToastAndroid.SHORT
				)
			}
		} else {
			ToastAndroid.show(
				loc.t('transactions.cartEmptyError'),
				ToastAndroid.SHORT
			)
		}
		setShowSellFlow(false)
		setCurrentFlow(0)
	}

	const resetCart = () => {
		setCartProducts([])
		setTotalPrice(0)
		setTotalProducts(0)
		setReceiptData(null)

		//NOTE: maybe not needed
		resetProductSelection()
	}

	const handleProductAddToCart = (data) => {
		const newCartProduct: CartProductType = {
			productName: newProductData.productName,
			variantName: selectedVariant?.variantName || '',
			variantCode: selectedVariant?.variantCode || '',
			productImage: newProductData?.image || null,
			measuringUnit: newProductData?.measuringUnit || null,
			lotId: selectedLot?.id || selectedLot?.lotId,
			buyPrice: selectedLot.buyPrice,
			sellPrice: selectedLot.sellPrice,
			originalPrice: selectedLot.sellPrice,
			discountAmount: data.discountAmount || 0,
			discountPercentage: data.discountPercentage || 0,
			discountType: data.discountType || 'PERCENTAGE',
			quantity: data.quantity,
			stock: selectedLot.stock,
		}

		setCartProducts((prevProducts) => {
			const existing = prevProducts.find(
				(item) => item.lotId === newCartProduct.lotId
			)

			if (existing) {
				return prevProducts.map((item) =>
					item.lotId === newCartProduct.lotId
						? {
								...item,
								quantity: data.quantity,
								discountAmount: data.discountAmount,
								discountPercentage: data.discountPercentage,
								discountType: data?.discountType || 'PERCENTAGE',
							}
						: item
				)
			} else {
				return [...prevProducts, newCartProduct]
			}
		})

		resetProductSelection()
		setCurrentFlow(0)
		setShowSellFlow(false)
	}

	const [ocrProductData, setOCRProductData] = useState([])
	const handleOCRData = async (data) => {
		try {
			const result = await fetchData(getProductByOCR, { searchTerm: data })
			if (!result?.success) {
				console.error('🚨 Error processing OCR data:', result.error)
				ToastAndroid.show(
					loc.t('transactions.errors.ocrDataError'),
					ToastAndroid.SHORT
				)
				return
			}

			if (result.data.products.length > 0) {
				setOCRProductData(result.data.products)
				setCurrentFlow(6)
			} else if (result.data.shopVariants.length > 0) {
				setVariantData(result.data.shopVariants)
				setCurrentFlow(2) // Show variant selector
			} else {
				ToastAndroid.show(
					loc.t('transactions.errors.noProductsFound'),
					ToastAndroid.SHORT
				)
			}
		} catch (error) {
			console.error('🚨 Error in OCR processing:', error)
			ToastAndroid.show(
				loc.t('transactions.errors.ocrDataError'),
				ToastAndroid.SHORT
			)
		}
	}

	//Currnt flow idx
	const [currentFlow, setCurrentFlow] = useState(0)
	const [showSellFlow, setShowSellFlow] = useState(false)

	//Define the modal flow for the barcode scanner method
	const productSellFlow = [
		{
			id: 0,
			name: 'show_camera',
			component: barCodeScanner,
			getProps: () => ({
				isVisible: isScanning,
				setIsVisible: setIsScanning,
				handleBarCodeScan: handleScan,
				cameraPermission: permission,
				requestPermission: requestPermission,
				handleOCRData: handleOCRData,
			}),
		},
		{
			id: 1,
			name: 'get_barcode_input',
			component: BarCodeInput,
			getProps: () => ({
				handleInputSubmit: handleScan,
				cancelScanFlow: cancelSellFlow,
			}),
		},
		{
			id: 2,
			name: 'show_variant',
			component: VariantSelector,
			getProps: () => ({
				variants: variantData,
				handleVariantSelection: handleVariantSelection,
				cancelScanFlow: cancelSellFlow,
				showCreate: false,
			}),
		},
		{
			id: 3,
			name: 'show_lot',
			component: LotSelector,
			getProps: () => ({
				lots: lotData,
				variant: selectedVariant,
				handleLotSelection: handleLotSelection,
				cancelScanFlow: cancelSellFlow,
				showCreate: false,
			}),
		},
		{
			id: 4,
			name: 'quantity_input',
			component: QuantityForm,
			getProps: () => ({
				lot: selectedLot,
				handleSubmit: handleProductAddToCart,
				cancelScanFlow: cancelSellFlow,
			}),
		},
		{
			id: 5,
			name: 'summary_page',
			component: SummaryPage,
			getProps: () => ({
				handleSubmit: handleSell,
				handleDraft: handleSell,
				cancelFlow: cancelSellFlow,
				selectedCustomerId: selctedCustomer,
				totalAmount: totalPrice,
			}),
		},
		{
			id: 6,
			name: 'showProductSelector',
			component: ProductSelector,
			getProps: () => ({
				products: ocrProductData,
				handleProductSelect: (product) => handleScan(product.barcode),

				cancelScanFlow: cancelSellFlow,
			}),
		},
	]

	//Show Prooduct Sell flow
	const handleScannedFLow = () => {
		const CurrentStep = productSellFlow.find((step) => step.id === currentFlow)
		const StepComponent = CurrentStep?.component
		const stepProps = CurrentStep?.getProps ? CurrentStep.getProps() : {}

		return <>{StepComponent && <StepComponent {...stepProps} />}</>
	}

	const cancelSellFlow = () => {
		setShowSellFlow(false)
		setCurrentFlow(0)
		setIsScanning(false)
		setSelectedVariant(null)
		setSelectedLot(null)
		setLotData(null)
		setVariantData(null)
		setNewProductData(null)
		setOCRProductData(null)
	}

	const removeItemFromCart = (lotId) => {
		setCartProducts((prev) => prev.filter((item) => item.lotId !== lotId))
	}

	// Add this function before the return statement
	const renderClearConfirmModal = () => (
		<Modal
			transparent={true}
			visible={showClearModal}
			animationType="fade"
			onRequestClose={() => setShowClearModal(false)}
		>
			<View style={styles.deleteModalBackdrop}>
				<View style={styles.deleteModalContent}>
					<MaterialIcons
						name="warning"
						size={48}
						color="#EF4444"
						style={styles.warningIcon}
					/>
					<Text style={styles.deleteTitle}>
						{loc.t('transactions.clearModal.title') || 'Clear Cart'}
					</Text>
					<Text style={styles.deleteMessage}>
						{loc.t('transactions.clearModal.message') ||
							'Are you sure you want to clear all items from the cart? This action cannot be undone.'}
					</Text>
					<View style={styles.deleteButtonContainer}>
						<TouchableOpacity
							style={[styles.deleteButton, styles.cancelDeleteButton]}
							onPress={() => setShowClearModal(false)}
							activeOpacity={0.8}
						>
							<Text style={styles.cancelDeleteText}>
								{loc.t('transactions.clearModal.cancel') || 'Cancel'}
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.deleteButton, styles.confirmDeleteButton]}
							onPress={() => {
								setCartProducts([])
								setShowClearModal(false)
								ToastAndroid.show(
									loc.t('transactions.clearModal.success') ||
										'Cart cleared successfully',
									ToastAndroid.SHORT
								)
							}}
							activeOpacity={0.8}
						>
							<Text style={styles.confirmDeleteText}>
								{loc.t('transactions.clearModal.clear') || 'Clear'}
							</Text>
						</TouchableOpacity>
					</View>
				</View>
			</View>
		</Modal>
	)

	// Add this function before the return statement
	const renderProductInfoModal = () => {
		if (!selectedProductInfo) return null

		return (
			<Modal
				animationType="fade"
				transparent={true}
				visible={infoModalVisible}
				onRequestClose={() => setInfoModalVisible(false)}
			>
				<Pressable
					className="flex-1 justify-center items-center bg-black/50"
					onPress={() => setInfoModalVisible(false)}
				>
					<Pressable
						className="bg-white p-6 rounded-lg w-4/5 shadow-lg"
						onPress={(e) => e.stopPropagation()}
					>
						<View className="flex-row justify-between items-center mb-4">
							<Text className="text-xl font-bold text-gray-800">
								{loc.t('transactions.productDetails')}
							</Text>
							<TouchableOpacity onPress={() => setInfoModalVisible(false)}>
								<MaterialIcons name="close" size={24} color="black" />
							</TouchableOpacity>
						</View>

						<View className="space-y-3">
							<View className="flex-row justify-between items-center py-2 border-b border-gray-200">
								<Text className="text-gray-600 font-medium">
									{loc.t('transactions.productName')}:
								</Text>
								<Text className="text-gray-800 font-semibold flex-1 text-right">
									{selectedProductInfo.productName}
								</Text>
							</View>

							<View className="flex-row justify-between items-center py-2 border-b border-gray-200">
								<Text className="text-gray-600 font-medium">
									{loc.t('transactions.variantName')}:
								</Text>
								<Text className="text-gray-800 font-semibold flex-1 text-right">
									{selectedProductInfo.variantName || '-'}
								</Text>
							</View>

							<View className="flex-row justify-between items-center py-2 border-b border-gray-200">
								<Text className="text-gray-600 font-medium">
									{loc.t('transactions.variantCode')}:
								</Text>
								<Text className="text-gray-800 font-semibold flex-1 text-right">
									{selectedProductInfo.variantCode || '-'}
								</Text>
							</View>

							<View className="flex-row justify-between items-center py-2 border-b border-gray-200">
								<Text className="text-gray-600 font-medium">
									{loc.t('transactions.sellPrice')}:
								</Text>
								<Text className="text-green-600 font-bold flex-1 text-right">
									{translateAmount(selectedProductInfo.sellPrice)}
								</Text>
							</View>

							<View className="flex-row justify-between items-center py-2 border-b border-gray-200">
								<Text className="text-gray-600 font-medium">
									{loc.t('transactions.buyPrice')}:
								</Text>
								<Text className="text-blue-600 font-bold flex-1 text-right">
									{translateAmount(selectedProductInfo.buyPrice)}
								</Text>
							</View>

							<View className="flex-row justify-between items-center py-2">
								<Text className="text-gray-600 font-medium">
									{loc.t('transactions.availableStock')}:
								</Text>
								<Text
									className={`font-bold flex-1 text-right ${
										selectedProductInfo.stock > 10
											? 'text-green-600'
											: selectedProductInfo.stock > 0
												? 'text-orange-600'
												: 'text-red-600'
									}`}
								>
									{translateNumber(selectedProductInfo.stock)}
								</Text>
							</View>
						</View>
					</Pressable>
				</Pressable>
			</Modal>
		)
	}

	// Quantity Edit Modal
	const renderQuantityEditModal = () => {
		if (!editingProduct) return null

		return (
			<Modal
				animationType="fade"
				transparent={true}
				visible={quantityEditModalVisible}
				onRequestClose={() => setQuantityEditModalVisible(false)}
			>
				<Pressable
					className="flex-1 justify-center items-center bg-black/50"
					onPress={() => setQuantityEditModalVisible(false)}
				>
					<Pressable
						className="bg-white p-6 rounded-lg w-4/5 shadow-lg"
						onPress={(e) => e.stopPropagation()}
					>
						<View className="flex-row justify-between items-center mb-4">
							<Text className="text-xl font-bold text-gray-800">
								{loc.t('editQuantity') || 'Edit Quantity'}
							</Text>
							<TouchableOpacity
								onPress={() => setQuantityEditModalVisible(false)}
							>
								<MaterialIcons name="close" size={24} color="black" />
							</TouchableOpacity>
						</View>

						<View className="space-y-4">
							<View className="space-y-2">
								<Text className="text-gray-600 font-medium">
									{editingProduct?.productName || 'Unknown Product'}
								</Text>
								{editingProduct?.variantName && (
									<Text className="text-gray-500 text-sm">
										{editingProduct.variantName}
									</Text>
								)}
							</View>

							<View className="space-y-2">
								<Text className="text-gray-600 font-medium">
									{loc.t('transactions.tableHeader.quantity') || 'Quantity'}:
								</Text>
								<TextInput
									className="border border-gray-300 rounded-lg px-4 py-3 text-lg text-gray-800"
									value={tempQuantity}
									onChangeText={setTempQuantity}
									keyboardType="numeric"
									placeholder="1"
									placeholderTextColor="#9CA3AF"
									autoFocus={true}
								/>
							</View>

							<View className="flex-row space-x-3 mt-6">
								<TouchableOpacity
									className="flex-1 bg-gray-200 py-3 rounded-lg"
									onPress={() => setQuantityEditModalVisible(false)}
								>
									<Text className="text-center text-gray-700 font-medium">
										{loc.t('cancel') || 'Cancel'}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									className="flex-1 bg-blue-500 py-3 rounded-lg"
									onPress={updateQuantity}
								>
									<Text className="text-center text-white font-medium">
										{loc.t('ok') || 'OK'}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</Pressable>
				</Pressable>
			</Modal>
		)
	}

	// Discount Edit Modal
	const renderDiscountModal = () => {
		if (!discountEditingProduct) return null

		return (
			<Modal
				animationType="fade"
				transparent={true}
				visible={discountModalVisible}
				onRequestClose={() => setDiscountModalVisible(false)}
			>
				<Pressable
					className="flex-1 justify-center items-center bg-black/50"
					onPress={() => setDiscountModalVisible(false)}
				>
					<Pressable
						className="bg-white p-6 rounded-lg w-4/5 shadow-lg"
						onPress={(e) => e.stopPropagation()}
					>
						<View className="flex-row justify-between items-center mb-4">
							<Text className="text-xl font-bold text-gray-800">
								{loc.t('editPrice') || 'Edit Price'}
							</Text>
							<TouchableOpacity onPress={() => setDiscountModalVisible(false)}>
								<MaterialIcons name="close" size={24} color="black" />
							</TouchableOpacity>
						</View>

						<View className="space-y-4">
							<View className="space-y-2">
								<Text className="text-gray-600 font-medium">
									{discountEditingProduct?.productName || 'Unknown Product'}
								</Text>
								{discountEditingProduct?.variantName && (
									<Text className="text-gray-500 text-sm">
										{discountEditingProduct.variantName}
									</Text>
								)}
								<Text className="text-gray-500 text-sm">
									{loc.t('quantity') || 'Quantity'}:{' '}
									{translateNumber(discountEditingProduct?.quantity || 1)}
								</Text>
								<Text className="text-gray-500 text-sm">
									{loc.t('originalPrice') || 'Original Price'}:{' '}
									{translateNumber(
										discountEditingProduct?.originalPrice ||
											discountEditingProduct?.buyPrice ||
											discountEditingProduct?.sellPrice ||
											0
									)}
								</Text>
							</View>

							<View className="flex-row" style={{ gap: 16 }}>
								<View className="flex-1 space-y-2">
									<Text className="text-gray-600 font-medium">
										{loc.t('unitPrice') || 'Unit Price'}:
									</Text>
									<TextInput
										ref={discountUnitPriceRef}
										className="border border-gray-300 rounded-lg px-4 py-3 text-lg text-gray-800"
										value={tempUnitPrice}
										onChangeText={updateUnitPrice}
										keyboardType="numeric"
										placeholder="0"
										placeholderTextColor="#9CA3AF"
										autoFocus={true}
									/>
								</View>

								<View className="flex-1 space-y-2">
									<Text className="text-gray-600 font-medium">
										{loc.t('unitDiscount') || 'Unit Discount'}:
									</Text>
									<TextInput
										className="border border-gray-300 rounded-lg px-4 py-3 text-lg text-gray-800"
										value={tempUnitDiscount}
										onChangeText={updateUnitDiscount}
										keyboardType="numeric"
										placeholder="0"
										placeholderTextColor="#9CA3AF"
									/>
								</View>
							</View>

							<View className="flex-row" style={{ gap: 16 }}>
								<View className="flex-1 space-y-2">
									<Text className="text-gray-600 font-medium">
										{loc.t('totalPrice') || 'Total Price'}:
									</Text>
									<TextInput
										className="border border-gray-300 rounded-lg px-4 py-3 text-lg text-gray-800"
										value={tempTotalPrice}
										onChangeText={updateTotalPrice}
										keyboardType="numeric"
										placeholder="0"
										placeholderTextColor="#9CA3AF"
									/>
								</View>

								<View className="flex-1 space-y-2">
									<Text className="text-gray-600 font-medium">
										{loc.t('totalDiscount') || 'Total Discount'}:
									</Text>
									<TextInput
										className="border border-gray-300 rounded-lg px-4 py-3 text-lg text-gray-800"
										value={tempTotalDiscount}
										onChangeText={updateTotalDiscount}
										keyboardType="numeric"
										placeholder="0"
										placeholderTextColor="#9CA3AF"
									/>
								</View>
							</View>

							<View
								className="flex-row justify-between mt-8"
								style={{ gap: 24 }}
							>
								<TouchableOpacity
									className="flex-1 bg-gray-200 py-3 rounded-lg"
									onPress={() => setDiscountModalVisible(false)}
								>
									<Text className="text-center text-gray-700 font-medium">
										{loc.t('cancel') || 'Cancel'}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									className="flex-1 bg-blue-500 py-3 rounded-lg"
									onPress={applyDiscount}
								>
									<Text className="text-center text-white font-medium">
										{loc.t('apply') || 'Apply'}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</Pressable>
				</Pressable>
			</Modal>
		)
	}

	const ShowCartItem = (product, index) => {
		const originalPrice =
			product.originalPrice || product.buyPrice || product.sellPrice
		const hasDiscount =
			product.discountAmount > 0 || product.discountPercentage > 0
		const totalPrice = product.sellPrice * product.quantity

		return (
			<View
				style={[
					styles.tableRow,
					{
						backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
						marginHorizontal: 8,
					},
				]}
			>
				<View style={styles.productNameCell}>
					<ProductThumbnail
						image={product.productImage}
						name={product.productName}
						size={28}
					/>
					<View style={styles.productInfo}>
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								maxWidth: '100%',
							}}
						>
							<Text
								style={[
									styles.productNameText,
									{ flexShrink: 1, maxWidth: '85%' },
								]}
								numberOfLines={1}
								ellipsizeMode="tail"
							>
								{product.productName}
							</Text>
							<TouchableOpacity
								onPress={() => handleOpenInfoModal(product)}
								style={{ paddingLeft: 4, flexShrink: 0 }}
							>
								<MaterialCommunityIcons
									name="information-outline"
									size={14}
									color="gray"
								/>
							</TouchableOpacity>
						</View>
						{product.variantName && (
							<Text
								style={[styles.variantNameText, { maxWidth: '100%' }]}
								numberOfLines={1}
								ellipsizeMode="tail"
							>
								{product.variantName}
							</Text>
						)}
					</View>
				</View>

				<View style={styles.quantityCell}>
					<TouchableOpacity
						onPress={() => changeQuantity(product.lotId, -1)}
						style={styles.quantityButton}
					>
						<MaterialIcons name="remove" size={16} color="#666" />
					</TouchableOpacity>

					{editingQuantityId === product.lotId ? (
						<TextInput
							style={[
								styles.quantityValueContainer,
								{ minWidth: 40, textAlign: 'center', color: '#374151' },
							]}
							value={inlineQuantityValue}
							onChangeText={setInlineQuantityValue}
							keyboardType="numeric"
							placeholderTextColor="#9CA3AF"
							autoFocus={true}
							onBlur={finishInlineQuantityEdit}
							onSubmitEditing={finishInlineQuantityEdit}
							blurOnSubmit={true}
						/>
					) : (
						<TouchableOpacity
							onPress={() => startInlineQuantityEdit(product)}
							style={styles.quantityValueContainer}
						>
							<Text style={styles.quantityText}>
								{translateNumber(product.quantity)}
							</Text>
						</TouchableOpacity>
					)}

					<TouchableOpacity
						onPress={() => changeQuantity(product.lotId, 1)}
						style={styles.quantityButton}
					>
						<MaterialIcons name="add" size={16} color="#666" />
					</TouchableOpacity>
				</View>

				<TouchableOpacity
					style={styles.sellPriceCell}
					onPress={() => openDiscountModal(product)}
					activeOpacity={0.7}
				>
					<View style={styles.priceContainer}>
						<Text style={styles.priceText}>{translateNumber(totalPrice)}</Text>
					</View>
					{hasDiscount && (
						<Text style={styles.originalPriceText}>
							{translateNumber(originalPrice * product.quantity)}
						</Text>
					)}
				</TouchableOpacity>

				<View style={styles.deleteButtonCell}>
					<TouchableOpacity
						onPress={() => removeItemFromCart(product.lotId)}
						className="p-1"
					>
						<MaterialIcons name="delete" size={14} color="red" />
					</TouchableOpacity>
				</View>
			</View>
		)
	}

	useEffect(() => {
		let totalProductsCount = 0
		let priceSum = 0
		cartProducts.forEach((item) => {
			totalProductsCount += Number(item.quantity)
			// Use the already discounted sellPrice * quantity
			// No need to apply discount again since sellPrice is already the final discounted price
			let localTotal = Number(item.quantity) * Number(item.sellPrice)
			priceSum += localTotal
		})
		setTotalPrice(priceSum)
		setTotalProducts(cartProducts.length)
	}, [cartProducts])

	//NOTE: search
	const fetchSearchData = async (searchTerm) => {
		const params = {
			searchTerm: searchTerm,
		}
		try {
			const result = await fetchData(
				getAllProductsFromShop,
				params,
				localProductController.getProductsFromShop,
				'read'
			)
			if (!result.success) {
				throw 'API Error'
			}
			return result.data.data
		} catch (err) {
			console.error('🚀 err : ', err)
		}
	}
	//TODO: improve this component. Search item row is rendered here
	const renderSearchItem = (item) => {
		// Example item structure:
		// {
		//     "createdAt": "2025-08-01T05:13:58.402Z",
		//     "id": "shop-variant-001",
		//     "lastSoldDate": "2024-01-15T10:30:00.000Z",
		//     "lowStock": 20,
		//     "lowStockSMS": true,
		//     "name": "Premium Basmati Rice",
		//     "notSoldSMS": true,
		//     "notifyAfterNotSold": 30,
		//     "notifyAt": null,
		//     "packOf": 5,
		//     "productID": "inventory-001",
		//     "shopID": "shop-001",
		//     "totalProducts": 150,
		//     "updatedAt": "2025-08-01T05:13:58.402Z",
		//     "variantCode": "RICE-5KG-PREM",
		//     "variantName": "5kg Premium Pack"
		// }
		return (
			<View>
				<Text>
					{item?.name} ({item?.variantName})
				</Text>
			</View>
		)
	}
	const handleSearchSelect = (item) => {
		// Clear the search box text
		searchBarRef.current?.clear && searchBarRef.current.clear()
		setIsSearchFocused(false)

		setShowSellFlow(true)
		const { product, ...variant } = item
		setNewProductData((prev) => product)
		handleVariantSelection(variant, product)
	}

	const resetProductSelection = () => {
		setSelectedVariant(null)
		setSelectedLot(null)
		setLotData(null)
		setVariantData(null)
		setNewProductData(null)
	}

	return (
		<KeyboardAvoidingView
			style={{ flex: 1 }}
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
		>
			<Pressable
				className="flex-1 bg-bgColor"
				onPress={() => {
					if (isSearchFocused) {
						searchBarRef.current?.blur && searchBarRef.current.blur()
						searchBarRef.current?.clear && searchBarRef.current.clear()
						setIsSearchFocused(false)
					}
				}}
			>
				{/* Header Section */}
				<View className="bg-primaryTheme p-4 pb-4 border-b-4 border-b-pageHeaderFooterBorder">
					<Pressable
						onPress={(e) => e.stopPropagation()}
						style={{ zIndex: 1000 }}
					>
						<SearchBar
							ref={searchBarRef}
							{...({
								fetchSearchData,
								onSelect: handleSearchSelect,
								placeholder:
									loc.t('transactions.searchPlaceholder') ||
									'Product / Variant / Code',
								renderItem: renderSearchItem,
								debounceDelay: 0,
								onFocusChange: (f) => setIsSearchFocused(f),
								filterMode: true,
							} as any)}
						/>
					</Pressable>
					<View className="flex-row justify-evenly mt-2" style={{ zIndex: 1 }}>
						<View className="flex-row">
							<View className="flex-row gap-4 border-white items-center">
								<MaterialCommunityIcons
									name="package-variant-closed"
									size={24}
									color="gold"
								/>
								<Text className="bg-white p-3 rounded-full px-12">
									{translateNumber(totalProducts)}
								</Text>
							</View>
						</View>

						<View className="flex-row">
							<View className="flex-row gap-2 border-white items-center">
								<MaterialCommunityIcons
									name="currency-bdt"
									size={24}
									color="gold"
								/>
								<Text className="bg-white p-3 rounded-full px-12">
									{translateAmount(totalPrice)}
								</Text>
							</View>
						</View>
					</View>
				</View>

				{/* Table Section */}
				<View className="flex-1">
					{/* Table header */}
					<View style={[styles.tableHeader, { marginHorizontal: 8 }]}>
						<View style={styles.productNameCell}>
							<Text style={styles.headerText}>
								{loc.t('transactions.tableHeader.productName')}
							</Text>
						</View>
						<View style={styles.quantityCell}>
							<Text style={styles.headerText}>
								{loc.t('transactions.tableHeader.quantity')}
							</Text>
						</View>
						<View style={styles.sellPriceCell}>
							<Text style={styles.headerText}>
								{loc.t('transactions.tableHeader.totalPrice') || 'Total Price'}
							</Text>
						</View>
						<View style={styles.deleteButtonCell}>
							<Text style={styles.headerText}>{''}</Text>
						</View>
					</View>

					<FlatList
						data={cartProducts}
						renderItem={({ item, index }) => ShowCartItem(item, index)}
						keyExtractor={(item) => item.lotId}
						ListFooterComponent={() =>
							cartProducts.length > 0 && (
								<View className="items-center py-4">
									<TouchableOpacity
										onPress={() => setShowClearModal(true)}
										activeOpacity={0.7}
									>
										<Text
											numberOfLines={1}
											textBreakStrategy="simple"
											className="text-red-500 text-base font-medium"
										>
											{loc.t('transactions.clearCart') || 'Clear Cart'}
										</Text>
									</TouchableOpacity>
								</View>
							)
						}
					/>
				</View>

				{/* Input methods */}
				{!isSearchFocused && !editingQuantityId && (
					<View className="flex-row items-center gap-10 justify-center p-4">
						<Pressable
							onPress={() => {
								setIsScanning(true)
								setCurrentFlow(0)
								setShowSellFlow(true)
							}}
						>
							<View className="bg-scanKeyboardBg items-center rounded-3xl px-6 py-4">
								<Barcode width={100} height={65} />
								<Text className="text-xl mx-1 text-white">
									{loc.t('barcodeScanBtn')}
								</Text>
							</View>
						</Pressable>
						<Pressable
							onPress={() => {
								// Close any scanning/modal flow and focus search input instead
								setShowSellFlow(false)
								setIsScanning(false)
								setCurrentFlow(0)
								// Use RAF to ensure layout settled before focusing
								requestAnimationFrame(() => {
									searchBarRef.current?.focus()
								})
							}}
						>
							<View className="bg-scanKeyboardBg items-center rounded-3xl px-6 py-4">
								<KeyboardIcon width={100} height={65} />
								<Text className="text-xl mx-1 text-white">
									{loc.t('manualInputBtn')}
								</Text>
							</View>
						</Pressable>
					</View>
				)}

				{/* Action button */}
				<View className="mx-4">
					<TouchableOpacity
						onPress={() => {
							if (cartProducts.length === 0) {
								ToastAndroid.show(
									loc.t('transactions.cartEmptyError'),
									ToastAndroid.SHORT
								)
								return
							}
							setCurrentFlow(5)
							setShowSellFlow(true)
						}}
					>
						<View className="bg-btnPrimary items-center rounded-full py-2 mx-4 mb-4">
							<Text className="text-xl mt-2 mb-2 text-white">
								{loc.t('common.next')}
							</Text>
						</View>
					</TouchableOpacity>
				</View>

				{showSellFlow && handleScannedFLow()}
				{renderProductInfoModal()}
				{renderQuantityEditModal()}
				{renderDiscountModal()}
				{/* receipt components */}
				{Receipt({
					isVisible: generateReceipt,
					setIsVisible: setGenerateReceipt,
					receiptData: receiptData,
					resetCart: resetCart,
					shopName: authState.shopName,
				})}
				{renderClearConfirmModal()}

				{/* Product Not Found Modal */}
				<CloseModal
					visible={showProductNotFoundModal}
					title={loc.t('productNotFound') || 'Product Not Found'}
					subtitle={
						loc.t('productNotFoundMessage') ||
						'Product not found in inventory. Would you like to add it manually?'
					}
					onClose={() => setShowProductNotFoundModal(false)}
					onConfirm={handleAddManually}
				/>
			</Pressable>
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	tableHeader: {
		flexDirection: 'row',
		backgroundColor: '#F3F4F6',
		borderBottomWidth: 1,
		borderBottomColor: '#E5E7EB',
		height: 40,
	},
	tableRow: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: '#F3F4F6',
	},
	productNameCell: {
		paddingVertical: 4,
		justifyContent: 'flex-start',
		width: '50%',
		alignItems: 'center',
		flexDirection: 'row',
		paddingHorizontal: 4,
	},
	productInfo: {
		flex: 1,
		marginLeft: 8,
		justifyContent: 'center',
	},
	quantityCell: {
		paddingVertical: 4,
		justifyContent: 'center',
		alignItems: 'center',
		width: '25%',
		flexDirection: 'row',
		minHeight: 48,
	},
	sellPriceCell: {
		paddingVertical: 4,
		justifyContent: 'center',
		width: '19%',
		alignItems: 'center',
		paddingHorizontal: 2,
		minHeight: 48,
	},
	deleteButtonCell: {
		width: '6%',
		paddingVertical: 4,
		justifyContent: 'center',
		alignItems: 'center',
		flexDirection: 'row',
		marginRight: 5,
	},
	headerText: {
		fontSize: 14,
		fontWeight: '600',
		color: '#374151',
		textAlign: 'center',
	},
	productNameText: {
		fontSize: 13,
		color: '#111827',
		fontWeight: '500',
		textAlign: 'left',
	},
	variantNameText: {
		fontSize: 11,
		color: '#6B7280',
		fontWeight: '400',
		textAlign: 'left',
		marginTop: 1,
	},
	priceText: {
		fontSize: 14,
		color: '#111827',
		fontWeight: '400',
		textAlign: 'center',
	},
	originalPriceText: {
		fontSize: 8,
		color: '#9CA3AF',
		fontWeight: '400',
		textAlign: 'center',
		textDecorationLine: 'line-through',
		marginTop: 1,
	},
	quantityText: {
		fontSize: 14,
		color: '#111827',
		fontWeight: '400',
		textAlign: 'center',
	},
	quantityButton: {
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: '#F3F4F6',
		justifyContent: 'center',
		alignItems: 'center',
		marginHorizontal: 4,
	},
	quantityValueContainer: {
		minWidth: 30,
		paddingHorizontal: 4,
		paddingVertical: 2,
		backgroundColor: '#F9FAFB',
		borderRadius: 4,
		justifyContent: 'center',
		alignItems: 'center',
	},
	priceContainer: {
		minWidth: 50,
		paddingHorizontal: 6,
		paddingVertical: 4,
		backgroundColor: '#F9FAFB',
		borderRadius: 6,
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 1,
		borderColor: '#E5E7EB',
	},
	variantText: {
		fontSize: 13,
		color: '#6B7280',
		textAlign: 'center',
	},
	// Delete Modal Styles
	deleteModalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	deleteModalContent: {
		backgroundColor: '#FFFFFF',
		borderRadius: 16,
		padding: 24,
		alignItems: 'center',
		minWidth: 300,
	},
	warningIcon: {
		marginBottom: 16,
	},
	deleteTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#1F2937',
		marginBottom: 8,
		textAlign: 'center',
	},
	deleteMessage: {
		fontSize: 14,
		color: '#6B7280',
		textAlign: 'center',
		marginBottom: 24,
		lineHeight: 20,
	},
	deleteButtonContainer: {
		flexDirection: 'row',
		gap: 12,
		width: '100%',
	},
	deleteButton: {
		flex: 1,
		padding: 12,
		borderRadius: 8,
		alignItems: 'center',
	},
	cancelDeleteButton: {
		backgroundColor: '#E5E7EB',
	},
	confirmDeleteButton: {
		backgroundColor: '#EF4444',
	},
	cancelDeleteText: {
		color: '#6B7280',
		fontWeight: '500',
		fontSize: 14,
	},
	confirmDeleteText: {
		color: '#FFFFFF',
		fontWeight: '500',
		fontSize: 14,
	},
})
