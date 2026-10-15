import React, { useState } from 'react'
import {
	StatusBar,
	Text,
	TextInput,
	View,
	TouchableOpacity,
	StyleSheet,
} from 'react-native'
import { Formik } from 'formik'
import * as Yup from 'yup'
import { useLocalization } from '../../../../src/localization/localizationContext'
import {
	districts,
	upazilas,
	barStyleMode,
	statusBarColor,
} from '../../../../src/constants'
import { cleanString } from '../../../../src/components/CleanString'
import { Dropdown } from 'react-native-element-dropdown'

export default function ShopForm(props) {
	const { loc } = useLocalization()
	const {
		initialValues = {},
		handleSubmit,
		formTitle = 'Create your account',
		submitText = 'Add Shop',
		shopCategories = [],
	} = props

	const dropDownDistrict = districts.map((item) => ({
		label: loc.t(`districts.${item}`) || item,
		value: item,
	}))

	// Create dropdown data for shop categories
	const dropDownCategories = shopCategories.map((item) => ({
		label: loc.t(`shops.add.categories.${item}`) || item,
		value: item,
	}))

	const [isFocus, setIsFocus] = useState(false)
	const [isCategoryFocus, setIsCategoryFocus] = useState(false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const [upazillDropDown, setUpazillDropDown] = useState([])
	const setUpazilaData = (zila) => {
		const dropDownUpazila =
			upazilas[zila]?.map((item) => ({
				label: loc.t(`upazilas.${zila}.${item}`) || item,
				value: item,
			})) || []
		setUpazillDropDown(dropDownUpazila)
	}

	const ShopSchema = Yup.object().shape({
		name: Yup.string().required(
			loc.t('shops.validation.nameRequired') || 'Shop name is required'
		),
		category: Yup.string().required(
			loc.t('shops.validation.categoryRequired') || 'Shop category is required'
		),
		street: Yup.string().required(
			loc.t('shops.validation.streetRequired') || 'Street is required'
		),
		district: Yup.string().required(
			loc.t('shops.validation.districtRequired') || 'District is required'
		),
		upazila: Yup.string().required(
			loc.t('shops.validation.upazilaRequired') || 'Upazila is required'
		),
		phone: Yup.string()
			.required(
				loc.t('shops.validation.phoneRequired') || 'Phone number is required'
			)
			.matches(
				/^\d+$/,
				loc.t('shops.validation.phoneNumeric') ||
					'Phone number must contain only digits'
			)
			.test(
				'starts-with-01',
				loc.t('shops.validation.phoneStartsWith01') ||
					'Phone number must start with 01',
				function (value) {
					if (!value) return false
					return value.startsWith('01')
				}
			)
			.length(
				11,
				loc.t('shops.validation.phoneLength') ||
					'Phone number must be exactly 11 digits'
			),
		tradeLicense: Yup.string().notRequired(),
		termsAccepted: Yup.boolean().oneOf(
			[true],
			loc.t('shops.validation.termsRequired') ||
				'You must accept the terms and policy'
		),
	})

	return (
		<View className="bg-bgColor bg-opacity-90 rounded-lg py-5 px-6">
			<StatusBar backgroundColor={statusBarColor} barStyle={barStyleMode} />
			<Text className="text-2xl font-bold mb-5 text-center text-gray-800">
				{formTitle}
			</Text>

			<Formik
				initialValues={{
					name: initialValues?.name || '',
					category: initialValues?.category || '',
					street: initialValues?.street || '',
					district: initialValues?.district || '',
					upazila: initialValues?.upazila || '',
					phone: initialValues?.phone || '',
					tradeLicense: initialValues?.tradeLicense || '',
					//termsAccepted: initialValues?.termsAccepted || false,
					termsAccepted: true,
				}}
				validationSchema={ShopSchema}
				onSubmit={(values) => {
					const cleanedValues = {
						...values,
						name: cleanString(values.name || ''),
						street: cleanString(values.street || ''),
						tradeLicense: values.tradeLicense
							? cleanString(values.tradeLicense)
							: '',
					}

					handleSubmit(cleanedValues)
				}}
			>
				{({
					values,
					errors,
					touched,
					handleChange,
					handleSubmit,
					setFieldValue,
					setFieldTouched,
					isValid,
				}) => (
					<View>
						<View className="mb-4">
							<Text className="text-base font-medium mb-1 text-gray-700">
								{loc.t('shops.form.shopName') || 'Shop Name'} *
							</Text>
							<TextInput
								placeholder={
									loc.t('shops.form.shopNamePlaceholder') ||
									'ex: rakib interprice'
								}
								placeholderTextColor="#A0A0A0"
								value={values.name}
								onChangeText={handleChange('name')}
								onBlur={() => setFieldTouched('name', true)}
								className="border border-gray-300 rounded-lg p-3 text-base"
							/>
							{errors.name && touched.name && (
								<Text className="text-red-500 text-xs mt-1">{errors.name}</Text>
							)}
						</View>

						{/* Shop Category Dropdown */}
						<View className="mb-4">
							<Text className="text-base font-medium mb-1 text-gray-700">
								{loc.t('shops.add.category') || 'Shop Category'} *
							</Text>
							<View className="border border-gray-300 rounded-lg p-3">
								<Dropdown
									data={dropDownCategories}
									search
									maxHeight={300}
									labelField="label"
									valueField="value"
									placeholder={
										!isCategoryFocus
											? loc.t('shops.add.categoryPlaceholder') ||
												'Select shop category'
											: '...'
									}
									placeholderTextColor="#A0A0A0"
									searchPlaceholder="Search..."
									value={values.category}
									onFocus={() => setIsCategoryFocus(true)}
									onBlur={() => setIsCategoryFocus(false)}
									onChange={(item) => {
										setFieldValue('category', item.value)
										setIsCategoryFocus(false)
									}}
								/>
							</View>
							{errors.category && touched.category && (
								<Text className="text-red-500 text-xs mt-1">
									{errors.category}
								</Text>
							)}
						</View>
						{/* eof Shop Category Dropdown */}
						<Text className="text-lg font-semibold mt-2 mb-1 text-gray-700">
							{loc.t('shops.form.shopLocation') || 'Shop Location'}
						</Text>

						{/* District Dropdown */}
						<View className="mb-4">
							<Text className="text-base font-medium mb-1 text-gray-700">
								{loc.t('shops.form.district') || 'District'} *
							</Text>
							<View className="border border-gray-300 rounded-lg p-3 ">
								<Dropdown
									data={dropDownDistrict}
									search
									maxHeight={300}
									labelField="label"
									valueField="value"
									placeholder={
										!isCategoryFocus
											? loc.t('shops.form.selectItem') || 'Select item'
											: '...'
									}
									placeholderTextColor="#A0A0A0"
									searchPlaceholder="Search..."
									value={values.district}
									onFocus={() => setIsFocus(true)}
									onBlur={() => setIsFocus(false)}
									onChange={(item) => {
										setFieldValue('district', item.value)
										setUpazilaData(item.value)
										setIsFocus(false)
									}}
								/>
							</View>
							{errors.district && touched.district && (
								<Text className="text-red-500 text-xs mt-1">
									{errors.district}
								</Text>
							)}
						</View>
						{/* eof District Dropdown */}

						{/* Upazila Dropdown */}
						<View className="mb-4">
							<Text className="text-base font-medium mb-1 text-gray-700">
								{loc.t('shops.form.upazila') || 'Upazila'} *
							</Text>
							<View className="border border-gray-300 rounded-lg p-3 ">
								<Dropdown
									data={upazillDropDown}
									search
									maxHeight={300}
									labelField="label"
									valueField="value"
									placeholder={
										!isCategoryFocus
											? loc.t('shops.form.selectItem') || 'Select item'
											: '...'
									}
									placeholderTextColor="#A0A0A0"
									searchPlaceholder="Search..."
									value={values.upazila}
									onFocus={() => setIsFocus(true)}
									onBlur={() => setIsFocus(false)}
									onChange={(item) => {
										setFieldValue('upazila', item.value)
										setIsFocus(false)
									}}
								/>
							</View>
							{errors.upazila && touched.upazila && (
								<Text className="text-red-500 text-xs mt-1">
									{errors.upazila}
								</Text>
							)}
						</View>
						{/* eof Upazila Dropdown */}

						<View className="mb-4">
							<Text className="text-base font-medium mb-1 text-gray-700">
								{loc.t('shops.form.street') || 'Street'} *
							</Text>
							<TextInput
								placeholder={
									loc.t('shops.form.streetPlaceholder') || 'ex: 123 Main Street'
								}
								placeholderTextColor="#A0A0A0"
								value={values.street}
								onChangeText={handleChange('street')}
								onBlur={() => setFieldTouched('street', true)}
								className="border border-gray-300 rounded-lg p-3 text-base"
							/>
							{errors.street && touched.street && (
								<Text className="text-red-500 text-xs mt-1">
									{errors.street}
								</Text>
							)}
						</View>

						<View className="mb-4">
							<Text className="text-base font-medium mb-1 text-gray-700">
								{loc.t('shops.form.phoneNumber') || 'Phone Number'} *
							</Text>
							<TextInput
								placeholder={
									loc.t('shops.form.phonePlaceholder') || 'ex: 01712345678'
								}
								placeholderTextColor="#A0A0A0"
								value={values.phone}
								onChangeText={(text) => {
									// Only allow digits and limit to 11 characters
									const numericValue = text.replace(/[^0-9]/g, '').slice(0, 11)
									setFieldValue('phone', numericValue)
								}}
								onBlur={() => setFieldTouched('phone', true)}
								keyboardType="phone-pad"
								maxLength={11}
								className="border border-gray-300 rounded-lg p-3 text-base"
							/>
							{errors.phone && touched.phone && (
								<Text className="text-red-500 text-xs mt-1">
									{errors.phone}
								</Text>
							)}
						</View>

						<View className="mb-4">
							<Text className="text-base font-medium mb-1 text-gray-700">
								{loc.t('shops.form.tradeLicense') || 'Trade License'}
							</Text>
							<TextInput
								placeholder={
									loc.t('shops.form.licensePlaceholder') ||
									'ex: 338388-83830-393'
								}
								placeholderTextColor="#A0A0A0"
								value={values.tradeLicense}
								onChangeText={handleChange('tradeLicense')}
								onBlur={() => setFieldTouched('tradeLicense', true)}
								className="border border-gray-300 rounded-lg p-3 text-base"
							/>
							{errors.tradeLicense && touched.tradeLicense && (
								<Text className="text-red-500 text-xs mt-1">
									{errors.tradeLicense}
								</Text>
							)}
						</View>

						{/* <View className="flex-row items-center my-4"> */}
						{/* 	<Checkbox */}
						{/* 		status={values.termsAccepted ? 'checked' : 'unchecked'} */}
						{/* 		onPress={() => { */}
						{/* 			setFieldValue('termsAccepted', !values.termsAccepted) */}
						{/* 		}} */}
						{/* 		color="#4169E1" */}
						{/* 	/> */}
						{/* 	<View className="flex-1 ml-2"> */}
						{/* 		<Text className="text-sm text-gray-600"> */}
						{/* 			{loc.t('shops.form.termsPrefix') || 'I understood the'}{' '} */}
						{/* 			<Text */}
						{/* 				className="text-blue-600 underline" */}
						{/* 				onPress={() => Linking.openURL('https://example.com/terms')} */}
						{/* 			> */}
						{/* 				{loc.t('shops.form.terms') || 'terms'} */}
						{/* 			</Text> */}
						{/* 			{' & '} */}
						{/* 			<Text */}
						{/* 				className="text-blue-600 underline" */}
						{/* 				onPress={() => */}
						{/* 					Linking.openURL('https://example.com/policy') */}
						{/* 				} */}
						{/* 			> */}
						{/* 				{loc.t('shops.form.policy') || 'policy'} */}
						{/* 			</Text> */}
						{/* 			. */}
						{/* 		</Text> */}
						{/* 	</View> */}
						{/* </View> */}
						{errors.termsAccepted && touched.termsAccepted && (
							<Text className="text-red-500 text-xs mt-1 text-center">
								{errors.termsAccepted}
							</Text>
						)}

						<Text className="text-gray-600 text-xs text-center mb-4">
							{loc.t('shops.validation.mandatoryFields') ||
								'* Fields are mandatory'}
						</Text>

						<TouchableOpacity
							className="rounded-lg py-4 items-center mt-2 bg-blue-600"
							onPress={handleSubmit}
						>
							<Text className="text-white text-base font-bold">
								{submitText}
							</Text>
						</TouchableOpacity>
					</View>
				)}
			</Formik>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		backgroundColor: 'white',
		padding: 16,
	},
	dropdown: {
		height: 50,
		borderColor: 'gray',
		borderWidth: 0.5,
		borderRadius: 8,
		paddingHorizontal: 8,
	},
	icon: {
		marginRight: 5,
	},
	label: {
		position: 'absolute',
		backgroundColor: 'white',
		left: 22,
		top: 8,
		zIndex: 999,
		paddingHorizontal: 8,
		fontSize: 14,
	},
	placeholderStyle: {
		fontSize: 16,
	},
	selectedTextStyle: {
		fontSize: 16,
	},
	iconStyle: {
		width: 20,
		height: 20,
	},
	inputSearchStyle: {
		height: 40,
		fontSize: 16,
	},
})
