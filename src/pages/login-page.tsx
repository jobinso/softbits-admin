import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/use-auth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const { login, verifyTotp, isLoading, error, clearError, requiresTotp } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      if (!useAuth.getState().requiresTotp) {
        navigate('/');
      }
    } catch {
      // Error is set in the store
    }
  };

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyTotp(totpCode);
      navigate('/');
    } catch {
      // Error is set in the store
    }
  };

  const handleCancelTotp = () => {
    setTotpCode('');
    setPassword('');
    clearError();
    useAuth.setState({ requiresTotp: false, tempToken: null });
  };

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3">
            <ShieldCheck className="w-7 h-7 text-dark" />
          </div>
          <h1 className="text-xl font-semibold text-dark-700">AdminIT</h1>
          <p className="text-sm text-dark-400 mt-1">System Administration Console</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-danger-50 border border-danger/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0" />
            <p className="text-sm text-danger">{error}</p>
            <button
              type="button"
              onClick={clearError}
              className="ml-auto text-xs text-danger hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Login Form */}
        {!requiresTotp ? (
          <form onSubmit={handleLogin} className="bg-dark-50 border border-dark-200 rounded-xl p-6 space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm text-dark-500 mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full px-3 py-2.5 bg-dark-100 border border-dark-200 rounded-lg text-sm text-dark-700"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-dark-500 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full px-3 py-2.5 bg-dark-100 border border-dark-200 rounded-lg text-sm text-dark-700"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full py-2.5 bg-primary text-dark font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTotp} className="bg-dark-50 border border-dark-200 rounded-xl p-6 space-y-4">
            <div className="text-center mb-2">
              <p className="text-sm text-dark-500">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div>
              <label htmlFor="totpCode" className="block text-sm text-dark-500 mb-1">
                Verification Code
              </label>
              <input
                id="totpCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                autoComplete="one-time-code"
                autoFocus
                required
                className="w-full px-3 py-2.5 bg-dark-100 border border-dark-200 rounded-lg text-sm text-dark-700 text-center tracking-widest"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || totpCode.length !== 6}
              className="w-full py-2.5 bg-primary text-dark font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={handleCancelTotp}
              className="w-full py-2 text-sm text-dark-400 hover:text-dark-500 transition-colors"
            >
              Back to login
            </button>
          </form>
        )}

        <p className="text-center text-xs text-dark-400 mt-6">
          softBITS AdminIT
        </p>
      </div>
    </div>
  );
}
