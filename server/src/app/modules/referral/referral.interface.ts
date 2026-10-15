export interface IReferralClaim {
    rewardId: string;
    rewardType: 'CREDITS' | 'SUBSCRIPTION_EXTENSION';
    userType: 'referrer' | 'referred';
    // exactly one of these two is set, depending on caller role
    activeShopId?: string;
    salesRepId?: string;
}
