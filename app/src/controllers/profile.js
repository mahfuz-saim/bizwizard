import apiClient from './apiClient'

export async function getProfileInfo(params) {
	const res = await apiClient.get('/user/profile', {
		headers: {
			Authorization: params.token,
		},
	})
	return res.data
}
