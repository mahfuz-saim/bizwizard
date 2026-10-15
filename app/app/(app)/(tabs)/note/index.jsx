import React, {
	useState,
	useEffect,
	useRef,
	useMemo,
	useCallback,
	memo,
} from 'react'
import {
	Text,
	TextInput,
	View,
	FlatList,
	TouchableOpacity,
	StyleSheet,
	ToastAndroid,
} from 'react-native'
import BouncyCheckbox from 'react-native-bouncy-checkbox'
import ContentLoader, { Rect } from 'react-content-loader/native'
import useApi from '../../../../src/hooks/useApi'
import {
	addNote,
	getAllNote,
	updateNote,
	deleteNote,
} from '../../../../src/controllers/note'
import { MaterialIcons } from '@expo/vector-icons'
import { useLocalization } from '../../../../src/localization/localizationContext'
import { useNumberTranslator } from '../../../../src/hooks/useNumberTranslator.jsx'
import { DeleteModal } from '../../../../src/components/AlertModal.jsx'

// Memoized Date Item Component
const DateItem = memo(
	({
		item,
		index,
		selectedDate,
		onDateSelect,
		formatDate,
		isToday,
		isSameDate,
		translateNumber,
	}) => {
		const { day, date } = formatDate(item)
		const isSelected = isSameDate(item, selectedDate)
		const todayFlag = isToday(item)

		const containerStyle = useMemo(() => {
			const baseStyle = [styles.dateItem]
			if (isSelected) {
				baseStyle.push(styles.dateItemSelected)
			} else if (todayFlag) {
				baseStyle.push(styles.dateItemToday)
			} else {
				baseStyle.push(styles.dateItemDefault)
			}
			return baseStyle
		}, [isSelected, todayFlag])

		const dayTextStyle = useMemo(
			() => [
				styles.dayText,
				isSelected ? styles.dayTextSelected : styles.dayTextDefault,
			],
			[isSelected]
		)

		const dateTextStyle = useMemo(
			() => [
				styles.dateText,
				isSelected ? styles.dateTextSelected : styles.dateTextDefault,
			],
			[isSelected]
		)

		const handlePress = useCallback(() => {
			onDateSelect(item)
		}, [item, onDateSelect])

		return (
			<TouchableOpacity onPress={handlePress} style={containerStyle}>
				<Text style={dayTextStyle}>{day}</Text>
				<Text style={dateTextStyle}>{translateNumber(date)}</Text>
			</TouchableOpacity>
		)
	}
)

// Memoized Note Item Component
const NoteItem = memo(
	({ note, onToggleComplete, onEditNote, onDeleteNote, translateNumber }) => {
		const containerStyle = useMemo(
			() => [
				styles.noteItem,
				note.isComplete ? styles.noteItemCompleted : styles.noteItemIncomplete,
			],
			[note.isComplete]
		)

		const textStyle = useMemo(
			() => ({
				fontFamily: 'JosefinSans-Regular',
				color: note.isComplete ? '#9CA3AF' : '#000',
			}),
			[note.isComplete]
		)

		const noteDescriptionStyle = useMemo(
			() => [
				styles.noteDescription,
				note.isComplete
					? styles.noteDescriptionCompleted
					: styles.noteDescriptionActive,
			],
			[note.isComplete]
		)

		const handleToggleComplete = useCallback(() => {
			onToggleComplete(note)
		}, [note, onToggleComplete])

		const handleEditNote = useCallback(() => {
			onEditNote(note)
		}, [note, onEditNote])

		const handleDeleteNote = useCallback(() => {
			onDeleteNote(note)
		}, [note, onDeleteNote])

		// Function to translate numbers in text content
		const translateTextNumbers = useCallback(
			(text) => {
				if (!text) return text
				return translateNumber(text)
			},
			[translateNumber]
		)

		return (
			<View style={containerStyle}>
				<View style={styles.noteRow}>
					<View style={styles.noteContent}>
						<BouncyCheckbox
							isChecked={note.isComplete}
							size={25}
							fillColor="gray"
							unfillColor="#FFFFFF"
							text={translateTextNumbers(note.name)}
							iconStyle={styles.bouncyCheckboxIcon}
							innerIconStyle={styles.bouncyCheckboxInnerIcon}
							textStyle={textStyle}
							onPress={handleToggleComplete}
						/>
						{note.note && !note.isComplete && (
							<Text style={noteDescriptionStyle}>
								{translateTextNumbers(note.note)}
							</Text>
						)}
					</View>
					<View style={styles.noteActions}>
						<TouchableOpacity
							onPress={handleEditNote}
							style={styles.actionButton}
						>
							<MaterialIcons name="edit" size={16} color="#4B5563" />
						</TouchableOpacity>
						<TouchableOpacity
							onPress={handleDeleteNote}
							style={styles.actionButtonDelete}
						>
							<MaterialIcons name="delete" size={16} color="#EF4444" />
						</TouchableOpacity>
					</View>
				</View>
			</View>
		)
	}
)

