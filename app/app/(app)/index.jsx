import { router } from 'expo-router'
import { useAuth } from '../../src/context/AuthContext'

export default function Index() {
	const { authState } = useAuth()

	// Redirect authenticated users directly to dashboard
	if (authState.authenticated) {
		return router.replace('/home/dashboard')
	}

	// Fallback to home if not authenticated (though this shouldn't happen due to auth guard)
	return router.replace('/home')
}
