import React from 'react';

export function TextBlock({ text, className = '' }) {
  if (!text) return null;

  // Enhanced markdown-to-HTML conversion with consistent styling
  const convertMarkdown = (text) => {
    return text
      // Bold text **text** or __text__
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/__(.*?)__/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      
      // Italic text *text* or _text_
      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-600">$1</em>')
      .replace(/_(.*?)_/g, '<em class="italic text-gray-600">$1</em>')
      
      // Code `code`
      .replace(/`(.*?)`/g, '<code class="text-code">$1</code>')
      
      // Line breaks
      .replace(/\n/g, '<br />');
  };

  const inlineStyles = `
    .text-code {
      font-family: ui-monospace, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      background: rgba(142, 142, 147, 0.12);
      color: #AF52DE;
      padding: 2px 6px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
    }
  `;

  return (
    <>
      <style>{inlineStyles}</style>
      <div 
        className={`
          bg-gray-50/80 backdrop-blur-sm
          border-l-2 border-red-500 
          pl-4 pr-4 py-3 rounded-r-xl
          w-full
          ${className}
        `}
      >
        <div 
          className="
            text-sm leading-[1.5] text-gray-800
            break-words
          "
          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
          dangerouslySetInnerHTML={{ __html: convertMarkdown(text) }}
        />
      </div>
    </>
  );
} 