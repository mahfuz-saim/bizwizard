// @dead-code — 2026-09-24 knip+grep: 0 active imports, candidate for removal (kept per request)
/**
 * Appends query parameters to a URL, handling array values properly.
 *
 * @param {URL} url - The URL object to append query params to.
 * @param {Record<string, any>} params - The query parameters object.
 */
export function appendQueryParams(url, params) {
	Object.entries(params).forEach(([key, value]) => {
		if (Array.isArray(value)) {
			value.forEach((item) => url.searchParams.append(key, item))
		} else if (value !== undefined && value !== null) {
			url.searchParams.append(key, value)
		}
	})
}
