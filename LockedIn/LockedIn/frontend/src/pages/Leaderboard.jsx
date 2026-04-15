import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const MOCK_LEADERBOARD = [
  { id: 1, name: 'Alex Johnson', department: 'C.S.E.', leetcode: 489, projects: 12, score: 9850 },
  { id: 2, name: 'Priya Sharma', department: 'C.S.E.', leetcode: 450, projects: 15, score: 9600 },
  { id: 3, name: 'Liam Hughes', department: 'E.C.E.', leetcode: 412, projects: 8, score: 9210 },
  { id: 4, name: 'Sophia Chen', department: 'C.S.E.', leetcode: 398, projects: 10, score: 8900 },
  { id: 5, name: 'Noah Smith', department: 'M.E.', leetcode: 360, projects: 5, score: 8500 },
  { id: 6, name: 'Emma Williams', department: 'C.S.E.', leetcode: 345, projects: 6, score: 8200 },
  { id: 7, name: 'Aiden Brown', department: 'E.E.E.', leetcode: 310, projects: 9, score: 7950 },
  { id: 8, name: 'Isabella Davis', department: 'C.S.E.', leetcode: 305, projects: 11, score: 7800 },
  { id: 9, name: 'Lucas Miller', department: 'C.S.E.', leetcode: 290, projects: 7, score: 7500 },
  { id: 10, name: 'Mia Wilson', department: 'I.T.', leetcode: 275, projects: 8, score: 7200 },
  { id: 11, name: 'Ethan Moore', department: 'C.S.E.', leetcode: 260, projects: 5, score: 6900 },
  { id: 12, name: 'Amelia Taylor', department: 'C.S.E.', leetcode: 245, projects: 6, score: 6600 },
  { id: 13, name: 'Oliver Anderson', department: 'E.C.E.', leetcode: 230, projects: 4, score: 6300 },
  { id: 14, name: 'Ava Thomas', department: 'C.S.E.', leetcode: 215, projects: 7, score: 6000 },
  { id: 15, name: 'Jackson Jackson', department: 'C.S.E.', leetcode: 200, projects: 5, score: 5700 },
  { id: 16, name: 'Harper White', department: 'I.T.', leetcode: 185, projects: 6, score: 5400 },
  { id: 17, name: 'Seb Harris', department: 'M.E.', leetcode: 170, projects: 3, score: 5100 },
  { id: 18, name: 'Evelyn Martin', department: 'C.S.E.', leetcode: 155, projects: 4, score: 4800 },
  { id: 19, name: 'Benjamin Thompson', department: 'C.S.E.', leetcode: 140, projects: 5, score: 4500 },
  { id: 20, name: 'Charlotte Garcia', department: 'E.C.E.', leetcode: 125, projects: 2, score: 4200 },
];

const Leaderboard = () => {
  const [students, setStudents] = useState([]);
  const [currentUserData, setCurrentUserData] = useState(null);

  useEffect(() => {
    // Simulate fetching data
    const localData = localStorage.getItem('student_data');
    let userName = 'You (Guest)';
    let userDept = 'C.S.E.';
    
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        userName = parsed.name || 'You';
        userDept = parsed.program || 'C.S.E.';
      } catch (e) {
        console.error('Could not parse local student data', e);
      }
    }

    // Insert current user into the mockup
    const userEntry = {
      id: 999,
      name: `${userName} (You)`,
      department: userDept,
      leetcode: 280,
      projects: 6,
      score: 7300,
      isCurrentUser: true,
    };

    const combined = [...MOCK_LEADERBOARD, userEntry].sort((a, b) => b.score - a.score);
    setStudents(combined);
    setCurrentUserData(userEntry);
  }, []);

  const getRankStyle = (rank) => {
    switch (rank) {
      case 1: return 'bg-yellow-900/30 text-yellow-500 border-yellow-700/50';
      case 2: return 'bg-gray-800/50 text-gray-300 border-white/20';
      case 3: return 'bg-orange-900/30 text-orange-500 border-orange-700/50';
      default: return 'text-gray-500 border-transparent';
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400 drop-shadow-sm">
            University Leaderboard
          </h1>
          <p className="text-gray-500 mt-2">See how you rank against your university peers.</p>
        </div>
        <div className="text-4xl">🏆</div>
      </div>

      <div className="glass-panel border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0b0b12] border-b border-white/10 uppercase text-xs font-semibold text-gray-500 tracking-wider">
                <th className="p-5 text-center w-20">Rank</th>
                <th className="p-5">Student</th>
                <th className="p-5 hidden md:table-cell">Department</th>
                <th className="p-5 text-center">LeetCode</th>
                <th className="p-5 text-center hidden sm:table-cell">Projects</th>
                <th className="p-5 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => {
                const rank = index + 1;
                const isUser = student.isCurrentUser;
                return (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`
                      border-b last:border-b-0 border-white/10 hover:bg-white/5 transition-colors
                      ${isUser ? 'bg-red-900/20 hover:bg-red-900/30 font-medium' : ''}
                    `}
                  >
                    <td className="p-5 text-center">
                      <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm border ${getRankStyle(rank)}`}>
                        {getRankIcon(rank)}
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] ${isUser ? 'bg-red-500' : 'bg-gray-800'}`}>
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className={`text-sm ${isUser ? 'text-red-400 font-bold' : 'text-gray-100'}`}>
                            {student.name}
                          </p>
                          <p className="text-xs text-gray-500 md:hidden">{student.department}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 hidden md:table-cell text-sm text-gray-400">
                      {student.department}
                    </td>
                    <td className="p-5 text-center">
                      <div className="inline-block px-3 py-1 bg-[#0b0b12] rounded-full text-xs font-semibold text-gray-300">
                        {student.leetcode}
                      </div>
                    </td>
                    <td className="p-5 text-center hidden sm:table-cell">
                      <div className="inline-block px-3 py-1 bg-[#0b0b12] rounded-full text-xs font-semibold text-gray-300">
                        {student.projects}
                      </div>
                    </td>
                    <td className="p-5 text-right font-bold text-gray-100">
                      {student.score.toLocaleString()}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
