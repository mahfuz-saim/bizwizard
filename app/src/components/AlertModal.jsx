import {
	Modal,
	View,
	Text,
	TouchableOpacity,
	TouchableWithoutFeedback,
	StyleSheet,
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useLocalization } from '../localization/localizationContext'

// Delete Confirmation Modal
export const DeleteModal = ({
	visible,
	onClose,
	onConfirm,
	title,
	subtitle,
}) => {
	const { loc } = useLocalization()

	return (
		<Modal
			transparent={true}
			visible={visible}
			animationType="fade"
			onRequestClose={onClose}
		>
			<TouchableWithoutFeedback onPress={onClose}>
				<View style={styles.modalBackdrop}>
					<TouchableWithoutFeedback onPress={() => {}}>
						<View style={styles.modalContent}>
							<MaterialIcons
								name="warning"
								size={48}
								color="#EF4444"
								style={styles.icon}
							/>
							<Text style={styles.title}>
								{title || loc.t('alertModal.deleteConfirmation')}
							</Text>
							<Text style={styles.subtitle}>
								{subtitle || loc.t('alertModal.deleteSubtitle')}
							</Text>
							<View style={styles.buttonContainer}>
								<TouchableOpacity
									style={[styles.button, styles.cancelButton]}
									onPress={onClose}
									activeOpacity={0.8}
								>
									<Text style={styles.cancelButtonText}>
										{loc.t('alertModal.cancel')}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.button, styles.deleteButton]}
									onPress={onConfirm}
									activeOpacity={0.8}
								>
									<Text style={styles.deleteButtonText}>
										{loc.t('alertModal.delete')}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</TouchableWithoutFeedback>
				</View>
			</TouchableWithoutFeedback>
		</Modal>
	)
}

// Close Confirmation Modal
export const CloseModal = ({
	visible,
	onClose,
	onConfirm,
	title,
	subtitle,
}) => {
	const { loc } = useLocalization()

	return (
		<Modal
			transparent={true}
			visible={visible}
			animationType="fade"
			onRequestClose={onClose}
		>
			<TouchableWithoutFeedback onPress={onClose}>
				<View style={styles.modalBackdrop}>
					<TouchableWithoutFeedback onPress={() => {}}>
						<View style={styles.modalContent}>
							<MaterialIcons
								name="info"
								size={48}
								color="#3B82F6"
								style={styles.icon}
							/>
							<Text style={styles.title}>
								{title || loc.t('alertModal.closeConfirmation')}
							</Text>
							<Text style={styles.subtitle}>
								{subtitle || loc.t('alertModal.closeSubtitle')}
							</Text>
							<View style={styles.buttonContainer}>
								<TouchableOpacity
									style={[styles.button, styles.cancelButton]}
									onPress={onClose}
									activeOpacity={0.8}
								>
									<Text style={styles.cancelButtonText}>
										{loc.t('alertModal.cancel')}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.button, styles.confirmButton]}
									onPress={onConfirm}
									activeOpacity={0.8}
								>
									<Text style={styles.confirmButtonText}>
										{loc.t('alertModal.close')}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</TouchableWithoutFeedback>
				</View>
			</TouchableWithoutFeedback>
		</Modal>
	)
}

// Error Modal
export const ErrorModal = ({ visible, onClose, title, subtitle }) => {
	const { loc } = useLocalization()

	return (
		<Modal
			transparent={true}
			visible={visible}
			animationType="fade"
			onRequestClose={onClose}
		>
			<TouchableWithoutFeedback onPress={onClose}>
				<View style={styles.modalBackdrop}>
					<TouchableWithoutFeedback onPress={() => {}}>
						<View style={styles.modalContent}>
							<MaterialIcons
								name="error"
								size={48}
								color="#EF4444"
								style={styles.icon}
							/>
							<Text style={styles.title}>
								{title || loc.t('alertModal.error')}
							</Text>
							<Text style={styles.subtitle}>
								{subtitle || loc.t('alertModal.errorSubtitle')}
							</Text>
							<View style={styles.singleButtonContainer}>
								<TouchableOpacity
									style={[styles.button, styles.okayButton]}
									onPress={onClose}
									activeOpacity={0.8}
								>
									<Text style={styles.okayButtonText}>
										{loc.t('alertModal.okay')}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</TouchableWithoutFeedback>
				</View>
			</TouchableWithoutFeedback>
		</Modal>
	)
}

