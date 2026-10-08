import admin from 'firebase-admin';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/set-admin-claim.mjs user@example.com');
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a Firebase service-account JSON file first.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const user = await admin.auth().getUserByEmail(email);
await admin.auth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
console.log(`Admin claim set for ${user.email}. Have the user sign out/in (or refresh the ID token) for it to take effect.`);
