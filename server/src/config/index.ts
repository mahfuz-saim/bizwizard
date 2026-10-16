import dotenv from 'dotenv';
import path from 'path';

const envPath =
    process.env.NODE_ENV === 'production'
        ? path.join(process.cwd(), '.env.prod')
        : path.join(process.cwd(), '.env');

dotenv.config({ path: envPath });

export default {
    env: process.env.NODE_ENV,
    port: process.env.PORT,
    database_url: process.env.DATABASE_URL,
    jwt: {
        secret: process.env.JWT_SECRET,
        expires_in: process.env.EXPIRES_IN,
        refresh_secret: process.env.REFRESH_SECRET,
        refresh_expires_in: process.env.REFRESH_EXPIRES_IN,
        passwordResetTokenExpirationTime:
            process.env.PASS_RESET_EXPIRATION_TIME,
    },
    reset_link: process.env.RESET_LINK,
    email: process.env.EMAIL,
    gmail_app_pass: process.env.GMAIL_APP_PASS,
    alert_recipients: process.env.ALERT_RECIPIENT_EMAILS,
    bcrypt_salt_rounds: process.env.SALT_ROUND,
    cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    },
    mim_sms: {
        user_name: process.env.MIM_USERNAME,
        api_key: process.env.MIM_API_KEY,
        sender_name: process.env.MIM_SENDER_NAME,
    },
    ssl: {
        store_id: process.env.SSL_STORE_ID,
        store_passwd: process.env.SSL_STORE_PASSWORD,
        shopPaymentIPN: process.env.SHOP_PAYMENT_IPN,
    },
    google_mailer: {
        token: process.env.GMAIL_APPLICATION_TOKEN,
        credentials: process.env.GMAIL_APPLICATION_CREDENTIALS,
    },
    demo: {
        email: process.env.DEMO_EMAIL,
        password: process.env.DEMO_PASSWORD,
        number: process.env.DEMO_NUMBER || '00000000000',
        shopName: process.env.DEMO_SHOP_NAME || 'Demo Store',
    },
};
