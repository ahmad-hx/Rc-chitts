import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  User,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

import Logo from '../components/Logo';
import Button from '../components/Button';

import {
  signInWithEmailAndPassword,
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError('');
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

  return (
    <div className="min-h-screen bg-[#1C1C1A] relative overflow-hidden px-4 py-8 sm:px-6 flex items-center justify-center font-sans">
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

            <div className="flex items-center justify-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.25em] text-[#D8D8D3]">
              <ShieldCheck className="h-4 w-4 text-[#2F6B4F]" />
              Private Admin Portal
            </div>
          </div>

          <div className="bg-white border border-[#E5E5E1] rounded-2xl p-6 sm:p-8 shadow-xl">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-black tracking-tight text-[#1C1C1A]">Raghavendra Chitts</h1>
              <p className="text-xs text-[#6B6B67] mt-1">Enterprise Admin Authentication</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-[#F2D4D4] bg-[#FCEEEE] p-3 text-xs font-bold text-[#A33A3A]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#A33A3A]" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="username" className="block text-[10px] font-extrabold uppercase tracking-wider text-[#6B6B67]">
                  Admin Email
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#959590]">
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
                    }}
                    className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] py-2.5 pl-10 pr-4 text-xs font-bold text-[#1C1C1A] placeholder:text-[#959590] outline-none transition-all focus:border-[#2F5D50] focus:bg-white focus:ring-1 focus:ring-[#2F5D50]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-[10px] font-extrabold uppercase tracking-wider text-[#6B6B67]">
                  Password
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#959590]">
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
                    }}
                    className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] py-2.5 pl-10 pr-11 text-xs font-bold text-[#1C1C1A] placeholder:text-[#959590] outline-none transition-all focus:border-[#2F5D50] focus:bg-white focus:ring-1 focus:ring-[#2F5D50]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#959590] hover:text-[#1C1C1A] focus:outline-none cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <label htmlFor="remember-me" className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#1C1C1A]">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-[#E5E5E1] text-[#2F5D50] focus:ring-[#2F5D50] cursor-pointer"
                  />
                  Remember me
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full rounded-xl bg-[#2F5D50] hover:bg-[#24493F] px-5 py-3 text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          </div>

          <div className="mt-6 text-center">
            <p className="text-[10px] font-semibold text-[#959590]">
              Authorized Personnel Only • Secure Admin System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
