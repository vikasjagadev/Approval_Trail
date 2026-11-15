import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import apiClient from '../api/client';
import { User } from '../api/types';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await apiClient.post<{ token: string; user: User }>('/auth/login', {
        email: email.trim(),
        password,
      });

      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as Record<string, unknown>).response === 'object'
      ) {
        const res = (err as { response?: { data?: { error?: { message?: string } } } }).response;
        setError(res?.data?.error?.message || 'Login failed. Please verify credentials.');
      } else {
        setError('Login failed. Please check network and server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Passw0rd!');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-md">
          AT
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          ApprovalTrail
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Configurable request portal with tamper-evident audit history
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-gray-100">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 border border-red-200 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@demo.com"
                  className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          {/* Demo Accounts Hint Box */}
          <div className="mt-6 border-t border-gray-100 pt-5">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">
              Click to autofill demo credentials
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleFillDemo('alice@demo.com')}
                className="p-2 text-left bg-gray-50 hover:bg-indigo-50 rounded border border-gray-200 transition-colors"
              >
                <div className="font-semibold text-gray-800">Alice (Requester)</div>
                <div className="text-[11px] text-gray-500">alice@demo.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo('manager@demo.com')}
                className="p-2 text-left bg-gray-50 hover:bg-indigo-50 rounded border border-gray-200 transition-colors"
              >
                <div className="font-semibold text-gray-800">Manager</div>
                <div className="text-[11px] text-gray-500">manager@demo.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo('approver@demo.com')}
                className="p-2 text-left bg-gray-50 hover:bg-indigo-50 rounded border border-gray-200 transition-colors"
              >
                <div className="font-semibold text-gray-800">Approver (HR/Fin)</div>
                <div className="text-[11px] text-gray-500">approver@demo.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleFillDemo('admin@demo.com')}
                className="p-2 text-left bg-gray-50 hover:bg-indigo-50 rounded border border-gray-200 transition-colors"
              >
                <div className="font-semibold text-gray-800">Admin</div>
                <div className="text-[11px] text-gray-500">admin@demo.com</div>
              </button>
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-2">
              Password for all accounts is: <code className="font-mono text-gray-600">Passw0rd!</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

