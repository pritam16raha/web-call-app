import { User as FirebaseUser } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  isOnline: boolean;
  lastSeen: Timestamp;
}

export interface Call {
  id: string;
  callerId: string;
  callerName: string;
  callerPhoto: string;
  receiverId?: string; // For one-to-one calls
  participants: string[]; // Array of user IDs
  type: 'voice' | 'video';
  status: 'ringing' | 'active' | 'ended' | 'missed';
  isGroupCall: boolean;
  createdAt: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
}

export interface CallSignal {
  id: string;
  callId: string;
  fromUserId: string;
  toUserId: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  timestamp: Timestamp;
}

export interface PeerConnection {
  userId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

export interface CallState {
  callId: string | null;
  isInCall: boolean;
  isCalling: boolean;
  isReceivingCall: boolean;
  callType: 'voice' | 'video' | null;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: User[];
  isMuted: boolean;
  isVideoOff: boolean;
}
