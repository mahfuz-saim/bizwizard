import {
	Text,
	View,
	StyleSheet,
	FlatList,
	ActivityIndicator,
} from 'react-native'
import { useLocalization } from '../../localization/localizationContext'
import { useNumberTranslator } from '../../hooks/useNumberTranslator'
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'

export default function LedgerView({ ledgerData, loading }) {
	const { loc } = useLocalization()
	const { translateNumber, translateAmount } = useNumberTranslator()

	const renderSkeletonRow = (index) => {
		return (
			<View
				key={`skeleton-${index}`}
				style={[styles.ledgerRow, styles.skeletonRow]}
			>
				<View style={styles.dateColumn}>
					<View style={[styles.skeletonBox, styles.skeletonDate]} />
					<View style={[styles.skeletonBox, styles.skeletonBalance]} />
				</View>
				<View style={styles.amountColumn}>
					<View style={[styles.skeletonBox, styles.skeletonAmount]} />
				</View>
				<View style={styles.amountColumn}>
					<View style={[styles.skeletonBox, styles.skeletonAmount]} />
				</View>
			</View>
		)
	}

	const renderLedgerItem = ({ item }) => {
		const createdDate = new Date(item.createdAt)
		const date = translateNumber(createdDate.toLocaleDateString())
		const time = translateNumber(
			createdDate.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: true,
			})
		)

		const isDebt = item.type === 'DEBT_CREATED'
		const isPayment =
			item.type === 'PAYMENT_SINGLE' || item.type === 'PAYMENT_BULK'

		// Determine background color based on type
		const backgroundColor = isDebt
			? '#FEF2F2' // Light red for debt
			: isPayment
				? '#ECFDF5' // Light green for payment
				: '#FFFFFF'

		return (
			<View style={[styles.ledgerRow, { backgroundColor }]}>
				{/* Date/Time/Balance Column */}
				<View style={styles.dateColumn}>
					<Text style={styles.dateText}>
						{date} <Text style={styles.timeText}>({time})</Text>
					</Text>
					<Text style={styles.balanceText}>
						{loc.t('debt.balance')}:{' '}
						{translateAmount(item.newBalance.toFixed(2))}
					</Text>
				</View>

				{/* Paid Column */}
				<View style={styles.amountColumn}>
					{/* <Text style={styles.columnHeader}>{loc.t('debt.paid')}</Text> */}
					<Text style={[styles.amountText, isPayment && styles.paidAmountText]}>
						{isPayment ? translateAmount(item.amount.toFixed(2)) : '-'}
					</Text>
				</View>

				{/* Debt Column */}
				<View style={styles.amountColumn}>
					{/* <Text style={styles.columnHeader}>{loc.t('debt.debtAmount')}</Text> */}
					<Text style={[styles.amountText, isDebt && styles.debtAmountText]}>
						{isDebt ? translateAmount(item.amount.toFixed(2)) : '-'}
					</Text>
				</View>
			</View>
		)
	}

	return (
		<View style={styles.container}>
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>
					{loc.t('debt.ledger') || 'Ledger'}
				</Text>

				{/* Ledger Table */}
				<View style={styles.tableContainer}>
					{/* Table Header */}
					<View style={styles.tableHeader}>
						<View style={styles.dateColumn}>
							<Text style={styles.headerText}>
								{loc.t('debt.date')} / {loc.t('debt.time')}
							</Text>
						</View>
						<View style={styles.amountColumn}>
							<Text style={styles.headerText}>{loc.t('debt.paid')}</Text>
						</View>
						<View style={styles.amountColumn}>
							<Text style={styles.headerText}>{loc.t('debt.debtAmount')}</Text>
						</View>
					</View>

					{/* Table Rows */}
					{loading ? (
						// Show skeleton while loading
						<View>
							{[1, 2, 3, 4, 5].map((index) => renderSkeletonRow(index))}
						</View>
					) : !ledgerData ||
					  !ledgerData.ledger ||
					  ledgerData.ledger.length === 0 ? (
						// Show empty state
						<View style={styles.emptyTableContainer}>
							<MaterialIcons
								name="account-balance-wallet"
								size={48}
								color="#D1D5DB"
							/>
							<Text style={styles.emptyText}>
								{loc.t('debt.noLedgerEntries') || 'No ledger entries found'}
							</Text>
						</View>
					) : (
						// Show actual data
						<FlatList
							data={ledgerData.ledger}
							keyExtractor={(item) => item.id}
							renderItem={renderLedgerItem}
							scrollEnabled={false}
							showsVerticalScrollIndicator={false}
						/>
					)}
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	emptyTableContainer: {
		alignItems: 'center',
		paddingVertical: 40,
		backgroundColor: '#FFFFFF',
	},
	emptyText: {
		marginTop: 16,
		fontSize: 16,
		color: '#6B7280',
		fontWeight: '600',
		textAlign: 'center',
	},
	skeletonRow: {
		backgroundColor: '#FFFFFF',
	},
	skeletonBox: {
		backgroundColor: '#E5E7EB',
		borderRadius: 4,
	},
	skeletonDate: {
		width: '80%',
		height: 12,
		marginBottom: 6,
	},
	skeletonBalance: {
		width: '60%',
		height: 10,
	},
	skeletonAmount: {
		width: '70%',
		height: 12,
	},
	section: {
		paddingVertical: 12,
		borderRadius: 8,
		marginBottom: 2,
	},
	sectionTitle: {
		fontWeight: '600',
		fontSize: 16,
		color: '#195FE1',
		marginBottom: 12,
		textAlign: 'center',
	},
	buyerInfoContainer: {
		backgroundColor: '#FFFFFF',
		padding: 16,
		borderRadius: 12,
		marginBottom: 12,
	},
	buyerInfoRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingVertical: 8,
	},
	buyerInfoLabel: {
		fontSize: 14,
		color: '#6B7280',
		fontWeight: '500',
	},
	buyerInfoValue: {
		fontSize: 14,
		color: '#333333',
		fontWeight: '600',
	},
	currentBalance: {
		fontSize: 16,
		fontWeight: 'bold',
	},
	tableContainer: {
		backgroundColor: '#FFFFFF',
		borderRadius: 12,
		overflow: 'hidden',
	},
	tableHeader: {
		flexDirection: 'row',
		backgroundColor: '#195FE1',
		paddingVertical: 12,
		paddingHorizontal: 8,
	},
	headerText: {
		fontSize: 12,
		fontWeight: 'bold',
		color: '#FFFFFF',
		textAlign: 'center',
	},
	ledgerRow: {
		flexDirection: 'row',
		paddingVertical: 6,
		paddingHorizontal: 8,
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(0, 0, 0, 0.1)',
	},
	dateColumn: {
		flex: 2,
		paddingRight: 8,
	},
	dateText: {
		fontSize: 12,
		color: '#333333',
		fontWeight: '600',
		marginBottom: 4,
	},
	timeText: {
		fontSize: 11,
		color: '#6B7280',
		marginBottom: 4,
	},
	balanceText: {
		fontSize: 11,
		color: '#195FE1',
		fontWeight: '600',
	},
	amountColumn: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	columnHeader: {
		fontSize: 10,
		color: '#6B7280',
		marginBottom: 4,
		fontWeight: '500',
	},
	amountText: {
		fontSize: 13,
		color: '#333333',
		fontWeight: '600',
		textAlign: 'center',
	},
	paidAmountText: {
		color: '#10B981',
		fontWeight: 'bold',
	},
	debtAmountText: {
		color: '#EF4444',
		fontWeight: 'bold',
	},
})
