import 'react-native-gesture-handler'
import { Drawer } from 'expo-router/drawer'
import React, {
	useState,
	useEffect,
	useMemo,
	useCallback,
	useRef,
	memo,
} from 'react'
import {
	View,
	TouchableOpacity,
	Text,
	Image,
	InteractionManager,
	StyleSheet,
} from 'react-native'
import Fontisto from '@expo/vector-icons/Fontisto'
import CustomDrawerContent from '../../../../../src/components/CustomDrawerContent'
import { router, useNavigation } from 'expo-router'
import { DrawerActions } from '@react-navigation/native'
import { getShopInfo } from '../../../../../src/controllers/shop'
import useApi from '../../../../../src/hooks/useApi'
import ICON from '../../../../../assets/icon.png'

// Memoized icon instances — avoid re-creating vector glyph components per render
const BellIcon = memo((props) => <Fontisto name="bell" {...props} />)
const MenuIcon = memo((props) => <Fontisto name="nav-icon-a" {...props} />)

// Static skeleton placeholder shown until shop info arrives
const ShopNameSkeleton = memo(() => <View style={styles.skeletonPill} />)

// HeaderLeft — receives shopName as prop so React.memo can skip re-renders
const HeaderLeft = memo(({ shopName, loaded }) => (
	<View style={styles.headerLeft}>
		<Image
			source={ICON}
			style={styles.logo}
			resizeMode="cover"
			fadeDuration={0}
		/>
		{loaded && shopName ? (
			<Text style={styles.shopName} numberOfLines={1}>
				{shopName}
			</Text>
		) : (
			<ShopNameSkeleton />
		)}
	</View>
))

// HeaderRight — fully memoized, only depends on stable callbacks
const HeaderRight = memo(({ onNotificationPress, onMenuPress }) => (
	<View style={styles.headerRight}>
		<TouchableOpacity
			onPress={onNotificationPress}
			style={styles.iconButton}
			hitSlop={hitSlop}
		>
			<BellIcon size={20} color="white" />
		</TouchableOpacity>
		<TouchableOpacity onPress={onMenuPress} hitSlop={hitSlop}>
			<MenuIcon size={20} color="white" />
		</TouchableOpacity>
	</View>
))

const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 }

export default function RootLayout() {
	const navigation = useNavigation()
	const { fetchData } = useApi()

	// Initial shopName so header renders instantly with no layout shift
	const [shopInfo, setShopInfo] = useState({})
	const [loaded, setLoaded] = useState(false)

	// Hold latest fetchData in a ref so the effect runs exactly once
	const fetchDataRef = useRef(fetchData)
	useEffect(() => {
		fetchDataRef.current = fetchData
	}, [fetchData])

	// Stable callbacks — never recreated, safe to pass to memoized children
	const onToggle = useCallback(() => {
		navigation.dispatch(DrawerActions.toggleDrawer())
	}, [navigation])

	const handleNotificationPress = useCallback(() => {
		router.push('/notification/Notification')
	}, [])

	// Header styles — frozen
	const headerStyle = useMemo(
		() => ({
			backgroundColor: '#195FE1',
			borderBottomWidth: 1,
			borderBottomColor: '#E1E1E120',
		}),
		[]
	)

	const screenOptions = useMemo(
		() => ({ headerStyle, headerTintColor: 'white' }),
		[headerStyle]
	)

	// Pre-built header elements (memoized so React.memo'd children re-render only on prop change).
	const headerLeftElement = useMemo(
		() => <HeaderLeft shopName={shopInfo?.data?.shopName} loaded={loaded} />,
		[shopInfo?.data?.shopName, loaded]
	)

	const headerRightElement = useMemo(
		() => (
			<HeaderRight
				onNotificationPress={handleNotificationPress}
				onMenuPress={onToggle}
			/>
		),
		[handleNotificationPress, onToggle]
	)

	// React Navigation's headerLeft/headerRight must be **functions**.
	// Wrap the memoized elements in stable callbacks so the function identity
	// is preserved across renders (avoids re-invoking React Navigation's diff path).
	const renderHeaderLeft = useCallback(
		() => headerLeftElement,
		[headerLeftElement]
	)
	const renderHeaderRight = useCallback(
		() => headerRightElement,
		[headerRightElement]
	)

	// Defer fetch so initial screen change is not blocked
	useEffect(() => {
		const handle = InteractionManager.runAfterInteractions(async () => {
			try {
				const data = await fetchDataRef.current(getShopInfo, {})
				if (data) setShopInfo(data)
			} catch (error) {
				console.error('🚨 Failed to fetch shop info:', error)
			} finally {
				setLoaded(true)
			}
		})
		return () => handle.cancel?.()
	}, [])

	return (
		<Drawer
			drawerContent={(props) => <CustomDrawerContent {...props} />}
			screenOptions={screenOptions}
		>
			<Drawer.Screen
				name="dashboard"
				options={{
					headerTitle: '',
					headerLeft: renderHeaderLeft,
					headerRight: renderHeaderRight,
				}}
			/>
		</Drawer>
	)
}

const styles = StyleSheet.create({
	headerLeft: {
		flexDirection: 'row',
		alignItems: 'center',
		marginLeft: 20,
	},
	headerRight: {
		flexDirection: 'row',
		alignItems: 'center',
		marginRight: 20,
	},
	logo: {
		width: 32,
		height: 32,
		borderRadius: 16,
		marginRight: 10,
	},
	shopName: {
		fontSize: 20,
		fontWeight: '600',
		color: 'white',
		maxWidth: 200,
	},
	iconButton: {
		marginHorizontal: 20,
	},
	skeletonPill: {
		width: 120,
		height: 22,
		borderRadius: 6,
		backgroundColor: 'rgba(255,255,255,0.25)',
	},
})
