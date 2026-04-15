import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { apiUrl } from '../services/api';

const LeetCodeStats = () => {
  const [dailyProblem, setDailyProblem] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [totalCounts, setTotalCounts] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [username, setUsername] = useState(localStorage.getItem('leetcode_username') || '');
  const [tempUsername, setTempUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (username) {
      fetchData();
    }
  }, [username]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [dailyRes, statsRes] = await Promise.all([
        axios.get(apiUrl('/api/leetcode/daily')),
        axios.get(apiUrl(`/api/leetcode/user/${username}`))
      ]);
      
      setDailyProblem(dailyRes.data);
      setUserStats(statsRes.data.stats);
      setTotalCounts(statsRes.data.totalCounts);
      setRanking(statsRes.data.ranking);
      
      // Persist for AI Assistant context
      localStorage.setItem('leetcode_stats', JSON.stringify({
        stats: statsRes.data.stats,
        totalCounts: statsRes.data.totalCounts,
        ranking: statsRes.data.ranking,
        lastUpdated: new Date().toISOString()
      }));
    } catch (err) {
      console.error("Error fetching LeetCode data", err);
      setError(err.response?.data?.error || 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  };

  const handleSetUsername = (e) => {
    e.preventDefault();
    if (tempUsername.trim()) {
      localStorage.setItem('leetcode_username', tempUsername.trim());
      setUsername(tempUsername.trim());
    }
  };

  if (!username) {
    return (
      <div className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl text-orange-500 font-bold">L</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Connect LeetCode</h2>
        <p className="text-gray-400 text-sm mb-6 max-w-xs">Enter your username to track your coding progress and see daily challenges.</p>
        <form onSubmit={handleSetUsername} className="w-full max-w-sm flex gap-2">
          <input
            type="text"
            placeholder="Username"
            value={tempUsername}
            onChange={(e) => setTempUsername(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/50 text-white transition-all"
          />
          <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20 active:scale-95">
            Connect
          </button>
        </form>
      </div>
    );
  }

  if (loading) return <div className="animate-pulse bg-white/5 h-[340px] rounded-2xl border border-white/10"></div>;

  const totalSolved = userStats?.All || 0;
  const totalAll = totalCounts?.All || 3800;
  const percentage = Math.round((totalSolved / totalAll) * 100);

  return (
    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:border-white/20 transition-all group">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
            <span className="text-orange-500 font-bold">L</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">LeetCode Analytics</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-gray-500 font-medium">{username}</p>
              {ranking && (
                <span className="text-[10px] bg-white/5 text-gray-400 px-1.5 py-0.5 rounded border border-white/10 font-mono">
                  Rank: #{ranking.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <button 
          onClick={() => {
            localStorage.removeItem('leetcode_username');
            setUsername('');
          }}
          className="text-[10px] text-gray-500 hover:text-red-400 uppercase tracking-widest font-bold transition-colors"
        >
          Change User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Progress Circle */}
        <div className="flex flex-col items-center justify-center p-4 bg-white/3 rounded-2xl border border-white/5">
          <div className="relative w-32 h-32 mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64" cy="64" r="58"
                strokeWidth="8" stroke="currentColor"
                fill="transparent"
                className="text-white/5"
              />
              <circle
                cx="64" cy="64" r="58"
                strokeWidth="8" stroke="currentColor"
                strokeDasharray={364}
                strokeDashoffset={364 - (364 * percentage) / 100}
                strokeLinecap="round"
                fill="transparent"
                className="text-orange-500 transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-white">{totalSolved}</span>
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Solved</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Attempting</p>
            <p className="text-sm font-medium text-white">1 Attempting</p>
          </div>
        </div>

        {/* Right: Difficulty Breakdown */}
        <div className="space-y-4 flex flex-col justify-center">
          {[
            { label: 'Easy', color: 'bg-green-500', solved: userStats?.Easy, total: totalCounts?.Easy, text: 'text-green-400' },
            { label: 'Med.', color: 'bg-yellow-500', solved: userStats?.Medium, total: totalCounts?.Medium, text: 'text-yellow-400' },
            { label: 'Hard', color: 'bg-red-500', solved: userStats?.Hard, total: totalCounts?.Hard, text: 'text-red-400' },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">{item.label}</span>
                <span className="text-xs font-medium text-white">
                  <span className={item.text}>{item.solved || 0}</span>
                  <span className="text-gray-500">/{item.total || 0}</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(((item.solved || 0) / (item.total || 1)) * 100, 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full ${item.color} rounded-full`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer: Daily Challenge Link */}
      {dailyProblem && (
        <a 
          href={dailyProblem.url} 
          target="_blank" 
          rel="noreferrer"
          className="mt-6 flex items-center justify-between p-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-xl transition-all group/link"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🔥</span>
            <div>
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Daily Challenge</p>
              <p className="text-sm font-bold text-white line-clamp-1">{dailyProblem.title}</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-orange-500 transform group-hover/link:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </a>
      )}
      
      {error && <p className="mt-4 text-xs text-red-400 text-center font-medium bg-red-500/5 p-2 rounded-lg border border-red-500/10">⚠️ {error}</p>}
    </div>
  );
};

export default LeetCodeStats;
