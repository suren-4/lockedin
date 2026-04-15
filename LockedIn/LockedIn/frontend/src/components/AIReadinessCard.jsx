import React, { useState, useEffect } from 'react';
import { apiUrl } from '../services/api';
import { BrainCircuit, TrendingUp, AlertTriangle } from 'lucide-react';

const AIReadinessCard = ({ studentData }) => {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        // Calculate average attendance
        const attendanceList = studentData?.attendance || [];
        const avgAttendance = attendanceList.length > 0 
          ? attendanceList.reduce((acc, curr) => acc + parseFloat(curr.attendancePercentage || 0), 0) / attendanceList.length
          : 0;
        
        // Count study hours (mock estimation based on timetable classes)
        const timetable = studentData?.timetable || [];
        const studyHours = timetable.length * 4; // 4 hours per class per week estimate

        // Mock LeetCode data until integrated dynamically across the app if needed
        // Since LeetCodeStats handles its own fetch, we'll use placeholder values typical for the student
        const lc_easy = 150;
        const lc_medium = 50;
        const lc_hard = 10;

        const response = await fetch(apiUrl('/api/ml/predict-readiness'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            attendance: avgAttendance || 75,
            lc_easy,
            lc_medium,
            lc_hard,
            study_hours: studyHours || 15
          })
        });

        if (response.ok) {
          const data = await response.json();
          setPrediction(data);
        }
      } catch (error) {
        console.error("ML Prediction fetch error", error);
      } finally {
        setLoading(false);
      }
    };

    if (studentData && !loading) {
        // Debounce if needed, but for now fetch once on mount with data
    }
    fetchPrediction();
  }, [studentData]);

  if (loading) {
    return (
      <div className="bg-white/5 p-6 rounded-xl border border-white/10 animate-pulse">
        <div className="h-6 w-1/2 bg-white/10 rounded mb-4"></div>
        <div className="h-10 w-1/3 bg-white/20 rounded"></div>
      </div>
    );
  }

  const score = prediction?.readiness_score || 0;
  let statusColor = score >= 75 ? 'text-emerald-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
  let badgeClass = score >= 75 ? 'bg-emerald-500/20 border-emerald-500/30' : score >= 50 ? 'bg-yellow-500/20 border-yellow-500/30' : 'bg-red-500/20 border-red-500/30';
  
  return (
    <div className="bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-black p-6 rounded-xl border border-white/10 relative overflow-hidden transition-all hover:border-purple-500/30 group">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none"></div>
      
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <BrainCircuit className="text-purple-400" size={24} />
          AI Placement Readiness
        </h2>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 flex items-center gap-1 border rounded-md ${badgeClass} ${statusColor}`}>
          Model Output
        </span>
      </div>

      <div className="flex items-end gap-3 mb-4">
        <span className={`text-5xl font-extrabold tracking-tighter ${statusColor}`}>
          {score.toFixed(1)}
        </span>
        <span className="text-gray-400 font-medium mb-1">/ 100</span>
      </div>

      <div className="w-full bg-white/5 rounded-full h-2.5 mb-4 overflow-hidden">
        <div 
          className={`h-2.5 rounded-full transition-all duration-1000 ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
          style={{ width: `${score}%` }}
        ></div>
      </div>

      <div className="mt-4 p-3 bg-black/30 rounded-lg border border-white/5">
        <h3 className="text-xs uppercase text-gray-500 font-bold mb-2 flex items-center gap-1">
          {score >= 75 ? <TrendingUp size={14} className="text-emerald-400" /> : <AlertTriangle size={14} className="text-yellow-400" />}
          AI Insights
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          {score >= 75 
            ? "Your current academic workload and continuous practice put you in the top percentile! Keep practicing LeetCode Mediums."
            : score >= 50
              ? "You are on track but could improve focus. Try balancing your practical hours with dedicated LeetCode Hard grinds."
              : "Warning: Your placement readiness is slipping. You must dramatically increase your attendance and start coding regularly."}
        </p>
      </div>
    </div>
  );
};

export default AIReadinessCard;
