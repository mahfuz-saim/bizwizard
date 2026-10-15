// @dead-code — 2026-09-24 knip+grep: 0 active imports, candidate for removal (kept per request)
import apiClient from './apiClient'

async function getPickUp(data) {
	const res = await apiClient.get(`/pickup/${data.shopId}`, {
		headers: {
			Authorization: data.token,
		},
	})
	return res.data
}

export { getPickUp }
