import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import ChitsPlaceholder from './pages/ChitsPlaceholder';
import PaymentsPlaceholder from './pages/PaymentsPlaceholder';
import WhatsAppPlaceholder from './pages/WhatsAppPlaceholder';
import History from './pages/History';
import SettingsPlaceholder from './pages/SettingsPlaceholder';

import AdminLayout from './layouts/AdminLayout';
import Logo from './components/Logo';
import ErrorBoundary from './components/ErrorBoundary';

function AuthTransition() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/95">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(14,165,233,0.18),_transparent_30%),radial-gradient(circle_at_center,_rgba(59,130,246,0.12),_transparent_48%)]" />

      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6">
        <div className="mb-6 animate-scale-in">
          <Logo size="xl" showText={false} className="drop-shadow-[0_12px_35px_rgba(59,130,246,0.35)]" />
        </div>

        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Raghavendra Chitts
        </h1>

        <p className="mt-3 text-sm text-slate-200/90 sm:text-base animate-fade-in-up">
          Simple. Secure. Smarter Chitt Management.
        </p>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authTransitioning, setAuthTransitioning] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        console.error('Firebase Auth State Error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setAuthTransitioning(false);
      return;
    }

    setAuthTransitioning(true);
    const timer = window.setTimeout(() => {
      setAuthTransitioning(false);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [user]);

  const handleLogin = () => {
    // Auth state is handled automatically by onAuthStateChanged.
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-sky-200/20 border-t-sky-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-semibold text-slate-200">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  const isAuthenticated = !!user;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>

          <Route
            path="/login"
            element={
              isAuthenticated ? (
                authTransitioning ? (
                  <AuthTransition />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />

          <Route
            path="/dashboard"
            element={
              isAuthenticated ? (
                <AdminLayout onLogout={handleLogout}>
                  <Dashboard />
                </AdminLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/members"
            element={
              isAuthenticated ? (
                <AdminLayout onLogout={handleLogout}>
                  <Members />
                </AdminLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/chits"
            element={
              isAuthenticated ? (
                <AdminLayout onLogout={handleLogout}>
                  <ChitsPlaceholder />
                </AdminLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/payments"
            element={
              isAuthenticated ? (
                <AdminLayout onLogout={handleLogout}>
                  <PaymentsPlaceholder />
                </AdminLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/whatsapp"
            element={
              isAuthenticated ? (
                <AdminLayout onLogout={handleLogout}>
                  <WhatsAppPlaceholder />
                </AdminLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/history"
            element={
              isAuthenticated ? (
                <AdminLayout onLogout={handleLogout}>
                  <History />
                </AdminLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/settings"
            element={
              isAuthenticated ? (
                <AdminLayout onLogout={handleLogout}>
                  <SettingsPlaceholder />
                </AdminLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="*"
            element={
              <Navigate
                to={isAuthenticated ? '/dashboard' : '/login'}
                replace
              />
            }
          />

        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;