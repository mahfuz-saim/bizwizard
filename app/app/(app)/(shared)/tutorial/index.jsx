import React, { useState, useCallback, memo, useEffect } from 'react'
import {
	Text,
	TouchableOpacity,
	View,
	ScrollView,
	StatusBar,
	StyleSheet,
	Dimensions,
	Pressable,
	ActivityIndicator,
	Linking,
	Image,
	BackHandler,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Feather, FontAwesome } from '@expo/vector-icons'
import { useLocalization } from '../../../../src/localization/localizationContext'
import { statusBarColor, barStyleMode } from '../../../../src/constants'
// ─── Lazy-loaded expo-image (graceful fallback to RN Image) ───────────────────
let ExpoImage
try {
	ExpoImage = require('expo-image').Image
} catch {
	ExpoImage = ({ source, style, onLoad, contentFit }) => (
		<Image
			source={source}
			style={style}
			onLoad={onLoad}
			resizeMode={contentFit === 'cover' ? 'cover' : 'contain'}
		/>
	)
}
// ── Section Title ──
// sectionTitle style removed

// ─── Responsive Helpers ────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window')
const BASE_WIDTH = 393
const scale = SCREEN_WIDTH / BASE_WIDTH
const rs = (size) =>
	Math.round(Math.min(Math.max(size * scale, size * 0.75), size * 1.4))
