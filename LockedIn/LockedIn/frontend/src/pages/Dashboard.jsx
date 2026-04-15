import React from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import LeetCodeStats from '../components/LeetCodeStats';
import AIChatbot from '../components/AIChatbot';
import { apiUrl } from '../services/api';
import AIReadinessCard from '../components/AIReadinessCard';

import Activities from './Activities';
import PlacementPlan from './PlacementPlan';
import PlacementQuiz from './PlacementQuiz';
import JobRoadmap from './JobRoadmap';
import JobTracker from './JobTracker';
import Trending from './Trending';
import Leaderboard from './Leaderboard';
import StudyRoom from './StudyRoom';
import MockInterviewer from './MockInterviewer';
import Academics from './Academics';
import SmartReminder from '../components/SmartReminder';
import { 
  LayoutDashboard, 
  Calendar, 
  PenTool, 
  Rocket, 
  BrainCircuit, 
  Map, 
  Briefcase, 
  TrendingUp, 
  Trophy, 
  Users, 
  Mic,
  LogOut,
  GraduationCap
} from 'lucide-react';

const getTodayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });

const isCurrentClass = (timeStr) => {
  if (!timeStr) return false;
  const parts = timeStr.split(' - ');
  if (parts.length !== 2) return false;
  const parseToMins = (t) => {
    let [h, m] = t.split(':').map(Number);
    if (h >= 1 && h <= 7) h += 12;
    return h * 60 + m;
  };
  const startMins = parseToMins(parts[0]);
  const endMins = parseToMins(parts[1]);
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  return currentMins >= startMins && currentMins <= endMins;
};

