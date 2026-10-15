import config from '../config';
import ApiError from '../errors/ApiError';
import httpStatus from 'http-status';
const sendOTP = async (data: { otp: number; number: string }) => {
    const reqBody = {
        UserName: config.mim_sms.user_name,
        Apikey: config.mim_sms.api_key,
        SenderName: config.mim_sms.sender_name,
        CampaignId: 'null',
        TransactionType: 'T',
        MobileNumber: `88${data.number}`,
        // Message: `Your OTP for Bebsapati: ${data.otp}`,
        Message: `<#> Your Bebsapati verification code is ${data.otp}. Please do not share this code with anyone. 1UvWpQDlAyP`,
    };

    if (config.env === 'development') {
        console.log(reqBody);
        return;
    }

    const res = await fetch('https://api.mimsms.com/api/SmsSending/SMS', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody),
    });
    const result = await res.json();
    if (result.statusCode !== '200') {
        throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            'Something went wrong',
        );
    }

    return null;
};

const sendReceipt = async (data: {
    number: string;
    totalPrice: number;
    pin: number;
    receiptId: string;
    shopName: string;
}) => {
    const msgBody = `
${data.shopName} Purchase Successful!
Total Price : ${data.totalPrice}
Download Receipt Link : https://bebsapati.com/receipt/${data.receiptId}
PIN : ${data.pin}

Thank you for shopping with us!
- Bebsapati
`;

    const reqBody = {
        UserName: config.mim_sms.user_name,
        Apikey: config.mim_sms.api_key,
        SenderName: config.mim_sms.sender_name,
        CampaignId: 'null',
        TransactionType: 'T',
        MobileNumber: `88${data.number}`,
        Message: msgBody,
    };

    if (config.env === 'development') {
        console.log(reqBody);
        return;
    }

    const res = await fetch('https://api.mimsms.com/api/SmsSending/SMS', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody),
    });

    const result = await res.json();
    if (result.statusCode !== '200') {
        throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            'Something went wrong',
        );
    }

    return { success: true };
};

const sendGeneralMessage = async (data: {
    msgBody: string;
    number: string;
}) => {
    // not adding country code here as it is done in the calling function
    const reqBody = {
        UserName: config.mim_sms.user_name,
        Apikey: config.mim_sms.api_key,
        SenderName: config.mim_sms.sender_name,
        CampaignId: 'null',
        TransactionType: 'T',
        MobileNumber: data.number,
        Message: data.msgBody,
    };

    if (config.env === 'development') {
        console.log('🚀 reqBody : ', reqBody);
        console.log('🚀 DEV_ENV: Not Proceeding');
        return;
    }

    const res = await fetch('https://api.mimsms.com/api/SmsSending/OneToMany', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody),
    });
    const result = await res.json();
    if (result.statusCode !== '200') {
        console.error('mim sms send err', result);
        return { succss: false };
    }

    return { success: true };
};

const sendDynamicMessage = async (
    data: {
        Message: string;
        MobNumber: string;
    }[],
) => {
    // not adding country code here as it is done in the calling function
    const reqBody = {
        UserName: config.mim_sms.user_name,
        Apikey: config.mim_sms.api_key,
        SenderName: config.mim_sms.sender_name,
        TransactionType: 'D',
        SmsData: data,
    };

    if (config.env === 'development') {
        console.log('🚀 reqBody : ', reqBody);
        console.log('🚀 DEV_ENV: Not Proceeding');
        return;
    }

    const res = await fetch('https://api.mimsms.com/api/SmsSending/DSMS', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody),
    });
    const result = await res.json();
    if (result.statusCode !== '200') {
        console.error(result);
        return { succss: false };
    }

    return { success: true };
};

export const smsHelper = {
    sendOTP,
    sendReceipt,
    sendGeneralMessage,
    sendDynamicMessage,
};
