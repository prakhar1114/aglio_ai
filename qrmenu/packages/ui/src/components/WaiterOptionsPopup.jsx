import React, { useEffect, useRef } from 'react';
import { BellIcon, ReceiptPercentIcon } from '@heroicons/react/24/outline';
import { handleWaiterRequest } from '@qrmenu/core';

/**
 * Minimal popup offering quick waiter-related actions.
 * Appears above the "Waiter" bottom-bar button.
 */
export function WaiterOptionsPopup({ anchor, onClose }) {
  if (!anchor) return null;

  const handleCallWaiter = async () => {
    try {
      await handleWaiterRequest(
        'call_waiter',
        'Waiter Called',
        'Your waiter has been notified and will be with you shortly.'
      );
    } finally {
      onClose();
    }
  };

  const handleAskBill = async () => {
    try {
      await handleWaiterRequest(
        'ask_for_bill',
        'Bill Requested',
        'Your bill request has been sent to staff.'
      );
    } finally {
      onClose();
    }
  };

  const containerRef = useRef(null);

  // Close when clicking / tapping outside
  useEffect(() => {
    function handleOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onClose();
      }
    }
    // Use only mouse events – avoids closing on touchpad scroll gestures
    document.addEventListener('mousedown', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: anchor.x,
        top: anchor.y,
        transform: 'translate(-50%, calc(-100% - 12px))', // account for arrow height
      }}
      ref={containerRef}
    >
      <div className="relative bg-white/80 backdrop-blur-md border border-gray-200/70 rounded-2xl shadow-xl shadow-gray-400/20 overflow-hidden min-w-[170px] ring-1 ring-black/5 pointer-events-auto">
        {/* Arrow */}
        <div className="absolute left-1/2 translate-x-[-50%] bottom-[-6px] w-3 h-3 bg-white/80 border border-gray-200/70 rotate-45 backdrop-blur-md" />

        <button
          onClick={handleCallWaiter}
          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none"
        >
          <BellIcon className="w-5 h-5" />
          <span>Call Waiter</span>
        </button>
        <button
          onClick={handleAskBill}
          className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none border-t border-gray-100/70"
        >
          <ReceiptPercentIcon className="w-5 h-5" />
          <span>Ask for Bill</span>
        </button>
      </div>
    </div>
  );
} 