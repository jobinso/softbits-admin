import { useState, useEffect, useCallback } from 'react';
import { Shield, Key, RefreshCw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, StatusBadge } from '@/components/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OAuthPkceFlowProps {
  onTokenAcquired: (token: string) => void;
  issuer?: string;
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  if (!crypto?.subtle) {
    throw new Error(
      'WebCrypto API not available. OAuth PKCE requires a secure context — access AdminIT via HTTPS or http://localhost.'
    );
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  const str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OAuthPkceFlow({ onTokenAcquired, issuer }: OAuthPkceFlowProps) {
  const [serverUrl, setServerUrl] = useState(issuer || '');
  const [scopes, setScopes] = useState('mcp:call_tool mcp:read_resource');
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [authorizing, setAuthorizing] = useState(false);

  // Sync issuer prop when it changes
  useEffect(() => {
    if (issuer) setServerUrl(issuer);
  }, [issuer]);

  // ------- Token exchange -------

  const exchangeCodeForToken = useCallback(async (code: string) => {
    const verifier = sessionStorage.getItem('oauth_pkce_verifier');
    const clientId = sessionStorage.getItem('oauth_pkce_client_id');
    const savedServerUrl = sessionStorage.getItem('oauth_pkce_server_url');
    const redirectUri = sessionStorage.getItem('oauth_pkce_redirect_uri');

    try {
      const response = await fetch(`${savedServerUrl}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId!,
          code_verifier: verifier!,
          redirect_uri: redirectUri!,
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        setToken(data.access_token);
        setExpiresAt(Date.now() + (data.expires_in || 3600) * 1000);
        onTokenAcquired(data.access_token);
        toast.success('OAuth token acquired');

        sessionStorage.removeItem('oauth_pkce_state');
        sessionStorage.removeItem('oauth_pkce_verifier');
        sessionStorage.removeItem('oauth_pkce_client_id');
        sessionStorage.removeItem('oauth_pkce_server_url');
        sessionStorage.removeItem('oauth_pkce_redirect_uri');
      } else {
        toast.error(`Token exchange failed: ${data.error_description || data.error}`);
      }
    } catch (err) {
      toast.error(`Token exchange failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setAuthorizing(false);
    }
  }, [onTokenAcquired]);

  // ------- Listen for callback message from popup -------

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'oauth_callback') return;

      const { code, state: returnedState, error } = event.data;

      if (error) {
        toast.error(`Authorization failed: ${error}`);
        setAuthorizing(false);
        return;
      }

      const savedState = sessionStorage.getItem('oauth_pkce_state');
      if (returnedState !== savedState) {
        toast.error('State mismatch — possible CSRF attack');
        setAuthorizing(false);
        return;
      }

      exchangeCodeForToken(code);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [exchangeCodeForToken]);

  // ------- Start PKCE flow -------

  async function startPkceFlow() {
    if (!serverUrl) {
      toast.error('OAuth Server URL is required');
      return;
    }

    setAuthorizing(true);

    try {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = crypto.randomUUID();
      const redirectUri = `${window.location.origin}/oauth/callback`;

      // Dynamic Client Registration
      const registerResponse = await fetch(`${serverUrl}/oauth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redirect_uris: [redirectUri],
          client_name: 'AdminIT MCP Tester',
          scope: scopes,
        }),
      });

      if (!registerResponse.ok) {
        const errBody = await registerResponse.text();
        throw new Error(`Client registration failed: ${errBody}`);
      }

      const { client_id } = await registerResponse.json();

      // Store state for callback verification
      sessionStorage.setItem('oauth_pkce_state', state);
      sessionStorage.setItem('oauth_pkce_verifier', codeVerifier);
      sessionStorage.setItem('oauth_pkce_client_id', client_id);
      sessionStorage.setItem('oauth_pkce_server_url', serverUrl);
      sessionStorage.setItem('oauth_pkce_redirect_uri', redirectUri);

      // Open authorization in popup
      const authUrl = new URL(`${serverUrl}/oauth/authorize`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', client_id);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      const popup = window.open(
        authUrl.toString(),
        'oauth_authorize',
        'width=500,height=700,left=200,top=100',
      );

      if (!popup) {
        toast.error('Popup blocked — please allow popups for this site');
        setAuthorizing(false);
      }
    } catch (err) {
      toast.error(`Authorization failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setAuthorizing(false);
    }
  }

  // ------- Revoke token -------

  async function revokeToken() {
    const clientId = sessionStorage.getItem('oauth_pkce_client_id');
    if (token && serverUrl && clientId) {
      try {
        await fetch(`${serverUrl}/oauth/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            token,
            client_id: clientId,
          }),
        });
      } catch {
        // Best-effort revocation; clear local state regardless
      }
    }

    setToken(null);
    setExpiresAt(null);
    onTokenAcquired('');
    toast.success('Token revoked');
  }

  // ------- Time-remaining display -------

  function formatTimeRemaining(): string {
    if (!expiresAt) return '';
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return 'Expired';
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  const redirectUri = `${window.location.origin}/oauth/callback`;

  return (
    <div className="border border-semantic-border-default rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4 text-semantic-text-subtle" />
        <span className="text-sm font-medium text-semantic-text-default">OAuth 2.1 PKCE</span>
      </div>

      {/* OAuth Server URL */}
      <div>
        <label className="block text-xs font-medium text-semantic-text-subtle mb-1">OAuth Server URL</label>
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          className="form-input"
          placeholder="https://mcp.example.com"
        />
      </div>

      {/* Scopes */}
      <div>
        <label className="block text-xs font-medium text-semantic-text-subtle mb-1">Scopes</label>
        <input
          type="text"
          value={scopes}
          onChange={(e) => setScopes(e.target.value)}
          className="form-input"
          placeholder="mcp:call_tool mcp:read_resource"
        />
      </div>

      {/* Redirect URI (read-only) */}
      <div>
        <label className="block text-xs font-medium text-semantic-text-subtle mb-1">Redirect URI</label>
        <input
          type="text"
          value={redirectUri}
          readOnly
          className="form-input bg-semantic-bg-subtle text-semantic-text-faint cursor-default"
        />
      </div>

      {/* Token status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {token ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <StatusBadge status="success" label={`Authorized (expires in ${formatTimeRemaining()})`} size="sm" />
            </>
          ) : (
            <>
              <Key className="w-4 h-4 text-semantic-text-faint" />
              <StatusBadge status="neutral" label="Not authorized" size="sm" />
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          onClick={startPkceFlow}
          disabled={authorizing || !serverUrl}
          size="sm"
        >
          {authorizing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Authorizing...
            </>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5" />
              Authorize
            </>
          )}
        </Button>
        {token && (
          <Button
            onClick={revokeToken}
            variant="ghost"
            size="sm"
          >
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}
