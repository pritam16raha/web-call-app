import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  updateDoc,
  deleteDoc,
  Timestamp,
  addDoc,
} from 'firebase/firestore';
import { PeerConnection } from '@/types';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCService {
  private peerConnections: Map<string, PeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private callId: string | null = null;
  private userId: string;
  private unsubscribes: (() => void)[] = [];

  constructor(userId: string) {
    this.userId = userId;
  }

  async initializeLocalStream(audioOnly: boolean = false): Promise<MediaStream> {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'Your browser does not support camera/microphone access. Please use a modern browser like Chrome, Firefox, or Safari.'
        );
      }

      // Check if running on HTTPS (required for WebRTC except on localhost)
      if (
        window.location.protocol !== 'https:' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        throw new Error(
          'Camera and microphone access requires HTTPS. Please use https:// or test on localhost.'
        );
      }

      // Stop existing stream if any
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: audioOnly ? false : {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error: any) {
      console.error('Error accessing media devices:', error);
      
      // Provide user-friendly error messages
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error(
          'Camera/microphone access was denied. Please allow access in your browser settings and try again.'
        );
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error(
          'No camera or microphone found. Please connect a camera/microphone and try again.'
        );
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        throw new Error(
          'Camera or microphone is already in use by another application. Please close other apps and try again.'
        );
      } else if (error.name === 'OverconstrainedError') {
        throw new Error(
          'Camera/microphone settings are not supported by your device. Trying with basic settings...'
        );
      } else if (error.name === 'SecurityError') {
        throw new Error(
          'Security error: WebRTC requires HTTPS. Please access the app using https:// or localhost.'
        );
      } else if (error.message) {
        throw error; // Re-throw with existing message
      } else {
        throw new Error(
          'Failed to access camera/microphone. Please check your browser permissions and try again.'
        );
      }
    }
  }

  createPeerConnection(remoteUserId: string): RTCPeerConnection {
    // Check if connection already exists
    if (this.peerConnections.has(remoteUserId)) {
      const existing = this.peerConnections.get(remoteUserId);
      if (existing && existing.connection.connectionState !== 'closed') {
        console.log('Using existing peer connection for', remoteUserId);
        return existing.connection;
      }
      // Clean up old connection
      this.closePeerConnection(remoteUserId);
    }

    const peerConnection = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.localStream) {
          try {
            // Check if track is already added
            const senders = peerConnection.getSenders();
            const trackAlreadyAdded = senders.some(sender => sender.track === track);
            
            if (!trackAlreadyAdded) {
              peerConnection.addTrack(track, this.localStream);
              console.log(`Added ${track.kind} track to peer connection`);
            }
          } catch (error) {
            console.error('Error adding track:', error);
          }
        }
      });
    }

    // Handle ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (event.candidate && this.callId) {
        try {
          await addDoc(collection(db, 'calls', this.callId, 'candidates'), {
            candidate: event.candidate.toJSON(),
            fromUserId: this.userId,
            toUserId: remoteUserId,
            timestamp: Timestamp.now(),
          });
        } catch (error) {
          console.error('Error sending ICE candidate:', error);
        }
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state for ${remoteUserId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'disconnected' || 
          peerConnection.connectionState === 'failed') {
        this.closePeerConnection(remoteUserId);
      }
    };

    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${remoteUserId}:`, peerConnection.iceConnectionState);
    };

    // Store peer connection
    this.peerConnections.set(remoteUserId, {
      userId: remoteUserId,
      connection: peerConnection,
    });

    return peerConnection;
  }

  async createOffer(remoteUserId: string): Promise<RTCSessionDescriptionInit> {
    const peerConnection = this.createPeerConnection(remoteUserId);

    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  async createAnswer(remoteUserId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const peerConnection = this.createPeerConnection(remoteUserId);

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      return answer;
    } catch (error) {
      console.error('Error creating answer:', error);
      throw error;
    }
  }

  async handleAnswer(remoteUserId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peerConnectionData = this.peerConnections.get(remoteUserId);
    
    if (!peerConnectionData) {
      console.error('No peer connection found for', remoteUserId);
      return;
    }

    const peerConnection = peerConnectionData.connection;

    try {
      // Only set remote description if we're in the right state
      if (peerConnection.signalingState === 'have-local-offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      } else {
        console.warn(`Cannot set remote description in state: ${peerConnection.signalingState}`);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleIceCandidate(remoteUserId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnectionData = this.peerConnections.get(remoteUserId);
    
    if (!peerConnectionData) {
      console.error('No peer connection found for', remoteUserId);
      return;
    }

    const peerConnection = peerConnectionData.connection;

    try {
      if (peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  setupRemoteStreamListener(remoteUserId: string, onRemoteStream: (stream: MediaStream) => void): void {
    const peerConnectionData = this.peerConnections.get(remoteUserId);
    
    if (!peerConnectionData) {
      console.error('No peer connection found for', remoteUserId);
      return;
    }

    const peerConnection = peerConnectionData.connection;

    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      
      if (event.streams && event.streams[0]) {
        peerConnectionData.stream = event.streams[0];
        onRemoteStream(event.streams[0]);
      }
    };
  }

  listenForCandidates(callId: string, remoteUserId: string): void {
    const candidatesRef = collection(db, 'calls', callId, 'candidates');
    const q = query(
      candidatesRef,
      where('toUserId', '==', this.userId),
      where('fromUserId', '==', remoteUserId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          this.handleIceCandidate(remoteUserId, data.candidate);
        }
      });
    });

    this.unsubscribes.push(unsubscribe);
  }

  setCallId(callId: string): void {
    this.callId = callId;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getPeerConnection(userId: string): PeerConnection | undefined {
    return this.peerConnections.get(userId);
  }

  getAllPeerConnections(): PeerConnection[] {
    return Array.from(this.peerConnections.values());
  }

  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  closePeerConnection(userId: string): void {
    const peerConnectionData = this.peerConnections.get(userId);
    
    if (peerConnectionData) {
      peerConnectionData.connection.close();
      this.peerConnections.delete(userId);
      console.log('Closed peer connection for', userId);
    }
  }

  cleanup(): void {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close all peer connections
    this.peerConnections.forEach((peerConnection, userId) => {
      peerConnection.connection.close();
    });
    this.peerConnections.clear();

    // Unsubscribe from listeners
    this.unsubscribes.forEach(unsubscribe => unsubscribe());
    this.unsubscribes = [];

    this.callId = null;
  }
}