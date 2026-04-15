import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { apiUrl } from '../services/api';
import { Sparkles, RefreshCw, BrainCircuit, Code, Database, Globe, Layers } from 'lucide-react';

const CATEGORIES = [
  { name: 'Data Structures', icon: <Layers size={18} /> },
  { name: 'Algorithms', icon: <Code size={18} /> },
  { name: 'System Design', icon: <Globe size={18} /> },
  { name: 'DBMS', icon: <Database size={18} /> },
];

const PlacementQuiz = () => {
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState('Medium');
  const [specificTopics, setSpecificTopics] = useState('');
  const [dynamicQuizzes, setDynamicQuizzes] = useState(() => {
    const saved = localStorage.getItem('lockedin_dynamic_quizzes');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('lockedin_dynamic_quizzes', JSON.stringify(dynamicQuizzes));
  }, [dynamicQuizzes]);

  const generateDynamicQuiz = async (category = 'Data Structures') => {
    setIsGenerating(true);
    try {
      const response = await axios.post(apiUrl('/api/quiz/generate'), {
        category,
        difficulty: selectedDifficulty,
        topics: specificTopics,
      });
      const newQuiz = { ...response.data, id: Date.now(), isAI: true };
      setDynamicQuizzes(prev => [newQuiz, ...prev].slice(0, 6));
      return newQuiz;
    } catch (error) {
      console.error('Quiz generation failed', error);
      alert('Failed to generate AI quiz. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const startQuiz = (quiz) => {
    setActiveQuiz(quiz);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setScore(0);
    setShowResults(false);
  };

  const handleAnswerSubmit = () => {
    if (selectedAnswer === activeQuiz.questions[currentQuestion].correct) {
      setScore(score + 1);
    }
    
    if (currentQuestion + 1 < activeQuiz.questions.length) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      setShowResults(true);
    }
  };

  const getDifficultyColor = (diff) => {
    switch(diff) {
      case 'Easy': return 'bg-emerald-500/20 text-emerald-400';
      case 'Medium': return 'bg-amber-500/20 text-amber-400';
      case 'Hard': return 'bg-red-500/20 text-red-400';
      default: return 'bg-white/5 text-gray-400';
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-2 text-gray-200 drop-shadow-sm">Placement Quiz 🧠</h1>
      <p className="text-gray-400 mb-8 font-medium">Test your knowledge across CS fundamentals, DSA, and System Design.</p>

      {!activeQuiz ? (
        <div className="space-y-8">
          {/* AI Generator Section */}
          <div className="glass-panel border border-red-500/20 bg-red-500/5 rounded-3xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <Sparkles size={120} className="text-red-500" />
            </div>
            <div className="relative z-10">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles size={20} className="text-red-400" /> AI Quiz Generator
              </h2>
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                <div className="flex-1 w-full">
                  <p className="text-gray-400 text-sm mt-1 mb-4">Select topic and difficulty to generate a unique quiz using Llama LLM.</p>
                  <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-fit mb-4">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Difficulty:</span>
                    <select 
                      value={selectedDifficulty}
                      onChange={(e) => setSelectedDifficulty(e.target.value)}
                      className="bg-transparent text-red-400 text-sm font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="Easy" className="bg-[#0b0b12]">Easy</option>
                      <option value="Medium" className="bg-[#0b0b12]">Medium</option>
                      <option value="Hard" className="bg-[#0b0b12]">Hard</option>
                    </select>
                  </div>

                  <div className="w-full max-w-2xl">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">
                      Specific Topics (Optional)
                    </label>
                    <input
                      type="text"
                      value={specificTopics}
                      onChange={(e) => setSpecificTopics(e.target.value)}
                      placeholder="e.g. Binary Trees, Dynamic Programming, SQL Joins"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Enter comma-separated topics to focus the generated quiz.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.name}
                    onClick={() => generateDynamicQuiz(cat.name)}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all font-medium text-sm disabled:opacity-50"
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
              
              {isGenerating && (
                <div className="mt-6 flex items-center gap-3 text-red-400 font-bold animate-pulse">
                  <RefreshCw className="animate-spin" size={18} />
                  <span>Llama is conceptualizing your questions...</span>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Recommended Quizzes</h2>
              <button 
                onClick={() => setDynamicQuizzes([])}
                className="text-sm text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={14} /> Reset List
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dynamicQuizzes.length > 0 ? dynamicQuizzes.map((quiz) => (
                <div key={quiz.id} className="bg-white/5 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 border border-white/10 group cursor-pointer relative" onClick={() => startQuiz(quiz)}>
                  {quiz.isAI && (
                    <span className="absolute top-4 right-4 text-red-500/40 group-hover:text-red-500/80 transition-colors">
                      <Sparkles size={16} />
                    </span>
                  )}
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${getDifficultyColor(quiz.difficulty)} mb-4 inline-block`}>
                    {quiz.difficulty}
                  </span>
                  <h3 className="text-xl font-bold text-gray-200 mb-2 group-hover:text-red-500 transition-colors">{quiz.title}</h3>
                  <p className="text-sm text-gray-500 mb-4">{quiz.category}</p>
                  <div className="flex items-center justify-between text-sm font-medium text-gray-400">
                    <span>{quiz.questions.length} Questions</span>
                    <span className="text-red-500 group-hover:translate-x-1 transition-transform">Start →</span>
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-12 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl">
                  <p className="text-gray-500">No quizzes generated yet. Use the generator above to start!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : showResults ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 rounded-2xl p-10 text-center max-w-xl mx-auto border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-purple-500"></div>
          <h2 className="text-3xl font-bold mb-4 text-gray-200">Quiz Completed!</h2>
          <div className="w-32 h-32 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center mb-6 border-4 border-blue-500/20">
            <span className="text-4xl font-extrabold text-blue-400">
              {score}/{activeQuiz.questions.length}
            </span>
          </div>
          <p className="text-lg text-gray-400 mb-8 font-medium">
            {score === activeQuiz.questions.length ? 'Perfect score! Placement ready! 🎉' : 
             score > activeQuiz.questions.length / 2 ? 'Great job! Keep practicing! 💪' : 
             'Needs review. Time to hit the books! 📚'}
          </p>
          <button onClick={() => setActiveQuiz(null)} className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all border border-white/10">
            Back to Quizzes
          </button>
        </motion.div>
      ) : (
        <motion.div key={currentQuestion} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white/5 rounded-2xl p-8 max-w-2xl mx-auto border border-white/10 relative overflow-hidden">
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-white/10">
            <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${((currentQuestion) / activeQuiz.questions.length) * 100}%` }}></div>
          </div>
          
          <div className="mb-8 mt-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Question {currentQuestion + 1} of {activeQuiz.questions.length}</span>
            <h2 className="text-2xl font-bold text-gray-200 mt-2">{activeQuiz.questions[currentQuestion].question}</h2>
          </div>

          <div className="space-y-3 mb-8">
            {activeQuiz.questions[currentQuestion].options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedAnswer(idx)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all font-medium ${
                  selectedAnswer === idx 
                    ? 'border-red-500 bg-red-500/10 text-red-400' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-white/10">
            <button
              onClick={handleAnswerSubmit}
              disabled={selectedAnswer === null}
              className={`px-8 py-3 rounded-xl font-bold transition-all ${
                selectedAnswer !== null 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-white/5 text-gray-500 cursor-not-allowed'
              }`}
            >
              {currentQuestion + 1 === activeQuiz.questions.length ? 'Finish Quiz' : 'Next Question'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PlacementQuiz;