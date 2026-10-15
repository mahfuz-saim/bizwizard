import apiClient from './apiClient'

/**
 * Get all referral rewards for the current user
 * @param {Object} data - Contains token and shopId
 * @returns {Promise<Object>} Response with asReferred and asReferrer rewards
 */
async function getReferralRewards(data) {
	const res = await apiClient.get('/referral/available-rewards', {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	return res.data
}

/**
 * Claim a referral reward
 * @param {Object} data - Contains token, shopId, and claim data
 * @param {string} data.data.activeShopId - Shop ID to credit reward
 * @param {string} data.data.rewardId - Reward ID to claim
 * @param {string} data.data.rewardType - 'CREDITS' or 'SUBSCRIPTION_EXTENSION'
 * @param {string} data.data.userType - 'referrer' or 'referred'
 * @returns {Promise<Object>} Response with success status
 */
async function availReferralReward(data) {
	const reqBody = {
		activeShopId: data.shopId,
		rewardId: data.data.rewardId,
		rewardType: data.data.rewardType,
		userType: data.data.userType,
	}

	const res = await apiClient.post('/referral/claim-reward', reqBody, {
		headers: {
			Authorization: data.token,
			'Content-Type': 'application/json',
		},
	})
	const resJson = res.data
	return resJson
}

export { getReferralRewards, availReferralReward }
