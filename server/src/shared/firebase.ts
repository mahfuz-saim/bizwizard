import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';

let firebaseApp: any = null;

export function initializeFirebase() {
    if (!getApps().length && !firebaseApp) {
        firebaseApp = initializeApp({
            credential: applicationDefault(),
        });
    }
    return firebaseApp;
}

// Auto-initialize on import
initializeFirebase();