// Memoized Skeleton Loader
const NoteSkeleton = memo(() => (
	<View style={styles.skeletonContainer}>
		<ContentLoader
			speed={2}
			width="100%"
			height={60}
			viewBox="0 0 380 60"
			backgroundColor="#e0e0e0"
			foregroundColor="#f5f5f5"
		>
			<Rect x="0" y="10" rx="4" ry="4" width="25" height="25" />
			<Rect x="35" y="10" rx="4" ry="4" width="200" height="18" />
			<Rect x="35" y="35" rx="4" ry="4" width="150" height="12" />
			<Rect x="320" y="10" rx="4" ry="4" width="20" height="20" />
			<Rect x="350" y="10" rx="4" ry="4" width="20" height="20" />
		</ContentLoader>
	</View>
))

// Memoized Loading Component
const LoadingList = memo(() => (
	<>
		<NoteSkeleton />
		<NoteSkeleton />
		<NoteSkeleton />
		<NoteSkeleton />
	</>
))

// Memoized Empty State
const EmptyState = memo(({ message }) => (
	<View style={styles.emptyState}>
		<Text style={styles.emptyStateText}>{message}</Text>
	</View>
))

// Memoized Section Header
const SectionHeader = memo(({ title }) => (
	<Text style={styles.sectionHeader}>{title}</Text>
))

