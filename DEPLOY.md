# Backend Deployment Guide (Railway)

This backend is a Node.js Socket.IO server designed to run on Railway.

## 1. Prerequisites
- GitHub repository: `https://github.com/cortexresearch/chattypatty-backend`
- Railway account connected to GitHub.

## 2. Deployment Steps
1. Log in to [Railway](https://railway.app/).
2. Click **"New Project"** -> **"Deploy from GitHub repo"**.
3. Select `chattypatty-backend`.
4. Railway will automatically detect the `package.json` and `Procfile`.
5. The `Procfile` command `web: node server.js` will be used to start the service.

## 3. Environment Variables
Add the following variable in the **Variables** tab of your Railway service:
- `PORT`: `3000` (Railway often provides this automatically via `process.env.PORT`).

## 4. Verification
Once deployed, Railway will provide a public URL (e.g., `https://chattypatty-backend-production.up.railway.app`). 
- Verify by visiting the URL; you should see "ChattyPatty Backend Running".
- **Important:** If your URL differs from the one in `frontend/js/main.js`, you must update the `BACKEND_URL` in the frontend code.
