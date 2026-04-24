import React, { useState, useEffect } from 'react';
import { Search, X, MessageSquare, User, Calendar } from 'lucide-react';
import { initDB } from '../utils/db';

export default function SearchModal({ onClose, onSelectResult }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [filter, setFilter] = useState('all'); // all, message, user

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const performSearch = async () => {
      const db = await initDB();
      const allResults = [];

      // Search Messages
      if (filter === 'all' || filter === 'message') {
        const messages = await db.getAll('messages');
        const filteredMessages = messages
          .filter(m => m.text?.toLowerCase().includes(query.toLowerCase()))
          .map(m => ({ ...m, resultType: 'message' }));
        allResults.push(...filteredMessages);
      }

      // Search Contacts/Users
      if (filter === 'all' || filter === 'user') {
        const contacts = await db.getAll('contacts');
        const filteredContacts = contacts
          .filter(c => c.name?.toLowerCase().includes(query.toLowerCase()))
          .map(c => ({ ...c, resultType: 'user' }));
        allResults.push(...filteredContacts);
      }

      setResults(allResults.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, filter]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-slate-800 flex items-center gap-4">
          <Search className="text-slate-500" size={20} />
          <input
            autoFocus
            type="text"
            placeholder="Search messages, users..."
            className="flex-1 bg-transparent border-none outline-none text-white text-lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full transition">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex gap-2 p-2 bg-slate-950/50 border-b border-slate-800">
          {['all', 'message', 'user'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs uppercase tracking-wider transition ${
                filter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {results.length > 0 ? (
            results.map((res, i) => (
              <div
                key={res.id || i}
                onClick={() => onSelectResult(res)}
                className="p-3 hover:bg-slate-800 rounded-xl cursor-pointer transition flex items-center gap-4 group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition">
                  {res.resultType === 'message' ? (
                    <MessageSquare size={18} className="text-blue-400" />
                  ) : (
                    <User size={18} className="text-purple-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-slate-200">
                      {res.resultType === 'message' ? (res.from === 'me' ? 'You' : 'Message') : res.name}
                    </span>
                    {res.timestamp && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(res.timestamp).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-1">
                    {res.resultType === 'message' ? res.text : 'Contact'}
                  </p>
                </div>
              </div>
            ))
          ) : query.length >= 2 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No results found for "{query}"</p>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-600">
              <p>Start typing to search...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
