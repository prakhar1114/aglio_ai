import { useState, useRef, useEffect } from 'react';
import { useChatStore, useSessionStore } from '@qrmenu/core';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { BlockRenderer } from './BlockRenderer';

export function AIChatDrawer() {
  // Use new chat store for all chat functionality
  const isOpen = useChatStore((state) => state.isDrawerOpen);
  const messages = useChatStore((state) => state.messages);
  const isTyping = useChatStore((state) => state.isTyping);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const closeDrawer = useChatStore((state) => state.closeDrawer);
  const isMessageOptimistic = useChatStore((state) => state.isMessageOptimistic);
  
  const memberNickname = useSessionStore((state) => state.nickname) || 'Guest';
  
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // setTimeout(() => inputRef.current?.focus(), 100);
      scrollToBottom();
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const message = inputMessage.trim();
    setInputMessage('');
    
    // Use the new chat store method to send message
    // This will handle adding the user message and AI response
    await sendMessage(message, memberNickname);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
        onClick={closeDrawer}
      />
      
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl z-[110] rounded-t-3xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col border-t border-black/10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/8 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-t-3xl">
          <div className="flex items-center space-x-3">
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-sm">🤖</span>
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
                AI Waiter
              </h2>
              <p className="text-xs opacity-90" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                Online now
              </p>
            </div>
          </div>
          <button
            onClick={closeDrawer}
            className="p-1.5 hover:bg-white/20 rounded-full transition-all duration-200"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Messages - Optimized for group chat */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
          {messages.map((message) => {
            const isOptimistic = isMessageOptimistic(message.id);
            const isCurrentUser = message.type === 'user' && message.sender === memberNickname;
            
            return (
              <div key={message.id} className={`transition-opacity duration-300`}>
                {message.type === 'user' ? (
                  /* User message - current user right-aligned, others left-aligned */
                  <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[75%]">
                      {message.sender && (
                        <p 
                          className={`text-xs text-gray-500 mb-1 ${isCurrentUser ? 'text-right' : 'text-left'}`} 
                          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
                        >
                          {message.sender}
                        </p>
                      )}
                      <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                        isCurrentUser 
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
                          : 'bg-white border border-gray-200 text-gray-800'
                      }`}>
                        <p className="text-sm leading-[1.4]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                          {message.content}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* AI message - full width, left-aligned */
                  <div className="w-full">
                    {/* AI Header */}
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-6 h-6 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center">
                        <span className="text-xs text-white">🤖</span>
                      </div>
                      <span className="text-xs font-medium text-gray-600" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                        AI Waiter
                      </span>
                    </div>
                    
                    {/* AI Content */}
                    <div className="space-y-2">
                      {message.blocks ? (
                        message.blocks.map((block, index) => (
                          <BlockRenderer key={`${message.id}-block-${index}`} block={block} />
                        ))
                      ) : message.content ? (
                        <div className="bg-gray-50/80 backdrop-blur-sm border-l-2 border-red-500 pl-4 pr-4 py-3 rounded-r-xl">
                          <p className="text-sm leading-[1.5] text-gray-800" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                            {message.content}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {isTyping && (
            <div className="w-full">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-6 h-6 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white">🤖</span>
                </div>
                <span className="text-xs font-medium text-gray-600" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}>
                  AI Waiter is typing...
                </span>
              </div>
              <div className="bg-gray-50/80 backdrop-blur-sm border-l-2 border-red-500 pl-4 pr-4 py-3 rounded-r-xl">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-black/8 bg-gray-50/80 backdrop-blur-xl">
          <div className="flex items-center space-x-3">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask the AI Waiter about menu items, dietary needs..."
              className="
                flex-1 px-4 py-3 
                border border-black/10 rounded-2xl 
                focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                text-sm bg-white/90 backdrop-blur-xl
                transition-all duration-200
                placeholder:text-gray-400
              "
              style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="
                p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white 
                rounded-2xl shadow-sm transition-all duration-200 
                hover:scale-105 active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              "
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 