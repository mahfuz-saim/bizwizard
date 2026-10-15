export const nanoIdHelper = {
    generateNanoid: async (length: number) => {
        const { nanoid } = await import('nanoid');
        return nanoid(length);
    },
    generateCustomNanoId: async (length: number) => {
        const { customAlphabet } = await import('nanoid');
        const alphabet =
            '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        const customNanoid = customAlphabet(alphabet, length);
        return customNanoid();
    },

    generateShopCode: async (length: number) => {
        const { customAlphabet } = await import('nanoid');
        const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const customNanoid = customAlphabet(alphabet, length);
        return customNanoid();
    },

    generateCustomBarCode: async () => {
        const { customAlphabet } = await import('nanoid');
        const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const customNanoid = customAlphabet(alphabet, 6);
        return customNanoid();
    },
};
