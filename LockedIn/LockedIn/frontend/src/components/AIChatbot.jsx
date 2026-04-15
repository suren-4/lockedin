import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { apiUrl } from '../services/api';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Clipboard, Check, Sparkles, AlertTriangle } from 'lucide-react';

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10 backdrop-blur-sm z-20 group"
      title="Copy code"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Clipboard className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />}
    </button>
  );
};

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I am your Academic Ai Assistant. Ask me anything about your timetable, LeetCode, or doubts.' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [burnoutDetected, setBurnoutDetected] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsTyping(true);

    // Silent ML Sentiment/Burnout check
    fetch(apiUrl('/api/ml/sentiment'), {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ text: userMessage.text })
    }).then(res => res.json()).then(data => {
      if (data.is_burnout && data.confidence > 0.4) {
        setBurnoutDetected(true);
      }
    }).catch(console.error);

    try {
      const studentDataRaw = localStorage.getItem('student_data');
      const studentData = studentDataRaw ? JSON.parse(studentDataRaw) : {};
      
      const enrichedData = {
        ...studentData,
        currentTime: new Date().toLocaleString(),
        currentDay: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        activities: JSON.parse(localStorage.getItem('local_activities') || '[]'),
        leetcode_username: localStorage.getItem('leetcode_username') || null,
        leetcode_stats: JSON.parse(localStorage.getItem('leetcode_stats') || 'null'),
        quiz_history: JSON.parse(localStorage.getItem('lockedin_dynamic_quizzes') || '[]'),
        interview_history: JSON.parse(localStorage.getItem('lockedin_mock_interview_history') || '[]')
      };

      // Add a placeholder message for the assistant
      setMessages(prev => [...prev, { role: 'assistant', text: '' }]);

      const response = await fetch(apiUrl('/api/chatbot/ask'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.text,
          context: `User is interacting with the AI Assistant. Page: ${window.location.pathname}`,
          student_data: enrichedData,
          history: nextMessages.map((entry) => ({
            role: entry.role,
            text: entry.text,
          })),
        }),
      });

      if (!response.ok) throw new Error('Failed to connect to AI');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantReply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);
              if (data.error) throw new Error(data.error);
              if (data.content) {
                setIsTyping(false); // Hide the "..." indicator when content starts
                assistantReply += data.content;
                // Update the last message in the list
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', text: assistantReply };
                  return updated;
                });
              }
            } catch (e) {
              // Partial JSON chunks can happen in streaming
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant' && last.text === '') {
          updated[updated.length - 1] = { role: 'assistant', text: 'Oops, I encountered an error connecting to the server.' };
        } else {
          updated.push({ role: 'assistant', text: 'Oops, I encountered an error connecting to the server.' });
        }
        return updated;
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-gradient-to-r from-red-500 via-red-600 to-red-700 rounded-full shadow-[0_0_25px_rgba(239,68,68,0.5)] transition-all text-white font-bold z-50 group border border-white/5 backdrop-blur-md overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 group-hover:rotate-12 transition-transform duration-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>
        </motion.button>
      )}

      {/* Chat Window Popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(10px)' }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              filter: 'blur(0px)',
              width: isMaximized ? '95vw' : '400px',
              height: isMaximized ? '90vh' : '600px',
              bottom: isMaximized ? '5vh' : '24px',
              right: isMaximized ? '2.5vw' : '24px'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.9, filter: 'blur(10px)' }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed max-h-[95vh] max-w-[95vw] glass-panel rounded-3xl shadow-2xl overflow-hidden border border-white/10 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="bg-black/40 backdrop-blur-md border-b border-white/5 p-5 flex justify-between items-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-red-600/10 z-0"></div>
              <div className="flex items-center gap-3 z-10">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-red-500 to-red-600 flex items-center justify-center shadow-inner text-white">
                  ✨
                </div>
                <div>
                  <h3 className="font-bold text-gray-200 text-lg">AI Assistant</h3>
                  {burnoutDetected ? (
                    <p className="text-xs text-yellow-500 font-medium flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                      <AlertTriangle className="w-3 h-3" /> Burnout Detected! Take a Break
                    </p>
                  ) : (
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 z-10">
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-gray-400"
                  title={isMaximized ? "Restore down" : "Maximize"}
                >
                  {isMaximized ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-500 hover:text-white transition-colors text-gray-400 font-bold"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gradient-to-b from-transparent to-black/20 custom-scrollbar">
              {messages.map((msg, idx) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-950 to-black border border-red-500/30 flex items-center justify-center mr-2 flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-red-400" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-[0_4px_12px_rgba(0,0,0,0.5)] leading-relaxed ${msg.role === 'user'
                    ? 'bg-gradient-to-br from-red-600 to-red-700 text-white rounded-br-sm shadow-red-500/20'
                    : 'bg-black/80 backdrop-blur-sm text-gray-200 border border-white/10 rounded-bl-sm'
                    }`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeText = String(children).replace(/\n$/, '');
                          return !inline && match ? (
                            <div className="relative group/code">
                              <CopyButton text={codeText} />
                              <SyntaxHighlighter
                                style={atomDark}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-lg my-2 text-xs"
                                {...props}
                              >
                                {codeText}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <code className={`${className} bg-white/10 px-1.5 py-0.5 rounded text-red-400 font-mono text-xs`} {...props}>
                              {children}
                            </code>
                          );
                        },
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        a: ({ children, href }) => <a href={href} className="text-red-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-red-500 pl-4 italic my-2">{children}</blockquote>
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              ))}

               {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex justify-start items-end"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-950 to-black border border-red-500/30 flex items-center justify-center mr-2">
                    <Sparkles className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="bg-black/80 backdrop-blur-sm text-gray-500 px-4 py-3 rounded-2xl rounded-bl-sm border border-white/10 flex gap-1 items-center h-[44px]">
                    <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-red-400 rounded-full animate-bounce"></span>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-black/40 backdrop-blur-md border-t border-white/10">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Ask me anything..."
                  className="w-full bg-black/80 border border-white/10 rounded-full pl-5 pr-14 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-gray-300 placeholder-gray-500 font-medium"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isTyping}
                  className="absolute right-1.5 w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center disabled:opacity-40 disabled:bg-gray-400 hover:bg-red-700 hover:scale-105 transition-all shadow-[0_8px_24px_rgba(0,0,0,0.6)] active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                  </svg>
                </button>
              </div>
              <div className="text-center mt-2">
                <span className="text-[10px] text-gray-400 font-medium">Responses generated by LockedIn AI</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatbot;
