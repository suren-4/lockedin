import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { apiUrl } from '../services/api';
import { Sparkles, Map, Target, Clock, ArrowRight } from 'lucide-react';

const JobRoadmap = () => {
  const [jobTitle, setJobTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [roadmap, setRoadmap] = useState(null);
  const [roadmapText, setRoadmapText] = useState('');
  const [currentJob, setCurrentJob] = useState('');

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!jobTitle.trim()) return;
    
    setIsGenerating(true);
    setRoadmap(null);
    setCurrentJob(jobTitle);

    try {
    const response = await fetch(apiUrl('/api/roadmap/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: jobTitle })
      });

      if (!response.ok) throw new Error('Stream failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Hold onto partial line

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine || cleanLine === 'data: [DONE]') continue;

          if (cleanLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(cleanLine.slice(6));
              if (data.content) {
                fullContent += data.content;
                // Live update the raw text for immediate feedback
                setRoadmapText(fullContent); 
              }
              if (data.error) throw new Error(data.error);
            } catch (err) {
              console.warn('Chunk parse error:', err);
            }
          }
        }
      }

      // Cleanup JSON (Mistral often wraps in markdown or adds text)
      let cleaned = fullContent.trim();
      
      // Remove Markdown code blocks if present
      cleaned = cleaned.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Robust array extraction - Find the first [ and the corresponding LAST ]
      const firstBracket = cleaned.indexOf('[');
      const lastBracket = cleaned.lastIndexOf(']');
      
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        cleaned = cleaned.substring(firstBracket, lastBracket + 1);
      }

      console.log('Attempting to parse:', cleaned);
      
      try {
        const parsed = JSON.parse(cleaned);
        const finalRoadmap = Array.isArray(parsed) ? parsed : (parsed.phases || parsed.roadmap || []);
        if (finalRoadmap.length === 0) throw new Error('No phases found');
        setRoadmap(finalRoadmap);
      } catch (parseErr) {
        console.error('JSON Parse Error:', parseErr, 'Raw Content:', cleaned);
        
        // Fallback: Try a less strict regex-based recovery if standard JSON parse fails
        try {
          // Look for patterns that look like { "id": ..., "title": ..., "desc": ... }
          const matches = cleaned.match(/\{[\s\S]*?\}(?=[\s,\]]|$)/g);
          if (matches && matches.length > 0) {
            const recovered = matches.map(m => {
              try { return JSON.parse(m); } catch (e) { return null; }
            }).filter(x => x && x.title);
            
            if (recovered.length > 0) {
              setRoadmap(recovered);
              return;
            }
          }
        } catch (recoverErr) {
          console.error('Recovery failed:', recoverErr);
        }
        
        throw new Error('AI format was unstable. Please try once more with a clearer role name.');
      }

    } catch (error) {
      console.error('Roadmap generation failed:', error);
      alert(error.message || 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
      setRoadmapText('');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-200 mb-2">Job Role Roadmap Generator</h1>
        <p className="text-gray-500">Enter your target role and get a structured execution plan.</p>
      </div>

      {/* Input Section */}
      <div className="glass-panel p-8 rounded-2xl mb-10 max-w-2xl mx-auto border border-white/10 shadow-xl">
        <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="e.g. Frontend Engineer, Data Scientist, SDE..."
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-medium text-white placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={isGenerating || !jobTitle.trim()}
            className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-red-500/30 flex items-center justify-center min-w-[160px]"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/5 border-t-white rounded-full animate-spin" />
                Planning...
              </span>
            ) : (
              'Generate Path'
            )}
          </button>
        </form>
        <div className="mt-4 flex gap-2 flex-wrap justify-center">
          {['Frontend Developer', 'Backend Engineer', 'Data Scientist', 'DevOps'].map(tag => (
            <button
              key={tag}
              onClick={() => setJobTitle(tag)}
              className="text-xs bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full font-medium hover:bg-red-500/30 transition-colors border border-red-500/20"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Streaming Content */}
      <AnimatePresence>
        {isGenerating && roadmapText && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-8 max-w-2xl mx-auto"
          >
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-4 text-xs font-bold text-red-400 uppercase tracking-widest">
                <Sparkles className="w-4 h-4 animate-pulse" />
                AI Planning in Progress...
              </div>
              <div className="text-gray-400 text-sm font-mono leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                {roadmapText}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roadmap Visualization */}
      <AnimatePresence>
        {roadmap && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative"
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-200">Your Path to <span className="text-red-500 capitalize">{currentJob}</span></h2>
              <p className="text-gray-500 mt-2">Estimated Time: {roadmap.length * 2} - {roadmap.length * 3} Weeks</p>
            </div>

            <div className="relative border-l-4 border-red-500/30 md:border-l-0 md:before:absolute md:before:border-l-4 md:before:border-red-500/30 md:before:h-full md:before:left-1/2 md:before:-ml-[2px] ml-4 md:ml-0 space-y-12 pb-12">
              {roadmap.map((step, index) => (
                <motion.div 
                  key={step.id}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.15 }}
                  className={`relative flex items-center ${index % 2 === 0 ? 'md:flex-row-reverse' : 'md:flex-row'} flex-col md:justify-center w-full clear-both`}
                >
                  {/* Timeline Dot */}
                  <div className="absolute left-[-11px] md:left-1/2 md:-ml-[12px] w-6 h-6 rounded-full bg-black border-4 border-red-500 z-10"></div>

                  {/* Content Box */}
                  <div className={`w-full md:w-[45%] ml-6 md:ml-0 ${index % 2 === 0 ? 'md:mr-auto md:pr-8 md:text-right' : 'md:ml-auto md:pl-8 text-left'}`}>
                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-white/20 transition-shadow relative group">
                      <div className={`absolute top-0 ${index % 2 === 0 ? 'right-0 rounded-tr-2xl rounded-bl-2xl' : 'left-0 rounded-tl-2xl rounded-br-2xl'} bg-red-500/20 text-red-400 px-4 py-1 text-xs font-bold`}>
                        Phase {index + 1}
                      </div>
                      <h3 className="text-xl font-bold text-gray-200 mt-4 mb-2 group-hover:text-red-500 transition-colors">{step.title}</h3>
                      <p className="text-gray-400 text-sm mb-4">{step.desc}</p>
                      
                      <div className={`flex items-center gap-4 ${index % 2 === 0 ? 'md:justify-end' : 'justify-start'}`}>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                          ⏳ {step.duration}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Completion Indicator */}
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: roadmap.length * 0.15 + 0.3 }}
              className="mt-8 flex justify-center"
            >
              <div className="bg-gradient-to-r from-red-600 to-red-800 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3">
                <span>🎯</span>
                Ready for Real Interviews!
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default JobRoadmap;
