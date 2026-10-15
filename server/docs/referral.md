# Referral System — Finalized Plan (Architecture Checkpoint)

## 1. What the Current System Does

**Schema**

- `ReferralCode` — one row per user, can belong to an `Owner` or a `SalesRepresentative` (SR), distinguished by `userType: ReferralCodeOwnerType`.
- `Referral` — created when a new user signs up with a referral code. Has `referralCodeId` and `referredUser: Owner` (SR cannot be a referred user today).
- `ReferralReward` — single row tracking both sides of one referral. Has duplicated `referrer*` and `referred*` fields: status, reward type (`CREDITS` / `SUBSCRIPTION_EXTENSION`), amount, claimed-at, shop pointer, tenant pointer.

**Signup flow**

- `UserServices.createUser` (owner or employee) — accepts an optional `referralCode`. If present, creates a `Referral` linked to the new Owner and a default `ReferralReward` (PENDING). The reward is always tied to a `Shop` and a `Tenant`.
- `UserServices.createSale` — creates an SR with an auto-generated `ReferralCode` but **never consumes a referral code**. No `Referral` or `ReferralReward` is created for SRs today.

**Reward flow**

- `referralService.getAllReferralRewards` — only queries the `Owner` table. SRs cannot list their rewards.
- `referralService.claimReferralReward` — requires `activeShopId`. For `CREDITS` it upserts the shop's `CreditWallet` and creates a `CreditTopup`. For `SUBSCRIPTION_EXTENSION` it extends the shop's active `Subscription.endDate`. Marks the matching side of `ReferralReward` as `CLAIMED`.

**Result today**: owner-to-owner referrals pay both sides, SRs who refer owners get nothing, and SRs cannot use or be referenced by any referral code.

## 2. New Features

### F1. SRs can receive referral rewards (CREDITS only)
SRs have no shop, so the reward is delivered via a new SR-side wallet (`SalesRepCreditWallet` + `SalesRepCreditTopup`). SR claims are forced to `rewardType: CREDITS`; `SUBSCRIPTION_EXTENSION` is rejected.

### F2. SRs can refer other SRs (no immediate reward; chain promise instead)
- SR signs up using another SR's code.
- Creates a `Referral` with `referredSalesRepresentative` set.
- Creates a `ReferralChainPromise` recording that the upstream SR will be owed a half-reward when the downstream SR refers their first Owner.
- No `ReferralReward` is created at this point.
- Owners cannot refer SRs (rejected at validation).

