import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator,
	StyleSheet,
} from 'react-native'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'

const DEBOUNCE_MS = 250
const MIN_CHARS = 1
// rows share one fixed height so the box height is deterministic and the
// list can be given real bounds (bounded list => scrollable list)
const RESULT_ROW_HEIGHT = 54
// 3.5 rows: the half cut off row is the cue that the list continues and
// can be scrolled - with a whole number of rows the box looked complete
const MAX_VISIBLE_ROWS = 3.5
const RESULTS_MAX_HEIGHT = RESULT_ROW_HEIGHT * MAX_VISIBLE_ROWS
// Rendering window: the whole result set can run to hundreds of rows, so the
// list hands out its results in batches. The first batch is rendered as is;
// from the second "show more" on, the window slides forward instead of
// growing, so at most MAX_WINDOW_BATCHES batches exist at any time.
const BATCH_SIZE = 10
const MAX_WINDOW_BATCHES = 2

/**
 * Text field that searches the pre-saved (device) product catalog while typing
 * and shows the matching products in a dropdown.
 *
 * The parent form is only updated when the user picks one of the suggestions
 * (`onSelect`), typing alone never overwrites the rest of the form.
 *
 * Props:
 *  - label: floating label text
 *  - value / onChangeText: controlled text (kept in sync with Formik)
 *  - onBlur: called when the field loses focus
 *  - onSelect(product): called with the full catalog row when a suggestion is tapped
 *  - searchFn(term): async (term) => array of catalog rows
 *  - onDropdownVisibilityChange(open): called whenever the results box opens
 *    or closes, so the parent form can pause its own scrolling while the box
 *    is on screen (a nested list cannot scroll while a parent scroll view
 *    intercepts the gesture)
 */
