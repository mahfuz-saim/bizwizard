import React, {
	useState,
	useEffect,
	useRef,
	forwardRef,
	useImperativeHandle,
} from 'react'
import {
	View,
	TextInput,
	TouchableOpacity,
	ActivityIndicator,
	Text,
	FlatList,
	StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalization } from '../localization/localizationContext'

// Wrapped with forwardRef to allow parent components to call focus()/blur() without breaking existing usages
const SearchBar = forwardRef(
	(
		{
			fetchSearchData,
			onSelect,
			placeholder,
			renderItem,
			debounceDelay,
			showSearchResult = true,
			onFocusChange, // optional callback(isFocused)
			filterMode = true, // true for filter mode, false for search mode
		},
		ref
	) => {
		const { loc } = useLocalization()

		// State management
		const [query, setQuery] = useState('')
		const [results, setResults] = useState([])
		const [loading, setLoading] = useState(false)
		const [error, setError] = useState(false)
		const [showDropdown, setShowDropdown] = useState(false)
		const [isFocused, setIsFocused] = useState(false)

		// Refs
		const debounceTimer = useRef(null)
		const inputRef = useRef(null)
		const latestQueryRef = useRef('')

		// Expose imperative methods
		useImperativeHandle(ref, () => ({
			focus: () => inputRef.current?.focus(),
			blur: () => inputRef.current?.blur(),
			clear: () => {
				setQuery('')
				setResults([])
				setShowDropdown(false)
			},
		}))

		// Debounced search effect
		useEffect(() => {
			latestQueryRef.current = query

			// Clear existing timer on every query change
			if (debounceTimer.current) {
				clearTimeout(debounceTimer.current)
				debounceTimer.current = null
			}

			// If query is empty, clear results and hide dropdown
			if (!query.trim()) {
				setResults([])
				setShowDropdown(false)
				setError(false)
				setLoading(false)

				// In filter mode, also notify the parent with an empty string so
				// the parent can reset its search state. Without this, clearing
				// the input wouldn't update the parent's `searchTerm` and the
				// list would keep showing the previous filtered results.
				if (filterMode) {
					fetchSearchData('')
					return
				}
			}

			// Set debounced timer for API call
			debounceTimer.current = setTimeout(async () => {
				const currentQuery = query.trim()
				setLoading(true)
				setError(false)
				setShowDropdown(showSearchResult && true)

				try {
					const searchResults = await fetchSearchData(currentQuery)

					if (latestQueryRef.current.trim() === currentQuery) {
						setResults(searchResults || [])
					}
				} catch (err) {
					console.error('Search API error:', err)
					if (latestQueryRef.current.trim() === currentQuery) {
						setError(true)
						setResults([])
					}
				} finally {
					if (latestQueryRef.current.trim() === currentQuery) {
						setLoading(false)
					}
				}
			}, debounceDelay)

			// Cleanup function - runs when component unmounts or before next effect
			return () => {
				if (debounceTimer.current) {
					clearTimeout(debounceTimer.current)
					debounceTimer.current = null
				}
			}
		}, [query, debounceDelay, fetchSearchData, filterMode, showSearchResult])

		// Component unmount cleanup
		useEffect(() => {
			return () => {
				if (debounceTimer.current) {
					clearTimeout(debounceTimer.current)
					debounceTimer.current = null
				}
			}
		}, [])

		// Handle input change
		const handleInputChange = (text) => {
			setQuery(text)
		}

		// Handle clear button press
		const handleClear = () => {
			setQuery('')
			setResults([])
			setShowDropdown(false)
			setError(false)
			inputRef.current?.focus()
		}

		// Handle input focus
		const handleFocus = () => {
			setIsFocused(true)
			if (query.trim() && (results.length > 0 || loading || error)) {
				setShowDropdown(showSearchResult && true)
			}
			// notify parent
			onFocusChange && onFocusChange(true)
		}

		// Handle input blur
		const handleBlur = () => {
			setIsFocused(false)
			// Small delay to allow item selection before hiding dropdown
			setTimeout(() => {
				setShowDropdown(false)
			}, 150)
			// notify parent after delay so UI using focus state updates naturally
			onFocusChange && onFocusChange(false)
		}

		// Handle item selection
		const handleItemSelect = (item) => {
			onSelect(item)
			setShowDropdown(false)
			inputRef.current?.blur()
		}

		// Render dropdown content based on state
		const renderDropdownContent = () => {
			if (loading) {
				return (
					<View style={styles.centerContainer}>
						<ActivityIndicator size="small" color="#177DFF" />
						<Text style={styles.statusText}>{loc.t('search.searching')}</Text>
					</View>
				)
			}

			if (error) {
				return (
					<View style={styles.centerContainer}>
						<Ionicons name="alert-circle-outline" size={24} color="#FF6B6B" />
						<Text style={[styles.statusText, styles.errorText]}>
							{loc.t('search.error')}
						</Text>
					</View>
				)
			}

			if (!query.trim()) {
				return (
					<View style={styles.centerContainer}>
						<Ionicons name="search-outline" size={24} color="#888888" />
						<Text style={styles.statusText}>
							{loc.t('search.typeToSearch')}
						</Text>
					</View>
				)
			}

			if (results.length === 0) {
				return (
					<View style={styles.centerContainer}>
						<Ionicons name="document-outline" size={24} color="#888888" />
						<Text style={styles.statusText}>{loc.t('search.noData')}</Text>
					</View>
				)
			}

			// Render search results using provided renderItem function
			return (
				<FlatList
					style={styles.resultsList}
					data={results}
					keyExtractor={(item, index) =>
						item?.id?.toString?.() || `search-result-${index}`
					}
					renderItem={({ item, index }) => (
						<TouchableOpacity
							style={[
								styles.resultItem,
								index === results.length - 1 && styles.lastResultItem,
							]}
							onPress={() => handleItemSelect(item)}
							activeOpacity={0.7}
						>
							{renderItem(item)}
						</TouchableOpacity>
					)}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				/>
			)
		}

		return (
			<View style={styles.container}>
				{/* Search Input Bar */}
				<View style={[styles.searchBar, isFocused && styles.searchBarFocused]}>
					{/* Search Icon */}
					<Ionicons
						name="search"
						size={20}
						color={isFocused ? '#177DFF' : '#888888'}
						style={styles.searchIcon}
					/>

					{/* Text Input */}
					<TextInput
						ref={inputRef}
						style={styles.textInput}
						value={query}
						onChangeText={handleInputChange}
						onFocus={handleFocus}
						onBlur={handleBlur}
						placeholder={placeholder}
						placeholderTextColor="#888888"
						returnKeyType="search"
						autoCorrect={false}
						autoCapitalize="none"
					/>

					{/* Clear Button */}
					{query.length > 0 && (
						<TouchableOpacity
							onPress={handleClear}
							style={styles.clearButton}
							activeOpacity={0.7}
						>
							<Ionicons name="close-circle" size={20} color="#888888" />
						</TouchableOpacity>
					)}
				</View>

				{/* Results Dropdown */}
				{showDropdown && (
					<View style={styles.dropdown}>{renderDropdownContent()}</View>
				)}
			</View>
		)
	}
)

