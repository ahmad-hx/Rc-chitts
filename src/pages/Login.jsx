import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

import Logo from '../components/Logo';
import Button from '../components/Button';

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';

import { auth } from '../firebase';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Password reset states
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError('');
    setResetSuccess('');
    setLoading(true);

    const email = username.trim();

    if (!email || !password) {
      setError('Please enter your email and password.');
      setLoading(false);
      return;
    }

    try {
      const persistence = rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;

      await setPersistence(auth, persistence);
      await signInWithEmailAndPassword(auth, email, password);

      setLoginSuccess(true);
      onLogin?.();
    } catch (error) {
      console.error('Firebase login error:', error);

      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          setError('Invalid email or password.');
          break;

        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;

        case 'auth/user-disabled':
          setError('This admin account has been disabled.');
          break;

        case 'auth/too-many-requests':
          setError('Too many failed attempts. Please try again later.');
          break;

        case 'auth/network-request-failed':
          setError('Network error. Please check your internet connection.');
          break;

        case 'auth/operation-not-allowed':
          setError('Email/password authentication is not enabled in Firebase.');
          break;

        default:
          setError(`Unable to sign in. Firebase error: ${error.code || 'unknown'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (loading || resetLoading) return;

    setError('');
    setResetSuccess('');

    const email = username.trim();

    if (!email) {
      setError('Enter your admin email first, then click Forgot Password.');
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetSuccess(
        'Password reset link sent. Please check your email inbox and spam folder.'
      );
    } catch (err) {
      console.error('Firebase password reset error:', err);

      switch (err.code) {
        case 'auth/user-not-found':
          setError('No admin account found with this email address.');
          break;

        case 'auth/invalid-email':
          setError('Please enter a valid email address.');
          break;

        case 'auth/too-many-requests':
          setError('Too many requests. Please try again later.');
          break;

        case 'auth/network-request-failed':
          setError('Network error. Please check your internet connection.');
          break;

        default:
          setError(
            'Unable to send password reset email. Please check the email address.'
          );
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F7] relative overflow-hidden px-4 py-8 sm:px-6 flex items-center justify-center font-sans">
      <div className="relative z-10 mx-auto w-full max-w-md">
        <div
          className={`w-full transition-all duration-700 ease-out ${
            loginSuccess ? 'pointer-events-none scale-[0.97] opacity-0' : 'opacity-100 scale-100'
          }`}
        >
          <div className="mb-6 text-center">
            <div className="mb-3 flex justify-center">
              <Logo size="lg" showText={false} />
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#667085]">
              <ShieldCheck className="h-4 w-4 text-[#285F52]" />
              Private Admin Portal
            </div>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-black tracking-tight text-[#111111]">Raghavendra Chitts</h1>
              <p className="text-xs text-[#667085] mt-1">Enterprise Admin Authentication</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF3F2] p-3 text-xs font-bold text-[#B42318]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B42318]" />
                  <span>{error}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="flex items-start gap-2 rounded-xl border border-[#BFD8D0] bg-[#EEF6F3] p-3 text-xs font-bold text-[#285F52]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#285F52]" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="username" className="block text-[10px] font-extrabold uppercase tracking-wider text-[#667085]">
                  Admin Email
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#98A2B3]">
                    <User className="h-4 w-4" />
                  </span>

                  <input
                    id="username"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Enter admin email"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setError('');
                      setResetSuccess('');
                    }}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] py-2.5 pl-10 pr-4 text-xs font-bold text-[#111111] placeholder:text-[#98A2B3] outline-none transition-all focus:border-[#285F52] focus:bg-white focus:ring-1 focus:ring-[#285F52]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-[10px] font-extrabold uppercase tracking-wider text-[#667085]">
                  Password
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#98A2B3]">
                    <Lock className="h-4 w-4" />
                  </span>

                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                      setResetSuccess('');
                    }}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] py-2.5 pl-10 pr-11 text-xs font-bold text-[#111111] placeholder:text-[#98A2B3] outline-none transition-all focus:border-[#285F52] focus:bg-white focus:ring-1 focus:ring-[#285F52]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#98A2B3] hover:text-[#111111] focus:outline-none cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <label htmlFor="remember-me" className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#111111]">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-[#E5E7EB] text-[#285F52] focus:ring-[#285F52] cursor-pointer"
                  />
                  Remember me
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading || loading}
                  className="text-xs font-bold text-[#285F52] hover:text-[#214D43] hover:underline focus:outline-none focus:ring-1 focus:ring-[#285F52] rounded px-1 py-0.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {resetLoading ? 'Sending link...' : 'Forgot Password?'}
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full rounded-xl bg-[#285F52] hover:bg-[#214D43] px-5 py-3 text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[10px] font-semibold text-[#98A2B3]">
              Authorized Personnel Only • Secure Admin System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