export default function NoteScreen() {
	const { fetchData } = useApi()
	const { loc } = useLocalization()
	const { translateNumber } = useNumberTranslator()

	// State management
	const [selectedDate, setSelectedDate] = useState(new Date())
	const [notes, setNotes] = useState([])
	const [newNoteText, setNewNoteText] = useState('')
	const [newNoteDescription, setNewNoteDescription] = useState('')
	const [editingNote, setEditingNote] = useState(null)
	const [loading, setLoading] = useState(true)
	const [showDeleteModal, setShowDeleteModal] = useState(false)
	const [noteToDelete, setNoteToDelete] = useState(null)

	const dateScrollRef = useRef(null)

	// Refs for frequently-changing input state to keep async handlers stable
	const newNoteTextRef = useRef(newNoteText)
	const newNoteDescriptionRef = useRef(newNoteDescription)
	const editingNoteRef = useRef(editingNote)
	const noteToDeleteRef = useRef(noteToDelete)
	const selectedDateRef = useRef(selectedDate)

	useEffect(() => {
		newNoteTextRef.current = newNoteText
	}, [newNoteText])
	useEffect(() => {
		newNoteDescriptionRef.current = newNoteDescription
	}, [newNoteDescription])
	useEffect(() => {
		editingNoteRef.current = editingNote
	}, [editingNote])
	useEffect(() => {
		noteToDeleteRef.current = noteToDelete
	}, [noteToDelete])
	useEffect(() => {
		selectedDateRef.current = selectedDate
	}, [selectedDate])

	// Memoized dates array
	const dates = useMemo(() => {
		const datesArray = []
		const today = new Date()

		for (let i = -15; i <= 15; i++) {
			const date = new Date(today)
			date.setDate(today.getDate() + i)
			datesArray.push(date)
		}
		return datesArray
	}, [])

	// Memoized utility functions
	const formatDate = useCallback(
		(date) => {
			const days = [
				loc.t('note.days.sun'),
				loc.t('note.days.mon'),
				loc.t('note.days.tue'),
				loc.t('note.days.wed'),
				loc.t('note.days.thu'),
				loc.t('note.days.fri'),
				loc.t('note.days.sat'),
			]
			return {
				day: days[date.getDay()],
				date: date.getDate(),
			}
		},
		[loc]
	)

	const isToday = useCallback((date) => {
		const today = new Date()
		return date.toDateString() === today.toDateString()
	}, [])

	const isSameDate = useCallback((date1, date2) => {
		return date1.toDateString() === date2.toDateString()
	}, [])

	// Memoized separated notes
	const { incompleteNotes, completedNotes } = useMemo(() => {
		const incomplete = notes.filter((note) => !note.isComplete)
		const completed = notes.filter((note) => note.isComplete)
		return { incompleteNotes: incomplete, completedNotes: completed }
	}, [notes])

	// Memoized combined notes for FlatList
	const combinedNotes = useMemo(() => {
		const result = [...incompleteNotes]
		if (completedNotes.length > 0) {
			result.push({ type: 'header', title: loc.t('note.completed') })
			result.push(...completedNotes)
		}
		return result
	}, [incompleteNotes, completedNotes, loc])

	// Scroll to current date on mount
	useEffect(() => {
		const timer = setTimeout(() => {
			if (dateScrollRef.current) {
				dateScrollRef.current.scrollToIndex({
					index: 15, // Current date is at index 15
					animated: true,
					viewPosition: 0.8,
				})
			}
		}, 100)
		return () => clearTimeout(timer)
	}, [])

	const loadNotes = useCallback(async () => {
		try {
			setLoading(true)
			const dateString = selectedDateRef.current.toISOString().split('T')[0]
			const response = await fetchData(getAllNote, { date: dateString })

			if (response && response.success) {
				setNotes(response.data || [])
			}
		} catch (error) {
			console.error('🚨 Error loading notes:', error)
		} finally {
			setLoading(false)
		}
	}, [fetchData])

	const handleAddNote = useCallback(async () => {
		const text = newNoteTextRef.current.trim()
		if (!text) return

		try {
			const noteData = {
				name: newNoteTextRef.current,
				note: newNoteDescriptionRef.current || '',
				dueDate: selectedDateRef.current.toISOString(),
			}

			const response = await fetchData(addNote, { data: noteData })

			if (response && response.success) {
				setNewNoteText('')
				setNewNoteDescription('')
				loadNotes()
			}
		} catch (error) {
			console.error('🚨 Error adding note:', error)
		}
	}, [fetchData, loadNotes])

	const handleSaveEdit = useCallback(async () => {
		const text = newNoteTextRef.current.trim()
		if (!text) return
		const editing = editingNoteRef.current
		if (!editing) return

		try {
			const updateData = {
				name: newNoteTextRef.current,
				note: newNoteDescriptionRef.current,
				isComplete: editing.isComplete,
			}

			const response = await fetchData(updateNote, {
				noteId: editing.id,
				data: updateData,
			})

			if (response && response.success) {
				setEditingNote(null)
				setNewNoteText('')
				setNewNoteDescription('')
				loadNotes()
			}
		} catch (error) {
			console.error('🚨 Error updating note:', error)
		}
	}, [fetchData, loadNotes])

	const handleToggleComplete = useCallback(
		async (note) => {
			try {
				const updateData = {
					name: note.name,
					note: note.note,
					isComplete: !note.isComplete,
				}

				const response = await fetchData(updateNote, {
					noteId: note.id,
					data: updateData,
				})

				if (response && response.success) {
					loadNotes()
				}
			} catch (error) {
				console.error('🚨 Error updating note:', error)
			}
		},
		[fetchData, loadNotes]
	)

	const handleEditNote = useCallback((note) => {
		setEditingNote(note)
		setNewNoteText(note.name)
		setNewNoteDescription(note.note || '')
	}, [])

	const handleCancelEdit = useCallback(() => {
		setEditingNote(null)
		setNewNoteText('')
		setNewNoteDescription('')
	}, [])

	const handleDeleteNote = useCallback((note) => {
		setNoteToDelete(note)
		setShowDeleteModal(true)
	}, [])

	const confirmDeleteNote = useCallback(async () => {
		const target = noteToDeleteRef.current
		if (!target) return

		try {
			const response = await fetchData(deleteNote, { noteId: target.id })

			if (response && response.success) {
				loadNotes()
				ToastAndroid.show(
					loc.t('note.noteDeleted') || 'Note deleted successfully',
					ToastAndroid.SHORT
				)
			} else {
				ToastAndroid.show(
					loc.t('note.deleteFailed') || 'Failed to delete note',
					ToastAndroid.SHORT
				)
			}
		} catch (error) {
			console.error('🚨 Error deleting note:', error)
			ToastAndroid.show(
				loc.t('note.deleteFailed') || 'Failed to delete note',
				ToastAndroid.SHORT
			)
		} finally {
			setShowDeleteModal(false)
			setNoteToDelete(null)
		}
	}, [fetchData, loadNotes, loc])

	const handleDateSelect = useCallback((date) => {
		setSelectedDate(date)
	}, [])

	const handleCloseDeleteModal = useCallback(() => {
		setShowDeleteModal(false)
		setNoteToDelete(null)
	}, [])

	// Memoized delete modal subtitle
	const deleteSubtitle = useMemo(() => {
		const fallback =
			loc.t('note.deleteConfirm') ||
			'Are you sure you want to delete this note?'
		if (!noteToDelete) return fallback
		return (
			loc.t('note.deleteConfirm') ||
			`Are you sure you want to delete "${noteToDelete.name}"?`
		)
	}, [noteToDelete, loc])

	// Load notes when component mounts or date changes
	useEffect(() => {
		loadNotes()
	}, [selectedDate, loadNotes])

	// Render functions for FlatList
	const renderDateItem = useCallback(
		({ item, index }) => (
			<DateItem
				item={item}
				index={index}
				selectedDate={selectedDate}
				onDateSelect={handleDateSelect}
				formatDate={formatDate}
				isToday={isToday}
				isSameDate={isSameDate}
				translateNumber={translateNumber}
			/>
		),
		[
			selectedDate,
			handleDateSelect,
			formatDate,
			isToday,
			isSameDate,
			translateNumber,
		]
	)

	const renderNoteItem = useCallback(
		({ item }) => {
			if (item.type === 'header') {
				return <SectionHeader title={item.title} />
			}
			return (
				<NoteItem
					note={item}
					onToggleComplete={handleToggleComplete}
					onEditNote={handleEditNote}
					onDeleteNote={handleDeleteNote}
					translateNumber={translateNumber}
				/>
			)
		},
		[handleToggleComplete, handleEditNote, handleDeleteNote, translateNumber]
	)

	const getDateItemLayout = useCallback(
		(data, index) => ({
			length: 88,
			offset: 88 * index,
			index,
		}),
		[]
	)

	const keyExtractor = useCallback((item, index) => {
		if (item.type === 'header') {
			return `header-${index}`
		}
		return item.id ? item.id.toString() : index.toString()
	}, [])

	const dateKeyExtractor = useCallback((item, index) => index.toString(), [])

	// Memoized button styles
	const primaryButtonStyle = useMemo(
		() => [
			styles.primaryButton,
			!newNoteText.trim() && styles.primaryButtonDisabled,
		],
		[newNoteText]
	)

	// Memoized input placeholders
	const titlePlaceholder = useMemo(
		() => (editingNote ? loc.t('note.editTask') : loc.t('note.noteTitle')),
		[editingNote, loc]
	)

	const descriptionPlaceholder = useMemo(
		() =>
			editingNote
				? loc.t('note.editDescription')
				: loc.t('note.descriptionOptional'),
		[editingNote, loc]
	)

	return (
		<View style={styles.container}>
			{/* Date Selector */}
			<View style={styles.dateSelector}>
				<FlatList
					ref={dateScrollRef}
					data={dates}
					renderItem={renderDateItem}
					keyExtractor={dateKeyExtractor}
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.dateScrollContainer}
					getItemLayout={getDateItemLayout}
					removeClippedSubviews={true}
					maxToRenderPerBatch={10}
					windowSize={10}
					initialNumToRender={7}
				/>
			</View>

			{/* Notes List */}
			<View style={styles.notesContainer}>
				{loading ? (
					<LoadingList />
				) : combinedNotes.length > 0 ? (
					<FlatList
						data={combinedNotes}
						renderItem={renderNoteItem}
						keyExtractor={keyExtractor}
						removeClippedSubviews={true}
						maxToRenderPerBatch={10}
						windowSize={10}
						initialNumToRender={8}
						updateCellsBatchingPeriod={100}
						keyboardShouldPersistTaps="handled"
						keyboardDismissMode="on-drag"
					/>
				) : (
					<EmptyState message={loc.t('note.noNotes')} />
				)}
			</View>

			{/* Add/Edit Note Input */}
			<View style={styles.inputContainer}>
				{editingNote && (
					<View style={styles.editingBanner}>
						<Text style={styles.editingText}>
							{loc.t('note.editing')}: {editingNote.name}
						</Text>
					</View>
				)}
				<View style={styles.inputRow}>
					<TextInput
						style={styles.textInput}
						placeholder={titlePlaceholder}
						placeholderTextColor={'#9CA3AF'}
						value={newNoteText}
						onChangeText={setNewNoteText}
					/>
					<TouchableOpacity
						onPress={editingNote ? handleSaveEdit : handleAddNote}
						style={primaryButtonStyle}
						disabled={!newNoteText.trim()}
					>
						<Text style={styles.primaryButtonText}>
							{editingNote ? loc.t('note.save') : loc.t('note.add')}
						</Text>
					</TouchableOpacity>
					{editingNote && (
						<TouchableOpacity
							onPress={handleCancelEdit}
							style={styles.secondaryButton}
						>
							<Text style={styles.secondaryButtonText}>
								{loc.t('note.cancel')}
							</Text>
						</TouchableOpacity>
					)}
				</View>
				<TextInput
					style={styles.textInputMultiline}
					placeholder={descriptionPlaceholder}
					placeholderTextColor={'#9CA3AF'}
					value={newNoteDescription}
					onChangeText={setNewNoteDescription}
					multiline
					textAlignVertical="top"
				/>
			</View>

			{/* Delete Confirmation Modal */}
			<DeleteModal
				visible={showDeleteModal}
				onClose={handleCloseDeleteModal}
				onConfirm={confirmDeleteNote}
				title={loc.t('note.deleteNote') || 'Delete Note'}
				subtitle={deleteSubtitle}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F9FAFB',
	},
	dateSelector: {
		backgroundColor: '#3B82F6',
		paddingVertical: 16,
	},
	dateScrollContainer: {
		paddingHorizontal: 16,
	},
	dateItem: {
		padding: 12,
		paddingVertical: 16,
		borderRadius: 8,
		marginHorizontal: 4,
		minWidth: 80,
		alignItems: 'center',
	},
	dateItemSelected: {
		backgroundColor: '#FFFFFF',
	},
	dateItemToday: {
		backgroundColor: '#F3EFEE',
	},
	dateItemDefault: {
		backgroundColor: '#DBEAFE',
	},
	dayText: {
		fontSize: 14,
		fontWeight: '500',
	},
	dayTextSelected: {
		color: '#2563EB',
	},
	dayTextDefault: {
		color: '#374151',
	},
	dateText: {
		fontSize: 18,
		fontWeight: 'bold',
	},
	dateTextSelected: {
		color: '#2563EB',
	},
	dateTextDefault: {
		color: '#1F2937',
	},
	notesContainer: {
		marginTop: 16,
		flex: 1,
	},
	noteItem: {
		marginHorizontal: 16,
		marginVertical: 8,
		padding: 16,
		borderRadius: 8,
	},
	noteItemCompleted: {
		borderWidth: 2,
		borderColor: 'rgba(0, 0, 0, 0.1)',
		backgroundColor: 'transparent',
	},
	noteItemIncomplete: {
		backgroundColor: '#F3EFEE',
	},
	noteRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	noteContent: {
		flex: 1,
	},
	noteDescription: {
		marginLeft: 40,
		fontSize: 14,
		marginTop: 4,
	},
	noteDescriptionActive: {
		color: '#121212',
	},
	noteDescriptionCompleted: {
		color: '#9CA3AF',
	},
	noteActions: {
		flexDirection: 'row',
		alignItems: 'center',
		marginLeft: 16,
	},
	actionButton: {
		padding: 8,
	},
	actionButtonDelete: {
		padding: 8,
		marginLeft: 8,
	},
	skeletonContainer: {
		marginHorizontal: 16,
		marginVertical: 8,
		padding: 16,
		borderRadius: 8,
		backgroundColor: '#F3EFEE',
	},
	emptyState: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 80,
	},
	emptyStateText: {
		color: '#6B7280',
		fontSize: 16,
	},
	sectionHeader: {
		marginHorizontal: 16,
		marginTop: 24,
		marginBottom: 8,
		fontSize: 12,
		fontWeight: '600',
		color: '#F97316',
		textTransform: 'uppercase',
	},
	inputContainer: {
		padding: 16,
		backgroundColor: '#FFFFFF',
		borderTopWidth: 1,
		borderTopColor: '#E5E7EB',
	},
	editingBanner: {
		marginBottom: 12,
		padding: 8,
		backgroundColor: '#EFF6FF',
		borderRadius: 8,
	},
	editingText: {
		fontSize: 14,
		color: '#2563EB',
		fontWeight: '500',
	},
	inputRow: {
		flexDirection: 'row',
		marginBottom: 8,
	},
	textInput: {
		borderWidth: 2,
		borderColor: '#D1D5DB',
		flex: 1,
		borderRadius: 8,
		padding: 12,
		marginRight: 16,
		fontSize: 16,
	},
	textInputMultiline: {
		borderWidth: 2,
		borderColor: '#D1D5DB',
		borderRadius: 8,
		padding: 12,
		height: 80,
		textAlignVertical: 'top',
		fontSize: 16,
	},
	primaryButton: {
		backgroundColor: '#3B82F6',
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 8,
		justifyContent: 'center',
	},
	primaryButtonDisabled: {
		backgroundColor: '#9CA3AF',
	},
	primaryButtonText: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 16,
	},
	secondaryButton: {
		backgroundColor: '#6B7280',
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderRadius: 8,
		justifyContent: 'center',
		marginLeft: 8,
	},
	secondaryButtonText: {
		color: '#FFFFFF',
		fontWeight: '600',
		fontSize: 16,
	},
	bouncyCheckboxIcon: {
		borderColor: '#0E4B99',
	},
	bouncyCheckboxInnerIcon: {
		borderWidth: 2,
	},
})
