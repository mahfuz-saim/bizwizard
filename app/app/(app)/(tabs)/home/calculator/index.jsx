import {
	Text,
	TouchableOpacity,
	View,
	FlatList,
	ToastAndroid,
	TextInput,
	Modal,
	StyleSheet,
} from 'react-native'
import { useState } from 'react'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import Receipt from '../../../../../src/components/receipt/Receipt'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import { useAuth } from '../../../../../src/context/AuthContext'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator.jsx'
import useApi from '../../../../../src/hooks/useApi.jsx'
import {
	getProductByVariantCode,
	getAllLotsFromVariant,
} from '../../../../../src/controllers/product.js'
import { localProductController } from '../../../../../src/controllers/offline/product.js'
import LotSelector from '../../../../../src/components/inventory/LotSelector.jsx'
import { shopController } from '../../../../../src/controllers/shop.js'
import { ErrorModal } from '../../../../../src/components/AlertModal.jsx'
function SmartCalculatorTable({
	cartProducts,
	onQuantityChange,
	onQuantityEdit,
}) {
	const { loc } = useLocalization()
	const { translateNumber, translateAmount } = useNumberTranslator()

	const tableHeader = () => {
		return (
			<View className="flex-row justify-between bg-tableRowHeaderBg py-2 rounded-t-lg">
				<Text className="w-1/3 text-center text-lg font-semibold">
					{loc.t('calculator.product') || 'Product'}
				</Text>
				<Text className="w-1/3 text-center text-lg font-semibold">
					{loc.t('calculator.qty') || 'Qty'}
				</Text>
				<Text className="w-1/3 text-center text-lg font-semibold">
					{loc.t('calculator.price') || 'Price'}
				</Text>
			</View>
		)
	}

	const tableRow = (rowData, index) => {
		return (
			<View className="flex-row items-center py-3 border-b border-gray-200">
				<View className="w-1/3 pr-2">
					<Text className="text-left" numberOfLines={1} ellipsizeMode="tail">
						{rowData.name ||
							`${loc.t('calculator.item') || 'Item'} ${translateNumber(
								index + 1
							)}`}
					</Text>
				</View>

				<View className="w-1/3 flex-row items-center justify-center">
					<TouchableOpacity onPress={() => onQuantityChange(index, -1)}>
						<MaterialCommunityIcons
							name="minus-circle-outline"
							size={20}
							color="#ef4444"
						/>
					</TouchableOpacity>
					<TouchableOpacity onPress={() => onQuantityEdit(index)}>
						<Text className="mx-1 text-center min-w-4 text-lg font-medium">
							{translateNumber(rowData.quantity)}
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => onQuantityChange(index, 1)}
						className="p-1"
					>
						<MaterialCommunityIcons
							name="plus-circle-outline"
							size={20}
							color="#22c55e"
						/>
					</TouchableOpacity>
				</View>
				<View className="w-1/3 flex-row items-center justify-between pl-2">
					<Text className="text-center font-medium flex-1">
						{translateAmount(Number(rowData.unitPrice), {
							currencySymbol: '৳',
							decimalPlaces: 0,
						})}
					</Text>
					<TouchableOpacity
						onPress={() => onQuantityChange(index, 'delete')}
						className="items-center"
					>
						<MaterialCommunityIcons
							name="delete-outline"
							size={20}
							color="#ef4444"
						/>
					</TouchableOpacity>
				</View>
			</View>
		)
	}

	return (
		<View className="flex-1 my-2 bg-white rounded-lg shadow-sm">
			{tableHeader()}
			<FlatList
				data={cartProducts}
				renderItem={({ item, index }) => tableRow(item, index)}
				keyExtractor={(item, index) => index.toString()}
				showsVerticalScrollIndicator={false}
			/>
		</View>
	)
}

