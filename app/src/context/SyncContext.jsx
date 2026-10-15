import React, {
	createContext,
	useContext,
	useState,
	useRef,
	useCallback,
	useEffect,
} from 'react'
import { useAuth } from './AuthContext'
import useApi from '../hooks/useApi'
import {
	getCheckpoint,
	upsertCheckpoint,
} from '../controllers/offline/syncCheckpoint'
import { localProductController } from '../controllers/offline/product'
import {
	getAllInventory,
	getAllProductsFromShop,
	getAllLotFromShop,
} from '../controllers/product'

const SyncContext = createContext(null)
export const useSyncContext = () => useContext(SyncContext)

const PAGE_SIZES = {
	product: 50,
	variant: 30,
	lot: 30,
}

const GLOBAL_SHOP = 'GLOBAL'

async function syncEntity({
	entity,
	shopId,
	pageSize,
	fetchFn,
	upsertFn,
	fetchData,
	onProgress,
	isCancelled,
}) {
	let checkpoint = await getCheckpoint(shopId, entity)
	let currentPage = checkpoint?.currentPage || 0
	let total = checkpoint?.total || 0

	// if already done, skip
	if (checkpoint?.status === 'done') {
		onProgress?.(total, total)
		return
	}

	// ensure we have a checkpoint row to resume from
	if (!checkpoint) {
		await upsertCheckpoint({
			shopId,
			entity,
			currentPage: 0,
			pageSize,
			total: 0,
			status: 'pending',
		})
	}

	while (true) {
		if (isCancelled?.()) break
		const nextPage = currentPage + 1

		// extra params per entity
		const extra = {}
		if (entity === 'variant') extra.includeProduct = false

		let res
		try {
			res = await fetchData(fetchFn, {
				page: nextPage,
				limit: pageSize,
				...extra,
			})
		} catch (e) {
			console.log(`[sync] fetch ${entity} page ${nextPage} error`, e?.message)
			throw e
		}

		if (!res?.success) {
			throw new Error(res?.message || `Failed to fetch ${entity}`)
		}

		const metaTotal = res?.data?.meta?.total ?? 0
		const dataArr = res?.data?.data ?? []

		if (nextPage === 1) {
			total = metaTotal
		}

		// Empty total => mark done immediately
		if (total === 0) {
			await upsertCheckpoint({
				shopId,
				entity,
				currentPage: nextPage,
				pageSize,
				total: 0,
				status: 'done',
			})
			onProgress?.(0, 0)
			break
		}

		if (dataArr.length > 0) {
			try {
				await upsertFn(dataArr)
			} catch (e) {
				console.log(`[sync] upsert ${entity} error`, e?.message)
				throw new Error(e?.message || `Error saving ${entity}`)
			}
		}

		const fetchedSoFar = Math.min(nextPage * pageSize, total)
		// decide done: no data, or fetched >= total, or last page smaller than pageSize
		const isDone =
			dataArr.length === 0 || fetchedSoFar >= total || dataArr.length < pageSize

		await upsertCheckpoint({
			shopId,
			entity,
			currentPage: nextPage,
			pageSize,
			total,
			status: isDone ? 'done' : 'syncing',
		})

		onProgress?.(fetchedSoFar, total)

		if (isDone) break
		if (dataArr.length === 0) break

		currentPage = nextPage

		// yield to keep UI responsive
		await new Promise((r) => setTimeout(r, 0))
	}
}

