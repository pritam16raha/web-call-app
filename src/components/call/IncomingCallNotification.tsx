'use client';

import React, { useEffect, useState } from 'react';
import { useCall } from '@/contexts/CallContext';
import { Phone, PhoneOff, Video } from 'lucide-react';

export default function IncomingCallNotification() {
  const { incomingCall, answerCall, declineCall } = useCall();
  const [isRinging, setIsRinging] = useState(false);

  useEffect(() => {
    if (incomingCall) {
      setIsRinging(true);
      
      // Play ringtone (you can add actual audio here)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440;
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      
      const interval = setInterval(() => {
        oscillator.frequency.value = oscillator.frequency.value === 440 ? 554 : 440;
      }, 1000);

      return () => {
        clearInterval(interval);
        oscillator.stop();
        audioContext.close();
      };
    } else {
      setIsRinging(false);
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  const handleAnswer = async () => {
    try {
      await answerCall(incomingCall.id);
    } catch (error) {
      console.error('Error answering call:', error);
      alert('Failed to answer call. Please try again.');
    }
  };

  const handleDecline = async () => {
    try {
      await declineCall();
    } catch (error) {
      console.error('Error declining call:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header with animation */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 text-center">
          <div className={`w-24 h-24 mx-auto mb-4 rounded-full border-4 border-white overflow-hidden ${
            isRinging ? 'animate-pulse' : ''
          }`}>
            {incomingCall.callerPhoto ? (
              <img
                src={incomingCall.callerPhoto}
                alt={incomingCall.callerName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                <span className="text-3xl text-gray-600">
                  {incomingCall.callerName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">
            {incomingCall.callerName}
          </h2>
          
          <div className="flex items-center justify-center gap-2 text-white">
            {incomingCall.type === 'video' ? (
              <>
                <Video className="w-5 h-5" />
                <span>Incoming Video Call</span>
              </>
            ) : (
              <>
                <Phone className="w-5 h-5" />
                <span>Incoming Voice Call</span>
              </>
            )}
          </div>
          
          {incomingCall.isGroupCall && (
            <div className="mt-2 text-white text-sm">
              Group Call • {incomingCall.participants.length} participants
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 flex gap-4">
          <button
            onClick={handleDecline}
            className="flex-1 flex flex-col items-center gap-2 p-4 bg-red-500 hover:bg-red-600 rounded-xl transition-colors group"
          >
            <div className="w-14 h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <PhoneOff className="w-7 h-7 text-white" />
            </div>
            <span className="text-white font-medium">Decline</span>
          </button>
          
          <button
            onClick={handleAnswer}
            className="flex-1 flex flex-col items-center gap-2 p-4 bg-green-500 hover:bg-green-600 rounded-xl transition-colors group"
          >
            <div className="w-14 h-14 bg-white bg-opacity-20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Phone className="w-7 h-7 text-white" />
            </div>
            <span className="text-white font-medium">Answer</span>
          </button>
        </div>
      </div>
    </div>
  );
}