const isTablet = SCREEN_WIDTH >= 600
// ─── Playlist & Video Data ─────────────────────────────────────────────────────
const CHANNEL_URL = 'https://www.youtube.com/@Bebsapati-Business-Manager'
const TUTORIAL_VIDEOS = [
	{ key: 'intro', videoId: 'IDb7QVCXEXI', duration: '2:46' },
	{ key: 'addProduct', videoId: 'e8DmSiegOcA', duration: '11:47' },
	{ key: 'makeSale', videoId: '7V1-rUBw9jY', duration: '6:50' },
	{ key: 'inventory', videoId: 'nMn24zKrm-k', duration: '6:50' },
	{ key: 'debt', videoId: 'Nz47kqii-M4', duration: '4:50' },
	{ key: 'multiShop', videoId: 'xPlujXVcaog', duration: '1:51' },
	{ key: 'note', videoId: '3dJxYOoURI4', duration: '1:43' },
	{ key: 'calculator', videoId: 'mpmmtqzJwLw', duration: '1:36' },
	{ key: 'customerSupplier', videoId: 'QcgsrdytKQE', duration: '2:15' },
	{ key: 'employee', videoId: 'HWWE4ZgB6YU', duration: '1:51' },
	{ key: 'message', videoId: '_vshs3L84c4', duration: '2:42' },
	{ key: 'report', videoId: 'aXRf6TOKNoM', duration: '3:53' },
]
const getThumbnailUrl = (videoId) =>
	`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
const getYouTubeUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`
// ─── Thumbnail Skeleton ────────────────────────────────────────────────────────
const ThumbnailSkeleton = memo(() => (
	<View style={styles.thumbnailSkeleton}>
		<ActivityIndicator size="small" color="#3b82f6" />
	</View>
))
// ─── Video Card ────────────────────────────────────────────────────────────────
const VideoCard = memo(({ item, index, isActive, onPress }) => {
	const { loc } = useLocalization()
	const [thumbLoaded, setThumbLoaded] = useState(false)
	const handlePress = useCallback(() => {
		onPress(item, index)
	}, [item, index, onPress])
	return (
		<Pressable
			onPress={handlePress}
			style={({ pressed }) => [
				styles.videoCard,
				isActive && styles.videoCardActive,
				pressed && styles.videoCardPressed,
			]}
		>
			{/* Thumbnail */}
			<View style={styles.tutorialContainer}>
				<View style={styles.thumbnailContainer}>
					{!thumbLoaded && <ThumbnailSkeleton />}
					<ExpoImage
						source={{ uri: getThumbnailUrl(item.videoId) }}
						style={[styles.thumbnail, !thumbLoaded && { opacity: 0 }]}
						onLoad={() => setThumbLoaded(true)}
						contentFit="cover"
					/>
					{/* Play button overlay — always visible */}
					<View style={styles.playOverlay}>
						<View
							style={[styles.playIconBg, isActive && styles.playIconBgActive]}
						>
							<FontAwesome
								name="play"
								size={rs(13)}
								color="#fff"
								style={{ marginLeft: rs(2) }}
							/>
						</View>
					</View>
					{/* YouTube logo badge — bottom-left */}
					<View style={styles.ytBadge}>
						<FontAwesome name="youtube-play" size={rs(13)} color="#FF0000" />
					</View>
					{/* Duration chip — bottom-right */}
					<View style={styles.durationChip}>
						<Text style={styles.durationText}>{item.duration}</Text>
					</View>
				</View>
				{/* Text content */}
				<View style={styles.cardTextContent}>
					<View style={styles.cardTexts}>
						<Text
							style={[styles.cardTitle, isActive && styles.cardTitleActive]}
							numberOfLines={2}
						>
							{loc.t(`tutorial.videos.${item.key}.title`)}
						</Text>
						<Text style={styles.cardDescription} numberOfLines={2}>
							{loc.t(`tutorial.videos.${item.key}.description`)}
						</Text>
					</View>
				</View>
			</View>
		</Pressable>
	)
})
// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TutorialScreen() {
	const { loc } = useLocalization()
	const router = useRouter()
	const [activeIndex, setActiveIndex] = useState(null)
	useEffect(() => {
		const backAction = () => {
			router.push('/home')
			return true
		}
		const handler = BackHandler.addEventListener(
			'hardwareBackPress',
			backAction
		)
		return () => handler.remove()
	}, [router])
	const handleVideoPress = useCallback((item, index) => {
		setActiveIndex(index)
		Linking.openURL(getYouTubeUrl(item.videoId))
	}, [])
	const handleOpenChannel = useCallback(() => {
		Linking.openURL(CHANNEL_URL)
	}, [])
	return (
		<View style={styles.root}>
			<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{/* Section Header */}
				<View style={styles.sectionHeader}></View>
				{/* Video List */}
				<View style={styles.videoList}>
					{TUTORIAL_VIDEOS.map((item, index) => (
						<VideoCard
							key={item.key}
							item={item}
							index={index}
							isActive={activeIndex === index}
							onPress={handleVideoPress}
						/>
					))}
				</View>
				{/* Channel CTA */}
				<View style={styles.channelCta}>
					<View style={styles.channelCtaInner}>
						<FontAwesome name="youtube-play" size={rs(24)} color="#FF0000" />
						<View style={styles.channelCtaTexts}>
							<Text style={styles.channelCtaTitle}>
								{loc.t('tutorial.channelTitle')}
							</Text>
							<Text style={styles.channelCtaSubtitle}>
								{loc.t('tutorial.channelSubtitle')}
							</Text>
						</View>
					</View>
					<TouchableOpacity
						style={styles.channelCtaBtn}
						onPress={handleOpenChannel}
						activeOpacity={0.8}
					>
						<Text style={styles.channelCtaBtnText}>
							{loc.t('tutorial.visitChannel')}
						</Text>
						<Feather name="arrow-right" size={rs(14)} color="#3b82f6" />
					</TouchableOpacity>
				</View>
			</ScrollView>
		</View>
	)
}
// ─── Styles ───────────────────────────────────────────────────────────────────
const CARD_THUMB_WIDTH = isTablet ? rs(140) : rs(118)
const CARD_THUMB_HEIGHT = Math.round(CARD_THUMB_WIDTH * (9 / 16))
const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#F0F8FF' },
	scroll: { flex: 1 },
	scrollContent: { paddingBottom: rs(32) },
	// ── Hero ──
	// ── Section Header ──
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: rs(20),
		paddingTop: rs(8),
		paddingBottom: rs(12),
	},
	// ── Video List ──
	videoList: { paddingHorizontal: rs(16), gap: rs(10) },
	// ── Video Card ──
	videoCard: {
		backgroundColor: '#F0F8FF',
		borderRadius: rs(16),
		flexDirection: 'row',
		alignItems: 'center',
		padding: rs(10),
		gap: rs(12),
		shadowColor: '#000',
		shadowOffset: { width: 0, height: rs(1) },
		shadowOpacity: 0.06,
		shadowRadius: rs(6),
		elevation: 3,
		borderWidth: 1.5,
		borderColor: '#f0f0f0',
	},
	videoCardActive: { borderColor: '#3b82f6', backgroundColor: '#F0F8FF' },
	videoCardPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
	// ── Thumbnail ──
	thumbnailContainer: {
		width: CARD_THUMB_WIDTH,
		height: CARD_THUMB_HEIGHT + rs(10),
		borderRadius: rs(10),
		overflow: 'hidden',
		backgroundColor: '#1a1a2e',
		flexShrink: 0,
	},
	thumbnailSkeleton: {
		...StyleSheet.absoluteFillObject,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#1a1a2e',
	},
	thumbnail: { width: '100%', height: '100%' },
	// Play button — always shown on top of thumbnail
	playOverlay: {
		...StyleSheet.absoluteFillObject,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: 'rgba(0,0,0,0.22)',
	},
	playIconBg: {
		width: rs(34),
		height: rs(34),
		borderRadius: rs(17),
		backgroundColor: 'rgba(0,0,0,0.65)',
		justifyContent: 'center',
		alignItems: 'center',
		borderWidth: 1.5,
		borderColor: 'rgba(255,255,255,0.35)',
	},
	playIconBgActive: {
		backgroundColor: '#3b82f6',
		borderColor: '#60a5fa',
	},
	// YouTube logo chip — bottom-left
	ytBadge: {
		position: 'absolute',
		bottom: rs(4),
		left: rs(5),
		backgroundColor: 'rgba(0,0,0,0.55)',
		borderRadius: rs(4),
		paddingHorizontal: rs(4),
		paddingVertical: rs(2),
	},
	// Duration chip — bottom-right
	durationChip: {
		position: 'absolute',
		bottom: rs(4),
		right: rs(4),
		backgroundColor: 'rgba(0,0,0,0.72)',
		borderRadius: rs(4),
		paddingHorizontal: rs(5),
		paddingVertical: rs(2),
	},
	durationText: { fontSize: rs(10), color: '#fff', fontWeight: '600' },
	// ── Card Text ──
	cardTextContent: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: rs(8),
	},
	cardTexts: { flex: 1 },
	cardTitle: {
		fontSize: rs(13),
		fontWeight: '700',
		color: '#111827',
		marginBottom: rs(3),
		lineHeight: rs(18),
	},
	cardTitleActive: { color: '#1d4ed8' },
	cardDescription: {
		fontSize: rs(11),
		color: '#6b7280',
		lineHeight: rs(15),
		marginBottom: rs(5),
	},
	// ── Channel CTA ──
	channelCta: {
		marginHorizontal: rs(16),
		marginTop: rs(24),
		backgroundColor: '#F0F8FF',
		borderRadius: rs(16),
		padding: rs(16),
		shadowColor: '#000',
		shadowOffset: { width: 0, height: rs(2) },
		shadowOpacity: 0.07,
		shadowRadius: rs(8),
		elevation: 4,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.5)',
	},
	channelCtaInner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: rs(12),
		marginBottom: rs(14),
	},
	channelCtaTexts: { flex: 1 },
	channelCtaTitle: {
		fontSize: rs(14),
		fontWeight: '700',
		color: '#111827',
		marginBottom: rs(2),
	},
	channelCtaSubtitle: { fontSize: rs(12), color: '#6b7280' },
	channelCtaBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: rs(6),
		backgroundColor: '#F0F8FF',
		borderRadius: rs(10),
		paddingVertical: rs(10),
		borderWidth: 1,
		borderColor: '#F0F8FF',
	},
	channelCtaBtnText: { fontSize: rs(13), fontWeight: '600', color: '#3b82f6' },
	tutorialContainer: {
		flexDirection: 'row',
		alignItems: 'flex-start',

		gap: rs(12),
	},
})
