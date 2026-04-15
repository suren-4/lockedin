import React, { useState, useEffect } from 'react';

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

const isUpcomingSoon = (timeStr) => {
  if (!timeStr) return false;
  const parts = timeStr.split(' - ');
  if (parts.length !== 2) return false;
  const parseToMins = (t) => {
    let [h, m] = t.split(':').map(Number);
    if (h >= 1 && h <= 7) h += 12;
    return h * 60 + m;
  };
  const startMins = parseToMins(parts[0]);
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();
  return startMins > currentMins && startMins - currentMins <= 30;
};

const SmartReminder = ({ timetable = [] }) => {
  const [reminders, setReminders] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const baseReminders = [
      { id: 1, text: 'Complete LeetCode Daily Challenge', type: 'coding', icon: '💻', status: 'pending' },
      { id: 2, text: 'Review Data Science notes', type: 'study', icon: '📚', status: 'pending' },
    ];

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayClasses = timetable.filter(c => c.day === today);
    const activeClassReminders = [];

    todayClasses.forEach((c) => {
      if (isCurrentClass(c.time)) {
        activeClassReminders.push({
          id: `ongoing-${c.subject}`, text: `LIVE NOW: ${c.subject} (${c.room})`,
          type: 'ongoing class', icon: '🔴', status: 'live'
        });
      } else if (isUpcomingSoon(c.time)) {
        activeClassReminders.push({
          id: `upcoming-${c.subject}`, text: `Upcoming: ${c.subject} at ${c.time.split(' - ')[0]} (${c.room})`,
          type: 'starting soon', icon: '⏳', status: 'urgent'
        });
      }
    });

    if (activeClassReminders.length > 0) {
      setReminders([...activeClassReminders, ...baseReminders]);
    } else {
      const nextClass = todayClasses.find(c => {
        const startHourMins = c.time.split(' - ')[0].split(':').map(Number);
        let h = startHourMins[0];
        if (h >= 1 && h <= 7) h += 12;
        return (h * 60 + startHourMins[1]) > (new Date().getHours() * 60 + new Date().getMinutes());
      });
      if (nextClass) {
        setReminders([{
          id: 'class-1', text: `Later Today: ${nextClass.subject} at ${nextClass.time} (${nextClass.room})`,
          type: 'schedule', icon: '🏛️', status: 'pending'
        }, ...baseReminders]);
      } else {
        setReminders(baseReminders);
      }
    }
  }, [timetable, currentTime]);

  return (
    <div className="bg-white/5 p-6 rounded-xl border border-white/10 h-full">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <span className="text-indigo-400">🔔</span> Smart Reminders
        </h2>
        <span className="text-xs font-semibold px-2 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-full">
          {reminders.length} Active
        </span>
      </div>

      <div className="space-y-3">
        {reminders.length > 0 ? reminders.map((rem) => (
          <div 
            key={rem.id} 
            className={`flex items-start gap-3 p-3 rounded-xl border transition-all hover:-translate-y-0.5 ${
              rem.status === 'live' ? 'bg-red-500/10 border-red-500/30 animate-pulse' :
              rem.status === 'urgent' ? 'bg-orange-500/10 border-orange-500/30 hover:border-orange-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <div className={`text-2xl mt-0.5 ${rem.status === 'live' ? 'animate-bounce' : ''}`}>{rem.icon}</div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${
                rem.status === 'live' ? 'text-red-400' :
                rem.status === 'urgent' ? 'text-orange-400' : 'text-white'
              }`}>
                {rem.text}
              </p>
              <div className="flex justify-between items-center mt-3">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${
                  rem.status === 'live' ? 'text-red-500' :
                  rem.status === 'urgent' ? 'text-orange-500' : 'text-gray-500'
                }`}>
                  {rem.type}
                </span>
                <button className={`text-xs px-2.5 py-1.5 rounded-lg text-white font-medium transition-colors ${
                  rem.status === 'live' ? 'bg-red-600 hover:bg-red-700' :
                  rem.status === 'urgent' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}>
                  {rem.status === 'live' ? 'Focus Mode' : rem.status === 'urgent' ? 'Join Soon' : 'Mark Done'}
                </button>
              </div>
            </div>
          </div>
        )) : (
          <p className="text-sm text-gray-500">You're all caught up for now. 🎉</p>
        )}
      </div>
    </div>
  );
};

export default SmartReminder;
