import {
	Pressable,
	Text,
	ToastAndroid,
	View,
	KeyboardAvoidingView,
	Platform,
	TouchableWithoutFeedback,
	Keyboard,
	ScrollView,
} from 'react-native'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { BackHandler } from 'react-native'
import barCodeScanner from '../../../../../src/components/barCodeScanner'
import { useCameraPermissions } from 'expo-camera'
import ProductForm from '../../../../../src/components/inventory/productForm.jsx'
import {
	getProductFromInventoryDatabase,
	getAllLotsFromVariant,
	getAllProductsFromShop,
} from '../../../../../src/controllers/product'
import {
	addProductToShop,
	updateLot,
} from '../../../../../src/controllers/product.js'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'
import useApi from '../../../../../src/hooks/useApi.jsx'
import {
	Barcode,
	Keyboard as KeyboardIcon,
} from '../../../../../assets/index.jsx'
import { useNavigation } from '@react-navigation/native'
import { router } from 'expo-router'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import VariantSelector from '../../../../../src/components/inventory/VariantSelector.jsx'
import LotSelector from '../../../../../src/components/inventory/LotSelector.jsx'
import QuantityInput from '../../../../../src/components/inventory/QuantityInput.jsx'
import BarCodeInput from '../../../../../src/components/inventory/BarcodeInput.jsx'
import { localProductController } from '../../../../../src/controllers/offline/product.js'
import SearchBar from '../../../../../src/components/searchBar.jsx'

