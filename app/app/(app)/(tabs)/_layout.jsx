import 'react-native-gesture-handler'
import { Tabs, router, usePathname } from 'expo-router'
import { View, useWindowDimensions } from 'react-native'
import AntDesign from '@expo/vector-icons/AntDesign'
import Feather from '@expo/vector-icons/Feather'
import Octicons from '@expo/vector-icons/Octicons'
import { useLocalization } from '../../../src/localization/localizationContext'
import { useEffect, useMemo } from 'react'
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withTiming,
} from 'react-native-reanimated'

export default function TabLayout() {
	const { loc } = useLocalization()
	const { width } = useWindowDimensions()
	const tabWidth = useMemo(() => width / 4, [width])
	const activeIndex = useSharedValue(0)
	const pathname = usePathname()

	const tabMap = useMemo(
		() => ({
			'/home': 0,
			'/sales': 1,
			'/note': 2,
			'/profile': 3,
		}),
		[]
	)

	const currentTab = useMemo(() => {
		if (pathname === '/home' || pathname === '/home/dashboard') return '/home'
		if (pathname.startsWith('/sales')) return '/sales'
		if (pathname.startsWith('/note')) return '/note'
		if (pathname.startsWith('/profile')) return '/profile'
		return null
	}, [pathname])

	// Pre-calculated icon components for better performance
	const iconComponents = useMemo(
		() => ({
			home: {
				active: <AntDesign name="home" size={22} color="#fff" />,
				inactive: <AntDesign name="home" size={22} color="#195FE1" />,
			},
			sales: {
				active: <Feather name="pie-chart" size={22} color="#fff" />,
				inactive: <Feather name="pie-chart" size={22} color="#195FE1" />,
			},
			note: {
				active: <Octicons name="checklist" size={22} color="#fff" />,
				inactive: <Octicons name="checklist" size={22} color="#195FE1" />,
			},
			profile: {
				active: <AntDesign name="user" size={22} color="#fff" />,
				inactive: <AntDesign name="user" size={22} color="#195FE1" />,
			},
		}),
		[]
	)

	const nextIndex = currentTab != null ? tabMap[currentTab] : null

	useEffect(() => {
		if (nextIndex == null) return
		activeIndex.value = withTiming(nextIndex * tabWidth, {
			duration: 250,
		})
	}, [activeIndex, nextIndex, tabWidth])

	const tabBarStyle = useMemo(
		() => ({
			height: 60,
			backgroundColor: 'white',
			borderTopWidth: 0,
			elevation: 4,
			shadowColor: '#000',
			shadowOffset: { width: 0, height: -1 },
			shadowOpacity: 0.06,
			shadowRadius: 2,
		}),
		[]
	)

	const animatedIndicatorStyle = useAnimatedStyle(() => {
		'worklet'
		return {
			transform: [{ translateX: activeIndex.value + tabWidth / 2 - 35 }],
			opacity: currentTab ? 1 : 0, // hide indicator when not on root tab
		}
	}, [currentTab, tabWidth])

	// Stable screen options � memoized so Tabs doesn't reconfigure on every render
	const screenOptions = useMemo(
		() =>
			({ route }) => {
				const routeName = route.name
				const tabRoute = '/' + routeName
				const isActive = currentTab === tabRoute

				return {
					headerShown: false,
					tabBarStyle,
					lazy: true,
					tabBarPressColor: 'transparent',
					tabBarItemStyle: {
						flex: 1,
						alignItems: 'center',
						justifyContent: 'center',
						paddingTop: 8,
					},
					tabBarShowLabel: false,

					tabBarIcon: () => {
						const icon =
							iconComponents[routeName]?.[isActive ? 'active' : 'inactive']

						return (
							<View
								style={{
									width: 58,
									height: 58,
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								{isActive ? (
									<View
										style={{
											width: 50,
											height: 50,
											borderRadius: 25,
											backgroundColor: 'transparent',
											alignItems: 'center',
											justifyContent: 'center',
										}}
									>
										{icon}
									</View>
								) : (
									icon
								)}
							</View>
						)
					},

					tabBarBackground: () => (
						<View style={{ flex: 1 }}>
							<Animated.View
								style={[
									{
										position: 'absolute',
										bottom: 8,
										width: 70,
										height: 45,
										borderRadius: 25,
										backgroundColor: '#2563eb',
									},
									animatedIndicatorStyle,
								]}
							/>
						</View>
					),
				}
			},
		[currentTab, tabBarStyle, iconComponents, animatedIndicatorStyle]
	)

	return (
		<Tabs screenOptions={screenOptions}>
			<Tabs.Screen
				name="home"
				options={{ title: loc.t('tabs.home') }}
				listeners={{
					tabPress: (event) => {
						event.preventDefault()
						router.replace('/home')
					},
				}}
			/>
			<Tabs.Screen name="sales" options={{ title: loc.t('tabs.sales') }} />
			<Tabs.Screen name="note" options={{ title: loc.t('tabs.notes') }} />
			<Tabs.Screen name="profile" options={{ title: loc.t('tabs.profile') }} />
		</Tabs>
	)
}
