# Firebase admin authorization

The app and Firestore rules decide admin status **only from Firebase Authentication custom claims**:

```js
request.auth.token.admin == true
```

There is no hardcoded admin email and the Firestore `users/{uid}.role` field is not used for authorization.

To grant admin access to a Firebase Auth account, run this one-time script from a trusted machine with a Firebase service-account credential:

```bash
npm install firebase-admin
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\service-account.json
node scripts/set-admin-claim.mjs admin@example.com
```

On macOS/Linux:

```bash
npm install firebase-admin
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
node scripts/set-admin-claim.mjs admin@example.com
```

To remove admin access, use a similar Admin SDK call with `{ admin: false }` (or remove the `admin` claim) from a trusted server. Users must refresh their Firebase ID token, normally by signing out and signing back in.

Never put the service-account JSON or Admin SDK credentials into the Vite frontend or GitHub Pages repository.
