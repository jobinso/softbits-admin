import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'oauth_callback',
          code,
          state,
          error: error || undefined,
          errorDescription: errorDescription || undefined,
        },
        window.location.origin,
      );

      // Close popup after a brief delay
      setTimeout(() => window.close(), 1000);
    }
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-dark">
      <div className="text-center">
        <p className="text-lg text-semantic-text-default">Authorization complete</p>
        <p className="text-sm text-semantic-text-faint mt-2">This window will close automatically...</p>
      </div>
    </div>
  );
}
