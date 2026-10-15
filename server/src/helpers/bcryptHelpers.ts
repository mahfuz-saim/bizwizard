import * as bcrypt from 'bcryptjs';

const hashedPassword = async (password: string): Promise<string> => {
    const saltRounds: number = 10;
    try {
        const hashedPassword: string = await bcrypt.hash(password, saltRounds);
        return hashedPassword;
    } catch (error) {
        throw new Error('Error hashing password');
    }
};

async function comparePasswords(
    plainTextPassword: string,
    hashedPassword: string,
): Promise<boolean> {
    try {
        const match: boolean = await bcrypt.compare(
            plainTextPassword,
            hashedPassword,
        );
        return match;
    } catch (error) {
        throw new Error('Error comparing passwords');
    }
}

export const AuthUtils = {
    comparePasswords,
    hashedPassword,
};
