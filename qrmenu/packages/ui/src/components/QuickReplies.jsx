import React, { useState } from 'react';
import { useChatStore, useSessionStore } from '@qrmenu/core';

export function QuickReplies({ options, className = '' }) {
  const [enableOptions, setEnableOptions] = useState(true);
  const { sendMessage } = useChatStore();
  const { nickname } = useSessionStore();
  
  if (!options || options.length === 0) return null;

  const handlePress = (option) => {
    if (!enableOptions) return;
    setEnableOptions(false);
    sendMessage(option, nickname);
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-wrap gap-1.5 pl-2 pr-2 py-1">
        {options.map((option, index) => (
          <button
            key={index}
            className={`
              text-xs font-medium
              px-2.5 py-1.5 rounded-full
              border transition-all duration-200 ease-out
              ${enableOptions 
                ? 'bg-white border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 active:scale-95' 
                : 'bg-gray-100 border-gray-200 text-gray-400 opacity-50 cursor-not-allowed'
              }
            `}
            style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
            onClick={() => handlePress(option)}
            disabled={!enableOptions}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
} 