// Permission Modal for settings access
export const PermissionModal = ({
	visible,
	onClose,
	onConfirm,
	title,
	subtitle,
}) => {
	const { loc } = useLocalization()

	return (
		<Modal
			transparent={true}
			visible={visible}
			animationType="fade"
			onRequestClose={onClose}
		>
			<TouchableWithoutFeedback onPress={onClose}>
				<View style={styles.modalBackdrop}>
					<TouchableWithoutFeedback onPress={() => {}}>
						<View style={styles.modalContent}>
							<MaterialIcons
								name="settings"
								size={48}
								color="#F59E0B"
								style={styles.icon}
							/>
							<Text style={styles.title}>
								{title || loc.t('permission.cameraPermissionDenied')}
							</Text>
							<Text style={styles.subtitle}>
								{subtitle || loc.t('permission.cameraPermissionMessage')}
							</Text>
							<View style={styles.buttonContainer}>
								<TouchableOpacity
									style={[styles.button, styles.cancelButton]}
									onPress={onClose}
									activeOpacity={0.8}
								>
									<Text style={styles.cancelButtonText}>
										{loc.t('permission.cancel')}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[styles.button, styles.settingsButton]}
									onPress={onConfirm}
									activeOpacity={0.8}
								>
									<Text style={styles.settingsButtonText}>
										{loc.t('permission.openSettings')}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</TouchableWithoutFeedback>
				</View>
			</TouchableWithoutFeedback>
		</Modal>
	)
}

// Confirm Modal for general confirmation actions
export const ConfirmModal = ({
	visible,
	onClose,
	onConfirm,
	title,
	subtitle,
	confirmText,
	cancelText,
	iconName = 'help',
	iconColor = '#177DFF',
	confirmButtonColor = '#177DFF',
	hideCancelButton = false,
}) => {
	const { loc } = useLocalization()

	return (
		<Modal
			transparent={true}
			visible={visible}
			animationType="fade"
			onRequestClose={onClose}
		>
			<TouchableWithoutFeedback onPress={onClose}>
				<View style={styles.modalBackdrop}>
					<TouchableWithoutFeedback onPress={() => {}}>
						<View style={styles.modalContent}>
							<MaterialIcons
								name={iconName}
								size={48}
								color={iconColor}
								style={styles.icon}
							/>
							<Text style={styles.title}>
								{title || loc.t('alertModal.confirmation')}
							</Text>
							<Text style={styles.subtitle}>
								{subtitle || loc.t('alertModal.confirmationSubtitle')}
							</Text>
							<View style={styles.buttonContainer}>
								{!hideCancelButton && (
									<TouchableOpacity
										style={[styles.button, styles.cancelButton]}
										onPress={onClose}
										activeOpacity={0.8}
									>
										<Text style={styles.cancelButtonText}>
											{cancelText || loc.t('alertModal.cancel')}
										</Text>
									</TouchableOpacity>
								)}
								<TouchableOpacity
									style={[
										styles.button,
										styles.confirmButton,
										{ backgroundColor: confirmButtonColor },
										hideCancelButton && { width: '100%' },
									]}
									onPress={onConfirm}
									activeOpacity={0.8}
								>
									<Text style={styles.confirmButtonText}>
										{confirmText || loc.t('alertModal.confirm')}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</TouchableWithoutFeedback>
				</View>
			</TouchableWithoutFeedback>
		</Modal>
	)
}

// Help Confirmation Modal
export const HelpModal = ({
	visible,
	onClose,
	onConfirm,
	title,
	subtitle,
	confirmText,
	cancelText,
	iconName = 'help-outline',
	iconColor = '#177DFF',
	confirmButtonColor = '#177DFF',
}) => {
	const { loc } = useLocalization()

	return (
		<Modal
			transparent={true}
			visible={visible}
			animationType="fade"
			onRequestClose={onClose}
		>
			<TouchableWithoutFeedback onPress={onClose}>
				<View style={styles.modalBackdrop}>
					<TouchableWithoutFeedback onPress={() => {}}>
						<View style={styles.modalContent}>
							<MaterialIcons
								name={iconName}
								size={48}
								color={iconColor}
								style={styles.icon}
							/>
							<Text style={styles.title}>
								{title || loc.t('alertModal.yttitle')}
							</Text>
							<Text style={styles.subtitle}>
								{subtitle || loc.t('alertModal.ytsubtitle')}
							</Text>
							<View style={styles.buttonContainer}>
								<TouchableOpacity
									style={[styles.button, styles.cancelButton]}
									onPress={onClose}
									activeOpacity={0.8}
								>
									<Text style={styles.cancelButtonText}>
										{cancelText || loc.t('alertModal.cancel')}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									style={[
										styles.button,
										styles.confirmButton,
										{ backgroundColor: confirmButtonColor },
									]}
									onPress={onConfirm}
									activeOpacity={0.8}
								>
									<Text style={styles.confirmButtonText}>
										{confirmText || loc.t('alertModal.confirm')}
									</Text>
								</TouchableOpacity>
							</View>
						</View>
					</TouchableWithoutFeedback>
				</View>
			</TouchableWithoutFeedback>
		</Modal>
	)
}