const ProductSearchInput = React.forwardRef(function ProductSearchInput(
	{
		label,
		value,
		onChangeText,
		onBlur,
		onSelect,
		searchFn,
		placeholder,
		editable = true,
		onDropdownVisibilityChange,
	},
	ref
) {
	const { loc } = useLocalization()
	const { translateNumber } = useNumberTranslator()
	const [results, setResults] = useState([])
	const [isLoading, setIsLoading] = useState(false)
	const [showResults, setShowResults] = useState(false)
	const [isFocused, setIsFocused] = useState(false)
	// rendering window over `results`
	const [windowStart, setWindowStart] = useState(0)
	const [windowCount, setWindowCount] = useState(BATCH_SIZE)

	const inputRef = useRef(null)
	const listRef = useRef(null)
	const scrollOffsetRef = useRef(0)
	// rows (px) removed from above the viewport by the last slide, subtracted
	// from the scroll offset afterwards so the list does not jump
	const pendingScrollAdjustRef = useRef(0)
	const pendingScrollToTopRef = useRef(false)
	const debounceRef = useRef(null)
	const blurTimerRef = useRef(null)
	const requestIdRef = useRef(0)
	// Set right after a suggestion is picked so the programmatic value change
	// does not immediately reopen the dropdown.
	const skipNextSearchRef = useRef(false)
	// kept in a ref so the unmount effect below does not re-run when the parent
	// passes a new callback identity
	const dropdownCallbackRef = useRef(onDropdownVisibilityChange)

	useEffect(() => {
		dropdownCallbackRef.current = onDropdownVisibilityChange
	}, [onDropdownVisibilityChange])

	// let the parent know while the results box is on screen
	useEffect(() => {
		dropdownCallbackRef.current?.(showResults)
	}, [showResults])

	useEffect(() => {
		return () => dropdownCallbackRef.current?.(false)
	}, [])

	const runSearch = useCallback(
		async (term, requestId) => {
			if (!searchFn) return
			setIsLoading(true)
			try {
				const rows = await searchFn(term)
				// ignore responses from stale keystrokes
				if (requestIdRef.current !== requestId) return
				setResults(Array.isArray(rows) ? rows : [])
				setShowResults(true)
			} catch (error) {
				console.log('ProductSearchInput search error', error?.message)
				if (requestIdRef.current !== requestId) return
				setResults([])
				setShowResults(true)
			} finally {
				if (requestIdRef.current === requestId) setIsLoading(false)
			}
		},
		[searchFn]
	)

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current)

		if (!isFocused) {
			// Only search while the user is interacting with the field
			skipNextSearchRef.current = false
			setIsLoading(false)
			return
		}

		const term = String(value || '').trim()

		if (skipNextSearchRef.current) {
			skipNextSearchRef.current = false
			return
		}

		if (term.length < MIN_CHARS) {
			setResults([])
			setShowResults(false)
			setIsLoading(false)
			return
		}

		debounceRef.current = setTimeout(() => {
			requestIdRef.current += 1
			runSearch(term, requestIdRef.current)
		}, DEBOUNCE_MS)

		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
		}
	}, [value, isFocused, runSearch])

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
			if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
		}
	}, [])

	// each new result set starts at the first batch, from the top
	useEffect(() => {
		setWindowStart(0)
		setWindowCount(BATCH_SIZE)
		pendingScrollAdjustRef.current = 0
		pendingScrollToTopRef.current = false
		scrollOffsetRef.current = 0
		listRef.current?.scrollTo?.({ y: 0, animated: false })
	}, [results])

	// apply the offset correction for a window that slid under the user’s finger
	useEffect(() => {
		const removedAbove = pendingScrollAdjustRef.current
		const backToTop = pendingScrollToTopRef.current
		pendingScrollAdjustRef.current = 0
		pendingScrollToTopRef.current = false
		if (backToTop) {
			listRef.current?.scrollTo?.({ y: 0, animated: false })
			scrollOffsetRef.current = 0
			return
		}
		if (!removedAbove) return
		const nextOffset = Math.max(0, scrollOffsetRef.current - removedAbove)
		listRef.current?.scrollTo?.({ y: nextOffset, animated: false })
		scrollOffsetRef.current = nextOffset
	}, [windowStart, windowCount])

	const handleChangeText = (text) => {
		setShowResults(false)
		onChangeText?.(text)
	}

	const handleFocus = () => {
		if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
		setIsFocused(true)
	}

	const handleBlur = () => {
		// small delay so tapping a suggestion still registers
		if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
		blurTimerRef.current = setTimeout(() => {
			setIsFocused(false)
			setShowResults(false)
		}, 180)
		onBlur?.()
	}

	const handleClear = () => {
		setResults([])
		setShowResults(false)
		onChangeText?.('')
	}

	const handleSelect = (item) => {
		if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
		skipNextSearchRef.current = true
		setResults([])
		setShowResults(false)
		setIsFocused(false)
		onSelect?.(item)
		// release the input so focusing it again still triggers `onFocus`
		inputRef.current?.blur()
	}

	const renderRow = (item, index, isLast) => {
		const subtitle = [item.genericName, item.measuringUnit]
			.filter((part) => part && String(part).trim() !== '')
			.join(' • ')

		return (
			<TouchableOpacity
				key={item.id ?? `${item.barcode}-${index}`}
				style={[styles.resultRow, isLast && styles.resultRowLast]}
				activeOpacity={0.7}
				onPress={() => handleSelect(item)}
			>
				<View style={styles.resultInfo}>
					<Text style={styles.resultName} numberOfLines={1}>
						{item.productName}
					</Text>
					{subtitle ? (
						<Text style={styles.resultSubtitle} numberOfLines={1}>
							{subtitle}
						</Text>
					) : null}
				</View>
				{item.barcode ? (
					<Text style={styles.resultBarcode} numberOfLines={1}>
						{translateNumber(String(item.barcode))}
					</Text>
				) : null}
			</TouchableOpacity>
		)
	}

	// at most 3.5 rows: a longer list is visibly cut off mid row and scrolls,
	// a shorter one fits exactly (no empty strip under the last result)
	const resultsHeight =
		Math.min(results.length, MAX_VISIBLE_ROWS) * RESULT_ROW_HEIGHT

	const visibleStart = Math.max(0, Math.min(windowStart, results.length - 1))
	const windowRows = results.slice(visibleStart, visibleStart + windowCount)
	const hasMoreBelow = visibleStart + windowRows.length < results.length
	const hasMoreAbove = visibleStart > 0

	// next batch below: grow the window once, then slide it so the earliest
	// rows leave the list instead of piling up on the frontend
	const handleShowMore = () => {
		if (windowCount >= MAX_WINDOW_BATCHES * BATCH_SIZE) {
			pendingScrollAdjustRef.current = BATCH_SIZE * RESULT_ROW_HEIGHT
			setWindowStart((start) => start + BATCH_SIZE)
			return
		}
		setWindowCount((count) => count + BATCH_SIZE)
	}

	// the batch above was dropped by a slide: bring it back
	const handleShowEarlier = () => {
		pendingScrollToTopRef.current = true
		setWindowStart((start) => Math.max(0, start - BATCH_SIZE))
	}

	const renderMoreButton = (onPress, testID) => (
		<TouchableOpacity
			style={styles.moreButton}
			testID={testID}
			activeOpacity={0.7}
			onPress={onPress}
		>
			<Text style={styles.moreButtonText}>
				{loc.t('productForm.showMore') || 'Show more'}
			</Text>
		</TouchableOpacity>
	)

	const renderDropdownContent = () => {
		if (isLoading) {
			return (
				<View style={styles.statusContainer}>
					<ActivityIndicator size="small" color="#195FE1" />
					<Text style={styles.statusText}>
						{loc.t('productForm.searchingProducts') || 'Searching products...'}
					</Text>
				</View>
			)
		}

		if (results.length === 0) {
			return (
				<View style={styles.statusContainer}>
					<MaterialIcons name="search-off" size={18} color="#6B7280" />
					<Text style={styles.statusText}>
						{loc.t('productForm.noMatchingProduct') ||
							'No saved product matched — you can type your own'}
					</Text>
				</View>
			)
		}

		return (
			<ScrollView
				ref={listRef}
				style={[styles.resultsList, { height: resultsHeight }]}
				// let this list scroll on its own inside the form / bottom sheet scroll view
				nestedScrollEnabled
				scrollEnabled
				keyboardShouldPersistTaps="always"
				showsVerticalScrollIndicator
				persistentScrollbar
				onScroll={(event) => {
					scrollOffsetRef.current = event.nativeEvent.contentOffset.y
				}}
				scrollEventThrottle={16}
			>
				{hasMoreAbove
					? renderMoreButton(handleShowEarlier, 'productSearchShowEarlier')
					: null}
				{windowRows.map((item, index) =>
					renderRow(
						item,
						index,
						index === windowRows.length - 1 && !hasMoreBelow
					)
				)}
				{hasMoreBelow
					? renderMoreButton(handleShowMore, 'productSearchShowMore')
					: null}
			</ScrollView>
		)
	}

	return (
		<View style={styles.wrapper}>
			{label ? <Text style={styles.overlayLabel}>{label}</Text> : null}
			<View
				style={[
					styles.inputRow,
					isFocused && styles.inputRowFocused,
					!editable && styles.inputRowDisabled,
				]}
			>
				<MaterialIcons
					name="search"
					size={18}
					color={isFocused ? '#195FE1' : '#6B7280'}
					style={styles.leadingIcon}
				/>
				<TextInput
					ref={(node) => {
						inputRef.current = node
						if (typeof ref === 'function') ref(node)
						else if (ref) ref.current = node
					}}
					value={value}
					onChangeText={handleChangeText}
					onFocus={handleFocus}
					onBlur={handleBlur}
					editable={editable}
					placeholder={placeholder}
					placeholderTextColor="rgba(0,0,0,0.54)"
					style={styles.input}
					returnKeyType="search"
					autoCapitalize="words"
					autoCorrect={false}
				/>
				{value ? (
					<TouchableOpacity
						onPress={handleClear}
						style={styles.clearButton}
						activeOpacity={0.7}
					>
						<MaterialIcons name="close" size={16} color="#6B7280" />
					</TouchableOpacity>
				) : null}
			</View>

			{showResults ? (
				<View style={styles.dropdown}>{renderDropdownContent()}</View>
			) : null}
		</View>
	)
})

