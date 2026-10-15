import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
	View,
	Text,
	TouchableOpacity,
	Modal,
	ToastAndroid,
	ActivityIndicator,
	FlatList,
	StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import AntDesign from '@expo/vector-icons/AntDesign'
import ContentLoader, { Rect } from 'react-content-loader/native'
import useApi from '../../../../../src/hooks/useApi'
import { attendanceController } from '../../../../../src/controllers/attendance'
import { useLocalization } from '../../../../../src/localization/localizationContext'
import { useNumberTranslator } from '../../../../../src/hooks/useNumberTranslator'

const AttendanceScreen = () => {
	const { employeeId } = useLocalSearchParams()
	const { fetchData } = useApi()
	const { loc } = useLocalization()
	const { translateNumber } = useNumberTranslator()

	const [currentDate, setCurrentDate] = useState(new Date())
	const [attendanceData, setAttendanceData] = useState([])
	const [loading, setLoading] = useState(true)
	const [calendarLoading, setCalendarLoading] = useState(false)
	const [selectedDate, setSelectedDate] = useState(null)
	const [modalVisible, setModalVisible] = useState(false)

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

	const fetchAttendanceData = async (date = currentDate) => {
		try {
			if (loading) {
				setCalendarLoading(true)
			} else {
				setLoading(true)
			}

			const dateMonth = date.getMonth() + 1
			const dateYear = date.getFullYear()
			const params = {
				month: dateMonth,
				year: dateYear,
				employeeId: employeeId,
			}
			const response = await fetchData(
				attendanceController.getAttendance,
				params
			)
			if (response?.data) {
				setAttendanceData(response.data)
			} else {
				setAttendanceData([])
			}
		} catch (error) {
			ToastAndroid.show(
				loc.t('attendance.errors.fetchFailed'),
				ToastAndroid.SHORT
			)
		} finally {
			setLoading(false)
			setCalendarLoading(false)
		}
	}

	useEffect(() => {
		fetchAttendanceData(currentDate)
	}, [currentDate, employeeId])

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

	const formatTime = (timeString) => {
		if (!timeString) return loc.t('attendance.todayStatus.noTime')
		const time = new Date(timeString)
		return time.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
		})
	}

	const getStatusText = (status) => {
		switch (status) {
			case 'PRESENT':
				return loc.t('attendance.status.present')
			case 'ABSENT':
				return loc.t('attendance.status.absent')
			case 'LATE':
				return loc.t('attendance.status.late')
			case 'PENDING':
				return loc.t('attendance.status.pending')
			case 'REQUESTED':
				return loc.t('attendance.status.requested')
			default:
				return loc.t('attendance.status.unknown')
		}
	}

	const openDateModal = (day) => {
		if (!day) return
		const attendanceRecord = getAttendanceForDate(day)
		const dateStr = `${dateInfo.year}-${String(dateInfo.month + 1).padStart(
			2,
			'0'
		)}-${String(day).padStart(2, '0')}`
		setSelectedDate({ day, dateStr, attendanceRecord })
		setModalVisible(true)
	}

	// Memoized CalendarDay component
	const CalendarDay = React.memo(({ item }) => {
		const status = getDayStatus(item.day)
		const dayStyle = getDayStyle(status)
		const textStyle = getTextStyle(status)

		return (
			<TouchableOpacity
				style={dayStyle}
				onPress={() => openDateModal(item.day)}
				disabled={!item.day}
			>
				{item.day && <Text style={textStyle}>{translateNumber(item.day)}</Text>}
			</TouchableOpacity>
		)
	})

	// Memoized CalendarWeek component
	const CalendarWeek = React.memo(({ week }) => (
		<View style={styles.weekRow}>
			{week.map((item) => (
				<CalendarDay key={item.key} item={item} />
			))}
		</View>
	))

	// Memoized SkeletonLoader component
	const SkeletonLoader = React.memo(() => (
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
				<ActivityIndicator size="large" color="#195FE1" />
				<Text style={styles.loadingText}>
					{loc.t('attendance.loadingMessage')}
				</Text>
			</View>
		)
	}

	const flatListData = [
		{ key: 'calendar', type: 'calendar' },
		{ key: 'legend', type: 'legend' },
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
									<CalendarWeek key={weekIndex} week={week} />
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

			default:
				return null
		}
	}

	return (
		<SafeAreaView style={styles.container}>
			<FlatList
				data={flatListData}
				renderItem={renderItem}
				keyExtractor={(item) => item.key}
				style={styles.container}
				showsVerticalScrollIndicator={false}
			/>

			{/* Date Detail Modal */}
			<Modal
				animationType="slide"
				transparent={true}
				visible={modalVisible}
				onRequestClose={() => setModalVisible(false)}
			>
				<View style={styles.modalOverlay}>
					<View style={styles.modalContainer}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>
								{loc.t('attendance.attendanceDetails')}
							</Text>
							<TouchableOpacity
								onPress={() => setModalVisible(false)}
								style={styles.closeButton}
							>
								<AntDesign name="close" size={24} color="#666" />
							</TouchableOpacity>
						</View>

						{selectedDate && (
							<View style={styles.modalContent}>
								<View style={styles.dateHeader}>
									<Text style={styles.dateText}>
										{new Date(selectedDate.dateStr).toLocaleDateString(
											'en-US',
											{
												weekday: 'long',
												year: 'numeric',
												month: 'long',
												day: 'numeric',
											}
										)}
									</Text>
								</View>

								{selectedDate.attendanceRecord ? (
									<>
										<View style={styles.detailContainer}>
											<View style={styles.detailItem}>
												<Text style={styles.detailLabel}>
													{loc.t('attendance.todayStatus.clockIn')}
												</Text>
												<View style={styles.detailValue}>
													<Text style={styles.timeText}>
														{formatTime(selectedDate.attendanceRecord.inTime)}
													</Text>
													<View
														style={[
															styles.statusBadge,
															{
																backgroundColor:
																	selectedDate.attendanceRecord.inStatus ===
																	'PRESENT'
																		? '#D1FAE5'
																		: '#FEE2E2',
															},
														]}
													>
														<Text
															style={[
																styles.statusText,
																{
																	color:
																		selectedDate.attendanceRecord.inStatus ===
																		'PRESENT'
																			? '#065F46'
																			: '#DC2626',
																},
															]}
														>
															{getStatusText(
																selectedDate.attendanceRecord.inStatus
															)}
														</Text>
													</View>
												</View>
											</View>

											<View style={styles.detailItem}>
												<Text style={styles.detailLabel}>
													{loc.t('attendance.todayStatus.clockOut')}
												</Text>
												<View style={styles.detailValue}>
													<Text style={styles.timeText}>
														{formatTime(selectedDate.attendanceRecord.outTime)}
													</Text>
													<View
														style={[
															styles.statusBadge,
															{
																backgroundColor:
																	selectedDate.attendanceRecord.outStatus ===
																	'PRESENT'
																		? '#D1FAE5'
																		: '#FEE2E2',
															},
														]}
													>
														<Text
															style={[
																styles.statusText,
																{
																	color:
																		selectedDate.attendanceRecord.outStatus ===
																		'PRESENT'
																			? '#065F46'
																			: '#DC2626',
																},
															]}
														>
															{getStatusText(
																selectedDate.attendanceRecord.outStatus
															)}
														</Text>
													</View>
												</View>
											</View>
										</View>
									</>
								) : (
									<View style={styles.noRecordContainer}>
										<AntDesign name="calendar" size={48} color="#D1D5DB" />
										<Text style={styles.noRecordText}>
											{loc.t('attendance.noRecordFound')}
										</Text>
									</View>
								)}
							</View>
						)}
					</View>
				</View>
			</Modal>
		</SafeAreaView>
	)
}

