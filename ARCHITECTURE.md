# Architecture & Error Resolution Guide

## Overview

This document explains the architecture of the WebCall application and how it resolves the errors you encountered in your previous implementation.

## Previous Errors Resolved

### 1. "Failed to execute 'addTrack' on 'RTCPeerConnection': A sender already exists for the track"

**Root Cause**: Attempting to add the same media track to a peer connection multiple times.

**Solution Implemented**:
```typescript
// In webrtc.ts - createPeerConnection()
const senders = peerConnection.getSenders();
const trackAlreadyAdded = senders.some(sender => sender.track === track);

if (!trackAlreadyAdded) {
  peerConnection.addTrack(track, this.localStream);
}
```

**Key Points**:
- Check if track already exists before adding
- Use getSenders() to verify current tracks
- Only add track if not already present

### 2. "Failed to set remote description: setRemoteDescription completed but signaling state did not change to have-remote-offer"

**Root Cause**: Attempting to set remote description when peer connection is not in the correct signaling state.

**Solution Implemented**:
```typescript
// In webrtc.ts - handleAnswer()
if (peerConnection.signalingState === 'have-local-offer') {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
} else {
  console.warn(`Cannot set remote description in state: ${peerConnection.signalingState}`);
}
```

**Key Points**:
- Check signaling state before setting remote description
- Only set remote description when in 'have-local-offer' state
- Log warnings for debugging instead of crashing

## Architecture

### 1. Component Structure

```
┌─────────────────────────────────────────┐
│           AuthProvider                  │
│  (Authentication State Management)      │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │        CallProvider               │ │
│  │  (Call State & WebRTC)            │ │
│  │                                   │ │
│  │  ┌─────────────────────────────┐ │ │
│  │  │       App Components        │ │ │
│  │  │  - Dashboard                │ │ │
│  │  │  - CallUI                   │ │ │
│  │  │  - IncomingCallNotification │ │ │
│  │  └─────────────────────────────┘ │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 2. Data Flow

#### Authentication Flow:
```
User → Google Sign-in → Firebase Auth → Create User Doc → Update Online Status
```

#### Call Initiation Flow (Caller):
```
1. User clicks call button
2. CallContext.startCall() is called
3. WebRTCService.initializeLocalStream() - Get camera/mic
4. Create call document in Firestore
5. For each receiver:
   - Create peer connection
   - Add local tracks
   - Create offer
   - Save offer to Firestore
   - Setup ICE candidate listener
6. Listen for answers from receivers
```

#### Call Answering Flow (Receiver):
```
1. Listen to Firestore for incoming calls
2. Show IncomingCallNotification
3. User clicks answer
4. CallContext.answerCall() is called
5. WebRTCService.initializeLocalStream() - Get camera/mic
6. Get offer from Firestore
7. Create peer connection
8. Set remote description (offer)
9. Create answer
10. Set local description (answer)
11. Save answer to Firestore
12. Setup ICE candidate listener
```

#### ICE Candidate Exchange:
```
1. Peer connection generates ICE candidates
2. Save to Firestore (calls/{callId}/candidates)
3. Other peer listens for candidates
4. Add ICE candidate to peer connection
5. Repeat until connection established
```

### 3. WebRTC Connection States

Understanding signaling states is crucial:

```
Caller Flow:
stable → have-local-offer → stable

