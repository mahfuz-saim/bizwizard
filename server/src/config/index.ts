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
    },
    cloudinary: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    },
    payment: {
        mode: process.env.PAYMENT_MODE || 'demo',
    },
    ai: {
        openaiApiKey: process.env.OPENAI_API_KEY,
        modelFast: process.env.OPENAI_MODEL_FAST || 'gpt-4o-mini',
        modelReasoning: process.env.OPENAI_MODEL_REASONING || 'gpt-4.1',
        modelEmbedding: process.env.OPENAI_MODEL_EMBEDDING || 'text-embedding-3-small',
        planBudgetUsd: Number(process.env.AI_PLAN_BUDGET_USD || 2),
        featureFlags: process.env.AI_FEATURE_FLAGS || 'matching,cashflow,analysis,agents',
    },
    demo: {
        email: process.env.DEMO_EMAIL,
        password: process.env.DEMO_PASSWORD,
        number: process.env.DEMO_NUMBER || '00000000000',
        shopName: process.env.DEMO_SHOP_NAME || 'Demo Store',
    },
};
