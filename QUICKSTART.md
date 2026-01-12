# Quick Start Guide

Follow these steps to get your WebCall application running:

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Setup Firebase

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project: `web-call-f5c82`
3. Enable Authentication:
   - Go to Authentication → Sign-in method
   - Enable Google as a provider
   - Add your domain (localhost:3000 for development)

4. Setup Firestore:
   - Go to Firestore Database
   - Create database (if not already created)
   - Start in production mode
   - Choose a location close to your users

5. Update Security Rules:
   - Go to Firestore → Rules tab
   - Copy the contents of `firestore.rules` file
   - Paste and publish the rules

## Step 3: Run the Application
```bash
npm run dev
```

Open http://localhost:3000 in your browser

## Step 4: Test the Application

### Testing Locally:
1. Open http://localhost:3000 in Chrome
2. Sign in with your Google account
3. Open http://localhost:3000 in another browser (Firefox/Edge) or Incognito mode
4. Sign in with a different Google account
5. You should see each other as "Online"
6. Click to start a video or voice call!

### Testing One-to-One Call:
1. Click on any online user
2. Choose "Video" or "Voice" call
3. The other user will receive a call notification
4. Accept the call to connect

### Testing Group Call:
1. Click "Group Call" button in the header
2. Select 2-4 users (maximum 4, plus you = 5 total)
3. Choose "Video" or "Voice" call
4. All selected users will receive call notifications
5. As each user accepts, they join the call

## Troubleshooting

### Camera/Mic Not Working
- Allow browser permissions for camera/microphone
- Check: chrome://settings/content/camera
- Check: chrome://settings/content/microphone

### Call Not Connecting
1. Check Firebase console for any errors
2. Open browser DevTools → Console
3. Look for WebRTC errors
4. Ensure both users are signed in
5. Check Firestore security rules are properly set

### "Failed to execute 'addTrack'" Error
This should be handled automatically. If you still see it:
1. Refresh the page
2. Clear browser cache
3. Check console for other errors

### No Users Showing Online
1. Verify Firestore rules are published
2. Check network tab for failed requests
3. Ensure users are signed in
4. Check Firestore console to see if user documents exist

## Important Notes

- **HTTPS Required**: WebRTC requires HTTPS in production
- **Browser Support**: Use modern browsers (Chrome, Firefox, Edge, Safari)
- **Participants Limit**: Maximum 5 participants per call
- **Firestore Quota**: Free tier has limits, monitor usage
- **Network**: Good internet connection required for quality calls

## Next Steps

After testing locally:
1. Deploy to Vercel or Netlify
2. Add your production domain to Firebase authorized domains
3. Test in production environment
4. Monitor Firebase usage and costs

## Firebase Console Quick Links

- Authentication: https://console.firebase.google.com/project/web-call-f5c82/authentication
- Firestore: https://console.firebase.google.com/project/web-call-f5c82/firestore
- Usage: https://console.firebase.google.com/project/web-call-f5c82/usage

## Need Help?

Check the README.md for detailed documentation and troubleshooting guide.
