import React, { useState, useEffect } from 'react';
import { useSessionStore, updateMemberNickname } from '@qrmenu/core';

export function NicknamePrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [hasBeenDismissed, setHasBeenDismissed] = useState(() => 
    sessionStorage.getItem('nickname_prompt_dismissed') === 'true'
  );
  
  const nickname = useSessionStore((state) => state.nickname);
  const memberPid = useSessionStore((state) => state.memberPid);
  const sessionPid = useSessionStore((state) => state.sessionPid);
  const wsStatus = useSessionStore((state) => state.wsStatus);
  const connectionStatus = useSessionStore((state) => state.connectionStatus);
  
  useEffect(() => {
    if (hasBeenDismissed || !sessionPid || !memberPid) return;
    
    if (wsStatus === 'connected' && connectionStatus === 'open') {
      const timer = setTimeout(() => setIsVisible(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [sessionPid, memberPid, wsStatus, connectionStatus, hasBeenDismissed]);

  const handleSave = async () => {
    if (inputValue.trim()) {
      try {
        await updateMemberNickname(memberPid, inputValue.trim());
      } catch (error) {
        console.error('Failed to update nickname:', error);
      }
    }
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setHasBeenDismissed(true);
    sessionStorage.setItem('nickname_prompt_dismissed', 'true');
  };

  if (!isVisible) return null;

  const restaurantName = import.meta.env.VITE_RESTAURANT_NAME || 'Our Restaurant';

  return (
    <div 
      className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-[100] backdrop-blur-sm"
      onClick={handleDismiss}
    >
      <div 
        className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-gray-100"
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Welcome Header */}
        <div className="text-center mb-6">
          <p className="text-sm font-medium text-gray-500 mb-2">
            Welcome to
          </p>
          <h2 className="text-2xl font-extrabold text-blue-600 mb-4 drop-shadow-sm">
            {restaurantName}
          </h2>
          <h3 className="text-lg font-semibold text-gray-800">
          What should we call you?
          </h3>
          <p className="text-sm text-gray-600 mt-2">
            We'd love to personalize your dining experience
          </p>
        </div>
        
        {/* Input */}
        <div className="mb-6">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Your name"
            className="w-full px-4 py-4 border-2 border-gray-200 rounded-2xl text-center font-medium outline-none focus:border-blue-500 focus:bg-blue-50/30 transition-all duration-200"
            style={{ fontSize: '16px' }}
            autoFocus
          />
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleSave}
            disabled={!inputValue.trim()}
            className={`w-full py-4 px-6 rounded-2xl font-semibold transition-all duration-200 ${
              inputValue.trim() 
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {inputValue.trim() ? `Continue` : 'Enter your name above'}
          </button>
          
          <button
            onClick={handleDismiss}
            className="w-full py-4 px-6 rounded-2xl font-medium text-gray-700 hover:text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            Continue as "{nickname}"
          </button>
        </div>
      </div>
    </div>
  );
} 