'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, updateDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        // Create or update user document
        const userRef = doc(db, 'users', firebaseUser.uid);
        await setDoc(
          userRef,
          {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || 'Anonymous',
            photoURL: firebaseUser.photoURL || '',
            isOnline: true,
            lastSeen: Timestamp.now(),
          },
          { merge: true }
        );

        // Listen to user document for real-time updates
        const unsubscribeUser = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            setUser(doc.data() as User);
          }
        });

        // Update online status when user leaves
        const updateOfflineStatus = async () => {
          await updateDoc(userRef, {
            isOnline: false,
            lastSeen: Timestamp.now(),
          });
        };

        window.addEventListener('beforeunload', updateOfflineStatus);

        setLoading(false);

        return () => {
          unsubscribeUser();
          window.removeEventListener('beforeunload', updateOfflineStatus);
        };
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: Timestamp.now(),
        });
      }
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
