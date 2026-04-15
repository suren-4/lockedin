import { S3Client } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
dotenv.config();

const s3Config = {
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "dummy",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "dummy",
    },
};

// Only enable S3 if credentials are provided, otherwise fallback to local logic
export const isS3Enabled = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
export const s3Client = isS3Enabled ? new S3Client(s3Config) : null;
export const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;
