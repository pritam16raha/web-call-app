'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useCall } from '@/contexts/CallContext';
import { User } from '@/types';
import { Video, Phone, LogOut, Users } from 'lucide-react';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { startCall } = useCall();
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showGroupCallModal, setShowGroupCallModal] = useState(false);

  useEffect(() => {
    if (!user) return;

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('isOnline', '==', true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: User[] = [];
      snapshot.forEach((doc) => {
        const userData = doc.data() as User;
        if (userData.uid !== user.uid) {
          users.push(userData);
        }
      });
      setOnlineUsers(users);
    });

    return () => unsubscribe();
  }, [user]);

  const handleOneToOneCall = (receiverId: string, type: 'voice' | 'video') => {
    startCall([receiverId], type);
  };

  const handleGroupCall = (type: 'voice' | 'video') => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one user');
      return;
    }
    if (selectedUsers.length > 4) {
      alert('Maximum 4 users can be selected for a group call');
      return;
    }
    startCall(selectedUsers, type);
    setShowGroupCallModal(false);
    setSelectedUsers([]);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg">
                <Video className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">WebCall</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowGroupCallModal(true)}
                className="flex items-center gap-2 bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
              >
                <Users className="w-5 h-5" />
                Group Call
              </button>
              
              <div className="flex items-center gap-3">
                <img
                  src={user.photoURL || '/default-avatar.png'}
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full"
                />
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-800">{user.displayName}</p>
                  <p className="text-xs text-green-600">● Online</p>
                </div>
              </div>
              
              <button
                onClick={signOut}
                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Online Users ({onlineUsers.length})
          </h2>
          <p className="text-gray-600">Click on a user to start a call</p>
        </div>

        {onlineUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No users online</p>
            <p className="text-gray-400 text-sm mt-2">Users will appear here when they come online</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {onlineUsers.map((onlineUser) => (
              <div
                key={onlineUser.uid}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <img
                      src={onlineUser.photoURL || '/default-avatar.png'}
                      alt={onlineUser.displayName}
                      className="w-16 h-16 rounded-full"
                    />
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-800 truncate">
                      {onlineUser.displayName}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{onlineUser.email}</p>
                    
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => handleOneToOneCall(onlineUser.uid, 'video')}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                      >
                        <Video className="w-4 h-4" />
                        Video
                      </button>
                      <button
                        onClick={() => handleOneToOneCall(onlineUser.uid, 'voice')}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                      >
                        <Phone className="w-4 h-4" />
                        Voice
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Group Call Modal */}
      {showGroupCallModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800">Start Group Call</h2>
                <button
                  onClick={() => {
                    setShowGroupCallModal(false);
                    setSelectedUsers([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-600 mt-2">
                Select up to 4 users (Selected: {selectedUsers.length}/4)
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {onlineUsers.map((onlineUser) => (
                <div
                  key={onlineUser.uid}
                  onClick={() => toggleUserSelection(onlineUser.uid)}
                  className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer mb-2 transition-colors ${
                    selectedUsers.includes(onlineUser.uid)
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(onlineUser.uid)}
                    onChange={() => {}}
                    className="w-5 h-5"
                  />
                  <img
                    src={onlineUser.photoURL || '/default-avatar.png'}
                    alt={onlineUser.displayName}
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{onlineUser.displayName}</h3>
                    <p className="text-sm text-gray-500">{onlineUser.email}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => handleGroupCall('video')}
                disabled={selectedUsers.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Video className="w-5 h-5" />
                Start Video Call
              </button>
              <button
                onClick={() => handleGroupCall('voice')}
                disabled={selectedUsers.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <Phone className="w-5 h-5" />
                Start Voice Call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
