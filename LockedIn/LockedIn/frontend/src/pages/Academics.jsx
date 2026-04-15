import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  BookOpen, 
  Award, 
  Clock, 
  Percent,
  ChevronRight,
  GraduationCap
} from 'lucide-react';

const Academics = ({ studentData, fetchUpdatedData, isSyncing }) => {
  const attendance = studentData?.attendance || [];
  const marks = studentData?.marks || [];

  if (!attendance.length && !marks.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10">
          <GraduationCap size={40} className="text-gray-600" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">No Academic Records Yet</h2>
        <p className="text-gray-500 max-w-md mb-6">
          Connect your SRM account to fetch your real-time attendance and marks.
        </p>
        <button 
          onClick={() => fetchUpdatedData(true)}
          disabled={isSyncing}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <GraduationCap className="text-red-500" /> Academic Overview
          </h1>
          <p className="text-gray-500 mt-1">Real-time performance tracking and attendance analysis.</p>
        </div>
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Live Sync Active</span>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 border border-white/10 p-5 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-2">
             <span className="text-xs font-medium text-gray-500 uppercase">Avg Attendance</span>
             <Percent size={14} className="text-blue-400" />
          </div>
          <div className="flex items-end gap-2">
            <h3 className="text-3xl font-bold text-white">
              {(attendance.reduce((acc, curr) => acc + parseFloat(curr.attendancePercentage), 0) / (attendance.length || 1)).toFixed(1)}%
            </h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 border border-white/10 p-5 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-2">
             <span className="text-xs font-medium text-gray-500 uppercase">Courses Logged</span>
             <BookOpen size={14} className="text-purple-400" />
          </div>
          <h3 className="text-3xl font-bold text-white">{attendance.length}</h3>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 p-5 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-2">
             <span className="text-xs font-medium text-gray-500 uppercase">Classes Missed</span>
             <AlertCircle size={14} className="text-red-400" />
          </div>
          <h3 className="text-3xl font-bold text-white">
            {attendance.reduce((acc, curr) => acc + parseInt(curr.hoursAbsent), 0)}
          </h3>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 border border-white/10 p-5 rounded-2xl"
        >
          <div className="flex items-center justify-between mb-2">
             <span className="text-xs font-medium text-gray-500 uppercase">Best Mark</span>
             <Award size={14} className="text-yellow-400" />
          </div>
          <h3 className="text-3xl font-bold text-white">
            {marks.length > 0 ? Math.max(...marks.map(m => m.total?.obtained || 0)) : '--'}
          </h3>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Detailed Attendance */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 px-1">
            <CheckCircle2 className="text-emerald-500" size={20} /> Attendance Detailed Report
          </h2>
          <div className="space-y-4">
            {attendance.map((course, idx) => {
              const pct = parseFloat(course.attendancePercentage);
              const isSafe = pct >= 75;
              const total = parseInt(course.hoursConducted);
              const absent = parseInt(course.hoursAbsent);
              const present = total - absent;

              // Classes to attend to hit 75%: solve (present + x) / (total + x) >= 0.75
              // present + x >= 0.75 * total + 0.75x → 0.25x >= 0.75 * total - present → x >= 3 * total - 4 * present
              const classesToAttend = Math.max(0, Math.ceil(3 * total - 4 * present));

              // Classes can miss while staying at 75%: solve present / (total + x) >= 0.75
              // present >= 0.75 * (total + x) → x <= present / 0.75 - total
              const canMiss = Math.max(0, Math.floor(present / 0.75 - total));

              return (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="max-w-[70%]">
                      <h4 className="text-white font-semibold line-clamp-1">{course.courseTitle}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {course.courseCode} · {course.slot}
                        {course.slotType === 'Practical' && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Lab</span>}
                      </p>
                    </div>
                    <div className={`text-xl font-bold ${isSafe ? 'text-emerald-400' : 'text-red-400'}`}>
                      {course.attendancePercentage}%
                    </div>
                  </div>
                  
                  <div className="w-full bg-white/5 rounded-full h-1.5 mb-4 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${course.attendancePercentage}%` }}
                      className={`h-full rounded-full ${isSafe ? 'bg-emerald-500' : 'bg-red-500'}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider">
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Clock size={10} /> {course.hoursConducted} Conducted
                      </span>
                      <span className="text-gray-500 flex items-center gap-1">
                        <AlertCircle size={10} className="text-red-400/50" /> {course.hoursAbsent} Absent
                      </span>
                    </div>
                    {isSafe ? (
                      <span className="text-emerald-500/70 italic text-[10px]">
                        Can miss {canMiss} more {canMiss === 1 ? 'class' : 'classes'}
                      </span>
                    ) : (
                      <span className="text-red-500/70 italic text-[10px]">
                        Attend {classesToAttend} {classesToAttend === 1 ? 'class' : 'classes'} to hit 75%
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Detailed Marks */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 px-1">
            <TrendingUp className="text-blue-500" size={20} /> Marks & Assessments
          </h2>
          <div className="space-y-4">
             {marks.map((record, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition-all"
                >
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/5">
                    <div>
                      <h4 className="text-white font-bold">{record.course}</h4>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">{record.category}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-blue-400">{record.total?.obtained} / {record.total?.maxMark}</div>
                      <p className="text-[10px] text-gray-500 uppercase font-medium">Internal Total</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(record.marks || record.exams || []).map((exam, eIdx) => (
                      <div key={eIdx} className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-300 font-medium">{exam.exam}</span>
                          <span className="text-white font-bold">{exam.obtained} / {exam.maxMark}</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1">
                          <div 
                            className="h-full bg-blue-500/50 rounded-full" 
                            style={{ width: `${(exam.obtained / exam.maxMark) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Academics;
