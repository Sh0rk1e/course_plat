# GitHub Pages Course Platform — upgraded

This version adds all three requested upgrades:

1. **Custom-domain GitHub Pages support**
2. **GitHub Actions deployment**
3. **A stronger video-protection architecture using short-lived Cloudflare Stream playback authorization**

Firebase configuration is intentionally left blank. You can provide it later.

---

# Architecture

## Normal mode

```text
React/Vite → Firebase Auth
          → Firestore (RBAC)
          → YouTube privacy-enhanced iframe
```

Anonymous users can read only the lesson marked `isIntro: true`.

## Stronger video mode

```text
React/Vite
   ↓ Firebase Auth
Short-lived video authorization endpoint
   ↓
Cloudflare Stream signed playback
```

The Cloudflare signing secret stays on a server-side Worker/API. It is **never** placed in Vite environment variables.

This is materially stronger than unlisted YouTube because the playback URL can be short-lived and authorization can be checked before issuing it.

> Important: this project does not pretend that unlisted YouTube is DRM. If the underlying YouTube URL is exposed, it can be shared. For genuinely restricted course content, use a signed video platform such as Cloudflare Stream with server-side authorization.

---

# 1. Install

Requirements:

- Node.js 20+
- npm
- A GitHub repository
- A Firebase project

```bash
npm install
```

Local development:

```bash
npm run dev
```

---

# 2. Firebase setup

When you are ready, create a Firebase Web App and enable:

- Authentication → Google
- Authentication → Email/Password
- Authentication → Anonymous
- Firestore Database

Copy `.env.example` to `.env`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Then add your Firebase Web App configuration:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Do not put Firebase Admin SDK credentials or private keys into `.env` or the frontend.

---

# 3. Firestore rules

Deploy:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

The rules enforce:

### Admin

`users/{uid}.role == "admin"`

- Read all video records
- Add videos
- Edit videos
- Delete videos
- Read user records

### Registered user

Google or email/password:

- Read all videos
- Cannot create/update/delete videos
- Cannot change their own role

### Anonymous guest

- Can read only a video with `isIntro == true`
- Cannot read locked video records

### Unauthenticated visitor

- Cannot read course records

The UI is not the security boundary; Firestore rules are.

---

# 4. Set yourself as Admin

The app intentionally has no role-management UI.

1. Create/sign in with your Google or email account.
2. Firebase Console → Authentication → Users.
3. Copy your UID.
4. Firestore → Data → `users`.
5. Open the document whose ID is your UID.
6. Set:

```text
role = admin
```

The application creates ordinary users as:

```text
role = user
```

A normal user cannot promote themselves because the Firestore rule requires the role to remain unchanged on self-updates.

---

# 5. Add lessons

Admin → Add lesson.

For YouTube mode:

```text
youtubeId = dQw4w9WgXcQ
```

For Cloudflare Stream mode:

```text
videoId = your Cloudflare Stream UID
```

You can keep both IDs on a lesson if you want to switch providers later.

Exactly one lesson should normally have:

```text
isIntro = true
```

---

# 6. Option A — YouTube

Default:

```env
VITE_VIDEO_PROVIDER=youtube
```

The player uses:

```text
https://www.youtube-nocookie.com/embed/VIDEO_ID?modestbranding=1&rel=0
```

This provides privacy-enhanced embedding but **does not provide true content access control**.

Use this when convenience is more important than preventing sharing.

---

# 7. Option B — stronger protection with Cloudflare Stream

Set:

```env
VITE_VIDEO_PROVIDER=cloudflare
VITE_VIDEO_TOKEN_ENDPOINT=https://YOUR-VIDEO-AUTH-DOMAIN.example/token
```

The browser requests authorization for the specific video.

The authorization service should:

1. Receive the Firebase ID token.
2. Verify the Firebase token server-side.
3. Identify the Firebase UID.
4. Reject anonymous users for locked lessons.
5. Confirm the requested Stream UID is an allowed course lesson.
6. Generate a short-lived Cloudflare Stream signed playback token.
7. Return only the short-lived playback URL.

The signing key belongs in the backend secret store.

