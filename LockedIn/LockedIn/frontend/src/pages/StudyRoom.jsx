import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MOCK_ROOMS = [
  { id: 1, name: 'Google Interview Prep', problem: 'Two Sum', difficulty: 'Easy', users: 4, maxUsers: 10, theme: 'from-green-500 to-emerald-700' },
  { id: 2, name: 'Daily LeetCode Challenge', problem: 'Minimum Number of Seconds...', difficulty: 'Hard', users: 2, maxUsers: 5, theme: 'from-red-500 to-rose-700' },
  { id: 3, name: 'Dynamic Programming Grind', problem: 'Longest Palindromic Subs...', difficulty: 'Medium', users: 8, maxUsers: 20, theme: 'from-orange-500 to-amber-600' },
  { id: 4, name: 'Amazon Graph Problems', problem: 'Number of Islands', difficulty: 'Medium', users: 3, maxUsers: 5, theme: 'from-purple-500 to-fuchsia-700' },
];

const StudyRoom = () => {
  const [rooms, setRooms] = useState(MOCK_ROOMS);
  const [activeRoom, setActiveRoom] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([]);

  const handleJoin = (room) => {
    setActiveRoom(room);
    setMessages([
      { id: Date.now(), user: 'System', text: `Welcome to ${room.name}! Let's solve ${room.problem} together.`, isSystem: true }
    ]);
  };

  const handleLeave = () => {
    setActiveRoom(null);
    setMessages([]);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    
    setMessages([...messages, { id: Date.now(), user: 'You', text: chatMessage, isSystem: false }]);
    setChatMessage('');
    
    // Mock response after a delay
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        user: 'Alex', 
        text: 'I think we can use a hash map for this to get O(n) time complexity!', 
        isSystem: false 
      }]);
    }, 2000);
  };

  if (activeRoom) {
    return (
      <div className="w-full max-w-[1600px] h-[calc(100vh-2rem)] mx-auto p-4 md:p-6 flex flex-col">
        <div className="flex items-center justify-between mb-4 glass-panel p-4 rounded-2xl">
          <div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              {activeRoom.name}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                activeRoom.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' :
                activeRoom.difficulty === 'Medium' ? 'bg-orange-500/20 text-orange-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {activeRoom.difficulty}
              </span>
              <span className="text-sm text-gray-500 font-medium">
                Problem: <span className="text-gray-100">{activeRoom.problem}</span>
              </span>
            </div>
          </div>
          <button 
            onClick={handleLeave}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-medium transition-colors border border-white/10"
          >
            Leave Room
          </button>
        </div>

        <div className="flex-1 flex gap-4 overflow-hidden mb-4 rounded-2xl">
          {/* Main Workspace Frame (Mock IDE/Whiteboard) */}
          <div className="flex-1 glass-panel border border-white/10 flex flex-col relative overflow-hidden rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
             <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
               <div className="text-9xl mb-4">👨‍💻</div>
             </div>
             <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-md z-10 flex justify-between items-center">
               <div className="font-mono text-sm font-semibold text-gray-400 flex items-center gap-2">
                 <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
                 Live Session
               </div>
               <div className="flex -space-x-2">
                 {[...Array(activeRoom.users)].map((_, i) => (
                   <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-gray-700 flex items-center justify-center text-xs font-bold text-white">
                     {String.fromCharCode(65 + i)}
                   </div>
                 ))}
               </div>
             </div>
             <div className="flex-1 p-6 relative z-10 font-mono text-sm overflow-y-auto">
               <div className="text-gray-400 mb-2">// Shared workspace for {activeRoom.name}</div>
               <div className="text-gray-400 mb-4">// Discuss approaches or share snippets in the chat</div>
               
               <div className="p-4 bg-[#0b0b12] rounded-xl border border-white/20 text-gray-200">
                  <div className="font-bold text-gray-400 mb-2">Editor Mockup</div>
                  <span className="text-blue-600">class</span> <span className="text-yellow-600">Solution</span> {'{'}
                  <br />
                  &nbsp;&nbsp;<span className="text-blue-600">public inline</span> <span className="text-green-600">solve</span>() {'{'}
                  <br />
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-gray-400">// write your code here</span>
                  <br />
                  &nbsp;&nbsp;<span className="">{'}'}</span>
                  <br />
                  <span className="">{'}'}</span>
               </div>
             </div>
          </div>

          {/* Chat Sidebar */}
          <div className="w-80 glass-panel border border-white/10 flex flex-col rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.5)] bg-black/40 overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-md">
              <h3 className="font-bold text-gray-200">Discussion</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence>
                {messages.map(msg => (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${msg.user === 'You' ? 'items-end' : 'items-start'}`}
                  >
                    {!msg.isSystem && <span className="text-xs text-gray-500 mb-1 ml-1">{msg.user}</span>}
                    <div className={`
                      px-3 py-2 rounded-xl text-sm 
                      ${msg.isSystem ? 'bg-white/5 text-gray-500 w-full text-center text-xs italic border border-white/10' : 
                        msg.user === 'You' ? 'bg-red-500 text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] rounded-tr-none' : 
                        'bg-[#151521] text-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-white/10 rounded-tl-none'
                      }
                    `}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            
            <div className="p-4 bg-white/5 border-t border-white/10 backdrop-blur-md">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input 
                  type="text" 
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Share ideas..." 
                  className="flex-1 bg-black/80 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
                <button 
                  type="submit"
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 drop-shadow-sm">
            Study Rooms
          </h1>
          <p className="text-gray-500 mt-2">Join live peer programming sessions and solve LeetCode problems together.</p>
        </div>
        <button className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all transform hover:-translate-y-0.5 flex items-center gap-2">
          <span>+</span> Create Room
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {rooms.map((room, i) => (
          <motion.div
            key={room.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-panel border-white/10 p-1 flex flex-col rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 group"
          >
            <div className={`h-2 min-w-full bg-gradient-to-r ${room.theme} rounded-t-xl`}></div>
            <div className="p-5 flex flex-col flex-1">
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                  room.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400 border border-green-500/20' :
                  room.difficulty === 'Medium' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' :
                  'bg-red-500/20 text-red-400 border border-red-500/20'
                }`}>
                  {room.difficulty}
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  {room.users}/{room.maxUsers}
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-gray-100 mb-1">{room.name}</h3>
              <p className="text-sm text-gray-400 font-medium mb-6 line-clamp-1 italic">
                Problem: {room.problem}
              </p>
              
              <div className="mt-auto pt-4 border-t border-white/10">
                <button
                  onClick={() => handleJoin(room)}
                  className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-medium shadow-[0_4px_12px_rgba(0,0,0,0.5)] hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                >
                  Join Session <span>→</span>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default StudyRoom;