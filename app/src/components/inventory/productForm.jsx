import React, { useState, useRef, useEffect, useCallback } from 'react'
import QuickEntryForm from './QuickEntryForm'
import FullProductForm from './FullProductForm'

/**
 * Thin orchestrator — delegates to QuickEntryForm (lot !== null/undefined)
 * vs FullProductForm. Preserves the original `isQuickEntry && !showFullForm`
 * vs `!isQuickEntry || showFullForm` branching and the handleFormSubmit/closeForm contract.
 * Ponytail-style reuse: no duplicated validation, number handling, or supplier logic.
 */
const ProductForm = React.forwardRef(function ProductForm(
	{
		initialValues = {},
		handleFormSubmit,
		closeForm,
		visible = true,
		ref: propRef,
	},
	forwardedRef
) {
	const isQuickEntry =
		initialValues.lot !== null && initialValues.lot !== undefined
	const [showFullForm, setShowFullForm] = useState(false)
	const quickEntryRef = useRef(null)
	const fullFormRef = useRef(null)

	// Backwards compat: original ProductForm accepted `ref` as a regular prop via getProps spread
	const resolvedFullRef = forwardedRef || propRef || fullFormRef

	useEffect(() => {
		// Reset full-form flag when closed
		if (!visible) setShowFullForm(false)
	}, [visible])

	const handleQuickSubmit = useCallback(
		(filteredValues) => {
			handleFormSubmit(filteredValues)
		},
		[handleFormSubmit]
	)

	const handleFullSubmit = useCallback(
		(filteredValues) => {
			handleFormSubmit(filteredValues)
		},
		[handleFormSubmit]
	)

	const handleEditFromQuickEntry = useCallback(() => {
		quickEntryRef.current?.dismiss?.()
		setTimeout(() => {
			setShowFullForm(true)
		}, 220)
	}, [])

	const handleQuickClose = useCallback(() => {
		quickEntryRef.current?.dismiss?.()
		setTimeout(() => closeForm(), 150)
	}, [closeForm])

	const handleFullClose = useCallback(() => {
		resolvedFullRef.current?.dismiss?.()
		setTimeout(() => closeForm(), 150)
	}, [closeForm, resolvedFullRef])

	const handleQuickDismiss = useCallback(() => closeForm(), [closeForm])
	const handleFullDismiss = useCallback(() => closeForm(), [closeForm])

	if (!visible) return null

	// Replicates original branching:
	// QuickEntry: isQuickEntry && !showFullForm
	// Full: !isQuickEntry || showFullForm
	if (isQuickEntry && !showFullForm) {
		return (
			<QuickEntryForm
				visible={visible}
				initialValues={initialValues}
				onSubmit={handleQuickSubmit}
				onClose={handleQuickClose}
				onDismiss={handleQuickDismiss}
				onEditFullForm={handleEditFromQuickEntry}
				sheetRef={quickEntryRef}
			/>
		)
	}

	return (
		<FullProductForm
			visible={visible}
			initialValues={initialValues}
			onSubmit={handleFullSubmit}
			onClose={handleFullClose}
			onDismiss={handleFullDismiss}
			sheetRef={resolvedFullRef}
		/>
	)
})

export default ProductForm
