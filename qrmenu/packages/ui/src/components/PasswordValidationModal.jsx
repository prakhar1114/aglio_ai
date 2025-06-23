import React, { useState } from 'react';
import { validatePassword } from '@qrmenu/core/utils/connection';
import { useSessionStore } from '@qrmenu/core/store/session';

export function PasswordValidationModal({ isOpen, onClose }) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { 
    sessionPid, 
    setSessionValidated, 
    showModal,
    hideModal 
  } = useSessionStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim() || !sessionPid) return;

    setIsLoading(true);
    setError('');

    try {
      const result = await validatePassword(sessionPid, password.trim());
      
      if (result.success && result.session_validated) {
        // Update session store
        setSessionValidated(true);
        
        // Show success message
        showModal({
          type: 'success',
          title: 'Password Validated',
          message: 'You can now place orders and make changes to your cart.',
          actions: [
            {
              label: 'Continue',
              action: () => {
                hideModal();
                onClose();
              },
              variant: 'primary'
            }
          ]
        });
      }
    } catch (error) {
      setError(error.message || 'Invalid password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">
          Daily Password Required
        </h2>
        
        <p className="text-gray-600 mb-6">
          Please enter today's password to continue with your order.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter today's password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !password.trim()}
            >
              {isLoading ? 'Validating...' : 'Submit'}
            </button>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500">
          <p>💡 Tip: If you don't know the password, ask your server or try "coffee"</p>
        </div>
      </div>
    </div>
  );
} 