import { useState, useRef, useEffect } from 'react';
import { useCartStore, getAIResponse } from '@qrmenu/core';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

export function AIChatDrawer() {
  // Use Zustand store for everything
  const isOpen = useCartStore((state) => state.isAIChatDrawerOpen);
  const messages = useCartStore((state) => state.chatMessages);
  const isTyping = useCartStore((state) => state.isChatTyping);
  const addChatMessage = useCartStore((state) => state.addChatMessage);
  const setChatTyping = useCartStore((state) => state.setChatTyping);
  const closeAIChatDrawer = useCartStore((state) => state.closeAIChatDrawer);
  
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
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const message = inputMessage.trim();
    setInputMessage('');
    
    // Use the store method to send message and get AI response
    // This will handle adding the user message and AI response
    const userMessage = {
      type: 'user',
      content: message
    };

    addChatMessage(userMessage);
    setChatTyping(true);

    // Use the centralized AI response function
    setTimeout(() => {
      const aiResponse = {
        type: 'ai',
        content: getAIResponse(message)
      };
      addChatMessage(aiResponse);
      setChatTyping(false);
    }, 1500);
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
        className="fixed inset-0 bg-black bg-opacity-50 z-[100]"
        onClick={closeAIChatDrawer}
      />
      
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white z-[110] rounded-t-2xl shadow-xl animate-slide-up max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-red-500 text-white rounded-t-2xl">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              🤖
            </div>
            <div>
              <h2 className="font-semibold">AI Food Assistant</h2>
              <p className="text-sm opacity-90">Online now</p>
            </div>
          </div>
          <button
            onClick={closeAIChatDrawer}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-2xl ${
                  message.type === 'user'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm">{message.content}</p>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-3 rounded-2xl">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about menu items, dietary needs..."
              className="flex-1 p-3 border border-gray-300 rounded-full focus:outline-none focus:border-red-500 text-sm"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
} 