export default function AddInventory() {
	const { loc } = useLocalization()
	const { fetchData } = useApi()
	const [permission, requestPermission] = useCameraPermissions()
	const [isScanning, setIsScanning] = useState(false)
	const [isManual, setIsManual] = useState(false)
	const navigation = useNavigation()
	const searchBarRef = useRef(null)
	const [isSearchFocused, setIsSearchFocused] = useState(false)
	const [searchResults, setSearchResults] = useState([])
	const [hasSearched, setHasSearched] = useState(false)

	// variant bottom sheet ref
	const variantBottomSheetModalRef = useRef(null)
	// product form bottom sheet ref
	const productFromSheetModalRef = useRef(null)

	const [newProductData, setNewProductData] = useState({
		id: '',
		barcode: '',
		measuringUnit: '',
		productName: '',
		image: '',
		genericName: '',
	})

	//Store all variant array
	const [variantData, setVariantData] = useState(null)
	//Store all lot data for selected variant
	const [lotData, setLotData] = useState(null)
	//Store selected variant data
	const [selectedVariant, setSelectedVariant] = useState(null)
	//Store selected lot data
	const [selectedLot, setSelectedLot] = useState(null)

	const handleScan = async (barcode) => {
		setIsScanning(false)

		// Empty barcode -> redirect to catalog create without barcode
		if (!barcode || barcode.trim() === '') {
			ToastAndroid.show(
				loc.t('inventory.add.redirectToCatalog') ||
					'Redirecting to create product...',
				ToastAndroid.SHORT
			)
			router.push({
				pathname: '/home/inventory/details',
				params: { openCreate: '1' },
			})
			return
		}

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
				ToastAndroid.show(
					loc.t('inventory.add.productNotFoundMessage') ||
						'Product not found — redirecting to create product',
					ToastAndroid.SHORT,
					ToastAndroid.CENTER
				)
				router.push({
					pathname: '/home/inventory/details',
					params: { openCreate: '1', barcode },
				})
				return
			}

			const { variants, ...productData } = result.data
			productData.barcode = productData.barcode || barcode

			setVariantData(variants)
			setNewProductData(productData)
			setCurrentFlow(2)
		} catch (error) {
			console.error('🚨 Error fetching product info:', error)
			ToastAndroid.show(
				loc.t('inventory.add.fetchError') || 'Error fetching product info',
				ToastAndroid.SHORT,
				ToastAndroid.CENTER
			)
		}
	}

	const handleVariantSelection = async (variant) => {
		setSelectedVariant(variant)

		if (variant === null) {
			// User clicked "Create Variant" — redirect to catalog (Inventory page)
			ToastAndroid.show(
				loc.t('inventory.add.redirectToCatalog') ||
					'Redirecting to create variant...',
				ToastAndroid.SHORT
			)
			const barcode = newProductData?.barcode || ''
			const productName = newProductData?.productName || ''
			router.push({
				pathname: '/home/inventory/details',
				params: { openCreate: '1', barcode, productName },
			})
			return
		}

		try {
			// Fetch lots for the selected variant
			const result = await fetchData(getAllLotsFromVariant, variant.id)

			if (result.success && result.data && result.data.length > 0) {
				setLotData(result.data)
				setCurrentFlow(3) // Show lot selector
			} else {
				// No lots found, go directly to form to create new lot
				setLotData([])
				setCurrentFlow(5) // Show form
			}
		} catch (error) {
			console.error('🚨 Error fetching lots:', error)
			ToastAndroid.show(
				loc.t('inventory.details.fetchLotsError') || 'Error fetching lots',
				ToastAndroid.SHORT,
				ToastAndroid.CENTER
			)
			// On error, still show the form
			setCurrentFlow(5)
		}
	}

	const handleLotSelection = (lot) => {
		setSelectedLot(lot)
		setCurrentFlow(4) // Show quantity input
	}

	const handleCreateNewLot = () => {
		setSelectedLot(null)
		setCurrentFlow(5) // Show form to create new lot
	}

	const handleLotUpdate = async (data) => {
		try {
			const updateResult = await fetchData(updateLot, data)
			if (!updateResult.success) {
				ToastAndroid.show(
					loc.t('inventory.add.failedToUpdateLot') ||
						'Failed to update the lot',
					ToastAndroid.SHORT,
					ToastAndroid.CENTER
				)
			} else {
				ToastAndroid.show(
					loc.t('inventory.add.quantityUpdatedSuccessfully') ||
						'Quantity updated successfully',
					ToastAndroid.SHORT,
					ToastAndroid.CENTER
				)
			}

			// Reset and close the flow
			cancelScanFlow()
		} catch (error) {
			console.error('🚨 Error updating quantity:', error)
			ToastAndroid.show(
				loc.t('inventory.add.errorUpdatingQuantity') ||
					'Error updating quantity',
				ToastAndroid.SHORT,
				ToastAndroid.CENTER
			)
		}
	}

	const handleFormSubmit = async (formData) => {
		setShowScanFlow(false)
		setCurrentFlow(0)
		try {
			function convertToISOString(dateStr) {
				const [day, month, year] = dateStr.split('/').map(Number)
				const date = new Date(Date.UTC(year, month - 1, day)) // month is 0-based
				return date.toISOString()
			}
			if (formData.lot?.mfgDate) {
				formData.lot.mfgDate = convertToISOString(formData.lot.mfgDate)
			}
			if (formData.lot?.expDate) {
				formData.lot.expDate = convertToISOString(formData.lot.expDate)
			}
			const result = await fetchData(addProductToShop, formData)

			if (result && result.success) {
				ToastAndroid.show(
					loc.t('productAddedToInventory'),
					ToastAndroid.SHORT,
					ToastAndroid.CENTER
				)

				// Reset form after successful submission
				setNewProductData({
					id: '',
					barcode: '',
					buyPrice: '',
					measuringUnit: '',
					productName: '',
					sellPrice: '',
					quantity: '',
					genericName: '',
				})
				setIsManual(false)
			} else {
				const errorMessage = result?.error || loc.t('unknownError')
				ToastAndroid.show(errorMessage, ToastAndroid.SHORT, ToastAndroid.CENTER)
			}
		} catch (error) {
			console.error('🚨 Error adding product:', error)
			ToastAndroid.show(
				loc.t('inventory.add.addProductError') || 'Error adding product',
				ToastAndroid.SHORT,
				ToastAndroid.CENTER
			)
		}
	}

	const [currentFlow, setCurrentFlow] = useState(0)

	// Handle device back button - route to dashboard instead of previous screen
	useFocusEffect(
		useCallback(() => {
			const onBackPress = () => {
				router.push('/home/dashboard')
				return true
			}

			const subscription = BackHandler.addEventListener(
				'hardwareBackPress',
				onBackPress
			)

			return () => subscription.remove()
		}, [])
	)

	//Define the modal flow for the barcode scanner method
	const barcodeModalFlow = [
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
			}),
		},
		{
			id: 1,
			name: 'get_barcode_input',
			component: BarCodeInput,
			getProps: () => ({
				handleInputSubmit: handleScan,
				cancelScanFlow: cancelScanFlow,
			}),
		},
		{
			id: 2,
			name: 'show_variant',
			component: VariantSelector,
			getProps: () => ({
				variants: variantData,
				handleVariantSelection,
				cancelScanFlow: cancelScanFlow,
				ref: variantBottomSheetModalRef,
			}),
		},
		{
			id: 3,
			name: 'show_lot',
			component: LotSelector,
			getProps: () => ({
				lots: lotData,
				variant: selectedVariant,
				handleLotSelection: (lot) => {
					setSelectedLot(lot)
					setCurrentFlow(5) // Show form directly instead of quantity input
				},
				handleCreateNewLot: handleCreateNewLot,
				cancelScanFlow: cancelScanFlow,
				showCreate: true,
			}),
		},
		{
			id: 4,
			name: 'quantity_input',
			component: QuantityInput,
			getProps: () => ({
				lot: selectedLot,
				variant: selectedVariant,
				handleLotUpdate: handleLotUpdate,
				cancelScanFlow: cancelScanFlow,
			}),
		},
		{
			id: 5,
			name: 'show_form',
			component: ProductForm,
			getProps: () => ({
				closeForm: closeProductForm,
				handleFormSubmit,
				initialValues: {
					product: newProductData,
					variant: selectedVariant,
					lot: selectedLot,
				},
				ref: productFromSheetModalRef,
			}),
		},
	]

	const closeProductForm = () => {
		setIsManual(false)
		setCurrentFlow(0)
		setNewProductData({
			id: '',
			barcode: '',
			buyPrice: '',
			measuringUnit: '',
			productName: '',
			sellPrice: '',
			quantity: '',
			genericName: '',
		})
		setSelectedVariant(null)
		setSelectedLot(null)
		setLotData(null)
	}

	const [showScanFlow, setShowScanFlow] = useState(false)

	// When keyboard closes, ensure search bar loses focus
	useEffect(() => {
		const onHide = () => {
			setIsSearchFocused(false)
			searchBarRef.current?.blur && searchBarRef.current.blur()
		}
		const hideSub = Keyboard.addListener('keyboardDidHide', onHide)
		const willHideSub = Keyboard.addListener('keyboardWillHide', onHide)
		return () => {
			hideSub.remove()
			willHideSub.remove()
		}
	}, [])

	// Search functionality
	const fetchSearchData = async (searchTerm) => {
		// If search term is empty, clear results
		if (!searchTerm || searchTerm.trim() === '') {
			setSearchResults([])
			setHasSearched(false)
			return []
		}

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
				setSearchResults([])
				setHasSearched(true)
				return []
			}
			setSearchResults(result.data.data || [])
			setHasSearched(true)
			return result.data.data
		} catch (err) {
			console.error('🔍 Search error:', err)
			setSearchResults([])
			setHasSearched(true)
			return []
		}
	}

	const renderSearchItem = (item) => {
		return (
			<View>
				<Text className="text-base font-medium">{item.product?.name}</Text>
				{item.variantName && (
					<Text className="text-sm text-gray-500">{item.variantName}</Text>
				)}
			</View>
		)
	}

	const handleSearchSelect = (item) => {
		// Clear the search box text
		searchBarRef.current?.clear && searchBarRef.current.clear()

		setShowScanFlow(true)
		const { product, ...variant } = item
		setNewProductData((prev) => product)
		handleVariantSelection(variant, product)
	}

	const handleProductSelect = async (product) => {
		// Get all variants for this product
		try {
			const result = await fetchData(getProductFromInventoryDatabase, {
				barcode: product.barcode,
			})

			if (result.success) {
				const { variants, ...ProductData } = result.data
				setNewProductData(ProductData)
				setVariantData(variants)
				setShowScanFlow(true)
				setCurrentFlow(2) // Show variant selector
				setIsSearchFocused(false)
			}
		} catch (error) {
			console.error('🚨 Error fetching variants:', error)
			ToastAndroid.show(
				loc.t('inventory.add.fetchError') || 'Error fetching variants',
				ToastAndroid.SHORT,
				ToastAndroid.CENTER
			)
		}
	}

	const handleVariantSelect = async (item) => {
		const { product, ...variant } = item
		setNewProductData(product)
		setSelectedVariant(variant)

		// Fetch lots for the selected variant
		try {
			const result = await fetchData(getAllLotsFromVariant, variant.id)

			if (result.success && result.data && result.data.length > 0) {
				setLotData(result.data)
				setShowScanFlow(true)
				setCurrentFlow(3) // Show lot selector
				setIsSearchFocused(false)
			} else {
				// No lots found, go directly to form to create new lot
				setLotData([])
				setShowScanFlow(true)
				setCurrentFlow(5) // Show form
				setIsSearchFocused(false)
			}
		} catch (error) {
			console.error('🚨 Error fetching lots:', error)
			ToastAndroid.show(
				loc.t('inventory.details.fetchLotsError') || 'Error fetching lots',
				ToastAndroid.SHORT,
				ToastAndroid.CENTER
			)
			// On error, still show the form
			setShowScanFlow(true)
			setCurrentFlow(5)
			setIsSearchFocused(false)
		}
	}

	const handleCreateNewProduct = () => {
		// Redirect to Inventory catalog create (product+variants, no lot)
		searchBarRef.current?.clear && searchBarRef.current.clear()
		setIsSearchFocused(false)
		ToastAndroid.show(
			loc.t('inventory.add.redirectToCatalog') ||
				'Redirecting to create product...',
			ToastAndroid.SHORT
		)
		router.push({
			pathname: '/home/inventory/details',
			params: { openCreate: '1' },
		})
	}

	// Group search results by product
	const groupResultsByProduct = () => {
		const productMap = new Map()
		const allVariants = []

		searchResults.forEach((item) => {
			const productId = item.product?.id
			if (!productId) return

			// Add unique products
			if (!productMap.has(productId)) {
				productMap.set(productId, item.product)
			}

			// Collect all variants
			allVariants.push(item)
		})

		return {
			products: Array.from(productMap.values()),
			variants: allVariants,
		}
	}

	//Show Barcode scanner flow
	const handleScannedFLow = () => {
		const CurrentStep = barcodeModalFlow[currentFlow]
		const StepComponent = CurrentStep?.component
		const stepProps = CurrentStep?.getProps ? CurrentStep.getProps() : {}

		return <>{StepComponent && <StepComponent {...stepProps} />}</>
	}

	const cancelScanFlow = () => {
		setShowScanFlow(false)
		setCurrentFlow(0)
		setIsScanning(false)
		setSelectedVariant(null)
		setSelectedLot(null)
		setLotData(null)
		setVariantData(null)
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
			style={{ flex: 1 }}
			keyboardVerticalOffset={0}
			enabled
		>
			<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
				<View className="bg-bgColor flex-1">
					{/* Search Bar */}
					<View className="bg-primaryTheme p-4 pb-4 border-b-4 border-b-pageHeaderFooterBorder">
						<SearchBar
							ref={searchBarRef}
							placeholder={
								loc.t('inventory.add.searchPlaceholder') || 'Search products...'
							}
							fetchSearchData={fetchSearchData}
							renderItem={renderSearchItem}
							onSelect={handleSearchSelect}
							debounceDelay={300}
							onFocusChange={(f) => setIsSearchFocused(f)}
							filterMode={false}
							showSearchResult={false}
						/>
					</View>
					{/* Content Area - Search Results or Create Button */}
					<View className="flex-1">
						{hasSearched && searchResults.length > 0 ? (
							<ScrollView
								className="flex-1 px-4 pt-4"
								showsVerticalScrollIndicator={true}
								contentContainerStyle={{ paddingBottom: 16 }}
							>
								{(() => {
									const { products, variants } = groupResultsByProduct()
									return (
										<>
											{/* Products Section */}
											{products.length > 0 && (
												<View className="mb-6">
													<Text className="text-sm font-semibold text-gray-500 mb-2 uppercase">
														{loc.t('inventory.add.products') || 'Products'}
													</Text>
													{products.map((product, productIndex) => (
														<Pressable
															key={productIndex}
															onPress={() => handleProductSelect(product)}
														>
															<View className="bg-white rounded-lg p-4 flex-row items-center justify-between shadow-sm border border-gray-200 mb-2">
																<Text className="text-base font-medium text-gray-800">
																	{product.productName}
																</Text>
																<MaterialCommunityIcons
																	name="arrow-right"
																	size={24}
																	color="#3B82F6"
																/>
															</View>
														</Pressable>
													))}
												</View>
											)}

											{/* Variants Section */}
											{variants.length > 0 && (
												<View>
													<Text className="text-sm font-semibold text-gray-500 mb-2 uppercase">
														{loc.t('inventory.add.variants') || 'Variants'}
													</Text>
													{variants.map((variant, variantIndex) => (
														<Pressable
															key={variantIndex}
															onPress={() => handleVariantSelect(variant)}
														>
															<View className="bg-white rounded-lg p-4 flex-row items-center justify-between shadow-sm border border-gray-200 mb-2">
																<Text className="text-base text-gray-800">
																	{variant.product.productName}{' '}
																	<Text className="font-medium">
																		[{variant.variantName}]
																	</Text>
																</Text>
																<MaterialCommunityIcons
																	name="arrow-right"
																	size={24}
																	color="#3B82F6"
																/>
															</View>
														</Pressable>
													))}
												</View>
											)}
										</>
									)
								})()}
							</ScrollView>
						) : hasSearched && searchResults.length === 0 ? (
							<View className="items-center justify-center flex-1">
								<Pressable onPress={handleCreateNewProduct}>
									<View className="items-center">
										<View className="bg-scanKeyboardBg rounded-full p-4 mb-4">
											<MaterialCommunityIcons
												name="plus"
												size={42}
												color="white"
											/>
										</View>
										<Text
											className="text-base font-medium text-gray-700"
											numberOfLines={1}
										>
											{loc.t('inventory.add.createNewProduct') ||
												'Create New Product'}
										</Text>
									</View>
								</Pressable>
							</View>
						) : (
							!isSearchFocused && (
								<View className="items-center justify-center flex-1">
									<Pressable onPress={handleCreateNewProduct}>
										<View className="items-center">
											<View className="bg-scanKeyboardBg rounded-full p-4 mb-4">
												<MaterialCommunityIcons
													name="plus"
													size={42}
													color="white"
												/>
											</View>
											<Text
												className="text-base font-medium text-gray-700"
												numberOfLines={1}
											>
												{loc.t('inventory.add.createNewProduct') ||
													'Create New Product'}
											</Text>
										</View>
									</Pressable>
								</View>
							)
						)}
					</View>

					{/* Bottom Buttons - Always visible when not searching */}
					{!isSearchFocused && (
						<View>
							<View className="flex-row gap-10 justify-center p-4">
								<Pressable
									onPress={() => {
										setIsScanning(true)
										setCurrentFlow(0)
										setShowScanFlow(true)
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
										// Focus on search bar instead of showing barcode input
										searchBarRef.current?.focus && searchBarRef.current.focus()
										setIsSearchFocused(true)
									}}
								>
									<View className="bg-scanKeyboardBg items-center rounded-3xl px-6 py-4 ">
										<KeyboardIcon width={100} height={65} />
										<Text className="text-xl mx-1 text-white">
											{loc.t('manualInputBtn')}
										</Text>
									</View>
								</Pressable>
							</View>
							<View className="my-2">
								<Pressable onPress={() => navigation.navigate('details')}>
									<View className="bg-btnPrimary items-center rounded-full py-2 mx-4 mb-4">
										<Text className="text-xl mt-2 mb-2 text-white">
											{loc.t('showInventory')}
										</Text>
									</View>
								</Pressable>
							</View>
						</View>
					)}
					{/* eof Input Method*/}
					{showScanFlow && handleScannedFLow()}
				</View>
			</TouchableWithoutFeedback>
		</KeyboardAvoidingView>
	)
}
