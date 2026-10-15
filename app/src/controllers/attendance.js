import apiClient from './apiClient'

async function clockIn(params) {
	const reqBody = {
		date: params.data.date,
	}
	const res = await apiClient.post('/employee/attendance/clock-in', reqBody, {
		headers: {
			'Content-Type': 'application/json',
			Authorization: params.token,
		},
	})
	return res.data
}

async function clockOut(params) {
	const reqBody = {
		date: params.data.date,
	}
	const res = await apiClient.post('/employee/attendance/clock-in', reqBody, {
		headers: {
			'Content-Type': 'application/json',
			Authorization: params.token,
		},
	})
	return res.data
}

async function getAttendance(params) {
	const { month, year, employeeId = null } = params.data
	const { shopId } = params
	const res = await apiClient.get('/employee/attendance/details', {
		headers: {
			Authorization: params.token,
		},
		params: employeeId ? { month, year, employeeId } : { month, year, shopId },
	})
	return res.data
}

async function getPendingAttendance(params) {
	const { shopId } = params
	const reqUrl = `/employee/attendance/clock-requests/${shopId}`

	const res = await apiClient.get(reqUrl, {
		headers: {
			Authorization: params.token,
		},
	})
	return res.data
}

async function handleAttendanceRequest(params) {
	const res = await apiClient.post(
		'/employee/attendance/update-attendance',
		params.data,
		{
			headers: {
				Authorization: params.token,
				'Content-Type': 'application/json',
			},
		}
	)
	return res.data
}

export const attendanceController = {
	clockIn,
	clockOut,
	getAttendance,
	getPendingAttendance,
	handleAttendanceRequest,
}
