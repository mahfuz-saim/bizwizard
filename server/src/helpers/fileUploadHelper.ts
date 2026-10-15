import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import * as fs from 'fs';
import { ICloudinaryResponse, IUploadFile } from '../interfaces/file';
import config from '../config';

cloudinary.config({
    cloud_name: config.cloudinary.cloud_name,
    api_key: config.cloudinary.api_key,
    api_secret: config.cloudinary.api_secret,
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Math.floor(Date.now() / 1000) + '_' + file.originalname);
    },
});

const upload = multer({ storage: storage });

const uploadToCloudinary = async (
    file: IUploadFile,
): Promise<ICloudinaryResponse | undefined> => {
    console.log('🚀 cloudinary file : ', file);
    try {
        const result: unknown = await cloudinary.uploader.upload(file.path, {
            resource_type: 'auto',
            folder: 'kyc-documents', // Optional: organize uploads
        });

        // Clean up local file after successful upload
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        return result as ICloudinaryResponse;
    } catch (err) {
        console.error('Cloudinary upload error:', err);
        // Clean up local file even on error
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        throw err;
    }
};

export const FileUploadHelper = {
    uploadToCloudinary,
    upload,
};
