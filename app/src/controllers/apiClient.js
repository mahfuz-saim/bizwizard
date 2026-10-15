import axios from 'axios'
import { BACKEND } from '../constants'
import * as SecureStore from 'expo-secure-store'

const apiClient = axios.create({
	baseURL: BACKEND,
	validateStatus: () => true,
})

export default apiClient
