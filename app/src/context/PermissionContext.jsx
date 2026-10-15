import { createContext, useContext, useMemo, useState } from 'react'
import * as SecureStore from 'expo-secure-store'

const PermissionContext = createContext(null)

export const usePermission = () => {
	const ctx = useContext(PermissionContext)
	if (!ctx) {
		throw new Error('usePermission must be used within a PermissionProvider')
	}
	return ctx
}

export const PermissionProvider = ({ children }) => {
	const [contactsPermission, setContactsPermission] = useState(null)

	// expo-file-system is only needed when a screen actually requests
	// storage access — load it lazily on first invocation.
	async function getStoragePermission() {
		const FileSystem = await import('expo-file-system/legacy')
		let permissions = await SecureStore.getItemAsync('permittedFolder')
		if (!permissions) {
			const result =
				await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
			if (result?.directoryUri) {
				await SecureStore.setItemAsync('permittedFolder', result.directoryUri)
				return result.directoryUri
			}
			return null
		}
		return permissions
	}

	// expo-contacts is only needed when a screen reads the contacts list —
	// load it lazily on first invocation.
	async function getContactsPermission() {
		const Contacts = await import('expo-contacts')
		const { status } = await Contacts.requestPermissionsAsync()
		const permission = {
			granted: status === 'granted',
			canAskAgain: status !== 'denied',
		}
		setContactsPermission(permission)
		return permission
	}

	const values = useMemo(
		() => ({
			contactsPermission,
			getStoragePermission,
			getContactsPermission,
		}),
		[contactsPermission]
	)

	return (
		<PermissionContext.Provider value={values}>
			{children}
		</PermissionContext.Provider>
	)
}

// ----------------------------------------------------------------------------
// Camera permission is isolated into its own provider so the camera hook
// doesn't run for the whole app — only the screens that actually open the
// scanner mount this provider.
// ----------------------------------------------------------------------------
const CameraPermissionContext = createContext(null)

export const useCameraPermission = () => {
	const ctx = useContext(CameraPermissionContext)
	if (!ctx) {
		throw new Error(
			'useCameraPermission must be used within a CameraPermissionProvider'
		)
	}
	return ctx
}

import { useCameraPermissions } from 'expo-camera'

export const CameraPermissionProvider = ({ children }) => {
	const [cameraPermission, requestCameraPermission] = useCameraPermissions()

	async function getCameraPermission() {
		if (!cameraPermission || !cameraPermission.granted) {
			return await requestCameraPermission()
		}
		return cameraPermission
	}

	const values = useMemo(
		() => ({
			cameraPermission,
			getCameraPermission,
		}),
		[cameraPermission]
	)

	return (
		<CameraPermissionContext.Provider value={values}>
			{children}
		</CameraPermissionContext.Provider>
	)
}
