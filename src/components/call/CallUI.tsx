'use client';

import React, { useEffect, useRef } from 'react';
import { useCall } from '@/contexts/CallContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from 'lucide-react';

export default function CallUI() {
  const {
    isInCall,
    isCalling,
    callType,
    localStream,
    remoteStreams,
    participants,
    isMuted,
    isVideoOff,
    endCall,
    toggleMute,
    toggleVideo,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Setup local video
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  if (!isInCall && !isCalling) return null;

  const isGroupCall = participants.length > 1;

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-white">
              {isGroupCall ? (
                <>
                  <Users className="w-5 h-5" />
                  <span className="text-lg font-semibold">
                    Group Call ({participants.length + 1} participants)
                  </span>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-700">
                    {participants[0] && (
                      <img
                        src={participants[0].photoURL}
                        alt={participants[0].displayName}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {participants[0]?.displayName || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-400">
                      {isCalling ? 'Calling...' : 'Connected'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              callType === 'video' 
                ? 'bg-blue-500 text-white' 
                : 'bg-green-500 text-white'
            }`}>
              {callType === 'video' ? 'Video Call' : 'Voice Call'}
            </span>
          </div>
        </div>
      </div>

      {/* Hidden audio elements for ALL remote streams - ensures audio always plays */}
      {/* For video calls, video element may have audio blocked by autoplay policy */}
      {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
        <audio
          key={`audio-${userId}`}
          ref={(el) => {
            if (el && el.srcObject !== stream) {
              el.srcObject = stream;
              el.volume = 1;
              el.muted = false;
              el.play().catch(err => console.log('Audio autoplay blocked:', err));
            }
          }}
          autoPlay
          playsInline
        />
      ))}

      {/* Video Grid */}
      <div className="flex-1 relative overflow-hidden">
        {callType === 'video' ? (
          <div className={`h-full grid ${
            remoteStreams.size === 0 ? 'grid-cols-1' :
            remoteStreams.size === 1 ? 'grid-cols-1 md:grid-cols-2' :
            remoteStreams.size === 2 ? 'grid-cols-2' :
            remoteStreams.size === 3 ? 'grid-cols-2 md:grid-cols-3' :
            'grid-cols-2 md:grid-cols-2'
          } gap-2 p-4`}>
            {/* Remote videos - audio is handled by hidden audio elements above */}
            {Array.from(remoteStreams.entries()).map(([userId, stream]) => {
              const participant = participants.find(p => p.uid === userId);
              return (
                <div key={userId} className="relative bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={(el) => {
                      if (el && el.srcObject !== stream) {
                        el.srcObject = stream;
                        el.play().catch(err => console.log('Video autoplay blocked:', err));
                      }
                    }}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {participant && (
                    <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-1 rounded-full text-white text-sm font-medium">
                      {participant.displayName}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Local video */}
            {!isVideoOff && (
              <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover mirror"
                />
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 px-3 py-1 rounded-full text-white text-sm font-medium">
                  You
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Voice call - show avatars */
          <div className="h-full flex items-center justify-center">
            <div className={`grid ${
              participants.length === 1 ? 'grid-cols-2' :
              participants.length === 2 ? 'grid-cols-3' :
              participants.length === 3 ? 'grid-cols-4' :
              'grid-cols-2 md:grid-cols-3'
            } gap-8`}>
              {participants.map((participant) => (
                <div key={participant.uid} className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <img
                      src={participant.photoURL}
                      alt={participant.displayName}
                      className="w-32 h-32 rounded-full border-4 border-green-500 shadow-xl"
                    />
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-green-500 px-3 py-1 rounded-full">
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <p className="text-white text-lg font-semibold">{participant.displayName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Local video preview for video calls (small corner) */}
        {callType === 'video' && !isVideoOff && remoteStreams.size > 0 && (
          <div className="absolute bottom-24 right-6 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-xl border-2 border-gray-700">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover mirror"
            />
            <div className="absolute top-2 left-2 bg-black bg-opacity-60 px-2 py-1 rounded text-white text-xs font-medium">
              You
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 px-6 py-6">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-colors ${
              isMuted
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-colors ${
                isVideoOff
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title={isVideoOff ? 'Turn on video' : 'Turn off video'}
            >
              {isVideoOff ? (
                <VideoOff className="w-6 h-6 text-white" />
              ) : (
                <Video className="w-6 h-6 text-white" />
              )}
            </button>
          )}

          <button
            onClick={endCall}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
            title="End call"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      <style jsx>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