export const SyncProvider = ({ children }) => {
	const { authState } = useAuth()
	const { fetchData } = useApi()

	const [isSyncing, setIsSyncing] = useState(false)
	const [phase, setPhase] = useState(null) // product | variant | lot | null
	const [progress, setProgress] = useState({
		product: null,
		variant: null,
		lot: null,
	})
	const [error, setError] = useState(null)

	const runningRef = useRef(false)
	const cancelRef = useRef(false)
	const lastShopRef = useRef(null)
	const pendingShopRef = useRef(null)

	const isCancelled = useCallback(() => cancelRef.current, [])

	const startSync = useCallback(
		async (overrideShopId) => {
			const token = authState?.token
			if (!token) return
			if (runningRef.current) {
				// queue for after current run — keep latest shopId
				const queued =
					overrideShopId !== undefined ? overrideShopId : authState?.shopId
				pendingShopRef.current = queued
				// ask current loop to stop early if it's for a different shop
				if (queued !== lastShopRef.current) cancelRef.current = true
				return
			}

			// determine shopId for variant/lot
			const shopId =
				overrideShopId !== undefined ? overrideShopId : authState?.shopId

			runningRef.current = true
			cancelRef.current = false
			setIsSyncing(true)
			setError(null)

			try {
				// 1) products — global
				let prodCp = await getCheckpoint(GLOBAL_SHOP, 'product')
				if (!prodCp || prodCp.status !== 'done') {
					setPhase('product')
					await syncEntity({
						entity: 'product',
						shopId: GLOBAL_SHOP,
						pageSize: PAGE_SIZES.product,
						fetchFn: getAllInventory,
						upsertFn: localProductController.upsertIntoInventory,
						fetchData,
						onProgress: (done, total) =>
							setProgress((p) => ({ ...p, product: { done, total } })),
						isCancelled,
					})
				} else {
					setProgress((p) => ({
						...p,
						product: { done: prodCp.total, total: prodCp.total },
					}))
				}

				// 2) variants + lots per shop (only if shop selected)
				if (shopId) {
					let varCp = await getCheckpoint(shopId, 'variant')
					if (!varCp || varCp.status !== 'done') {
						setPhase('variant')
						await syncEntity({
							entity: 'variant',
							shopId,
							pageSize: PAGE_SIZES.variant,
							fetchFn: getAllProductsFromShop,
							upsertFn: localProductController.upsertIntoShopVariant,
							fetchData,
							onProgress: (done, total) =>
								setProgress((p) => ({ ...p, variant: { done, total } })),
							isCancelled,
						})
					} else {
						setProgress((p) => ({
							...p,
							variant: { done: varCp.total, total: varCp.total },
						}))
					}

					let lotCp = await getCheckpoint(shopId, 'lot')
					if (!lotCp || lotCp.status !== 'done') {
						setPhase('lot')
						await syncEntity({
							entity: 'lot',
							shopId,
							pageSize: PAGE_SIZES.lot,
							fetchFn: getAllLotFromShop,
							upsertFn: localProductController.upsertIntoLot,
							fetchData,
							onProgress: (done, total) =>
								setProgress((p) => ({ ...p, lot: { done, total } })),
							isCancelled,
						})
					} else {
						setProgress((p) => ({
							...p,
							lot: { done: lotCp.total, total: lotCp.total },
						}))
					}
				}

				// done silently — no UI toast (removed per requirement)
			} catch (e) {
				console.log('[sync] error', e?.message)
				setError(e?.message || 'Sync failed')
				// silent fail — keep checkpoint for resume (no toast)
			} finally {
				setIsSyncing(false)
				setPhase(null)
				runningRef.current = false
				cancelRef.current = false
				// if a shop switch was queued while we were running, start it now
				if (pendingShopRef.current !== null) {
					const queued = pendingShopRef.current
					pendingShopRef.current = null
					// delay to let state settle
					setTimeout(() => startSync(queued), 300)
				}
			}
		},
		[authState?.token, authState?.shopId, fetchData]
	)

	// auto-start: on token/shop change, resume
	useEffect(() => {
		if (!authState?.token) return
		const shopId = authState?.shopId
		// small delay to let SecureStore/DB settle
		const t = setTimeout(() => {
			if (runningRef.current) {
				// queue switch — will cancel current loop if different shop
				if (shopId !== lastShopRef.current) {
					pendingShopRef.current = shopId
					cancelRef.current = true
				}
			} else {
				startSync(shopId)
			}
			lastShopRef.current = shopId
		}, 500)
		return () => clearTimeout(t)
	}, [authState?.token, authState?.shopId, startSync])

	const cancelSync = useCallback(() => {
		cancelRef.current = true
	}, [])

	const value = {
		isSyncing,
		phase,
		progress,
		error,
		startSync,
		cancelSync,
	}

	return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