function SmartCalculator() {
	const { authState } = useAuth()
	const { loc } = useLocalization()
	const {
		translateNumber,
		translateAmount,
		toEnglishNumbers,
		prepareReceiptData,
		prepareReceiptTotal,
	} = useNumberTranslator()
	const { fetchData } = useApi()

	// Input states
	const [productCode, setProductCode] = useState('')
	const [quantity, setQuantity] = useState('1')
	const [price, setPrice] = useState('')

	// UI states
	const [currentMode, setCurrentMode] = useState('price') // 'product', 'quantity', 'price'
	const [cartProducts, setCartProducts] = useState([])
	const [cartTotal, setCartTotal] = useState(0)
	const [isCheckout, setIsCheckout] = useState(false)
	const [showErrorModal, setShowErrorModal] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')
	const [showQuantityModal, setShowQuantityModal] = useState(false)
	const [editingQuantityIndex, setEditingQuantityIndex] = useState(null)
	const [newQuantityValue, setNewQuantityValue] = useState('')

	// Calculate total whenever cart changes
	const calculateTotal = (products) => {
		return products.reduce((total, item) => {
			return total + Number(item.unitPrice) * Number(item.quantity)
		}, 0)
	}

	// Handle product code fetch (placeholder for future implementation)
	const fetchProduct = async (code) => {
		// TODO: Implement product fetching logic
		console.log('Fetching product with code:', code)
		// For now, just return a mock product
		return {
			productName: `${
				loc.t('calculator.product') || 'Product'
			} ${translateNumber(code)}`,
			sellPrice: '10.00',
			barcode: code,
			unit: 'pcs',
		}
	}

	// Handle mode switching
	const switchMode = (mode) => {
		if (mode === 'price') {
			if (!isCustomLot) {
				ToastAndroid.show(
					'You cant change price for the selected lot',
					ToastAndroid.SHORT
				)
				setCurrentMode('quantity')
				return
			}
		}

		setCurrentMode(mode)
	}

	// Handle calculator button press
	const handlePress = (item) => {
		switch (true) {
			case item.value === 'P':
				switchMode('product')
				break
			case item.value === 'Q':
				switchMode('quantity')
				break
			case item.value === 'T':
				switchMode('price')
				break
			case item.value === 'clear':
				if (currentMode === 'product') setProductCode('')
				else if (currentMode === 'quantity') setQuantity('1')
				else if (currentMode === 'price') setPrice('')
				break
			case item.value === 'reset':
				setProductCode('')
				setQuantity('1')
				setPrice('')
				setCartProducts([])
				setCartTotal(0)
				setIsCustomLot(true)
				break
			case item.value === '00' || item.value === '0' || item.value === '.':
				handleNumberInput(item.value)
				break
			case item.value >= '1' && item.value <= '9':
				handleNumberInput(item.value)
				break
			case item.value === 'backspace':
				handleBackspace()
				break
			case item.value === 'enter':
				if (currentMode === 'product') {
					handleProductEnter()
				} else if (currentMode === 'quantity') {
					handleQuantityEnter()
				} else if (currentMode === 'price') {
					handlePriceEnter()
				}
				break
			case item.value === 'complete':
				handleCheckOut()

				break
		}
	}

	const [showLotSelector, setShowLotSelector] = useState(false)
	const [lotData, setLotData] = useState(null)
	const [variantData, setVariantData] = useState(null)
	const [isCustomLot, setIsCustomLot] = useState(true)
	const [lotItems, setLotItems] = useState([])
	const [customItems, setCustomItems] = useState([])
	const [selecctedLot, setSelectedLot] = useState(null)
	const handleLotSelection = (item) => {
		setSelectedLot(item)
		setShowLotSelector(false)
		setPrice(item.sellPrice)
		setIsCustomLot(false)
		setCurrentMode('quantity')
	}
	const handleProductEnter = async () => {
		const result = await fetchData(
			getProductByVariantCode,
			{
				variantCode: productCode,
			},
			localProductController.getProductByVariantCode,
			'read'
		)

		if (!result?.success) {
			ToastAndroid.show('No Product Found', ToastAndroid.SHORT)
			return
		}

		const { product: ProductData, ...variant } = result.data

		const lotResult = await fetchData(getAllLotsFromVariant, result.data.id)
		const Lot = lotResult?.data || []
		setVariantData(variant)
		setLotData(Lot)
		setShowLotSelector(true)
	}
	const handlePriceEnter = () => {
		const parsedPrice = parseFloat(price)
		const parseQty = parseFloat(quantity)

		if (parsedPrice <= 0 || isNaN(parsedPrice)) {
			setCurrentMode('price')
			return
		} else if (parseQty <= 0 || isNaN(parseQty)) {
			setCurrentMode('quantity')
			return
		}
		addItemsToCart()
	}
	const handleQuantityEnter = () => {
		const parsedPrice = parseFloat(price)
		const parseQty = parseFloat(quantity)

		if (parseQty <= 0 || isNaN(parseQty)) {
			setCurrentMode('quantity')
			return
		} else if (parsedPrice <= 0 || isNaN(parsedPrice)) {
			setCurrentMode('price')
			return
		}
		addItemsToCart()
		ToastAndroid.show(
			loc.t('calculator.productAddedToCart'),
			ToastAndroid.SHORT
		)
	}
	const addItemsToCart = () => {
		let cartRowData = null
		if (isCustomLot) {
			cartRowData = {
				name: loc.t('calculator.unknownProduct') || 'Unknown Product',
				quantity: quantity,
				unitPrice: price,
				discountAmount: 0,
				discountPercentage: 0,
				discountType: 'AMOUNT',
			}
			setCustomItems((prev) => [...prev, cartRowData])
		} else {
			cartRowData = {
				name: variantData.name || productCode,
				quantity: quantity,
				unitPrice: price,
				discountAmount: 0,
				discountPercentage: 0,
				discountType: 'AMOUNT',
			}
			setLotItems((prev) => [
				...prev,
				{
					lotId: selecctedLot.id,
					quantity: quantity,
					discountAmount: 0,
					discountPercentage: 0,
					discountType: 'AMOUNT',
				},
			])
		}
		setCartProducts((prev) => {
			const newProducts = [...prev, cartRowData]
			setCartTotal(calculateTotal(newProducts))
			return newProducts
		})
		//reset inputs
		resetInputs()
	}

	const resetInputs = () => {
		setProductCode('')
		setQuantity('1')
		setPrice('')
		setCurrentMode('price')
		setIsCustomLot(true)
		setLotData(null)
		setVariantData(null)
		setSelectedLot(null)
	}
	const handleCheckOut = async () => {
		if (cartProducts.length === 0) {
			ToastAndroid.show(
				loc.t('calculator.noItemsInCart') || 'No items in cart to checkout',
				ToastAndroid.SHORT
			)
			return
		}
		const result = await fetchData(shopController.quickSellProduct, {
			customItems: customItems,
			lotItems: lotItems,
			cart: {
				discountAmount: 0,
				discountPercentage: 0,
				discountPercentage: 'PERCENTAGE',
				isDraft: false,
				txnInfo: {
					sendSMS: false,
				},
			},
		})
		if (!result?.success) {
			//TODO: handle error
			ToastAndroid.show('Failed to complete the transaction', ToastAndroid.LONG)
			return
		}
		ToastAndroid.show(
			loc.t('calculator.sellSuccessful') || 'Product Sold Successfully',
			ToastAndroid.SHORT
		)
		resetCart()
	}

	const handleNumberInput = (value) => {
		switch (currentMode) {
			case 'product':
				setProductCode((prev) => prev + value)
				break
			case 'quantity':
				setQuantity((prev) => {
					if (prev === '1' && value !== '.' && value !== '0') return value
					return prev + value
				})
				break
			case 'price':
				setPrice((prev) => {
					if (prev === '' && value !== '.') return value
					return prev + value
				})
				break
		}
	}

	const handleBackspace = () => {
		switch (currentMode) {
			case 'product':
				setProductCode((prev) => prev.slice(0, -1))
				break
			case 'quantity':
				setQuantity((prev) => (prev.length > 1 ? prev.slice(0, -1) : '1'))
				break
			case 'price':
				setPrice((prev) => prev.slice(0, -1))
				break
		}
	}

	const handleEnter = async () => {
		if (!price || price === '0') {
			ToastAndroid.show(
				loc.t('calculator.enterValidPrice') || 'Please enter a valid price',
				ToastAndroid.SHORT
			)
			return
		}

		let productData = {
			barcode: productCode || '',
			productName: '',
			sellPrice: price,
			unitPrice: price,
			quantity: quantity || '1',
			unit: 'pcs',
		}

		// If product code exists, try to fetch product data
		if (productCode) {
			try {
				const fetchedProduct = await fetchProduct(productCode)
				productData = {
					...productData,
					...fetchedProduct,
					sellPrice: price || fetchedProduct.sellPrice,
					quantity: quantity || '1',
				}
			} catch (error) {
				console.log('Failed to fetch product:', error)
			}
		}

		setCartProducts((prev) => [...prev, productData])
		const newProducts = [...cartProducts, productData]
		setCartTotal(calculateTotal(newProducts))

		// Reset inputs
		setProductCode('')
		setQuantity('1')
		setPrice('')
		setCurrentMode('price')
	}

	const handleQuantityChange = (index, action) => {
		setCartProducts((prev) => {
			const newProducts = [...prev]
			if (action === 'delete') {
				newProducts.splice(index, 1)
			} else {
				const currentQty = Number(newProducts[index].quantity)
				const newQty = Math.max(1, currentQty + action)
				newProducts[index].quantity = newQty.toString()
			}
			setCartTotal(calculateTotal(newProducts))
			return newProducts
		})
	}

	const handleQuantityEdit = (index) => {
		setEditingQuantityIndex(index)
		setNewQuantityValue(cartProducts[index].quantity)
		setShowQuantityModal(true)
	}

	const confirmQuantityEdit = () => {
		if (editingQuantityIndex === null) return

		// Convert Bengali input to English numbers using the hook
		const englishText = toEnglishNumbers(newQuantityValue)
		const newQty = Number(englishText)

		if (newQty > 0) {
			setCartProducts((prev) => {
				const newProducts = [...prev]
				newProducts[editingQuantityIndex].quantity = newQty.toString()
				setCartTotal(calculateTotal(newProducts))
				return newProducts
			})
		} else {
			ToastAndroid.show('Please enter a valid quantity', ToastAndroid.SHORT)
			return
		}

		setShowQuantityModal(false)
		setEditingQuantityIndex(null)
		setNewQuantityValue('')
	}

	const resetCart = () => {
		setCartTotal(0)
		setCartProducts([])
		setProductCode('')
		setQuantity('1')
		setPrice('')
		setCustomItems([])
		setLotItems([])
		setCartProducts([])
	}

	const getModeIndicator = (mode) => {
		return currentMode === mode
			? 'border-2 border-blue-500 bg-blue-50'
			: 'bg-white'
	}

	// Display translated values in the input banner
	const displayProductCode = productCode
		? translateNumber(productCode)
		: loc.t('calculator.product') || 'Product'
	const displayQuantity =
		translateNumber(quantity) || loc.t('calculator.qty') || 'Quantity'
	const displayPrice = price
		? translateNumber(price)
		: loc.t('calculator.price') || 'Price'

	return (
		<View className="flex-1 bg-bgColor">
			{/* Enhanced top banner with translated numbers */}
			<View className="bg-primaryTheme p-4">
				<View className="flex-row justify-center">
					<View
						className={`p-3 rounded-l-lg w-1/3 ${getModeIndicator('product')}`}
					>
						<Text className="text-center text-lg font-bold text-gray-800 mt-1">
							{displayProductCode}
						</Text>
					</View>
					<View className={`p-3 w-1/3 ${getModeIndicator('quantity')}`}>
						<Text className="text-center text-lg font-bold text-gray-800 mt-1">
							{displayQuantity}
						</Text>
					</View>
					<View
						className={`p-3 rounded-r-lg w-1/3 ${getModeIndicator('price')}`}
					>
						<Text className="text-center text-lg font-bold text-gray-800 mt-1">
							{displayPrice}
						</Text>
					</View>
				</View>
			</View>

			{/* Enhanced table */}
			<View className="px-4 flex-1">
				<SmartCalculatorTable
					cartProducts={cartProducts}
					onQuantityChange={handleQuantityChange}
					onQuantityEdit={handleQuantityEdit}
				/>
			</View>

			{/* Enhanced calculator */}
			<View className="px-4 pb-4">
				{/* Total display with translated amount */}
				<View className="bg-white rounded-lg p-2 mb-2 shadow-sm">
					<Text className="text-center text-lg font-bold">
						{loc.t('calculator.total') || 'Total'}:{' '}
						{translateAmount(cartTotal, {
							currencySymbol: '৳ ',
							decimalPlaces: 2,
						})}
					</Text>
				</View>

				<View className="flex-row flex-wrap justify-between">
					{/* Mode selection buttons with localized labels */}
					<TouchableOpacity
						className="w-[23%] mb-2"
						onPress={() => switchMode('product')}
					>
						<Text
							className={`p-3 rounded-xl text-center font-medium text-sm ${
								currentMode === 'product'
									? 'bg-blue-500 text-white'
									: 'bg-color_3'
							}`}
						>
							{loc.t('calculator.product') || 'Product'}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className="w-[23%] mb-2"
						onPress={() => switchMode('quantity')}
					>
						<Text
							className={`p-3 rounded-xl text-center font-medium text-sm ${
								currentMode === 'quantity'
									? 'bg-blue-500 text-white'
									: 'bg-color_3'
							}`}
						>
							{loc.t('calculator.qty') || 'Qty'}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className="w-[23%] mb-2"
						onPress={() => switchMode('price')}
					>
						<Text
							className={`p-3 rounded-xl text-center font-medium text-sm ${
								currentMode === 'price'
									? 'bg-blue-500 text-white'
									: 'bg-color_3'
							}`}
						>
							{loc.t('calculator.price') || 'Price'}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className="w-[23%] mb-2"
						onPress={() => handlePress({ name: 'Clear', value: 'clear' })}
					>
						<Text className="bg-red-400 text-white p-3 rounded-xl text-center font-medium">
							{loc.t('calculator.clear') || 'C'}
						</Text>
					</TouchableOpacity>

					{/* Number buttons - display translated numbers */}
					{['1', '2', '3'].map((num) => (
						<TouchableOpacity
							key={num}
							className="w-[23%] mb-2"
							onPress={() => handlePress({ name: num, value: num })}
						>
							<Text className="bg-color_3 p-3 rounded-xl text-center font-medium">
								{translateNumber(num)}
							</Text>
						</TouchableOpacity>
					))}

					<TouchableOpacity
						className="w-[23%] mb-2"
						onPress={() => handlePress({ name: '⌫', value: 'backspace' })}
					>
						<Text className="bg-orange-400 text-white p-3 rounded-xl text-center font-medium">
							⌫
						</Text>
					</TouchableOpacity>

					{['4', '5', '6'].map((num) => (
						<TouchableOpacity
							key={num}
							className="w-[23%] mb-2"
							onPress={() => handlePress({ name: num, value: num })}
						>
							<Text className="bg-color_3 p-3 rounded-xl text-center font-medium">
								{translateNumber(num)}
							</Text>
						</TouchableOpacity>
					))}

					<TouchableOpacity
						className="w-[23%] mb-2"
						onPress={() => handlePress({ name: '.', value: '.' })}
					>
						<Text className="bg-color_3 p-3 rounded-xl text-center font-medium">
							.
						</Text>
					</TouchableOpacity>

					{['7', '8', '9'].map((num) => (
						<TouchableOpacity
							key={num}
							className="w-[23%] mb-2"
							onPress={() => handlePress({ name: num, value: num })}
						>
							<Text className="bg-color_3 p-3 rounded-xl text-center font-medium">
								{translateNumber(num)}
							</Text>
						</TouchableOpacity>
					))}

					<TouchableOpacity
						className="w-[23%] mb-2"
						onPress={() => handlePress({ name: 'Reset', value: 'reset' })}
					>
						<Text className="bg-orange-400 text-white p-3 rounded-xl text-center font-medium">
							{loc.t('calculator.reset') || 'Reset'}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className="w-[23%] mb-2"
						onPress={() => handlePress({ name: '00', value: '00' })}
					>
						<Text className="bg-color_3 p-3 rounded-xl text-center font-medium">
							{translateNumber('00')}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className="w-[23%] mb-2"
						onPress={() => handlePress({ name: '0', value: '0' })}
					>
						<Text className="bg-color_3 p-3 rounded-xl text-center font-medium">
							{translateNumber('0')}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className="w-[23%] mb-2"
						onPress={() => handlePress({ name: 'Enter', value: 'enter' })}
					>
						<Text className="bg-color_6 text-white p-3 rounded-xl text-center font-medium">
							{loc.t('calculator.enter') || 'Enter'}
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						className="w-[23%] mb-2"
						onPress={() => handlePress({ name: 'Pay', value: 'complete' })}
					>
						<Text className="bg-green-500 text-white p-3 rounded-xl text-center font-medium">
							{loc.t('calculator.receipt') || 'Receipt'}
						</Text>
					</TouchableOpacity>
				</View>
			</View>

			{/* Receipt component with English numbers using hook functions */}
			{Receipt({
				isVisible: isCheckout,
				setIsVisible: setIsCheckout,
				cartData: prepareReceiptData(cartProducts),
				cartTotal: prepareReceiptTotal(cartTotal),
				resetCart: resetCart,
				shopName: authState.shopName,
			})}
			{showLotSelector && (
				<LotSelector
					lots={lotData}
					variant={variantData}
					handleLotSelection={handleLotSelection}
					handleCreateNewLot={null}
					cancelScanFlow={() => setShowLotSelector(false)}
					showCreate={false}
				></LotSelector>
			)}

			{/* Error Modal */}
			<ErrorModal
				visible={showErrorModal}
				onClose={() => setShowErrorModal(false)}
				message={errorMessage}
			/>

			{/* Quantity Edit Modal */}
			<Modal
				visible={showQuantityModal}
				transparent={true}
				animationType="fade"
				onRequestClose={() => setShowQuantityModal(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContent}>
						<Text style={styles.modalTitle}>
							{loc.t('calculator.editQuantity') || 'Edit Quantity'}
						</Text>
						<TextInput
							style={styles.quantityInput}
							value={newQuantityValue}
							onChangeText={setNewQuantityValue}
							placeholder={
								loc.t('calculator.enterNewQuantity') || 'Enter new quantity'
							}
							keyboardType="numeric"
							autoFocus={true}
						/>
						<View style={styles.modalButtons}>
							<TouchableOpacity
								style={[styles.modalButton, styles.cancelButton]}
								onPress={() => setShowQuantityModal(false)}
							>
								<Text style={styles.cancelButtonText}>
									{loc.t('calculator.cancel') || 'Cancel'}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.modalButton, styles.confirmButton]}
								onPress={confirmQuantityEdit}
							>
								<Text style={styles.confirmButtonText}>
									{loc.t('calculator.confirm') || 'Confirm'}
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	)
}

const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
	},
	modalContent: {
		backgroundColor: 'white',
		padding: 20,
		borderRadius: 12,
		width: '85%',
		maxWidth: 400,
		elevation: 5,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: 'bold',
		textAlign: 'center',
		marginBottom: 15,
		color: '#333',
	},
	quantityInput: {
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
		marginBottom: 20,
		textAlign: 'center',
	},
	modalButtons: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		gap: 10,
	},
	modalButton: {
		flex: 1,
		padding: 12,
		borderRadius: 8,
		alignItems: 'center',
	},
	cancelButton: {
		backgroundColor: '#f5f5f5',
		borderWidth: 1,
		borderColor: '#ddd',
	},
	confirmButton: {
		backgroundColor: '#6592E5',
	},
	cancelButtonText: {
		color: '#666',
		fontSize: 16,
		fontWeight: '500',
	},
	confirmButtonText: {
		color: 'white',
		fontSize: 16,
		fontWeight: '500',
	},
})

export default SmartCalculator