export default ProductSearchInput

const styles = StyleSheet.create({
	wrapper: {
		position: 'relative',
		zIndex: 20,
	},
	overlayLabel: {
		position: 'absolute',
		top: 0,
		left: 12,
		backgroundColor: '#F0F8FF',
		paddingHorizontal: 6,
		fontSize: 11,
		lineHeight: 13,
		color: '#195FE1',
		fontWeight: '600',
		zIndex: 10,
		borderRadius: 6,
		maxWidth: '90%',
	},
	inputRow: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.54)',
		paddingHorizontal: 12,
		height: 44,
	},
	inputRowFocused: {
		borderColor: '#195FE1',
	},
	inputRowDisabled: {
		backgroundColor: '#f5f5f5',
	},
	leadingIcon: {
		marginRight: 8,
	},
	input: {
		flex: 1,
		fontSize: 16,
		color: '#333333',
		paddingVertical: 0,
		height: 42,
	},
	clearButton: {
		padding: 4,
		marginLeft: 6,
	},
	dropdown: {
		marginTop: 4,
		backgroundColor: '#FFFFFF',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: 'rgba(0, 0, 0, 0.12)',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 4,
		elevation: 4,
		overflow: 'hidden',
	},
	resultsList: {
		maxHeight: RESULTS_MAX_HEIGHT,
		flexGrow: 0,
	},
	resultRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		height: RESULT_ROW_HEIGHT,
		paddingHorizontal: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#F0F0F0',
	},
	resultRowLast: {
		borderBottomWidth: 0,
	},
	moreButton: {
		alignItems: 'center',
		justifyContent: 'center',
		marginHorizontal: 12,
		marginVertical: 8,
		paddingVertical: 9,
		borderWidth: 1,
		borderColor: '#195FE1',
		borderRadius: 8,
		// outline only: text with a blue border, no fill
		backgroundColor: 'transparent',
	},
	moreButtonText: {
		fontSize: 13,
		fontWeight: '600',
		color: '#195FE1',
	},
	resultInfo: {
		flex: 1,
		marginRight: 8,
	},
	resultName: {
		fontSize: 15,
		fontWeight: '600',
		color: '#1F2937',
	},
	resultSubtitle: {
		fontSize: 12,
		color: '#6B7280',
		marginTop: 2,
	},
	resultBarcode: {
		fontSize: 12,
		color: '#195FE1',
		fontWeight: '500',
	},
	statusContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		paddingVertical: 14,
		paddingHorizontal: 12,
	},
	statusText: {
		fontSize: 13,
		color: '#6B7280',
		flexShrink: 1,
	},
})
