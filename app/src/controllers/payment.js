import apiClient from './apiClient'

export async function paymentInit(data) {
	const reqBody = {
		...data.data,
		shopId: data.shopId,
	}
	const res = await apiClient.post('/shop/payment/init', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

export async function verifyCoupon(couponCode) {
	try {
		const res = await apiClient.get(`/coupon/verify/${couponCode}`)
		return res.data
	} catch (err) {
		return { success: false, message: err.message }
	}
}