### Never do this

```env
VITE_CLOUDFLARE_SIGNING_SECRET=...
```

Anything beginning with `VITE_` can be shipped to browsers.

The reference architecture is in:

```text
functions/src/token-endpoint.example.js
```

and the implementation guidance is in:

```text
functions/README.md
```

For production, I recommend a Cloudflare Worker or another server-side endpoint rather than attempting to sign playback URLs in GitHub Pages.

---

# 8. Custom GitHub Pages domain

GitHub Pages supports a custom domain.

For an apex domain:

```text
example.com
```

configure the DNS records GitHub provides.

For a subdomain such as:

```text
learn.example.com
```

create the appropriate DNS CNAME pointing to your GitHub Pages hostname.

Then:

1. GitHub repository → Settings → Pages.
2. Configure the custom domain.
3. Enable HTTPS after DNS has propagated.

Create:

```text
public/CNAME
```

containing only:

```text
learn.example.com
```

The repository includes `public/CNAME.example` as a template.

### Firebase

Also add the custom domain to:

Firebase Console → Authentication → Settings → Authorized domains.

---

# 9. GitHub Actions deployment

This version uses:

```text
.github/workflows/deploy.yml
```

Every push to `main` builds and deploys the site to GitHub Pages.

Enable:

GitHub repository → Settings → Pages

and select:

```text
Source: GitHub Actions
```

### Required repository secrets

GitHub repository → Settings → Secrets and variables → Actions → Secrets:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### Optional repository variables

Settings → Secrets and variables → Actions → Variables:

```text
VITE_VIDEO_PROVIDER
VITE_VIDEO_TOKEN_ENDPOINT
```

For example:

```text
VITE_VIDEO_PROVIDER = youtube
```

or:

```text
VITE_VIDEO_PROVIDER = cloudflare
```

Do not store video signing secrets in GitHub Pages variables. Those values belong in your server-side video authorization service.

---

# 10. GitHub repository setup

```bash
git init
git add .
git commit -m "Initial course platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

After the Actions workflow succeeds, GitHub Pages will publish the site.

You no longer need the old `npm run deploy` workflow, although the package still includes the `gh-pages` script for manual deployment if desired.

---

# 11. GitHub Pages routing

The application uses React Router with BrowserRouter.

GitHub Pages does not natively rewrite arbitrary URLs to `index.html`, so this package includes:

```text
public/404.html
```

which redirects back through the SPA entry point.

The application also restores the requested route.

---

# 12. Data model

## users/{uid}

```text
email: string
displayName: string
role: "user" | "admin"
createdAt: timestamp
```

## videos/{videoDocumentId}

```text
title: string
youtubeId: string
videoId: string
description: string
order: number
isIntro: boolean
```

`youtubeId` is used by YouTube mode.

`videoId` is used by Cloudflare Stream mode.

---

# 13. Production security checklist

Before launch:

- [ ] Configure Firebase Auth providers.
- [ ] Deploy Firestore rules.
- [ ] Deploy Firestore indexes.
- [ ] Create your admin account.
- [ ] Test anonymous access.
- [ ] Test registered-user access.
- [ ] Test admin CRUD.
- [ ] Add GitHub Actions Firebase secrets.
- [ ] Configure custom domain.
- [ ] Add custom domain to Firebase Authorized Domains.
- [ ] If using Cloudflare Stream, deploy the server-side token endpoint.
- [ ] Keep all signing secrets server-side.
- [ ] Use short-lived video tokens.
- [ ] Do not rely on hidden UI buttons for authorization.
- [ ] Do not put service-account credentials in the React application.

---

# 14. What I need from you later

When you're ready, provide the Firebase Web App configuration values:

```text
apiKey
authDomain
projectId
storageBucket
messagingSenderId
appId
```

You can paste them here; Firebase Web API configuration is intended for client-side use. **Do not send Firebase Admin service-account private keys.**

I can then prepare the project configuration around your actual Firebase project.

---

# 15. Build

```bash
npm run build
npm run preview
```

The production build is generated in:

```text
dist/
```

For GitHub Actions, push to `main` and the workflow handles the deployment.
