import TextRecognition from '@react-native-ml-kit/text-recognition'

class OCRProcessor {
	static async extractTextFromImage(imageUri) {
		try {
			const result = await TextRecognition.recognize(imageUri)

			const extractedTexts = result.blocks.flatMap((block) =>
				block.lines.flatMap((line) =>
					line.elements.map((element) => ({
						text: element.text,
						confidence: element.confidence || 0.5,
					}))
				)
			)

			return {
				extractedTexts,
				fullResult: result,
			}
		} catch (error) {
			console.error('OCR processing error:', error)
			return {
				extractedTexts: [],
				fullResult: null,
				error: error.message,
			}
		}
	}
}

export default OCRProcessor