const styles = StyleSheet.create({
	container: {
		position: 'relative',
		zIndex: 1000,
	},

	// Search Bar Styles
	searchBar: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#E5E5E5',
		paddingHorizontal: 16,
		paddingVertical: 12,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	searchBarFocused: {
		borderColor: '#177DFF',
		shadowColor: '#177DFF',
		shadowOpacity: 0.2,
		shadowRadius: 4,
		elevation: 4,
	},
	searchIcon: {
		marginRight: 12,
	},
	textInput: {
		flex: 1,
		fontSize: 16,
		color: '#333333',
		paddingVertical: 0, // Remove default padding
	},
	clearButton: {
		marginLeft: 8,
		padding: 4,
	},

	// Dropdown Styles
	dropdown: {
		position: 'absolute',
		top: '100%',
		left: 0,
		right: 0,
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		borderTopLeftRadius: 4,
		borderTopRightRadius: 4,
		marginTop: 4,
		maxHeight: 300,
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 4,
		},
		shadowOpacity: 0.15,
		shadowRadius: 6,
		elevation: 8,
		zIndex: 1001,
		borderWidth: 1,
		borderColor: '#E5E5E5',
		borderTopColor: 'transparent',
	},

	// Center Container for Status Messages
	centerContainer: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 32,
		paddingHorizontal: 16,
	},
	statusText: {
		fontSize: 14,
		color: '#888888',
		marginTop: 8,
		textAlign: 'center',
	},
	errorText: {
		color: '#FF6B6B',
	},

	// Results List Styles
	resultsList: {
		maxHeight: 300,
	},
	resultItem: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#F0F0F0',
		backgroundColor: '#FFFFFF',
	},
	lastResultItem: {
		borderBottomWidth: 0,
		borderBottomLeftRadius: 12,
		borderBottomRightRadius: 12,
	},
})

export default SearchBar