const styles = StyleSheet.create({
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
	},
	modalContent: {
		backgroundColor: '#F0F8FF',
		borderRadius: 12,
		padding: 24,
		width: '100%',
		maxWidth: 340,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	icon: {
		marginBottom: 16,
	},
	title: {
		fontSize: 18,
		fontWeight: '600',
		color: '#1F2937',
		textAlign: 'center',
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 14,
		color: '#6B7280',
		textAlign: 'center',
		marginBottom: 24,
		lineHeight: 20,
	},
	buttonContainer: {
		flexDirection: 'row',
		width: '100%',
		gap: 12,
	},
	singleButtonContainer: {
		width: '100%',
	},
	button: {
		flex: 1,
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 44,
		marginBottom: 12,
	},
	cancelButton: {
		backgroundColor: '#6B7280',
	},
	deleteButton: {
		backgroundColor: '#EF4444',
	},
	confirmButton: {
		backgroundColor: '#3B82F6',
	},
	okayButton: {
		backgroundColor: '#3B82F6',
	},
	settingsButton: {
		backgroundColor: '#F59E0B',
	},
	cancelButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	deleteButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	confirmButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	okayButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	settingsButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
})

// Example usage:
/*
import { DeleteModal, CloseModal, ErrorModal, PermissionModal, ConfirmModal } from './path/to/ModalComponents';

// In your component:
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [showCloseModal, setShowCloseModal] = useState(false);
const [showErrorModal, setShowErrorModal] = useState(false);
const [showPermissionModal, setShowPermissionModal] = useState(false);
const [showConfirmModal, setShowConfirmModal] = useState(false);

// Delete Modal
<DeleteModal
  visible={showDeleteModal}
  onClose={() => setShowDeleteModal(false)}
  onConfirm={handleDelete}
  title="Delete Customer" // Optional - will use translation key if not provided
  subtitle={`Are you sure you want to delete ${customer?.name}?`} // Optional
/>

// Close Modal
<CloseModal
  visible={showCloseModal}
  onClose={() => setShowCloseModal(false)}
  onConfirm={handleClose}
  title="Unsaved Changes" // Optional - will use translation key if not provided
  subtitle="You have unsaved changes. Are you sure you want to close?" // Optional
/>

// Error Modal
<ErrorModal
  visible={showErrorModal}
  onClose={() => setShowErrorModal(false)}
  title="Connection Error" // Optional - will use translation key if not provided
  subtitle="Unable to connect to the server. Please check your internet connection." // Optional
/>

// Permission Modal
<PermissionModal
  visible={showPermissionModal}
  onClose={() => setShowPermissionModal(false)}
  onConfirm={() => {
    setShowPermissionModal(false)
    Linking.openSettings()
  }}
  title="Camera Permission Required" // Optional - will use translation key if not provided
  subtitle="Please enable camera permission in settings to use this feature." // Optional
/>

// Confirm Modal
<ConfirmModal
  visible={showConfirmModal}
  onClose={() => setShowConfirmModal(false)}
  onConfirm={handleConfirm}
  title="Confirm Action" // Optional - will use translation key if not provided
  subtitle="Are you sure you want to proceed?" // Optional
  confirmText="Proceed" // Optional - will use translation key if not provided
  cancelText="Cancel" // Optional - will use translation key if not provided
  iconName="help" // Optional - defaults to 'help'
  iconColor="#177DFF" // Optional - defaults to '#177DFF'
  confirmButtonColor="#177DFF" // Optional - defaults to '#177DFF'
/>
*/
