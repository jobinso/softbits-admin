import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle, LoaderCircle } from 'lucide-react';
import { useAuth } from '../hooks/use-auth';

const PENDING_LICENSE_KEY = 'pending-license-xml';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [licenseMessage, setLicenseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleLicenseFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xml') && !file.name.endsWith('.lic')) {
      setLicenseMessage({ type: 'error', text: 'Please select an XML or LIC license file' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      localStorage.setItem(PENDING_LICENSE_KEY, content);
      setLicenseMessage({ type: 'success', text: `License file "${file.name}" staged. It will be uploaded after login.` });
    };
    reader.onerror = () => {
      setLicenseMessage({ type: 'error', text: 'Failed to read license file' });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Login Card */}
        {!requiresTotp ? (
          <form onSubmit={handleLogin} className="bg-surface-raised border border-border rounded-xl p-8 space-y-5">
            {/* Logo & Branding */}
            <div className="flex items-center gap-3 mb-2">
              <LoaderCircle className="w-10 h-10 text-primary" strokeWidth={2.5} />
              <div>
                <h1 className="text-xl font-bold text-semantic-text-default">
                  soft<span className="text-primary">BITS</span> AdminIT
                </h1>
                <p className="text-sm text-primary">Admin Console</p>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-danger-50 border border-danger/20 rounded-lg">
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

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-xs font-medium tracking-wider text-semantic-text-subtle mb-1.5 uppercase">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                required
                className="w-full px-3 py-2.5 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring focus:border-accent-primary transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium tracking-wider text-semantic-text-subtle mb-1.5 uppercase">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
                className="w-full px-3 py-2.5 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring focus:border-accent-primary transition-colors"
              />
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full py-2.5 bg-gradient-to-r from-primary to-primary-400 text-semantic-text-on-primary font-medium rounded-lg disabled:opacity-50 transition-colors hover:brightness-110"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Load License */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 border border-border text-semantic-text-default rounded-lg flex items-center justify-center gap-2 hover:bg-surface-overlay transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                Load License
              </button>
              <p className="text-xs text-semantic-text-faint">Upload an offline license file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,.lic"
                onChange={handleLicenseFile}
                className="hidden"
              />
            </div>

            {/* License Message */}
            {licenseMessage && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                licenseMessage.type === 'success'
                  ? 'bg-success/10 border border-success/20 text-success'
                  : 'bg-danger-50 border border-danger/20 text-danger'
              }`}>
                <p>{licenseMessage.text}</p>
                <button
                  type="button"
                  onClick={() => setLicenseMessage(null)}
                  className="ml-auto text-xs hover:underline"
                >
                  Dismiss
                </button>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={handleTotp} className="bg-surface-raised border border-border rounded-xl p-8 space-y-5">
            {/* Logo & Branding */}
            <div className="flex items-center gap-3 mb-2">
              <LoaderCircle className="w-10 h-10 text-primary" strokeWidth={2.5} />
              <div>
                <h1 className="text-xl font-bold text-semantic-text-default">
                  soft<span className="text-primary">BITS</span> AdminIT
                </h1>
                <p className="text-sm text-primary">Admin Console</p>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-danger-50 border border-danger/20 rounded-lg">
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

            <div className="text-center mb-2">
              <p className="text-sm text-semantic-text-subtle">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div>
              <label htmlFor="totpCode" className="block text-xs font-medium tracking-wider text-semantic-text-subtle mb-1.5 uppercase">
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
                placeholder="000000"
                autoComplete="one-time-code"
                autoFocus
                required
                className="w-full px-3 py-2.5 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default text-center tracking-widest placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring focus:border-accent-primary transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || totpCode.length !== 6}
              className="w-full py-2.5 bg-gradient-to-r from-primary to-primary-400 text-semantic-text-on-primary font-medium rounded-lg disabled:opacity-50 transition-colors hover:brightness-110"
            >
              {isLoading ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={handleCancelTotp}
              className="w-full py-2 text-sm text-semantic-text-faint hover:text-semantic-text-subtle transition-colors"
            >
              Back to login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
