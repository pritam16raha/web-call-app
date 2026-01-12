# WebCall - Video & Voice Call Application

A modern web-based video and voice calling application built with Next.js, TypeScript, Firebase, and WebRTC.

## Features

- 🎥 **Video Calls**: High-quality video calling with up to 5 participants
- 📞 **Voice Calls**: Crystal clear voice calling
- 👥 **Group Calls**: Support for group calls with up to 5 people
- 🟢 **Online Status**: Real-time online/offline status
- 🔐 **Google Authentication**: Secure sign-in with Google
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎛️ **Call Controls**: Mute/unmute, video on/off, end call

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Authentication, Firestore)
- **Real-time Communication**: WebRTC
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+ installed
- A Firebase project with Authentication and Firestore enabled
- Google OAuth configured in Firebase

## Setup Instructions

### 1. Clone and Install

```bash
cd web-call-app
npm install
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing one)
3. Enable **Authentication** → Google Sign-in provider
4. Enable **Firestore Database** in production mode
5. Get your Firebase configuration from Project Settings

### 3. Update Firestore Security Rules

Go to Firestore Database → Rules and paste these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Calls collection
    match /calls/{callId} {
      allow read: if request.auth != null && 
        (request.auth.uid == resource.data.callerId || 
         request.auth.uid in resource.data.participants);
      allow create: if request.auth != null && request.auth.uid == request.resource.data.callerId;
      allow update: if request.auth != null && 
        (request.auth.uid == resource.data.callerId || 
         request.auth.uid in resource.data.participants);
      
      // Call offers, answers, and candidates
      match /offers/{document=**} {
        allow read, write: if request.auth != null;
      }
      match /answers/{document=**} {
        allow read, write: if request.auth != null;
      }
      match /candidates/{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

### 4. Environment Variables

The `.env.local` file is already configured with your Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBgvzqcFF8f_UF1xwW6lYsl5l9DcyH4Zvs
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=web-call-f5c82.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=web-call-f5c82
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=web-call-f5c82.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=909652447278
NEXT_PUBLIC_FIREBASE_APP_ID=1:909652447278:web:e42e4242abe9e921454fbf
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XKZ43HKBDH
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Testing

1. Open the app in two different browsers (or incognito mode)
2. Sign in with different Google accounts
3. You should see each other as "Online"
4. Click on a user to start a call

## Project Structure

```
web-call-app/
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── layout.tsx         # Root layout with providers
│   │   ├── page.tsx           # Main page
│   │   └── globals.css        # Global styles
│   ├── components/            # React components
│   │   ├── auth/              # Authentication components
│   │   ├── call/              # Call-related components
│   │   └── dashboard/         # Dashboard components
│   ├── contexts/              # React contexts
│   │   ├── AuthContext.tsx   # Authentication state
│   │   └── CallContext.tsx   # Call state management
│   ├── lib/                   # Utility libraries
│   │   ├── firebase.ts       # Firebase configuration
│   │   └── webrtc.ts         # WebRTC service
│   └── types/                 # TypeScript types
│       └── index.ts          # Type definitions
├── .env.local                # Environment variables
├── next.config.js            # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies
```

## How It Works

### WebRTC Connection Flow

1. **Caller initiates call**: Creates a call document in Firestore
2. **Generates offer**: Creates WebRTC offer and stores it
3. **Receiver gets notification**: Listens to Firestore for incoming calls
4. **Receiver answers**: Creates answer and updates Firestore
5. **ICE candidates exchange**: Both peers exchange ICE candidates through Firestore
6. **Connection established**: Direct peer-to-peer connection is established
7. **Media streaming**: Audio/video streams are exchanged directly

### Group Calls

- Uses mesh topology for up to 5 participants
- Each participant maintains peer connections with all others
- Firestore handles signaling for all peer connections

## Common Issues

### Camera/Microphone Not Working

- Make sure your browser has permission to access camera/microphone
- Check browser settings: `chrome://settings/content/camera` and `chrome://settings/content/microphone`
- Try using HTTPS (required for WebRTC in production)

### Calls Not Connecting

- Check Firebase security rules are properly configured
- Ensure both users are authenticated
- Check browser console for errors
- Verify WebRTC is supported in your browser

### "Failed to execute 'addTrack'" Error

This is handled in the code by checking if tracks are already added before adding them.

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 14+
- Opera 70+

## Production Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### HTTPS Requirement

WebRTC requires HTTPS in production. Make sure your deployment platform provides SSL certificates (Vercel does this automatically).

## Security Considerations

- Always use HTTPS in production
- Implement rate limiting for call creation
- Add user blocking/reporting features
- Monitor Firestore usage and set up budgets
- Regularly update dependencies

## Future Enhancements

- [ ] Screen sharing
- [ ] Chat during calls
- [ ] Call recording
- [ ] Virtual backgrounds
- [ ] Noise cancellation
- [ ] Call history
- [ ] User profiles
- [ ] Call scheduling
- [ ] Mobile app (React Native)

## License

MIT License - feel free to use this project for learning or production.

## Support

If you encounter any issues, please check:
1. Browser console for errors
2. Firebase console for quota/usage issues
3. Network tab for failed requests

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
