import { IUploadFile } from '../../../../interfaces/file';
import { FileUploadHelper } from '../../../../helpers/fileUploadHelper';
import prisma from '../../../../shared/prisma';
import ApiError from '../../../../errors/ApiError';
import httpStatus from 'http-status';
import { JwtPayload } from '../../../../interfaces/common';
import { IKycApproval, IKycInput } from './kyc.interface';
import { notificationService } from '../../notification/notification.service';
import { sendEmailAlertToAdmins } from '../../../../helpers/sendEmail';

const submitKYC = async (
    user: JwtPayload,
    payload: IKycInput,
    files: Record<string, IUploadFile[]>,
) => {
    const keys = ['documentFront', 'documentBack', 'selfie'] as const;

    if (!keys.every(k => k in files)) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            'All KYC document is required',
        );
    }

    const uploadPromises = keys.map(async key => {
        return FileUploadHelper.uploadToCloudinary(files[key][0]);
    });
    const uploadResponses = await Promise.all(uploadPromises);
    const uploadedFiles = uploadResponses.map(response => ({
        fileType: response?.type as string,
        fileUrl: response?.secure_url as string,
    }));

    await prisma.$transaction(async tx => {
        const existingKyc = await tx.kYC.findUnique({
            where: {
                userId: user.userID,
            },
        });
        if (existingKyc) {
            await tx.kycDocument.deleteMany({
                where: {
                    kycId: existingKyc.id,
                },
            });
            await tx.kYC.delete({
                where: {
                    id: existingKyc.id,
                },
            });
        }

        await tx.kYC.create({
            data: {
                ...payload,
                userId: user.userID,
                documents: {
                    create: uploadedFiles.map(file => ({
                        fileType: file.fileType,
                        fileUrl: file.fileUrl,
                    })),
                },
            },
        });
    });

    try {
        await sendEmailAlertToAdmins(
            'New KYC Submission',
            `A New User has submitted KYC documents for verification. Please review them in the admin panel.`,
        );
    } catch (err) {
        console.error(
            'Failed to send KYC submission alert email to admins:',
            err,
        );
    }

    return null;
};

const getKYCStatus = async (user: JwtPayload, shopId: string) => {
    const shop = await prisma.shop.findUnique({
        where: {
            id: shopId,
        },
        include: {
            owner: true,
            Employee: true,
        },
    });
    if (user.role === 'OWNER') {
        if (shop?.ownerID !== user.userID) {
            throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
        }
    } else if (user.role === 'EMPLOYEE') {
        const isEmployee = shop?.Employee.some(
            emp => emp.userID === user.userID,
        );
        if (!isEmployee) {
            throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
        }
    }

    const kycRecord = await prisma.kYC.findUnique({
        where: {
            userId: shop?.ownerID,
        },
    });

    return kycRecord;
};

const approveKYC = async (payload: IKycApproval, tenantId: string) => {
    const kycRecord = await prisma.kYC.findUniqueOrThrow({
        where: {
            userId: payload.userId,
        },
    });
    if (kycRecord.isVerified) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'KYC is already approved');
    }
    const result = await prisma.kYC.update({
        where: {
            userId: payload.userId,
        },
        data: {
            isVerified: payload.status === 'APPROVED' ? true : false,
            verificationStatus: payload.status,
            verificationDate: new Date(),
        },
    });

    // Send notification to the owner
    const notificationTitle =
        payload.status === 'APPROVED'
            ? 'KYC Verification Approved'
            : 'KYC Verification Rejected';
    const notificationBody =
        payload.status === 'APPROVED'
            ? 'Your KYC has been approved successfully!'
            : 'Your KYC verification was rejected. Please resubmit with correct documents.';

    await notificationService.sendNotification({
        title: notificationTitle,
        body: notificationBody,
        userIds: [payload.userId],
    });

    return result;
};

const getAllKYCRequests = async () => {
    const kycRequests = await prisma.kYC.findMany({
        where: {
            verificationStatus: 'PENDING',
        },
        include: {
            user: true,
            documents: true,
        },
    });
    return kycRequests;
};

export const kycService = {
    submitKYC,
    getKYCStatus,
    approveKYC,
    getAllKYCRequests,
};
