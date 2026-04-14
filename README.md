# TGStream - Secure Watch Party Platform

TGStream is a production-ready, highly secure web application built with Next.js (App Router) that allows users to watch movies together, video call, and chat in real-time.

## Features

- **AnyDesk-Style Connection**: Join rooms using simple, secure Room IDs.
- **High-Performance Watch Party**: Sychronized video playback via URL or Screen Sharing (getDisplayMedia).
- **Independent Video Calling**: Crystal clear P2P video calls using WebRTC that don't interfere with movie playback.
- **Real-time Chat**: Instant communication using Socket.io.
- **Highly Secure Auth**: JWT-based authentication stored in httpOnly cookies, password hashing with bcrypt, and protected routes.
- **Premium UI**: Sleek, glassmorphic dark theme for an immersive experience.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), Vanilla CSS
- **Backend**: Next.js API Routes, Node.js (Socket.io Signaling Server)
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io
- **Communication**: WebRTC (STUN: Google)
- **Authentication**: JWT, bcryptjs

## Prerequisites

- Node.js (v18+)
- MongoDB Atlas account (or local MongoDB)
- Vercel account (for frontend deployment)
- Render or similar (for socket server deployment)

## Setup Instructions

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd tgstream
npm install
```

### 2. Configure Environment
Create a `.env` file in the root and add the following:
```env
MONGODB_URI=your_mongodb_cluster_uri
JWT_SECRET=your_super_secure_jwt_secret
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
PORT=3001
```

### 3. Run Locally
You need to run TWO servers simultaneously:

**Option A: Separate Terminals**
1. Run Next.js app: `npm run dev`
2. Run Socket server: `npm run socket`

**Usage**: Open [http://localhost:3000](http://localhost:3000)

## Security Implementation

- **JWT in httpOnly Cookies**: Prevents XSS-based token theft.
- **Password Hashing**: Uses bcrypt with 10 salt rounds.
- **Route Protection**: Middleware ensures only authenticated users can access dashboards and rooms.
- **Rate Limiting**: Login route is protected against brute-force attacks.
- **WebRTC Security**: Uses secure signaling via Socket.io and Google's public STUN servers.

## Deployment Guide

### Socket Server (Backend)
1. Deploy `server.js` to **Render** or **Railway**.
2. Set Environment Variables (`PORT`, `JWT_SECRET`).
3. Note your service URL (e.g., `https://my-tgstream-socket.onrender.com`).

### Next.js App (Frontend)
1. Push to GitHub and connect to **Vercel**.
2. Add Environment Variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `NEXT_PUBLIC_SOCKET_URL` (Set this to your Render URL)
3. Deploy!

## License
MIT
