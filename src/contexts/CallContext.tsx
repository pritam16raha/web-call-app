'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { WebRTCService } from '@/lib/webrtc';
import { useAuth } from './AuthContext';
import { Call, User, CallState } from '@/types';

interface CallContextType extends CallState {
  startCall: (receiverIds: string[], type: 'voice' | 'video') => Promise<void>;
  answerCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  incomingCall: Call | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};

const MAX_PARTICIPANTS = 5;

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [webRTCService, setWebRTCService] = useState<WebRTCService | null>(null);
  const [callState, setCallState] = useState<CallState>({
    callId: null,
    isInCall: false,
    isCalling: false,
    isReceivingCall: false,
    callType: null,
    localStream: null,
    remoteStreams: new Map(),
    participants: [],
    isMuted: false,
    isVideoOff: false,
  });
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  // Initialize WebRTC service
  useEffect(() => {
    if (user) {
      const service = new WebRTCService(user.uid);
      setWebRTCService(service);

      return () => {
        service.cleanup();
      };
    }
  }, [user]);

  // Listen for incoming calls
  useEffect(() => {
    if (!user) return;

    const callsRef = collection(db, 'calls');
    const q = query(
      callsRef,
      where('participants', 'array-contains', user.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const callData = { id: change.doc.id, ...change.doc.data() } as Call;
          
          // Check if call is stale (older than 60 seconds) - cleanup on page load
          const createdAt = callData.createdAt?.toDate?.() || new Date(0);
          const now = new Date();
          const ageInSeconds = (now.getTime() - createdAt.getTime()) / 1000;
          
          if (ageInSeconds > 60) {
            // Mark stale call as missed
            try {
              await updateDoc(doc(db, 'calls', change.doc.id), {
                status: 'missed',
                endedAt: Timestamp.now(),
              });
            } catch (err) {
              console.error('Error cleaning up stale call:', err);
            }
            return;
          }
          
          // Don't show incoming call if user is the caller or already in a call
          if (callData.callerId !== user.uid && !callState.isInCall) {
            setIncomingCall(callData);
            setCallState(prev => ({ ...prev, isReceivingCall: true }));
          }
        } else if (change.type === 'modified') {
          const callData = change.doc.data() as Call;
          
          // If call ended or missed, clear incoming call
          if (callData.status === 'ended' || callData.status === 'missed') {
            setIncomingCall(null);
            setCallState(prev => ({ ...prev, isReceivingCall: false }));
          }
        } else if (change.type === 'removed') {
          // Call document was deleted, clear incoming call
          if (incomingCall?.id === change.doc.id) {
            setIncomingCall(null);
            setCallState(prev => ({ ...prev, isReceivingCall: false }));
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user, callState.isInCall, incomingCall?.id]);

  // Start a call
  const startCall = useCallback(
    async (receiverIds: string[], type: 'voice' | 'video') => {
      if (!user || !webRTCService) return;

      // Validate participants count
      if (receiverIds.length + 1 > MAX_PARTICIPANTS) {
        alert(`Maximum ${MAX_PARTICIPANTS} participants allowed in a group call`);
        return;
      }

      try {
        setCallState(prev => ({ ...prev, isCalling: true, callType: type }));

        // Initialize local stream
        const localStream = await webRTCService.initializeLocalStream(type === 'voice');
        
        // Create call document
        const callRef = doc(collection(db, 'calls'));
        const callId = callRef.id;
        
        const participants = [user.uid, ...receiverIds];
        const isGroupCall = receiverIds.length > 1;

        await setDoc(callRef, {
          callerId: user.uid,
          callerName: user.displayName,
          callerPhoto: user.photoURL,
          receiverId: isGroupCall ? null : receiverIds[0],
          participants,
          type,
          status: 'ringing',
          isGroupCall,
          createdAt: Timestamp.now(),
        });

        webRTCService.setCallId(callId);

        // Create offers for each receiver
        for (const receiverId of receiverIds) {
          const offer = await webRTCService.createOffer(receiverId);
          
          await setDoc(doc(db, 'calls', callId, 'offers', receiverId), {
            offer,
            fromUserId: user.uid,
            toUserId: receiverId,
            timestamp: Timestamp.now(),
          });

          // Listen for ICE candidates
          webRTCService.listenForCandidates(callId, receiverId);

          // Setup remote stream listener
          webRTCService.setupRemoteStreamListener(receiverId, (stream) => {
            setCallState(prev => {
              const newRemoteStreams = new Map(prev.remoteStreams);
              newRemoteStreams.set(receiverId, stream);
              return { ...prev, remoteStreams: newRemoteStreams };
            });
          });
        }

        // Fetch participant details
        const participantDetails = await Promise.all(
          receiverIds.map(async (id) => {
            const userDoc = await getDoc(doc(db, 'users', id));
            return userDoc.data() as User;
          })
        );

        setCallState(prev => ({
          ...prev,
          callId,
          isInCall: true,
          isCalling: false,
          localStream,
          participants: participantDetails,
        }));

        // Listen for answers
        const answersRef = collection(db, 'calls', callId, 'answers');
        onSnapshot(answersRef, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              webRTCService.handleAnswer(data.fromUserId, data.answer);
            }
          });
        });

        // Update call status to active after 2 seconds (simulating ring time)
        setTimeout(async () => {
          await updateDoc(callRef, {
            status: 'active',
            startedAt: Timestamp.now(),
          });
        }, 2000);

      } catch (error) {
        console.error('Error starting call:', error);
        setCallState(prev => ({ ...prev, isCalling: false }));
        throw error;
      }
    },
    [user, webRTCService]
  );

  // Answer a call
  const answerCall = useCallback(
    async (callId: string) => {
      if (!user || !webRTCService || !incomingCall) return;

      try {
        // Initialize local stream
        const localStream = await webRTCService.initializeLocalStream(
          incomingCall.type === 'voice'
        );

        webRTCService.setCallId(callId);

        // Get all offers for this user
        const offersRef = collection(db, 'calls', callId, 'offers');
        const offerDoc = await getDoc(doc(offersRef, user.uid));

        if (offerDoc.exists()) {
          const offerData = offerDoc.data();
          const callerId = offerData.fromUserId;

          // Create answer
          const answer = await webRTCService.createAnswer(callerId, offerData.offer);

          await setDoc(doc(db, 'calls', callId, 'answers', user.uid), {
            answer,
            fromUserId: user.uid,
            toUserId: callerId,
            timestamp: Timestamp.now(),
          });

          // Listen for ICE candidates
          webRTCService.listenForCandidates(callId, callerId);

          // Setup remote stream listener
          webRTCService.setupRemoteStreamListener(callerId, (stream) => {
            setCallState(prev => {
              const newRemoteStreams = new Map(prev.remoteStreams);
              newRemoteStreams.set(callerId, stream);
              return { ...prev, remoteStreams: newRemoteStreams };
            });
          });
        }

        // Update call status
        await updateDoc(doc(db, 'calls', callId), {
          status: 'active',
          startedAt: Timestamp.now(),
        });

        // Fetch all participants
        const participantDetails = await Promise.all(
          incomingCall.participants
            .filter(id => id !== user.uid)
            .map(async (id) => {
              const userDoc = await getDoc(doc(db, 'users', id));
              return userDoc.data() as User;
            })
        );

        setCallState(prev => ({
          ...prev,
          callId,
          isInCall: true,
          isReceivingCall: false,
          callType: incomingCall.type,
          localStream,
          participants: participantDetails,
        }));

        setIncomingCall(null);
      } catch (error) {
        console.error('Error answering call:', error);
        throw error;
      }
    },
    [user, webRTCService, incomingCall]
  );

  // Decline incoming call
  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      // Update call status to missed/declined
      await updateDoc(doc(db, 'calls', incomingCall.id), {
        status: 'missed',
        endedAt: Timestamp.now(),
      });

      // Clear incoming call state
      setIncomingCall(null);
      setCallState(prev => ({ ...prev, isReceivingCall: false }));
    } catch (error) {
      console.error('Error declining call:', error);
    }
  }, [incomingCall]);

  // End call
  const endCall = useCallback(async () => {
    if (!callState.callId || !webRTCService) return;

    try {
      // Update call status
      await updateDoc(doc(db, 'calls', callState.callId), {
        status: 'ended',
        endedAt: Timestamp.now(),
      });

      // Cleanup WebRTC
      webRTCService.cleanup();

      // Reset state
      setCallState({
        callId: null,
        isInCall: false,
        isCalling: false,
        isReceivingCall: false,
        callType: null,
        localStream: null,
        remoteStreams: new Map(),
        participants: [],
        isMuted: false,
        isVideoOff: false,
      });

      setIncomingCall(null);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }, [callState.callId, webRTCService]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (webRTCService) {
      const newMutedState = !callState.isMuted;
      webRTCService.toggleAudio(!newMutedState);
      setCallState(prev => ({ ...prev, isMuted: newMutedState }));
    }
  }, [webRTCService, callState.isMuted]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (webRTCService) {
      const newVideoState = !callState.isVideoOff;
      webRTCService.toggleVideo(!newVideoState);
      setCallState(prev => ({ ...prev, isVideoOff: newVideoState }));
    }
  }, [webRTCService, callState.isVideoOff]);

  return (
    <CallContext.Provider
      value={{
        ...callState,
        incomingCall,
        startCall,
        answerCall,
        endCall,
        declineCall,
        toggleMute,
        toggleVideo,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};