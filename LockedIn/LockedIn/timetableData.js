// ── Real timetable data extracted from uploaded schedule ────────────────
// DO1=Monday, DO2=Tuesday, DO3=Wednesday, DO4=Thursday, DO5=Friday

const TIMETABLE = [
  // ── Monday (DO1) ──
  { day: 'Monday', time: '12:30 - 01:20', subject: 'Essentials in Cloud and DevOps', room: 'TP-301' },
  { day: 'Monday', time: '01:25 - 02:15', subject: 'Essentials in Cloud and DevOps', room: 'TP-301' },
  { day: 'Monday', time: '02:20 - 03:10', subject: 'Data Science',                   room: 'TP-503' },
  { day: 'Monday', time: '03:10 - 04:00', subject: 'Data Science',                   room: 'TP-503' },
  { day: 'Monday', time: '04:00 - 04:50', subject: 'Consumer Behaviour',             room: 'TP-202' },

  // ── Tuesday (DO2) ──
  { day: 'Tuesday', time: '08:00 - 08:50', subject: 'Software Engineering and Project Management', room: 'TP-401' },
  { day: 'Tuesday', time: '08:50 - 09:40', subject: 'Software Engineering and Project Management', room: 'TP-401' },
  { day: 'Tuesday', time: '09:45 - 10:35', subject: 'Consumer Behaviour',             room: 'TP-202' },
  { day: 'Tuesday', time: '10:40 - 11:30', subject: 'Consumer Behaviour',             room: 'TP-202' },
  { day: 'Tuesday', time: '11:35 - 12:25', subject: 'Essentials in Cloud and DevOps', room: 'TP-301' },

  // ── Wednesday (DO3) ──
  { day: 'Wednesday', time: '08:00 - 08:50', subject: 'Software Engineering and Project Management', room: 'TP-401' },
  { day: 'Wednesday', time: '08:50 - 09:40', subject: 'Software Engineering and Project Management', room: 'TP-401' },
  { day: 'Wednesday', time: '12:30 - 01:20', subject: 'Fog Computing',                room: 'TP-602' },
  { day: 'Wednesday', time: '01:25 - 02:15', subject: 'Fog Computing',                room: 'TP-602' },
  { day: 'Wednesday', time: '02:20 - 03:10', subject: 'Essentials in Cloud and DevOps', room: 'TP-301' },
  { day: 'Wednesday', time: '03:10 - 04:00', subject: 'Cloud Product and Platform Engineering', room: 'TP-505' },
  { day: 'Wednesday', time: '04:00 - 04:50', subject: 'Software Engineering and Project Management', room: 'TP-401' },

  // ── Thursday (DO4) ──
  { day: 'Thursday', time: '08:00 - 08:50', subject: 'Cloud Product and Platform Engineering', room: 'TP-505' },
  { day: 'Thursday', time: '08:50 - 09:40', subject: 'Cloud Product and Platform Engineering', room: 'TP-505' },
  { day: 'Thursday', time: '09:45 - 10:35', subject: 'Software Engineering and Project Management', room: 'TP-401' },
  { day: 'Thursday', time: '11:35 - 12:25', subject: 'Fog Computing',                 room: 'TP-602' },
  { day: 'Thursday', time: '03:10 - 04:00', subject: 'Fog Computing',                 room: 'TP-602' },
  { day: 'Thursday', time: '04:00 - 04:50', subject: 'Fog Computing',                 room: 'TP-602' },
  { day: 'Thursday', time: '04:50 - 05:30', subject: 'Project',                       room: 'TP-604' },
  { day: 'Thursday', time: '05:30 - 06:10', subject: 'Project',                       room: 'TP-604' },

  // ── Friday (DO5) ──
  { day: 'Friday', time: '08:00 - 08:50', subject: 'Cloud Product and Platform Engineering', room: 'TP-505' },
  { day: 'Friday', time: '08:50 - 09:40', subject: 'Cloud Product and Platform Engineering', room: 'TP-505' },
  { day: 'Friday', time: '02:20 - 03:10', subject: 'Fog Computing',                   room: 'TP-602' },
  { day: 'Friday', time: '03:10 - 04:00', subject: 'Data Science',                    room: 'TP-503' },
  { day: 'Friday', time: '04:00 - 04:50', subject: 'Cloud Product and Platform Engineering', room: 'TP-505' },
  { day: 'Friday', time: '04:50 - 05:30', subject: 'Indian Traditional Knowledge',    room: 'TP-101' },
  { day: 'Friday', time: '05:30 - 06:10', subject: 'Indian Traditional Knowledge',    room: 'TP-101' },
];

export default TIMETABLE;