Receiver Flow:
stable → have-remote-offer → stable
```

**Important Rules**:
- Only create offer when in 'stable' state
- Only set remote description (offer) when in 'stable' state
- Only create answer when in 'have-remote-offer' state
- Only set remote description (answer) when in 'have-local-offer' state

### 4. Firebase Structure

```
Firestore:
├── users/
│   └── {userId}
│       ├── uid
│       ├── email
│       ├── displayName
│       ├── photoURL
│       ├── isOnline
│       └── lastSeen
│
└── calls/
    └── {callId}
        ├── callerId
        ├── callerName
        ├── callerPhoto
        ├── receiverId (null for group calls)
        ├── participants[] (array of user IDs)
        ├── type ('video' | 'voice')
        ├── status ('ringing' | 'active' | 'ended')
        ├── isGroupCall
        ├── createdAt
        ├── startedAt
        └── endedAt
        │
        ├── offers/
        │   └── {userId} (receiver's userId)
        │       ├── offer
        │       ├── fromUserId
        │       ├── toUserId
        │       └── timestamp
        │
        ├── answers/
        │   └── {userId} (answerer's userId)
        │       ├── answer
        │       ├── fromUserId
        │       ├── toUserId
        │       └── timestamp
        │
        └── candidates/
            └── {candidateId} (auto-generated)
                ├── candidate
                ├── fromUserId
                ├── toUserId
                └── timestamp
```

## Best Practices Implemented

### 1. Peer Connection Management

```typescript
// Always check if connection exists before creating new one
if (this.peerConnections.has(remoteUserId)) {
  const existing = this.peerConnections.get(remoteUserId);
  if (existing && existing.connection.connectionState !== 'closed') {
    return existing.connection; // Reuse existing
  }
  this.closePeerConnection(remoteUserId); // Clean up old
}
```

### 2. Track Management

```typescript
// Check before adding tracks
const senders = peerConnection.getSenders();
const trackAlreadyAdded = senders.some(sender => sender.track === track);

if (!trackAlreadyAdded) {
  peerConnection.addTrack(track, this.localStream);
}
```

### 3. State Verification

```typescript
// Always check state before operations
if (peerConnection.signalingState === 'have-local-offer') {
  await peerConnection.setRemoteDescription(answer);
}
```

### 4. Error Handling

```typescript
try {
  await operation();
} catch (error) {
  console.error('Detailed error:', error);
  // Graceful degradation instead of crash
}
```

### 5. Cleanup

```typescript
// Always cleanup on unmount or call end
cleanup(): void {
  // Stop all tracks
  if (this.localStream) {
    this.localStream.getTracks().forEach(track => track.stop());
  }
  
  // Close all connections
  this.peerConnections.forEach((pc) => pc.connection.close());
  
  // Clear listeners
  this.unsubscribes.forEach(unsub => unsub());
}
```

## Group Call Architecture

For group calls, we use a **mesh topology**:

```
User A ←→ User B
  ↕         ↕
User C ←→ User D
```

Each user maintains direct peer connections with all other users.

**Limitations**:
- Maximum 5 participants (to avoid bandwidth issues)
- Each user sends their stream to all others
- Each user receives streams from all others

**Signaling for Group Calls**:
1. Caller creates offers for all receivers
2. Each receiver creates answer for caller
3. Receivers create offers for other receivers (peer-to-peer)
4. ICE candidates exchanged between all pairs

## Performance Considerations

### 1. Stream Management
- Reuse local stream across all peer connections
- Don't create new stream for each connection

### 2. Connection Lifecycle
- Check connection state before operations
- Close connections when no longer needed
- Handle reconnection attempts

### 3. Firestore Optimization
- Use real-time listeners efficiently
- Clean up listeners when component unmounts
- Delete old call documents to save storage

## Testing Checklist

- [ ] One-to-one video call
- [ ] One-to-one voice call
- [ ] Group video call (3-5 people)
- [ ] Group voice call (3-5 people)
- [ ] Mute/unmute audio
- [ ] Toggle video on/off
- [ ] Call rejection
- [ ] Call ending
- [ ] Multiple consecutive calls
- [ ] Connection recovery after network issue
- [ ] Browser compatibility (Chrome, Firefox, Safari)

## Common Debugging Steps

1. **Check Browser Console**: Look for WebRTC errors
2. **Check Firestore**: Verify documents are being created
3. **Check Network Tab**: Look for failed requests
4. **Check chrome://webrtc-internals**: Detailed WebRTC stats
5. **Test Locally First**: Use localhost before deploying

## Security Considerations

1. **Firestore Rules**: Ensure only authorized users can access calls
2. **HTTPS**: Required for WebRTC in production
3. **Rate Limiting**: Consider adding to prevent abuse
4. **User Permissions**: Always check camera/mic permissions

## Future Improvements

1. **TURN Server**: Add for better connectivity behind firewalls
2. **Selective Forwarding Unit (SFU)**: For larger group calls
3. **Recording**: Add call recording capability
4. **Screen Sharing**: Implement screen share feature
5. **Chat**: Add text chat during calls
6. **Quality Adaptation**: Adjust quality based on bandwidth

## Conclusion

This implementation solves the previous errors by:
1. Properly managing peer connection lifecycle
2. Checking states before operations
3. Preventing duplicate track additions
4. Handling errors gracefully
5. Proper cleanup on exit

The architecture is scalable, maintainable, and follows WebRTC best practices.
