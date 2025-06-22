import React from 'react';
import { XMarkIcon, InformationCircleIcon, ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useSessionStore } from '@qrmenu/core';

const iconMap = {
  info: InformationCircleIcon,
  warning: ExclamationTriangleIcon,
  success: CheckCircleIcon,
  error: XCircleIcon,
};

const colorMap = {
  info: {
    bg: 'bg-blue-50',
    icon: 'text-blue-500',
    title: 'text-blue-900',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  warning: {
    bg: 'bg-yellow-50',
    icon: 'text-yellow-500',
    title: 'text-yellow-900',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  success: {
    bg: 'bg-green-50',
    icon: 'text-green-500',
    title: 'text-green-900',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  error: {
    bg: 'bg-red-50',
    icon: 'text-red-500',
    title: 'text-red-900',
    text: 'text-red-700',
    border: 'border-red-200',
  },
};

const buttonVariants = {
  primary: 'bg-red-500 hover:bg-red-600 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
  success: 'bg-green-500 hover:bg-green-600 text-white',
};

export function InformationModal() {
  const modal = useSessionStore((state) => state.modal);
  const hideModal = useSessionStore((state) => state.hideModal);

  if (!modal.isOpen) return null;

  const IconComponent = iconMap[modal.type] || InformationCircleIcon;
  const colors = colorMap[modal.type] || colorMap.info;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      hideModal();
    }
  };

  const handleActionClick = (action) => {
    if (action.action) {
      action.action();
    }
    hideModal();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        {/* Modal */}
        <div 
          className={`bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto ${colors.border} border`}
          style={{
            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`${colors.bg} p-6 rounded-t-2xl border-b ${colors.border}`}>
            <div className="flex items-start space-x-4">
              <div className={`flex-shrink-0 ${colors.icon}`}>
                <IconComponent className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0">
                {modal.title && (
                  <h3 className={`text-lg font-semibold ${colors.title} mb-1`}>
                    {modal.title}
                  </h3>
                )}
                {modal.message && (
                  <p className={`text-sm ${colors.text} leading-relaxed`}>
                    {modal.message}
                  </p>
                )}
              </div>
              <button
                onClick={hideModal}
                className="flex-shrink-0 p-1 hover:bg-white/50 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Actions */}
          {modal.actions && modal.actions.length > 0 && (
            <div className="p-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                {modal.actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleActionClick(action)}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                      buttonVariants[action.variant] || buttonVariants.primary
                    }`}
                    style={{
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Default close button if no actions */}
          {(!modal.actions || modal.actions.length === 0) && (
            <div className="p-6">
              <div className="flex justify-end">
                <button
                  onClick={hideModal}
                  className="px-4 py-2 rounded-lg font-medium text-sm bg-gray-200 hover:bg-gray-300 text-gray-900 transition-colors"
                  style={{
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 