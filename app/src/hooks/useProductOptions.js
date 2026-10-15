import { useMemo, useCallback } from 'react'
import { useLocalization } from '../localization/localizationContext'

export const useProductOptions = (measuringUnit) => {
	const { loc } = useLocalization()

	const unitOptions = useMemo(
		() => [
			{ key: 'bag', label: loc.t('productForm.bag'), value: 'Bag' },
			{ key: 'barrel', label: loc.t('productForm.barrel'), value: 'Barrel' },
			{ key: 'bottle', label: loc.t('productForm.bottle'), value: 'Bottle' },
			{ key: 'box', label: loc.t('productForm.box'), value: 'Box (box)' },
			{ key: 'carton', label: loc.t('productForm.carton'), value: 'Carton' },
			{ key: 'dozen', label: loc.t('productForm.dozen'), value: 'Dozen (doz)' },
			{ key: 'feet', label: loc.t('productForm.feet'), value: 'Feet (ft)' },
			{ key: 'meter', label: loc.t('productForm.meter'), value: 'Meter (m)' },
			{ key: 'yard', label: loc.t('productForm.yard'), value: 'Yard' },
			{
				key: 'kilogram',
				label: loc.t('productForm.kilogram'),
				value: 'Kilogram (kg)',
			},
			{ key: 'roll', label: loc.t('productForm.roll'), value: 'Roll' },
			{ key: 'gram', label: loc.t('productForm.gram'), value: 'Gram (g)' },
			{ key: 'litre', label: loc.t('productForm.litre'), value: 'Litre (L)' },
			{
				key: 'millilitre',
				label: loc.t('productForm.millilitre'),
				value: 'Millilitre (mL)',
			},
			{ key: 'piece', label: loc.t('productForm.piece'), value: 'Piece (pc)' },
			{
				key: 'squareFeet',
				label: loc.t('productForm.squareFeet'),
				value: 'Square feet (sq ft)',
			},
			{
				key: 'squareMeter',
				label: loc.t('productForm.squareMeter'),
				value: 'Square meter (sq m)',
			},
			{
				key: 'squareYard',
				label: loc.t('productForm.squareYard'),
				value: 'Square yard (sq yd)',
			},
			{ key: 'ton', label: loc.t('productForm.ton'), value: 'Ton' },
		],
		[loc]
	)

	const categoryOptions = useMemo(() => {
		const opts = []
		const categoryData = loc.t('productForm.category')
		if (categoryData && typeof categoryData === 'object') {
			for (const [key, value] of Object.entries(categoryData)) {
				opts.push({ key, label: value, value: key })
			}
		}
		if (opts.length === 0)
			opts.push({ key: 'OTHER', label: 'Other', value: 'OTHER' })
		return opts
	}, [loc])

	const findMatchingUnit = useCallback(
		(unit) => {
			if (!unit) return ''
			const mu = unit.toLowerCase()
			const matched = unitOptions.find(
				(u) =>
					u.value.toLowerCase().includes(mu) ||
					mu.includes(u.value.toLowerCase())
			)
			return matched?.value || ''
		},
		[unitOptions]
	)

	// convenience: resolve initial measuringUnit directly
	const resolvedUnit = useMemo(
		() => findMatchingUnit(measuringUnit),
		[findMatchingUnit, measuringUnit]
	)

	return { unitOptions, categoryOptions, findMatchingUnit, resolvedUnit }
}
