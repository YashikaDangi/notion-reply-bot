import React, { useState } from 'react';

// Types for the API response
interface Reply {
  username: string;
  comment: string;
  generatedReply: string;
}

interface ApiResponse {
  success: boolean;
  data?: {
    totalFound: number;
    processed: number;
    replies: Reply[];
  };
  error?: string;
  details?: string;
  message?: string;
  hint?: string;
}

const ProcessUnreplied: React.FC = () => {
  const [limit, setLimit] = useState<number>(10);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('https://insta-comment-replies-725cd9ab18a1.herokuapp.com/process-unreplied', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit }),
      });
      
      const data: ApiResponse = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Process Unreplied Comments</h1>
      
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-1">
              Number of comments to process:
            </label>
            <input
              type="number"
              id="limit"
              min={1}
              max={100}
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className={`px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              loading ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Processing...' : 'Send Request'}
          </button>
        </form>
      </div>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {response && (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Response</h2>
          
          {response.error ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <p className="font-medium text-red-700">Error: {response.error}</p>
              {response.details && <p className="mt-1 text-red-700">{response.details}</p>}
              {response.hint && <p className="mt-2 text-sm text-red-600">{response.hint}</p>}
            </div>
          ) : response.success ? (
            <div>
              <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
                <p className="font-medium text-green-700">
                  Success! Found {response.data?.totalFound} comments and processed {response.data?.processed}
                </p>
              </div>
              
              {response.data?.replies && response.data.replies.length > 0 ? (
                <>
                  <h3 className="text-lg font-medium mt-6 mb-4">Generated Replies</h3>
                  <div className="space-y-4">
                    {response.data.replies.map((reply, index) => (
                      <div key={index} className="border border-gray-200 rounded-md p-4">
                        <div className="flex items-start space-x-3">
                          <div className="bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center">
                            <span className="text-gray-600 font-medium">{reply.username.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{reply.username}</p>
                            <p className="text-gray-600 mt-1">{reply.comment}</p>
                            
                            <div className="mt-3 pl-3 border-l-4 border-indigo-400">
                              <p className="text-gray-800 italic">{reply.generatedReply}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p>No replies were generated.</p>
              )}
            </div>
          ) : (
            <div>
              <p>{response.message || 'Unknown response format'}</p>
            </div>
          )}
          
          <div className="mt-6">
            <details>
              <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800">
                Show raw JSON response
              </summary>
              <pre className="mt-2 bg-gray-100 p-4 rounded-md overflow-x-auto text-xs">
                {JSON.stringify(response, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessUnreplied;