import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-dark-300 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-white mb-2">Page Not Found</h2>
        <p className="text-gray-400 mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-primary text-dark font-medium rounded hover:bg-primary-400 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
