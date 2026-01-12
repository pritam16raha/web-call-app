'use client';

import { useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/components/auth/LoginPage';
import Dashboard from '@/components/dashboard/Dashboard';
import CallUI from '@/components/call/CallUI';
import IncomingCallNotification from '@/components/call/IncomingCallNotification';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <>
      <Dashboard />
      <CallUI />
      <IncomingCallNotification />
    </>
  );
}
