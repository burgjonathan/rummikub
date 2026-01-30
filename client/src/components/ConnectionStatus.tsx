import { useSocket } from '../context/SocketContext';

export default function ConnectionStatus() {
  const { isConnected, reconnectAttempts } = useSocket();

  if (isConnected) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-yellow-900 py-2 px-4 text-center font-medium z-50">
      <div className="flex items-center justify-center gap-2">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>
          Reconnecting to server...
          {reconnectAttempts > 0 && ` (attempt ${reconnectAttempts})`}
        </span>
      </div>
    </div>
  );
}
