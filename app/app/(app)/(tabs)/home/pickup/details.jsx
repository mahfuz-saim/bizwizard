import { Text, View } from 'react-native'
import { useLocalization } from '../../../../../src/localization/localizationContext.jsx'
import useApi from '../../../../../src/hooks/useApi.jsx'

export default function PickUpDetails() {
	const { loc } = useLocalization()
	const { fetchData } = useApi()

	return (
		<View>
			<Text>details</Text>
		</View>
	)
}