// ═══════════════════════════════════════════════════════════════════════
// Dashboard Overview
// ═══════════════════════════════════════════════════════════════════════
const DashboardOverview = ({ studentData, fetchUpdatedData, isSyncing }) => {
  const [loginMessage, setLoginMessage] = React.useState('');
  const [attendance, setAttendance] = React.useState([]);
  const [marks, setMarks] = React.useState([]);

  React.useEffect(() => {
    if (studentData) {
      if (studentData.attendance?.length) setAttendance(studentData.attendance);
      if (studentData.marks?.length) setMarks(studentData.marks);
    }
    setLoginMessage(localStorage.getItem('login_status_message') || '');
  }, [studentData]);

  const timetable = studentData?.timetable || [];
  const today = getTodayName();
  const currentDayOrder = studentData?.currentDayOrder || null;
  const todayClasses = timetable.filter(c => c.day === today);
  const uniqueSubjects = [...new Set(timetable.map(c => c.subject))].length;
  const dataSource = studentData?.data_source;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2 text-white">
        {studentData?.name ? `Hey, ${studentData.name}!` : 'Student Dashboard'}
      </h1>
      {studentData?.regNumber && (
        <p className="text-gray-500 text-sm mb-4">
          {studentData.regNumber}{studentData.batch ? ` · Batch ${studentData.batch}` : ''}
          {currentDayOrder && (
            <>
              {' · '}
              <span className="text-blue-400 font-semibold">Today: {currentDayOrder}</span>
            </>
          )}
        </p>
      )}

      {loginMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
        >
          {dataSource === 'live' && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />}
          {loginMessage}
          {dataSource === 'live' && <span className="ml-auto text-xs opacity-70">Authenticated Session</span>}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 p-6 rounded-3xl border border-white/10 transition-all hover:border-blue-500/50 hover:bg-white/10 group shadow-xl"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-gray-400 text-sm font-medium">Classes Today</h3>
              <p className="text-5xl font-extrabold mt-2 text-blue-400 tracking-tight">{todayClasses.length}</p>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:scale-110 transition-transform">
              <Calendar size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            {today} Schedule
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 p-6 rounded-3xl border border-white/10 transition-all hover:border-purple-500/50 hover:bg-white/10 group shadow-xl"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-gray-400 text-sm font-medium">Total Subjects</h3>
              <p className="text-5xl font-extrabold mt-2 text-purple-400 tracking-tight">{uniqueSubjects}</p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-400 group-hover:scale-110 transition-transform">
              <GraduationCap size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Active Enrollment
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 p-6 rounded-3xl border border-white/10 transition-all hover:border-orange-500/50 hover:bg-white/10 group shadow-xl"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-gray-400 text-sm font-medium">LeetCode Streak</h3>
              <p className="text-5xl font-extrabold mt-2 text-orange-400 tracking-tight font-display">12 🔥</p>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-400 group-hover:scale-110 transition-transform">
              <Trophy size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            Top 5% of Students
          </p>
        </motion.div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-6">
          <div className="bg-white/5 p-6 rounded-xl border border-white/10">
            <h2 className="text-xl font-bold mb-4 text-white">Classes Today ({today})</h2>
            <div className="space-y-3">
              {todayClasses.length > 0 ? todayClasses.map((c, i) => {
                const isActive = isCurrentClass(c.time);
                const isLab = c.slotType === 'Practical' ||
                              c.type === 'lab' ||
                              c.courseType?.toLowerCase().includes('lab') ||
                              c.courseType?.toLowerCase().includes('practical') ||
                              c.subject?.toLowerCase().includes('lab');

                // Find attendance for this subject - match by courseCode and slot type
                const att = attendance.find(a => {
                  if (a.courseCode !== c.courseCode) return false;
                  // Match slot type (both have slotType from server)
                  if (a.slotType && c.slotType) return a.slotType === c.slotType;
                  const attIsLab = a.slotType === 'Practical' || a.slot?.startsWith('P');
                  return attIsLab === isLab;
                }) || attendance.find(a => a.courseCode === c.courseCode);
                return (
                  <div key={i} className={`flex items-center justify-between p-4 rounded-lg transform transition-all duration-300 ${
                    isActive
                      ? 'bg-red-500/10 border border-red-500/30 scale-[1.02]'
                      : isLab
                        ? 'bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/15'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}>
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold truncate ${isActive ? 'text-red-400' : isLab ? 'text-purple-300' : 'text-white'}`}>{c.subject}</p>
                        {isLab && !isActive && (
                          <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">Lab</span>
                        )}
                        {isActive && <span className="flex-shrink-0 flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>}
                      </div>
                      <p className={`text-sm ${isActive ? 'text-red-400 font-medium' : 'text-gray-500'}`}>{c.time} {isActive && '(Ongoing)'}</p>
                      {att && (
                        <p className={`text-xs mt-1 font-medium ${
                          parseFloat(att.attendancePercentage) < 75 ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          Attendance: {att.attendancePercentage}%
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        isActive ? 'bg-red-500/20 text-red-400' : isLab ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>{c.room || 'TBD'}</p>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 mb-4 text-sm font-medium">No classes scheduled or data missing.</p>
                  <button 
                    onClick={() => fetchUpdatedData(true)}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                  >
                    {isSyncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                </div>
              )}
            </div>
          </div>
          <SmartReminder timetable={timetable} />
        </div>
        <div className="flex flex-col gap-6">
          <AIReadinessCard studentData={studentData} />
          <LeetCodeStats />
          {attendance.length > 0 && (
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                Attendance Overview
                <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Live</span>
              </h2>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {attendance.map((a, i) => {
                  const pct = parseFloat(a.attendancePercentage);
                  const safe = pct >= 75;
                  return (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {a.courseTitle}
                          {a.slotType === 'Practical' && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded align-middle">Lab</span>}
                        </p>
                        <p className="text-xs text-gray-500">{a.hoursConducted} conducted · {a.hoursAbsent} absent</p>
                      </div>
                      <div className={`flex-shrink-0 text-sm font-bold px-2 py-1 rounded-full ${
                        safe ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {a.attendancePercentage}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {marks && marks.length > 0 && (
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                Marks Overview
                <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Live</span>
              </h2>
              <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                {marks.map((m, i) => {
                  const exams = Array.isArray(m.marks) ? m.marks : (m.exams || []);
                  return (
                    <div key={i} className="flex flex-col gap-1 border-b border-white/10 pb-3 last:border-0 last:pb-0">
                      <p className="text-sm font-medium text-white line-clamp-1" title={m.course}>{m.course}</p>
                      {m.category && <p className="text-xs text-gray-500">{m.category}</p>}
                      <div className="flex justify-between items-end gap-3">
                        <div className="text-xs text-gray-400 max-w-[70%]">
                          {exams.map(e => `${e.exam}: ${e.obtained}/${e.maxMark}`).join(' · ')}
                        </div>
                        <div className="flex-shrink-0 text-sm font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                          {m.total?.obtained} / {m.total?.maxMark}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Full Week Timetable View
// ═══════════════════════════════════════════════════════════════════════
const Timetable = ({ studentData, fetchUpdatedData, isSyncing }) => {
  const [timetable, setTimetable] = React.useState([]);
  const [attendance, setAttendance] = React.useState([]);

  React.useEffect(() => {
    if (studentData) {
      setTimetable(studentData.timetable || []);
      if (studentData.attendance?.length) setAttendance(studentData.attendance);
    }
  }, [studentData]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const today = getTodayName();
  const currentDayOrder = studentData?.currentDayOrder || null;
  const hasTimetable = days.some(day => timetable.some(item => item.day === day));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">My Timetable</h1>
        {currentDayOrder && (
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl">
            <span className="text-sm font-medium text-gray-400">Today:</span>
            <span className="text-lg font-bold text-blue-400">{currentDayOrder}</span>
          </div>
        )}
      </div>

      {!hasTimetable && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-10 flex flex-col items-center justify-center text-center">
          <Calendar size={48} className="text-gray-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No Timetable Data</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm">
            We couldn't find your timetable. This can happen if the SRM session expired or the initial fetch failed.
          </p>
          <button 
            onClick={() => fetchUpdatedData(true)}
            disabled={isSyncing}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {days.map(day => {
        const classes = timetable.filter(c => c.day === day);
        if (classes.length === 0) return null;

        const dayOrder = classes[0]?.dayOrder || '';
        const isToday = currentDayOrder && dayOrder === currentDayOrder;

        return (
          <div key={day} className="mb-6">
            <h2 className={`text-lg font-bold mb-3 flex items-center gap-2 ${
              isToday ? 'text-red-400' : 'text-gray-300'
            }`}>
              {isToday && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
              <span className={isToday ? 'text-red-400' : 'text-blue-400'}>
                {dayOrder || day}
              </span>
              {isToday && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium ml-2">Today</span>}
            </h2>
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="w-[140px] px-4 py-3 text-xs font-bold text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Subject</th>
                    <th className="w-[80px] px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">Type</th>
                    <th className="w-[100px] px-4 py-3 text-xs font-bold text-gray-500 uppercase">Room</th>
                    {attendance.length > 0 && <th className="w-[100px] px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">Attendance</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {classes.map((item, idx) => {
                    const isLab = item.slotType === 'Practical' ||
                                  item.type === 'lab' ||
                                  item.courseType?.toLowerCase().includes('lab') ||
                                  item.courseType?.toLowerCase().includes('practical') ||
                                  item.subject?.toLowerCase().includes('lab');

                    // Find attendance - match by courseCode and slot type for accuracy
                    const att = attendance.find(a => {
                      if (a.courseCode !== item.courseCode) return false;
                      if (a.slotType && item.slotType) return a.slotType === item.slotType;
                      const attIsLab = a.slotType === 'Practical' || a.slot?.startsWith('P');
                      return attIsLab === isLab;
                    }) || attendance.find(a => a.courseCode === item.courseCode);

                    const pct = att ? parseFloat(att.attendancePercentage) : null;
                    return (
                      <tr key={idx} className={`transition-colors ${isLab ? 'bg-purple-500/5 hover:bg-purple-500/10' : 'hover:bg-white/5'}`}>
                        <td className="px-4 py-3 text-sm text-gray-400 font-mono whitespace-nowrap">{item.time}</td>
                        <td className={`px-4 py-3 text-sm font-medium truncate ${isLab ? 'text-purple-300' : 'text-white'}`}>{item.subject}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          {isLab ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Lab</span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Theory</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.room || 'TBD'}</td>
                        {attendance.length > 0 && (
                          <td className="px-4 py-3 text-sm text-center">
                            {pct !== null ? (
                              <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                                pct < 75 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>{att.attendancePercentage}%</span>
                            ) : <span className="text-gray-600">—</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Dashboard Shell (sidebar + routes)
// ═══════════════════════════════════════════════════════════════════════
const navItems = [
  { to: '/dashboard',            icon: <LayoutDashboard size={20} strokeWidth={1.5} />, label: 'Overview' },
  { to: '/dashboard/academics',  icon: <GraduationCap size={20} strokeWidth={1.5} />, label: 'Academic Records' },
  { to: '/dashboard/timetable',  icon: <Calendar size={20} strokeWidth={1.5} />, label: 'Timetable' },
  { to: '/dashboard/activities', icon: <PenTool size={20} strokeWidth={1.5} />, label: 'Activities' },
  { to: '/dashboard/placement',  icon: <Rocket size={20} strokeWidth={1.5} />, label: 'Placement Plan' },
  { to: '/dashboard/quiz',       icon: <BrainCircuit size={20} strokeWidth={1.5} />, label: 'Placement Quiz' },
  { to: '/dashboard/roadmap',    icon: <Map size={20} strokeWidth={1.5} />, label: 'Job Roadmap' },
  { to: '/dashboard/tracker',    icon: <Briefcase size={20} strokeWidth={1.5} />, label: 'Job Tracker' },
  { to: '/dashboard/mock-interview', icon: <Mic size={20} strokeWidth={1.5} />, label: 'Mock Interview' },
  { to: '/dashboard/trending',   icon: <TrendingUp size={20} strokeWidth={1.5} />, label: 'Trending' },
  { to: '/dashboard/leaderboard',icon: <Trophy size={20} strokeWidth={1.5} />, label: 'Leaderboard' },
  { to: '/dashboard/study-room', icon: <Users size={20} strokeWidth={1.5} />, label: 'Study Room' },
];

const Dashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [studentData, setStudentData] = React.useState(null);
  const [lastSynced, setLastSynced] = React.useState(null);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const fetchUpdatedData = React.useCallback(async (forceDeep = false) => {
    const token = localStorage.getItem('token');
    const creds = localStorage.getItem('creds');
    if (!token && !creds) return;

    setIsSyncing(true);
    try {
      let tt, att, marks, profile;

      // Try fast fetch first if not forced
      if (!forceDeep && token) {
        const [ttRes, attRes, marksRes, userInfoRes] = await Promise.all([
          fetch(apiUrl('/api/timetable'), { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(apiUrl('/api/attendance'), { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(apiUrl('/api/marks'), { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(apiUrl('/api/userinfo'), { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        // If any of these are 502 (Bad Gateway), it usually means the cookie expired
        if (ttRes.status === 502 || attRes.status === 502 || marksRes.status === 502 || userInfoRes.status === 502) {
          if (creds) return fetchUpdatedData(true); // Retry with deep sync
        }

        tt = ttRes.ok ? await ttRes.json() : null;
        att = attRes.ok ? await attRes.json() : null;
        marks = marksRes.ok ? await marksRes.json() : null;
        const userInfoData = userInfoRes.ok ? await userInfoRes.json() : null;
        const fallbackProfile = tt ? {
          branch: tt.branch,
          program: tt.program,
          department: tt.department,
          section: tt.section,
          semester: tt.semester,
          name: tt.name,
          batch: tt.batch,
          regNumber: tt.regNumber,
        } : null;

        profile = userInfoData?.userInfo ? {
          branch: userInfoData.userInfo.branch || fallbackProfile?.branch,
          program: userInfoData.userInfo.program || fallbackProfile?.program,
          department: userInfoData.userInfo.department || fallbackProfile?.department,
          section: userInfoData.userInfo.section || fallbackProfile?.section,
          semester: userInfoData.userInfo.semester || fallbackProfile?.semester,
          name: userInfoData.userInfo.name || fallbackProfile?.name,
          batch: userInfoData.userInfo.batch || fallbackProfile?.batch,
          regNumber: userInfoData.userInfo.regNumber || fallbackProfile?.regNumber,
        } : fallbackProfile;
      } else if (creds) {
        // Deep sync via Puppeteer (slow but reliable)
        const response = await fetch(apiUrl('/api/auth/sync'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: creds
        });
        if (response.ok) {
          const data = await response.json();
          tt = { timetable: data.student_data.timetable, currentDayOrder: data.student_data.currentDayOrder };
          att = { attendance: data.student_data.attendance };
          marks = { marks: data.student_data.marks };
          profile = {
            branch: data.student_data.branch,
            program: data.student_data.program,
            department: data.student_data.department,
            section: data.student_data.section,
            semester: data.student_data.semester,
            name: data.student_data.name,
            batch: data.student_data.batch,
            regNumber: data.student_data.regNumber,
          };
          localStorage.setItem('token', data.token); // Save new token
        }
      }

      setStudentData(prev => {
        const newData = {
          ...prev,
          timetable: tt?.timetable || prev?.timetable || [],
          attendance: att?.attendance || prev?.attendance || [],
          marks: marks?.marks || prev?.marks || [],
          currentDayOrder: tt?.currentDayOrder || prev?.currentDayOrder || null,
          branch: profile?.branch || prev?.branch || '',
          program: profile?.program || prev?.program || '',
          department: profile?.department || prev?.department || '',
          section: profile?.section || prev?.section || '',
          semester: profile?.semester || prev?.semester || '',
          name: profile?.name || prev?.name || '',
          batch: profile?.batch || prev?.batch || '',
          regNumber: profile?.regNumber || prev?.regNumber || '',
          data_source: 'live'
        };
        localStorage.setItem('student_data', JSON.stringify(newData));
        return newData;
      });
      setLastSynced(new Date());
    } catch (err) {
      console.error('Auto-sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  React.useEffect(() => {
    const data = localStorage.getItem('student_data');
    if (data) {
      setStudentData(JSON.parse(data));
      setLastSynced(new Date());
    }

    // Initial sync
    fetchUpdatedData();

    // Set up 2-minute interval
    const interval = setInterval(fetchUpdatedData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchUpdatedData]);

  const handleSignOut = () => {
    localStorage.removeItem('student_data');
    localStorage.removeItem('token');
    localStorage.removeItem('login_status_message');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-transparent">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-white/3 backdrop-blur-md border-r border-white/10 flex flex-col z-20 transition-all duration-300 relative`}>
        <div className={`p-6 border-b border-white/10 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {isSidebarOpen ? (
            <div className="font-bold text-2xl tracking-tighter text-white">Locked<span className="text-red-500">In</span></div>
          ) : (
            <div className="font-bold text-2xl tracking-tighter text-red-500">L</div>
          )}
          
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-1.5 rounded-lg hover:bg-white/10 text-gray-400 transition-colors z-50 ${!isSidebarOpen ? 'absolute -right-3 top-7 bg-black border border-white/20 rounded-full w-7 h-7 flex items-center justify-center' : ''}`}
            title="Toggle Sidebar"
          >
            {isSidebarOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            )}
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
          {navItems.map(item => {
            const isActive = location.pathname === item.to ||
              (item.to !== '/dashboard' && location.pathname.startsWith(item.to));

            return (
              <Link
                key={item.to}
                to={item.to}
                title={!isSidebarOpen ? item.label : ""}
                className={`flex items-center ${isSidebarOpen ? 'px-4' : 'justify-center'} py-3 font-medium rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20 translate-x-1'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white hover:translate-x-1'
                }`}
              >
                <span className={`${isSidebarOpen ? 'mr-3' : ''} text-xl`}>{item.icon}</span> 
                {isSidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        
        <div className="px-4 py-2 border-t border-white/5 mt-auto">
           {lastSynced && (
             <div className="flex flex-col gap-2">
               <div className={`text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-2 ${!isSidebarOpen ? 'justify-center' : ''}`}>
                 <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-emerald-500'}`} />
                 {isSidebarOpen && `Sync: ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
               </div>
               {isSidebarOpen && (
                 <button 
                   onClick={() => fetchUpdatedData(true)}
                   disabled={isSyncing}
                   className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-widest flex items-center gap-1 transition-colors disabled:opacity-50"
                 >
                   {isSyncing ? 'Syncing...' : 'Sync Now'}
                 </button>
               )}
             </div>
           )}
        </div>

        <div className={`p-4 border-t border-white/10 flex ${!isSidebarOpen ? 'justify-center' : ''}`}>
          <button
            onClick={handleSignOut}
            title={!isSidebarOpen ? "Sign Out" : ""}
            className={`flex items-center ${isSidebarOpen ? 'w-full px-4' : 'justify-center'} py-3 font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300 hover:translate-x-1`}
          >
            <span className={`${isSidebarOpen ? 'mr-3' : ''} grid place-items-center`}><LogOut size={20} strokeWidth={1.5} /></span>
            {isSidebarOpen && <span className="whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto z-10 relative">
        <Routes>
          <Route path="/" element={<DashboardOverview studentData={studentData} fetchUpdatedData={fetchUpdatedData} isSyncing={isSyncing} />} />
          <Route path="/academics" element={<Academics studentData={studentData} fetchUpdatedData={fetchUpdatedData} isSyncing={isSyncing} />} />
          <Route path="/timetable" element={<Timetable studentData={studentData} fetchUpdatedData={fetchUpdatedData} isSyncing={isSyncing} />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/placement" element={<PlacementPlan studentData={studentData} />} />
          <Route path="/quiz" element={<PlacementQuiz />} />
          <Route path="/roadmap" element={<JobRoadmap />} />
          <Route path="/tracker" element={<JobTracker />} />
          <Route path="/mock-interview" element={<MockInterviewer />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/study-room" element={<StudyRoom />} />
        </Routes>
      </main>

      <div className="z-50 relative">
        <AIChatbot />
      </div>
    </div>
  );
};

export default Dashboard;
