import apiClient from './apiClient'
export async function addNote(data) {
	const reqBody = {
		shopID: data.shopId,
		...data.data.data,
	}
	const res = await apiClient.post('/note', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function getAllNote(data) {
	const res = await apiClient.get(`/note/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
		params: {
			date: data.data.date,
		},
	})
	return res.data
}

export async function updateNote(data) {
	const res = await apiClient.put(`/note/${data.data.noteId}`, data.data.data, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function deleteNote(data) {
	const res = await apiClient.delete(`/note/${data.data.noteId}`, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}
