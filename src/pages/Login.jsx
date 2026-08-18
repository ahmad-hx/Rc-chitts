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
    <div className="login-shell relative min-h-screen overflow-hidden px-4 py-8 sm:px-6">
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${
            loginSuccess ? 'pointer-events-none scale-[0.97] opacity-0' : 'opacity-100 scale-100'
          }`}
        >
          <div className="mb-7 text-center">
            <div className="mb-4 flex justify-center">
              <Logo size="lg" showText={false} className="drop-shadow-[0_12px_35px_rgba(56,189,248,0.32)]" />
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200/90">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
              Private Admin Portal
            </div>
          </div>

          <div className="glass-panel rounded-[28px] p-5 sm:p-6">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-black tracking-tight text-white">Raghavendra Chitts</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="username" className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Admin Email
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
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
                    className="w-full rounded-2xl border border-slate-600/60 bg-slate-950/40 py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Password
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
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
                    className="w-full rounded-2xl border border-slate-600/60 bg-slate-950/40 py-3 pl-10 pr-11 text-sm text-white placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-400/20"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-white focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <label htmlFor="remember-me" className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-200">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-950/40 text-sky-400 focus:ring-sky-400/30"
                  />
                  Remember me
                </label>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-5 py-3.5 text-base font-semibold text-white shadow-[0_14px_28px_rgba(59,130,246,0.38)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(59,130,246,0.42)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          </div>

          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Private System
            </div>

            <p className="mt-3 text-[10px] text-slate-400">
              Authorized Personnel Only. Actions are logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
