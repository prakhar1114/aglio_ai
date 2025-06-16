import React from 'react';

export function CategoryDropdown({ isOpen, categories = [], onSelect, onClose }) {
  if (!isOpen) return null;

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9998]"
      onClick={handleBackgroundClick}
    >
      <div className="absolute top-2 left-1 bg-white/40 backdrop-blur-lg rounded-lg shadow-lg w-40 max-h-72 overflow-y-auto z-[9999] border border-gray-200/20">
        {categories.map((cat) => (
          <div
            key={cat}
            className="px-2 py-1.5 text-sm cursor-pointer hover:bg-gray-100 active:scale-95 transition transform duration-100 ease-out"
            onClick={() => onSelect?.(cat)}
          >
            {cat}
          </div>
        ))}
      </div>
    </div>
  );
} 