export default AttendanceScreen

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#F9FAFB',
	},
	loadingContainer: {
		flex: 1,
		backgroundColor: '#F9FAFB',
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
	headerContent: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	backButton: {
		padding: 8,
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: '600',
		color: '#1F2937',
		textAlign: 'center',
		flex: 1,
	},
	headerSpacer: {
		width: 40,
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
	modalOverlay: {
		flex: 1,
		justifyContent: 'flex-end',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
	},
	modalContainer: {
		backgroundColor: 'white',
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		padding: 24,
		maxHeight: '60%',
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		color: '#1F2937',
	},
	closeButton: {
		padding: 8,
	},
	modalContent: {
		gap: 16,
	},
	dateHeader: {
		backgroundColor: '#F9FAFB',
		padding: 16,
		borderRadius: 12,
	},
	dateText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#1F2937',
		textAlign: 'center',
	},
	detailContainer: {
		gap: 12,
	},
	detailItem: {
		backgroundColor: '#F3F4F6',
		padding: 16,
		borderRadius: 12,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	detailLabel: {
		fontSize: 14,
		fontWeight: '500',
		color: '#374151',
	},
	detailValue: {
		alignItems: 'flex-end',
	},
	timeText: {
		fontSize: 16,
		fontWeight: '600',
		color: '#1F2937',
		marginBottom: 4,
	},
	statusBadge: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 6,
	},
	statusText: {
		fontSize: 12,
		fontWeight: '500',
	},
	noRecordContainer: {
		alignItems: 'center',
		paddingVertical: 32,
		backgroundColor: '#F9FAFB',
		borderRadius: 12,
	},
	noRecordText: {
		fontSize: 14,
		color: '#6B7280',
		marginTop: 12,
		textAlign: 'center',
	},
})
