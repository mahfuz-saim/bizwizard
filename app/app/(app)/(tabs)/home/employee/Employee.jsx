import React, {
	useState,
	useEffect,
	useMemo,
	memo,
	useCallback,
	useRef,
} from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	ToastAndroid,
	FlatList,
	ActivityIndicator,
	StyleSheet,
	BackHandler,
} from 'react-native'
import AntDesign from '@expo/vector-icons/AntDesign'
import ContentLoader, { Rect } from 'react-content-loader/native'
import { ErrorModal } from '../../../../../src/components/AlertModal.jsx'
import { attendanceController } from '../../../../../src/controllers/attendance'
import useApi from '../../../../../src/hooks/useApi'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator'
import { router, useFocusEffect } from 'expo-router'

export default function AttendanceScreen() {
	const [attendanceData, setAttendanceData] = useState([])
	const [loading, setLoading] = useState(true)
	const [calendarLoading, setCalendarLoading] = useState(false)
	const [clockingIn, setClockingin] = useState(false)
	const [clockingOut, setClockingOut] = useState(false)
	const [currentDate, setCurrentDate] = useState(new Date())
	const [showErrorModal, setShowErrorModal] = useState(false)
	const [errorMessage, setErrorMessage] = useState('')
	const { fetchData } = useApi()
	const { loc } = useLocalization()
	const { translateNumber } = useNumberTranslator()

	// Use ref to track if data has been loaded before
	const hasLoadedOnce = useRef(false)

	// Memoized days of week for localization
	const daysOfWeek = useMemo(
		() => [
			loc.t('attendance.calendar.daysOfWeek.sun'),
			loc.t('attendance.calendar.daysOfWeek.mon'),
			loc.t('attendance.calendar.daysOfWeek.tue'),
			loc.t('attendance.calendar.daysOfWeek.wed'),
			loc.t('attendance.calendar.daysOfWeek.thu'),
			loc.t('attendance.calendar.daysOfWeek.fri'),
			loc.t('attendance.calendar.daysOfWeek.sat'),
		],
		[loc]
	)

	// Memoized month/year translation
	const getTranslatedMonthYear = useCallback(
		(date) => {
			const monthName = date.toLocaleDateString('en-US', { month: 'long' })
			const year = date.getFullYear()

			// Get translated month name from locale
			const translatedMonth =
				loc.t(`attendance.calendar.months.${monthName.toLowerCase()}`) ||
				monthName

			// Translate year numbers
			const translatedYear = translateNumber(year)

			return `${translatedMonth} ${translatedYear}`
		},
		[loc, translateNumber]
	)

	// Memoized date calculations
	const dateInfo = useMemo(() => {
		const year = currentDate.getFullYear()
		const month = currentDate.getMonth()
		const today = new Date()
		const todayStr = `${today.getFullYear()}-${String(
			today.getMonth() + 1
		).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

		return {
			year,
			month,
			dateMonth: month + 1,
			dateYear: year,
			today,
			todayStr,
			isCurrentMonth:
				month === today.getMonth() && year === today.getFullYear(),
		}
	}, [currentDate])

	// Memoized attendance lookup
	const todayAttendance = useMemo(() => {
		return attendanceData.find((attendance) =>
			attendance.date.startsWith(dateInfo.todayStr)
		)
	}, [attendanceData, dateInfo.todayStr])

	// Memoized attendance status
	const attendanceStatus = useMemo(() => {
		const hasClockdIn =
			todayAttendance &&
			(todayAttendance.inStatus === 'REQUESTED' ||
				todayAttendance.inStatus === 'PRESENT' ||
				todayAttendance.inStatus === 'LATE')
		const hasClockdOut =
			todayAttendance &&
			(todayAttendance.outStatus === 'REQUESTED' ||
				todayAttendance.outStatus === 'PRESENT' ||
				todayAttendance.outStatus === 'LATE')

		return { hasClockdIn, hasClockdOut }
	}, [todayAttendance])

	// Mock API calls - replace with actual API endpoints
	const fetchAttendanceDetails = useCallback(
		async (date = currentDate) => {
			try {
				// Only show calendar loading for month changes, not initial load
				if (hasLoadedOnce.current) {
					setCalendarLoading(true)
				} else {
					setLoading(true)
				}

				const dateMonth = date.getMonth() + 1
				const dateYear = date.getFullYear()
				const result = await fetchData(attendanceController.getAttendance, {
					month: dateMonth,
					year: dateYear,
				})

				if (!result?.success) {
					setAttendanceData([])
				} else {
					setAttendanceData(result.data)
				}

				hasLoadedOnce.current = true
			} catch (error) {
				ToastAndroid.show(
					loc.t('attendance.errors.fetchFailed') ||
						'Failed to fetch attendance data',
					ToastAndroid.SHORT
				)
			} finally {
				setLoading(false)
				setCalendarLoading(false)
			}
		},
		[fetchData]
	)

	const clockIn = useCallback(async () => {
		try {
			setClockingin(true)
			ToastAndroid.show(
				loc.t('attendance.messages.clockInSuccess') ||
					'Clock-in request submitted',
				ToastAndroid.SHORT
			)
			const today = new Date()
			const result = await fetchData(attendanceController.clockIn, {
				date: today,
			})
			await fetchAttendanceDetails() // Refresh data
		} catch (error) {
			ToastAndroid.show(
				loc.t('attendance.errors.clockInFailed') || 'Failed to clock in',
				ToastAndroid.SHORT
			)
		} finally {
			setClockingin(false)
		}
	}, [fetchData, fetchAttendanceDetails])

	const clockOut = useCallback(async () => {
		try {
			setClockingOut(true)
			ToastAndroid.show(
				loc.t('attendance.messages.clockOutSuccess') ||
					'Clock-out request submitted',
				ToastAndroid.SHORT
			)
			const today = new Date()
			const result = await fetchData(attendanceController.clockIn, {
				date: today,
			})
			await fetchAttendanceDetails() // Refresh data
		} catch (error) {
			ToastAndroid.show(
				loc.t('attendance.errors.clockOutFailed') || 'Failed to clock out',
				ToastAndroid.SHORT
			)
		} finally {
			setClockingOut(false)
		}
	}, [fetchData, fetchAttendanceDetails])

	useEffect(() => {
		fetchAttendanceDetails(currentDate)
	}, [currentDate])

	useFocusEffect(
		useCallback(() => {
			const onBackPress = () => {
				router.push('/home/dashboard')
				return true // Prevent default behavior
			}

			const subscription = BackHandler.addEventListener(
				'hardwareBackPress',
				onBackPress
			)

			return () => subscription.remove()
		}, [])
	)

	// Navigate to previous month
	const goToPreviousMonth = useCallback(() => {
		const newDate = new Date(currentDate)
		newDate.setMonth(newDate.getMonth() - 1)
		setCurrentDate(newDate)
	}, [currentDate])

	// Navigate to next month
	const goToNextMonth = useCallback(() => {
		const newDate = new Date(currentDate)
		newDate.setMonth(newDate.getMonth() + 1)
		setCurrentDate(newDate)
	}, [currentDate])

	// Memoized calendar data
	const calendarData = useMemo(() => {
		const { year, month } = dateInfo
		const firstDay = new Date(year, month, 1)
		const lastDay = new Date(year, month + 1, 0)
		const daysInMonth = lastDay.getDate()
		const startingDayOfWeek = firstDay.getDay()

		const days = []

		// Add empty cells for days before the month starts
		for (let i = 0; i < startingDayOfWeek; i++) {
			days.push(null)
		}

		// Add days of the month
		for (let i = 1; i <= daysInMonth; i++) {
			days.push(i)
		}

		// Generate calendar rows (weeks) for proper 7-column layout
		const rows = []
		for (let i = 0; i < days.length; i += 7) {
			const week = days.slice(i, i + 7)
			while (week.length < 7) {
				week.push(null)
			}
			rows.push(week.map((day, index) => ({ day, key: `${i}-${index}` })))
		}

		return { rows, daysInMonth }
	}, [dateInfo])

	// Memoized attendance lookup function
	const getAttendanceForDate = useCallback(
		(day) => {
			if (!day) return null
			const dateStr = `${dateInfo.year}-${String(dateInfo.month + 1).padStart(
				2,
				'0'
			)}-${String(day).padStart(2, '0')}`
			return attendanceData.find((attendance) =>
				attendance.date.startsWith(dateStr)
			)
		},
		[attendanceData, dateInfo.year, dateInfo.month]
	)

	const getDayStatus = useCallback(
		(day) => {
			if (!day) return 'empty'
			const attendance = getAttendanceForDate(day)
			const isToday =
				day === dateInfo.today.getDate() &&
				dateInfo.month === dateInfo.today.getMonth() &&
				dateInfo.year === dateInfo.today.getFullYear()

			if (isToday) return 'today'
			if (!attendance) return 'absent'
			if (attendance.inStatus === 'PRESENT' || attendance.inStatus === 'LATE')
				return 'present'
			if (
				attendance.inStatus === 'PENDING' ||
				attendance.inStatus === 'REQUESTED'
			)
				return 'pending'
			return 'absent'
		},
		[getAttendanceForDate, dateInfo]
	)

	// Memoized style functions
	const getDayStyle = useCallback((status) => {
		switch (status) {
			case 'today':
				return [styles.dayBase, styles.todayDay]
			case 'present':
				return [styles.dayBase, styles.presentDay]
			case 'pending':
				return [styles.dayBase, styles.pendingDay]
			case 'absent':
				return [styles.dayBase, styles.absentDay]
			case 'empty':
				return [styles.dayBase, styles.emptyDay]
			default:
				return [styles.dayBase, styles.defaultDay]
		}
	}, [])

	const getTextStyle = useCallback((status) => {
		switch (status) {
			case 'today':
			case 'present':
			case 'pending':
				return styles.whiteText
			case 'absent':
				return styles.grayText
			default:
				return styles.darkText
		}
	}, [])

	// Check if today's attendance is already given - removed old function and variable

	// Memoized StatusIcon component
	const StatusIcon = memo(({ status }) => {
		const iconProps = { size: 20 }

		switch (status) {
			case 'PRESENT':
				return <AntDesign name="checkcircleo" {...iconProps} color="#3B82F6" />
			case 'LATE':
				return (
					<AntDesign name="exclamationcircleo" {...iconProps} color="#EF4444" />
				)
			case 'REQUESTED':
			case 'PENDING':
				return <AntDesign name="clockcircleo" {...iconProps} color="#3B82F6" />
			case 'ABSENT':
				return <AntDesign name="closecircle" {...iconProps} color="#EF4444" />
			default:
				return null
		}
	})

	// Memoized CalendarDay component
	const CalendarDay = memo(
		({ item, getDayStatus, getDayStyle, getTextStyle, translateNumber }) => {
			const status = getDayStatus(item.day)
			const dayStyle = getDayStyle(status)
			const textStyle = getTextStyle(status)

			return (
				<View style={dayStyle}>
					{item.day && (
						<Text style={textStyle}>{translateNumber(item.day)}</Text>
					)}
				</View>
			)
		}
	)

	// Memoized CalendarWeek component
	const CalendarWeek = memo(
		({ week, getDayStatus, getDayStyle, getTextStyle, translateNumber }) => (
			<View style={styles.weekRow}>
				{week.map((item) => (
					<CalendarDay
						key={item.key}
						item={item}
						getDayStatus={getDayStatus}
						getDayStyle={getDayStyle}
						getTextStyle={getTextStyle}
						translateNumber={translateNumber}
					/>
				))}
			</View>
		)
	)

	// Memoized SkeletonLoader component
	const SkeletonLoader = memo(() => (
		<ContentLoader
			speed={2}
			width="100%"
			height={300}
			backgroundColor="#f3f3f3"
			foregroundColor="#ecebeb"
		>
			<Rect x="0" y="20" rx="8" ry="8" width="100%" height="260" />
		</ContentLoader>
	))

	if (loading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" color="#177DFF" />
				<Text style={styles.loadingText}>
					{loc.t('attendance.loadingMessage')}
				</Text>
			</View>
		)
	}

	const flatListData = [
		{ key: 'calendar', type: 'calendar' },
		{ key: 'legend', type: 'legend' },
		...(todayAttendance ? [{ key: 'todayStatus', type: 'todayStatus' }] : []),
		{ key: 'buttons', type: 'buttons' },
	]

	const renderItem = ({ item }) => {
		switch (item.type) {
			case 'calendar':
				return (
					<View style={styles.calendarContainer}>
						{/* Month Navigation inside calendar frame */}
						<View style={styles.monthNavigation}>
							<TouchableOpacity
								onPress={goToPreviousMonth}
								style={styles.navButton}
							>
								<AntDesign name="left" size={20} color="#374151" />
							</TouchableOpacity>

							<Text style={styles.monthText}>
								{getTranslatedMonthYear(currentDate)}
							</Text>

							<TouchableOpacity
								onPress={goToNextMonth}
								style={styles.navButton}
							>
								<AntDesign name="right" size={20} color="#374151" />
							</TouchableOpacity>
						</View>

						{calendarLoading ? (
							<SkeletonLoader />
						) : (
							<>
								{/* Days of week header */}
								<View style={styles.daysHeader}>
									{daysOfWeek.map((day, index) => (
										<Text key={index} style={styles.dayHeaderText}>
											{day}
										</Text>
									))}
								</View>

								{/* Calendar grid */}
								{calendarData.rows.map((week, weekIndex) => (
									<CalendarWeek
										key={weekIndex}
										week={week}
										getDayStatus={getDayStatus}
										getDayStyle={getDayStyle}
										getTextStyle={getTextStyle}
										translateNumber={translateNumber}
									/>
								))}
							</>
						)}
					</View>
				)

			case 'legend':
				return (
					<View style={styles.legendContainer}>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendDot, { backgroundColor: '#3B82F6' }]}
							/>
							<Text style={styles.legendText}>
								{loc.t('attendance.legend.today')}
							</Text>
						</View>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendDot, { backgroundColor: '#10B981' }]}
							/>
							<Text style={styles.legendText}>
								{loc.t('attendance.legend.present')}
							</Text>
						</View>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendDot, { backgroundColor: '#F59E0B' }]}
							/>
							<Text style={styles.legendText}>
								{loc.t('attendance.legend.pending')}
							</Text>
						</View>
						<View style={styles.legendItem}>
							<View
								style={[styles.legendDot, { backgroundColor: '#D1D5DB' }]}
							/>
							<Text style={styles.legendText}>
								{loc.t('attendance.legend.absent')}
							</Text>
						</View>
					</View>
				)

			case 'todayStatus':
				return (
					<View style={styles.todayStatusContainer}>
						<Text style={styles.todayStatusTitle}>
							{loc.t('attendance.todayStatus.title')}
						</Text>

						<View style={styles.statusRow}>
							<View style={styles.statusLabel}>
								<Text style={styles.statusText}>
									{loc.t('attendance.todayStatus.clockIn')}
								</Text>
								<StatusIcon status={todayAttendance.inStatus} />
							</View>
							<Text style={styles.timeText}>
								{todayAttendance.inTime
									? new Date(todayAttendance.inTime).toLocaleTimeString(
											'en-US',
											{
												hour: '2-digit',
												minute: '2-digit',
											}
										)
									: loc.t('attendance.todayStatus.noTime')}
							</Text>
						</View>

						<View style={styles.statusRow}>
							<View style={styles.statusLabel}>
								<Text style={styles.statusText}>
									{loc.t('attendance.todayStatus.clockOut')}
								</Text>
								<StatusIcon status={todayAttendance.outStatus} />
							</View>
							<Text style={styles.timeText}>
								{todayAttendance.outTime
									? new Date(todayAttendance.outTime).toLocaleTimeString(
											'en-US',
											{
												hour: '2-digit',
												minute: '2-digit',
											}
										)
									: loc.t('attendance.todayStatus.noTime')}
							</Text>
						</View>
					</View>
				)

			case 'buttons':
				return (
					<View style={styles.buttonsContainer}>
						{/* Clock In Button */}
						<TouchableOpacity
							onPress={clockIn}
							disabled={attendanceStatus.hasClockdIn || clockingIn}
							style={[
								styles.actionButton,
								attendanceStatus.hasClockdIn
									? styles.disabledButton
									: styles.clockInButton,
							]}
						>
							<View style={styles.buttonContent}>
								{clockingIn ? (
									<ActivityIndicator
										size="small"
										color="white"
										style={styles.buttonIcon}
									/>
								) : (
									<AntDesign
										name="clockcircleo"
										size={20}
										color={attendanceStatus.hasClockdIn ? '#6B7280' : 'white'}
										style={styles.buttonIcon}
									/>
								)}
								<Text
									style={[
										styles.buttonText,
										attendanceStatus.hasClockdIn
											? styles.disabledButtonText
											: styles.enabledButtonText,
									]}
								>
									{clockingIn
										? loc.t('attendance.buttons.clockingIn')
										: loc.t('attendance.buttons.clockIn')}
								</Text>
							</View>
						</TouchableOpacity>

						{attendanceStatus.hasClockdIn && !attendanceStatus.hasClockdOut && (
							<View style={styles.statusMessage}>
								<Text style={styles.statusMessageText}>
									{loc.t('attendance.messages.clockInRequestSubmitted')}
								</Text>
							</View>
						)}

						{/* Clock Out Button */}
						<TouchableOpacity
							onPress={clockOut}
							disabled={
								!attendanceStatus.hasClockdIn ||
								attendanceStatus.hasClockdOut ||
								clockingOut
							}
							style={[
								styles.actionButton,
								!attendanceStatus.hasClockdIn || attendanceStatus.hasClockdOut
									? styles.disabledButton
									: styles.clockOutButton,
							]}
						>
							<View style={styles.buttonContent}>
								{clockingOut ? (
									<ActivityIndicator
										size="small"
										color="white"
										style={styles.buttonIcon}
									/>
								) : (
									<AntDesign
										name="clockcircleo"
										size={20}
										color={
											!attendanceStatus.hasClockdIn ||
											attendanceStatus.hasClockdOut
												? '#6B7280'
												: 'white'
										}
										style={styles.buttonIcon}
									/>
								)}
								<Text
									style={[
										styles.buttonText,
										!attendanceStatus.hasClockdIn ||
										attendanceStatus.hasClockdOut
											? styles.disabledButtonText
											: styles.enabledButtonText,
									]}
								>
									{clockingOut
										? loc.t('attendance.buttons.clockingOut')
										: loc.t('attendance.buttons.clockOut')}
								</Text>
							</View>
						</TouchableOpacity>

						{attendanceStatus.hasClockdOut && (
							<View style={styles.statusMessage}>
								<Text style={styles.statusMessageText}>
									{loc.t('attendance.messages.clockOutRequestSubmitted')}
								</Text>
							</View>
						)}

						{!attendanceStatus.hasClockdIn && (
							<View style={styles.statusMessage}>
								<Text style={styles.statusMessageText}>
									{loc.t('attendance.messages.pleaseClockInFirst')}
								</Text>
							</View>
						)}
					</View>
				)

			default:
				return null
		}
	}

	return (
		<>
			<FlatList
				data={flatListData}
				renderItem={renderItem}
				keyExtractor={(item) => item.key}
				style={styles.container}
				showsVerticalScrollIndicator={false}
				removeClippedSubviews={true}
				maxToRenderPerBatch={3}
				updateCellsBatchingPeriod={50}
				initialNumToRender={3}
				windowSize={5}
			/>

			{/* Error Modal */}
			<ErrorModal
				visible={showErrorModal}
				onClose={() => setShowErrorModal(false)}
				title={loc.t('error') || 'Error'}
				subtitle={errorMessage}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F9FAFB',
	},
	loadingContainer: {
		flex: 1,
		backgroundColor: 'white',
		alignItems: 'center',
		justifyContent: 'center',
	},
	loadingText: {
		marginTop: 16,
		color: '#6B7280',
		fontSize: 16,
	},
	headerContainer: {
		backgroundColor: 'white',
		paddingHorizontal: 24,
		paddingVertical: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: 'regular',
		color: '#1F2937',
		textAlign: 'center',
	},
	monthNavigation: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 16,
		paddingHorizontal: 4,
	},
	navButton: {
		padding: 8,
	},
	monthText: {
		color: '#6B7280',
		textAlign: 'center',
		flex: 1,
		fontSize: 16,
		fontWeight: '500',
	},
	calendarContainer: {
		backgroundColor: 'white',
		borderRadius: 16,
		padding: 16,
		marginHorizontal: 24,
		marginBottom: 8,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	daysHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 12,
		paddingHorizontal: 4,
	},
	dayHeaderText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#6B7280',
		flex: 1,
		textAlign: 'center',
	},
	weekRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 4,
		marginBottom: 4,
	},
	dayBase: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		flex: 1,
		marginHorizontal: 2,
	},
	todayDay: {
		backgroundColor: '#3B82F6',
	},
	presentDay: {
		backgroundColor: '#10B981',
	},
	pendingDay: {
		backgroundColor: '#F59E0B',
	},
	absentDay: {
		backgroundColor: '#D1D5DB',
	},
	emptyDay: {
		backgroundColor: 'transparent',
	},
	defaultDay: {
		backgroundColor: '#E5E7EB',
	},
	whiteText: {
		color: 'white',
		fontWeight: '600',
		fontSize: 14,
	},
	grayText: {
		color: '#6B7280',
		fontSize: 14,
	},
	darkText: {
		color: '#1F2937',
		fontSize: 14,
	},
	legendContainer: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		marginTop: 8,
		paddingHorizontal: 24,
		marginBottom: 16,
	},
	legendItem: {
		alignItems: 'center',
	},
	legendDot: {
		width: 16,
		height: 16,
		borderRadius: 8,
		marginBottom: 4,
	},
	legendText: {
		fontSize: 12,
		color: '#6B7280',
	},
	todayStatusContainer: {
		marginHorizontal: 24,
		marginTop: 16,
		backgroundColor: 'white',
		borderRadius: 16,
		padding: 16,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
		marginBottom: 16,
	},
	todayStatusTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#1F2937',
		marginBottom: 12,
	},
	statusRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	statusLabel: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	statusText: {
		color: '#6B7280',
		marginRight: 8,
		fontSize: 14,
	},
	timeText: {
		fontSize: 14,
		color: '#6B7280',
	},
	buttonsContainer: {
		marginHorizontal: 24,
		marginTop: 4,
		marginBottom: 16,
	},
	actionButton: {
		paddingVertical: 16,
		paddingHorizontal: 24,
		borderRadius: 16,
		marginBottom: 12,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	clockInButton: {
		backgroundColor: '#3B82F6',
	},
	clockOutButton: {
		backgroundColor: '#EF4444',
	},
	disabledButton: {
		backgroundColor: '#E5E7EB',
	},
	buttonContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
	buttonIcon: {
		marginRight: 12,
	},
	buttonText: {
		fontSize: 18,
		fontWeight: '600',
	},
	enabledButtonText: {
		color: 'white',
	},
	disabledButtonText: {
		color: '#6B7280',
	},
	statusMessage: {
		marginBottom: 16,
	},
	statusMessageText: {
		fontSize: 14,
		color: '#6B7280',
		textAlign: 'center',
	},
})
