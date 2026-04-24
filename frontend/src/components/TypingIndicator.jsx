import React from 'react';

const TypingIndicator = () => {
  return (
    <div className="flex items-center gap-1 p-2 bg-slate-800 rounded-2xl rounded-tl-none w-fit max-w-[70%]">
      <div className="flex space-x-1 items-center h-5 px-2">
        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
};

export default TypingIndicator;
