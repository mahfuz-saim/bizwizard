import { useState, useEffect, useCallback } from 'react'
import useApi from './useApi'
import { getAllSupplier } from '../controllers/supplier'
import { useLocalization } from '../localization/localizationContext'

export const useSuppliers = () => {
	const { fetchData } = useApi()
	const { loc } = useLocalization()
	const [suppliers, setSuppliers] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	const fetchSuppliers = useCallback(async () => {
		setLoading(true)
		setError('')
		try {
			const res = await fetchData(getAllSupplier, {})
			if (res.success) {
				setSuppliers(res.data.data || [])
			} else {
				setError(
					res.message ||
						loc.t('productForm.failedToFetchSuppliers') ||
						'Failed to fetch suppliers'
				)
			}
		} catch (e) {
			setError(
				e.message ||
					loc.t('productForm.failedToFetchCustomers') ||
					'Failed to fetch suppliers'
			)
			console.error('Error fetching suppliers:', e)
		} finally {
			setLoading(false)
		}
	}, [fetchData, loc])

	useEffect(() => {
		fetchSuppliers()
	}, [fetchSuppliers])

	return { suppliers, loading, error, refresh: fetchSuppliers, setError }
}