### F3. SR→SR→Owner chain payout (depth 1)
When an SR (B) brings in an Owner (O), two rewards fire:
- **B gets the full SR-referrer reward** (CREDITS only) for O as referrer.
- **A (B's referrer) gets a half-reward** (CREDITS only), but **only if this is B's first successful Owner conversion** and a pending chain promise exists for B. The half-amount is snapshotted at promise-creation time.

A does not get anything for any further owners B refers. Subsequent owner referrals by B give only B a reward.

### F4. Reward listing exposes chain data
SRs can list their pending rewards, their outstanding chain promises, and any chain bonuses owed to them.

## 3. Valid Referral Graph (final)

| Case | Code owner | New user | Immediate reward | Chain effect |
|---|---|---|---|---|
| 1 | none | Owner | none | none |
| 2 | Owner | Owner | both get reward (unchanged) | none |
| 3 | SR | Owner | SR gets CREDITS, Owner gets reward on first claim | resolves upstream promise if any |
| 4 | SR | SR | none | creates `ReferralChainPromise` |
| 5 | Owner | SR | rejected (rule 5) | n/a |

## 4. Concrete Schema Changes

### `Referral`
- Make `referredUser` optional.
- Add `referredSalesRepresentative: SalesRepresentative?` with relation `"srReferred"`.
- Add `@@index([referredSalesRepresentative])`.

### `ReferralReward`
- Already nullable: `referrerShopId`, `referredShopId`, `referrerTenantId`, `referredTenantId`.
- Add `referrerSalesRepId: String?` and `referredSalesRepId: String?` with relations `"RewardReferrerSR"` / `"RewardReferredSR"`.
- RewardType stays CREDITS / SUBSCRIPTION_EXTENSION. SR claims always use CREDITS.

### `SalesRepresentative`
- Add inverse relation `referralsReferred: Referral[] @relation("srReferred")`.
- Add inverse relations for the reward pointers: `RewardReferrerSR`, `RewardReferredSR`.
- Add inverse relations for chain promise: `promisesAsUpstream: ReferralChainPromise[]`, `promiseAsDownstream: ReferralChainPromise? @relation("PromiseDownstream")`.

### NEW: `ReferralChainPromiseStatus` enum
`PENDING`, `FULFILLED`.

### NEW: `ReferralChainPromise`
- `id`, `upstreamSalesRepId` (FK to `SalesRepresentative.userID`).
- `downstreamSalesRepId` **unique** — enforces one referrer per downstream SR.
- `halfAmount: Float` — snapshotted at creation, never recomputed.
- `status: ReferralChainPromiseStatus @default(PENDING)`.
- `fulfilledAt: DateTime?`.
- `fulfilledByReferralId: String? @unique` — the owner referral that fulfilled it; prevents double-fire on race.
- `createdAt`, `updatedAt`.
- Indexes: `@@index([upstreamSalesRepId, status])`.

### NEW: `SalesRepCreditWallet`
- `id`, `salesRepId @unique`, `totalCredits Float`, `usedCredits Float`, timestamps.
- One wallet per SR.

### NEW: `SalesRepCreditTopup`
- `id`, `salesRepId`, `walletId`, `credits Float`, `reason String?` (e.g. `REFERRAL_REWARD`, `REFERRAL_CHAIN_BONUS`), `refId String?` (loose pointer to `ReferralReward.id`), `addedAt`.
- Indexes on `salesRepId`, `walletId`.

No `SalesRepCreditUsage` table — SRs only receive credits for now.

## 5. Behavior Changes (per entry point)

### `UserServices.createSale` (new: accept referralCode)
1. Accept optional `referralCode` in payload.
2. If provided, validate the `ReferralCode` exists. Reject if `userType === OWNER` (rule 5).
3. Create the SR + auto-generated `ReferralCode` for the new SR (existing logic).
4. If referral code was provided:
   - Create a `Referral` row with `referralCodeId` and `referredSalesRepresentative = newSR`. No `referredUser`. No `ReferralReward`.
   - Create a `ReferralChainPromise` with `upstreamSalesRepId = referralCode.salesRepresentativeId`, `downstreamSalesRepId = newSR.userID`, `halfAmount = referrerCredits / 2`, `status = PENDING`.
   - If `downstreamSalesRepId` unique constraint fires: reject the signup with a clear error (this SR is already in a chain).

### `UserServices.createUser` (owner signup, extended)
1. Existing owner + `ReferralCode` + (if code used) `Referral` + default `ReferralReward` (PENDING).
2. After creating the main reward, look up the `ReferralCode` used:
   - **If owner-owned code**: no chain logic. End.
   - **If SR-owned code**: the referrer is `SR_b`.
     - Set the main `ReferralReward.referrerSalesRepId = SR_b.userID` (already known via `ReferralCode.salesRepresentativeId`). SR_b will see this in their `asReferrer[]`.
     - Look up `ReferralChainPromise` where `downstreamSalesRepId = SR_b.userID` and `status = PENDING`.
     - If found:
       - Update promise: `status = FULFILLED`, `fulfilledAt = now()`, `fulfilledByReferralId = thisReferral.id`.
       - Create a **second** `ReferralReward` row for the chain bonus:
         - `referralId = thisReferral.id` (one-to-one — would conflict with the existing main reward).
         - **Resolution**: do **not** reuse `thisReferral.id`. Instead, the chain bonus gets its own `Referral` row? No — chain bonus is not a referral of its own.
         - **Cleaner**: keep `ReferralReward` one-to-one with `Referral`; represent the chain bonus as a separate row tied to `upstreamSalesRepId` only, no `referralId` link. Make `referralId` on `ReferralReward` **nullable** and add `chainBonusReferralId: String? @unique` as the alternate inverse.
         - The chain bonus row is created with `referrerSalesRepId = SR_a.userID`, `referrerCredits = promise.halfAmount`, `referrerStatus = PENDING`, `referrerRewardType = CREDITS`.
         - All within the same transaction as the main signup so race-safety holds.
       - If `fulfilledByReferralId @unique` constraint fires: rollback and surface a retry message (race lost).
     - If no promise: do nothing (SR_b was created with no upstream, e.g. SR_b signed up without a code).
3. **One-to-one constraint on `ReferralReward.referralId`**: change from `@unique` to nullable + drop `@unique`, add `@unique` on `chainBonusReferralId` (or similar) so both the main reward and the chain bonus can co-exist without colliding.

### `referralService.getAllReferralRewards`
Branch on caller role:
- **Owner** — existing logic (asReferred from `Owner.referral`, asReferrer from `ReferralCode.Referrals`).
- **SR** — return:
  - `asReferred`: still `null` (no SR→SR reward), but expose inbound referral info for display.
  - `asReferrer`: `ReferralCode.Referrals` where referred is an Owner; their `referrer*` PENDING rewards (always CREDITS).
  - `chainBonuses`: `ReferralReward` rows where `referrerSalesRepId = me` AND `referrerStatus = PENDING` (the chain bonuses owed to me).
  - `outstandingChainPromises`: `ReferralChainPromise` where `upstreamSalesRepId = me` and `status = PENDING`, joined with the downstream SR's name/number for UI.

### `referralService.claimReferralReward`
1. Validation:
   - `activeShopId` and `salesRepId` are mutually exclusive; exactly one is required.
   - If caller role is SR → `salesRepId` required, `activeShopId` rejected. Force `rewardType = CREDITS`; reject `SUBSCRIPTION_EXTENSION` with 400.
   - If caller role is Owner → `activeShopId` required, `salesRepId` rejected.
2. Validate the reward's pointer side matches:
   - If claiming `userType === 'referrer'`:
     - Owner: `reward.referrerShopId` is null but `referrerSalesRepId` set → reject.
     - SR: `reward.referrerSalesRepId` set, `referrerShopId` null → accept.
3. Apply:
   - CREDITS + shop → existing wallet/topup path.
   - CREDITS + SR → upsert `SalesRepCreditWallet`, create `SalesRepCreditTopup` with `reason = 'REFERRAL_REWARD'` or `'REFERRAL_CHAIN_BONUS'` (based on whether the reward row has a non-null `chainBonusReferralId` or some discriminator field), set `refId = reward.id`.
   - SUBSCRIPTION_EXTENSION + shop → existing path.
   - SUBSCRIPTION_EXTENSION + SR → rejected.
4. Mark the matching side CLAIMED with `referrerShopId` or `referrerSalesRepId` as appropriate.

### `UserServices.verifyReferral`
No change — just verifies a code exists.

### Sale rep routes / middleware
- verifyTenant.ts — confirm `/referral/*` routes allow SR with no tenant header. Already passes `auth(OWNER, SALES_REPRESENTATIVE)`, but the middleware must not reject on missing tenant for SR calls.

## 6. API Surface Changes (FE-facing)

- `POST /user/create-sale` body — add optional `referralCode: string`.
- `POST /referral/claim-reward` body — `activeShopId` now optional, add `salesRepId: string` (mutually exclusive). Reward type is enforced server-side for SRs.
- `GET /referral/available-rewards` response for SR — adds `chainBonuses[]` and `outstandingChainPromises[]`.

## 7. Files To Change

**Schema / migrations**
- schema.prisma — Referral, ReferralReward, SalesRepresentative updates; new ReferralChainPromise, SalesRepCreditWallet, SalesRepCreditTopup, ReferralChainPromiseStatus enum.
- New migration.sql — all additive, null-safe for existing data; drop the `@unique` on `referral_rewards.referralId` and add nullable.

**Validation / interfaces**
- user.validations.ts — accept `referralCode` on sale creation.
- user.interface.ts — extend `ISale`.
- referral.validation.ts — `activeShopId` optional, `salesRepId` added.
- referral.interface.ts — same.

**Services**
- user.service.ts — extend `createSale` and `createUser` as described above.
- referral.service.ts — `getAllReferralRewards` + `claimReferralReward` branch on role, add SR wallet writes.
- New `src/app/modules/salesRepCredit/salesRepCredit.service.ts` — wallet read/balance helpers.

**Controllers / routes**
- user.controller.ts + user.routes.ts — already wired; ensure validation accepts `referralCode` on create-sale.
- referral.controller.ts — `claimReferralReward` accepts `salesRepId`.
- (Optional) saleRepresentative.controller.ts — `GET /:id/referrals` listing for SR dashboard.

**Middleware sanity-check**
- verifyTenant.ts — confirm SR with no tenant passes for `/referral/*`.

## 8. Locked-In Decisions

1. **Single credit unit**, shared with the existing `CreditWallet`. SRs use a parallel `SalesRepCreditWallet` that uses the same float unit.
2. **Chain depth = 1.** A gets rewarded once per downstream B, on B's first owner conversion. No further hops.
3. **Half-reward = `referrerCredits / 2`**.
4. **No expiry** on chain promises.
5. **Owners cannot refer SRs** — rejected at validation in `createSale`.
6. **Snapshot `halfAmount`** at promise creation (default `referrerCredits / 2 = 50`).
7. **Promise still fires** even if downstream SR is later `isDeleted = true`.
8. **No admin revoke action** for chain promises.
9. **Chain bonus lives in `ReferralReward`** — handled by making `referralId` nullable (one-to-one removed) and adding a discriminator (`chainBonusReferralId` or a `bonusType` field).
10. **Reward amounts hard-coded** — `referrerCredits = 100`, `halfAmount = 50`. No config table.

## 9. Race & Edge Cases (all handled in design)

- Two concurrent owner signups referred by the same downstream SR → `fulfilledByReferralId @unique` + transaction → one wins, one rolls back.
- Two SRs both refer the same new SR → `downstreamSalesRepId @unique` → second signup rejected.
- Downstream SR deleted before converting → promise still fires on first owner conversion.
- Config changes later → snapshot protects existing promises.
- SR claiming subscription extension → rejected at validation.

## 10. What Stays the Same

- Owner→Owner referral flow (case 2).
- `CreditWallet`/`CreditTopup`/`Subscription` logic for owners.
- `RewardType` and `RewardClaimStatus` enums.
- Existing `referral_rewards` rows remain valid (new fields nullable).
- `verifyReferral` endpoint.
- Auth/role middleware surface.

---
