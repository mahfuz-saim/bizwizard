import config from '../config';
import { google } from 'googleapis';
import fs from 'fs';

// gmail API setup
if (!config.google_mailer.credentials || !config.google_mailer.token) {
    throw new Error(
        'Google mailer credentials or token not provided in config',
    );
}

const credentials = JSON.parse(
    fs.readFileSync(config.google_mailer.credentials, 'utf-8'),
);

const token = JSON.parse(fs.readFileSync(config.google_mailer.token, 'utf-8'));

const { client_secret, client_id, redirect_uris } = credentials.web;

const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
auth.setCredentials(token);

const gmail = google.gmail({ version: 'v1', auth });
// eo gmail API setup

export async function sendAPIMail({
    to,
    subject,
    message,
}: {
    to: string;
    subject: string;
    message: string;
}) {
    const emailLines = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${subject}`,
        '',
        message,
    ];

    const email = emailLines.join('\n');

    const encodedMessage = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
            raw: encodedMessage,
        },
    });
    return result;
}

export async function sendEmail(to: string, subject: string, html: string) {
    await sendAPIMail({
        to, // list of receivers
        subject: subject, // Subject line
        message: html, // html body
    });
}

export async function sendEmailAlertToAdmins(subject: string, html: string) {
    const response = await sendAPIMail({
        to: config.alert_recipients as string, // list of receivers
        subject: subject, // Subject line
        message: html, // html body
    });
    console.log('🚀 admin notify response : ', response);
}
