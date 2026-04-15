import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Clock,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import { apiUrl } from '../services/api';

const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 18 * 60;
const BRANCH_OPTIONS = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL'];
const BRANCH_PROFILES = {
  CSE: {
    targetRoles: ['Software Engineer', 'Backend Developer', 'Full Stack Developer'],
    skills: ['DSA and problem solving', 'DBMS, OS, and CN', 'Projects with deployment'],
    projects: ['Build one deployable full-stack project', 'Practice timed coding rounds', 'Revise CS fundamentals weekly'],
    certifications: ['Cloud or backend fundamentals cert', 'Resume-ready GitHub project write-up'],
  },
  ECE: {
    targetRoles: ['Embedded Engineer', 'VLSI Intern', 'IoT Engineer'],
    skills: ['Digital electronics', 'Communication systems', 'Embedded programming'],
    projects: ['Create one embedded or circuit-based mini project', 'Revise signals and electronics notes', 'Practice aptitude alongside core prep'],
    certifications: ['Embedded systems or IoT certification', 'Document one hardware-oriented project'],
  },
  EEE: {
    targetRoles: ['Electrical Design Engineer', 'Power Systems Trainee', 'Automation Engineer'],
    skills: ['Machines and power systems', 'Control systems', 'Aptitude and analytical reasoning'],
    projects: ['Prepare one simulation-based core project', 'Revise electrical subjects with formulas', 'Practice interview explanations for lab work'],
    certifications: ['Power systems or automation certification', 'One simulation/report portfolio artifact'],
  },
  MECH: {
    targetRoles: ['Graduate Engineer Trainee', 'Design Engineer', 'Manufacturing Engineer'],
    skills: ['Thermodynamics and SOM', 'Manufacturing and CAD', 'Interview problem solving'],
    projects: ['Build a CAD or design case study', 'Revise core mechanical formula sheets', 'Practice operations and production questions'],
    certifications: ['CAD or design tools certification', 'One mini design portfolio entry'],
  },
  CIVIL: {
    targetRoles: ['Site Engineer', 'Structural Trainee', 'Planning Engineer'],
    skills: ['Structural analysis', 'Surveying and estimation', 'Project planning'],
    projects: ['Prepare one design or estimation case study', 'Revise structural and site concepts', 'Practice project-coordination style questions'],
    certifications: ['AutoCAD or planning certification', 'One documented civil mini project'],
  },
};
const BRANCH_KEYWORDS = {
  CSE: ['computer', 'software', 'programming', 'cloud', 'devops', 'data science', 'dbms', 'operating', 'network'],
  ECE: ['electronics', 'communication', 'digital electronics', 'signals', 'embedded', 'vlsi', 'iot'],
  EEE: ['electrical', 'power', 'machines', 'control system', 'power electronics'],
  MECH: ['mechanical', 'thermodynamics', 'manufacturing', 'som', 'cad', 'fluid'],
  CIVIL: ['civil', 'structural', 'surveying', 'concrete', 'geotechnical', 'estimation'],
};

function parseAcademicTime(timeStr) {
  const value = timeStr?.trim();
  if (!value) return null;

  const match = value.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem) {
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    return hours * 60 + minutes;
  }

  if (hours >= 1 && hours <= 6) {
    hours += 12;
  }

  return hours * 60 + minutes;
}

function formatAcademicTime(totalMinutes) {
  const normalizedHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = normalizedHours >= 12 ? 'PM' : 'AM';
  const hours12 = normalizedHours % 12 || 12;

  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDuration(durationMinutes) {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function parseClassWindow(timeStr) {
  const [startText, endText] = String(timeStr || '').split(' - ').map(part => part.trim());
  const startMinutes = parseAcademicTime(startText);
  const endMinutes = parseAcademicTime(endText);

  if (startMinutes == null || endMinutes == null) {
    return null;
  }

  return { startMinutes, endMinutes };
}

function getGroupOrder(dayOrder, day) {
  const match = String(dayOrder || '').match(/DO(\d+)/i);
  if (match) return Number(match[1]);

  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const index = weekdays.indexOf(day);
  return index >= 0 ? index + 1 : Number.MAX_SAFE_INTEGER;
}

function buildFreeWindow(group, fromMinutes, toMinutes, type) {
  const durationMinutes = toMinutes - fromMinutes;
  if (durationMinutes <= 30) return null;

  return {
    day: group.day,
    dayOrder: group.dayOrder,
    label: group.dayOrder ? `${group.dayOrder} · ${group.day}` : group.day,
    from: formatAcademicTime(fromMinutes),
    to: formatAcademicTime(toMinutes),
    durationMinutes,
    durationLabel: formatDuration(durationMinutes),
    durationHours: Number((durationMinutes / 60).toFixed(1)),
    type,
  };
}

function analyzeSchedule(timetable) {
  const grouped = new Map();

  timetable.forEach(entry => {
    if (!entry?.time) return;
    const key = entry.dayOrder || entry.day || 'Schedule';
    if (!grouped.has(key)) {
      grouped.set(key, {
        day: entry.day || key,
        dayOrder: entry.dayOrder || null,
        classes: [],
      });
    }
    grouped.get(key).classes.push(entry);
  });

  const freeWindows = [];

  [...grouped.values()]
    .sort((a, b) => getGroupOrder(a.dayOrder, a.day) - getGroupOrder(b.dayOrder, b.day))
    .forEach(group => {
      const classes = group.classes
        .map(entry => ({ ...entry, window: parseClassWindow(entry.time) }))
        .filter(entry => entry.window)
        .sort((a, b) => a.window.startMinutes - b.window.startMinutes);

      if (!classes.length) return;

      const first = classes[0].window;
      const last = classes[classes.length - 1].window;

      const morningWindow = buildFreeWindow(group, DAY_START_MINUTES, first.startMinutes, 'morning');
      if (morningWindow) freeWindows.push(morningWindow);

      for (let index = 0; index < classes.length - 1; index += 1) {
        const current = classes[index].window;
        const next = classes[index + 1].window;
        const gapWindow = buildFreeWindow(group, current.endMinutes, next.startMinutes, 'gap');
        if (gapWindow) freeWindows.push(gapWindow);
      }

      const eveningWindow = buildFreeWindow(group, last.endMinutes, DAY_END_MINUTES, 'evening');
      if (eveningWindow) freeWindows.push(eveningWindow);
    });

  return freeWindows;
}

function summarizeFreeWindows(freeWindows) {
  const grouped = new Map();

  freeWindows.forEach(window => {
    const key = window.dayOrder || window.day;
    if (!grouped.has(key)) {
      grouped.set(key, {
        day: window.day,
        dayOrder: window.dayOrder,
        label: window.label,
        availableMinutes: 0,
      });
    }

    grouped.get(key).availableMinutes += window.durationMinutes;
  });

  return [...grouped.values()]
    .sort((a, b) => getGroupOrder(a.dayOrder, a.day) - getGroupOrder(b.dayOrder, b.day))
    .map(group => ({
      ...group,
      availableHours: Number((group.availableMinutes / 60).toFixed(1)),
    }));
}

function calculateProgressMetrics(freeWindows) {
  if (!freeWindows.length) {
    return { weeklyHours: 0, weeklyMinutes: 0, estimatedDays: 0, weeklyProgress: 0 };
  }

  const totalMinutesPerWeek = freeWindows.reduce((sum, window) => sum + window.durationMinutes, 0);
  const weeklyHours = totalMinutesPerWeek / 60;
  const placementHoursNeeded = 120;
  const weeksNeeded = weeklyHours > 0 ? Math.ceil(placementHoursNeeded / weeklyHours) : 0;

  return {
    weeklyHours: weeklyHours.toFixed(1),
    weeklyMinutes: totalMinutesPerWeek,
    estimatedDays: weeksNeeded * 7,
    weeklyProgress: Math.min(100, Math.round((weeklyHours / placementHoursNeeded) * 100)),
  };
}

function detectBranchFromText(text) {
  const normalized = String(text || '').toLowerCase();
  let bestBranch = null;
  let bestScore = 0;

  Object.entries(BRANCH_KEYWORDS).forEach(([branch, keywords]) => {
    const score = keywords.reduce((sum, keyword) => sum + (normalized.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestBranch = branch;
    }
  });

  return bestScore > 0 ? { branch: bestBranch, score: bestScore } : null;
}

function inferBranchFromStudentData(studentData) {
  const explicitBranch = String(studentData?.branch || '').trim().toUpperCase();
  if (BRANCH_OPTIONS.includes(explicitBranch)) {
    return { branch: explicitBranch, source: 'academia' };
  }

  const profileText = `${studentData?.program || ''} ${studentData?.department || ''}`.toLowerCase();

  if (/\bcse\b/.test(profileText)) return { branch: 'CSE', source: 'profile' };
  if (/\bece\b/.test(profileText)) return { branch: 'ECE', source: 'profile' };
  if (/\beee\b/.test(profileText)) return { branch: 'EEE', source: 'profile' };
  if (/\bmech\b/.test(profileText)) return { branch: 'MECH', source: 'profile' };

  const profileMatch = detectBranchFromText(profileText);
  if (profileMatch) {
    return { branch: profileMatch.branch, source: 'profile' };
  }

  const subjectText = Array.isArray(studentData?.timetable)
    ? studentData.timetable.map(item => item?.subject || '').join(' | ')
    : '';
  const subjectMatch = detectBranchFromText(subjectText);
  if (subjectMatch?.score >= 2) {
    return { branch: subjectMatch.branch, source: 'subjects' };
  }

  return null;
}

function buildLocalPlacementPlan(branch, slotHours, prepWindows, studentData) {
  const profile = BRANCH_PROFILES[branch] || BRANCH_PROFILES.CSE;
  const weeklyHours = Number((slotHours.reduce((sum, item) => sum + item.availableHours, 0)).toFixed(1));
  const groupedWindows = new Map();

  prepWindows.forEach(window => {
    const key = window.dayOrder || window.day;
    if (!groupedWindows.has(key)) {
      groupedWindows.set(key, []);
    }
    groupedWindows.get(key).push(window);
  });

  return {
    headline: `${branch} placement plan aligned to your current free slots`,
    summary: `Using ${weeklyHours} hours of weekly free time from your timetable, this plan prioritizes ${branch} placement preparation while keeping aptitude, projects, and interview practice consistent.`,
    targetRoles: profile.targetRoles,
    coreSkills: profile.skills,
    projects: profile.projects,
    certifications: profile.certifications,
    roadmap: [
      {
        phase: 'Phase 1',
        title: 'Foundation and revision',
        weeks: 'Weeks 1-3',
        focus: `Build confidence in ${branch} core concepts and set a repeatable prep rhythm.`,
        deliverables: [
          `Revise 2-3 core ${branch} topics and prepare summary notes`,
          'Start aptitude practice at least three times per week',
          'Prepare a clean resume and project summary',
        ],
      },
      {
        phase: 'Phase 2',
        title: 'Projects and interview depth',
        weeks: 'Weeks 4-7',
        focus: 'Convert subject knowledge into interview answers and visible project proof.',
        deliverables: [
          'Finish one portfolio-worthy project or mini implementation',
          'Prepare 20 common technical interview questions with answers',
          'Practice one mock interview each week',
        ],
      },
      {
        phase: 'Phase 3',
        title: 'Placement sprint',
        weeks: 'Weeks 8-12',
        focus: 'Use your day-order windows for timed revision, test practice, and company-specific prep.',
        deliverables: [
          'Run two full mock rounds under time pressure',
          'Prepare company-specific notes for top target roles',
          'Track weak areas and revise them twice a week',
        ],
      },
    ],
    slotPlan: slotHours.map((slot, index) => ({
      dayOrder: slot.dayOrder || slot.day,
      day: slot.day,
      focus: profile.skills[index % profile.skills.length],
      timeBlocks: (groupedWindows.get(slot.dayOrder || slot.day) || []).map(window => `${window.from} - ${window.to}`),
      tasks: [
        `Use this day order for ${profile.skills[index % profile.skills.length]}`,
        'End the block with 10 minutes of recap and next-day planning',
      ],
      weeklyHours: slot.availableHours,
    })),
    interviewPrep: [
      'Prepare a concise self-introduction and project walkthrough',
      'Maintain an error log from aptitude, quizzes, and mocks',
      ...(studentData?.timetable?.length ? ['Link your coursework and labs to likely interview questions'] : []),
    ],
  };
}

function getPrepSuggestion(window, branch, slotPlanMap) {
  const planned = slotPlanMap.get(window.dayOrder || window.day);
  if (planned) {
    return {
      title: planned.focus,
      detail: planned.tasks?.[0] || 'Follow the generated task list for this day order.',
    };
  }

  const defaults = {
    CSE: ['Solve one DSA problem set', 'Revise DBMS or OS notes'],
    ECE: ['Revise digital electronics', 'Practice communication systems questions'],
    EEE: ['Revise machines or power systems', 'Practice quantitative aptitude'],
    MECH: ['Revise SOM or thermodynamics', 'Work on design interview questions'],
    CIVIL: ['Revise structural analysis', 'Practice estimation and site concepts'],
  };

  const branchDefaults = defaults[branch] || defaults.CSE;
  return {
    title: window.durationMinutes >= 90 ? branchDefaults[0] : branchDefaults[1],
    detail: `Use this ${window.durationLabel} block for focused ${branch} placement preparation.`,
  };
}

const PlacementPlan = ({ studentData }) => {
  const [timetable, setTimetable] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('CSE');
  const [completedTasks, setCompletedTasks] = useState({});
  const [planResponse, setPlanResponse] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [streamedPlanText, setStreamedPlanText] = useState('');
  const [profileOverride, setProfileOverride] = useState(null);
  const [isHydratingProfile, setIsHydratingProfile] = useState(false);
  const lastLoadedPlanKeyRef = useRef('');

  const effectiveStudentData = useMemo(
    () => ({ ...(studentData || {}), ...(profileOverride || {}) }),
    [studentData, profileOverride]
  );

  const detectedBranch = useMemo(
    () => inferBranchFromStudentData(effectiveStudentData || {}),
    [effectiveStudentData]
  );

  useEffect(() => {
    if (effectiveStudentData) {
      setTimetable(effectiveStudentData.timetable || []);
      const savedBranch = localStorage.getItem('lockedin_selected_placement_branch');

      // Always prefer explicit branch scraped from Academia when available.
      if (detectedBranch?.source === 'academia' && detectedBranch?.branch) {
        setSelectedBranch(detectedBranch.branch);
      } else {
        setSelectedBranch(savedBranch || detectedBranch?.branch || 'CSE');
      }
    }
  }, [effectiveStudentData, detectedBranch]);

  useEffect(() => {
    if (!studentData || profileOverride || isHydratingProfile) return;
    if (detectedBranch?.branch) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    let cancelled = false;

    const hydrateFromAcademia = async () => {
      setIsHydratingProfile(true);
      try {
        const response = await fetch(apiUrl('/api/userinfo'), {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return;
        const data = await response.json();
        const userInfo = data?.userInfo;
        if (!userInfo) return;

        const normalizedBranch = String(userInfo.branch || '').trim().toUpperCase();
        const mergeData = {
          branch: BRANCH_OPTIONS.includes(normalizedBranch) ? normalizedBranch : '',
          program: userInfo.program || '',
          department: userInfo.department || '',
          section: userInfo.section || '',
          semester: userInfo.semester || '',
          name: userInfo.name || studentData?.name || '',
          batch: userInfo.batch || studentData?.batch || '',
          regNumber: userInfo.regNumber || studentData?.regNumber || '',
        };

        if (cancelled) return;

        setProfileOverride(mergeData);

        const existing = JSON.parse(localStorage.getItem('student_data') || '{}');
        localStorage.setItem('student_data', JSON.stringify({ ...existing, ...mergeData }));
      } catch (_) {
        // Ignore hydration errors and keep local fallback behavior.
      } finally {
        if (!cancelled) {
          setIsHydratingProfile(false);
        }
      }
    };

    hydrateFromAcademia();

    return () => {
      cancelled = true;
    };
  }, [studentData, profileOverride, isHydratingProfile, detectedBranch]);

  useEffect(() => {
    const saved = localStorage.getItem(`lockedin_placement_progress_${selectedBranch}`);
    setCompletedTasks(saved ? JSON.parse(saved) : {});
  }, [selectedBranch]);

  useEffect(() => {
    localStorage.setItem('lockedin_selected_placement_branch', selectedBranch);
  }, [selectedBranch]);

  useEffect(() => {
    localStorage.setItem(`lockedin_placement_progress_${selectedBranch}`, JSON.stringify(completedTasks));
  }, [completedTasks, selectedBranch]);

  const timetableSignature = useMemo(
    () => JSON.stringify((timetable || []).map(item => `${item.dayOrder || item.day}-${item.time}-${item.subject}`)),
    [timetable]
  );

  const freeWindows = useMemo(() => analyzeSchedule(timetable), [timetable]);
  const metrics = useMemo(() => calculateProgressMetrics(freeWindows), [freeWindows]);
  const slotHours = useMemo(() => summarizeFreeWindows(freeWindows), [freeWindows]);

  const aiPlan = planResponse?.plan || null;
  const slotPlanMap = useMemo(() => {
    const entries = (aiPlan?.slotPlan || []).map(item => [item.dayOrder || item.day, item]);
    return new Map(entries);
  }, [aiPlan]);

  const prepWindows = useMemo(
    () => freeWindows.map(window => ({
      ...window,
      suggestion: getPrepSuggestion(window, selectedBranch, slotPlanMap),
    })),
    [freeWindows, selectedBranch, slotPlanMap]
  );

  const totalTasks = useMemo(
    () => (aiPlan?.roadmap || []).reduce((sum, phase) => sum + (phase.deliverables?.length || 0), 0),
    [aiPlan]
  );

  const completedCount = useMemo(
    () => Object.values(completedTasks).filter(Boolean).length,
    [completedTasks]
  );

  const progress = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const getPlanCacheKey = useCallback(
    (branch) => `lockedin_placement_plan_${branch}`,
    []
  );

  const generatePlan = useCallback(async (forceRefresh = false) => {
    if (!selectedBranch || !effectiveStudentData) return;

    const cacheKey = getPlanCacheKey(selectedBranch);
    if (!forceRefresh) {
      if (lastLoadedPlanKeyRef.current === cacheKey && planResponse) {
        return;
      }

      const cachedPlanRaw = localStorage.getItem(cacheKey);
      if (cachedPlanRaw) {
        try {
          const cachedPlan = JSON.parse(cachedPlanRaw);
          setPlanResponse(cachedPlan);
          lastLoadedPlanKeyRef.current = cacheKey;
          setError('');
          setNotice('');
          return;
        } catch (_) {
          localStorage.removeItem(cacheKey);
        }
      }
    } else {
      localStorage.removeItem(cacheKey);
    }

    setIsGenerating(true);
    setError('');
    setNotice('');
    setStreamedPlanText('');
    try {
      const response = await fetch(apiUrl('/api/placement-plan/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: selectedBranch, student_data: effectiveStudentData, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`Placement API responded with ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let finalPayload = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine === 'data: [DONE]') continue;

            if (cleanLine.startsWith('data: ')) {
              try {
                const data = JSON.parse(cleanLine.slice(6));
                if (data.type === 'content' && data.content) {
                  fullContent += data.content;
                  setStreamedPlanText(fullContent);
                }
                if (data.type === 'done' && data.payload) {
                  finalPayload = data.payload;
                }
                if (data.type === 'error') {
                  throw new Error(data.error || 'Failed while streaming placement plan.');
                }
              } catch (streamError) {
                if (streamError instanceof Error) throw streamError;
              }
            }
          }
        }

        if (finalPayload) {
          setPlanResponse(finalPayload);
          localStorage.setItem(cacheKey, JSON.stringify(finalPayload));
          lastLoadedPlanKeyRef.current = cacheKey;
        } else {
          throw new Error('Placement stream ended without final payload.');
        }
      } else {
        const data = await response.json();
        setPlanResponse(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        lastLoadedPlanKeyRef.current = cacheKey;
      }
    } catch (generationError) {
      const fallbackPayload = {
        source: 'local',
        plan: buildLocalPlacementPlan(selectedBranch, slotHours, freeWindows, effectiveStudentData),
      };
      setPlanResponse(fallbackPayload);
      localStorage.setItem(cacheKey, JSON.stringify(fallbackPayload));
      lastLoadedPlanKeyRef.current = cacheKey;

      if (/404/.test(generationError.message || '')) {
        setNotice('Backend placement route is not active yet. Showing a local branch plan for now. Restart the backend to enable Mistral generation.');
      } else {
        setNotice('Could not reach the Mistral placement endpoint. Showing a local branch plan instead.');
      }
    } finally {
      setIsGenerating(false);
      setStreamedPlanText('');
    }
  }, [selectedBranch, effectiveStudentData, getPlanCacheKey, planResponse, slotHours, freeWindows]);

  useEffect(() => {
    generatePlan(false);
  }, [selectedBranch, generatePlan]);

  const toggleTask = (phaseIndex, taskIndex) => {
    const key = `${selectedBranch}-${phaseIndex}-${taskIndex}`;
    setCompletedTasks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-6 w-full max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-200 mb-1">Placement Plan</h1>
          <p className="text-gray-500 text-sm">
            Branch-specific placement prep generated from your scraped timetable, free slot hours, and active day order schedule.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex flex-col gap-2 text-sm text-gray-400">
            Branch / domain
            <select
              value={selectedBranch}
              onChange={(event) => setSelectedBranch(event.target.value)}
              className="min-w-[180px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            >
              {BRANCH_OPTIONS.map(branch => (
                <option key={branch} value={branch} className="bg-[#111111] text-gray-200">
                  {branch}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => generatePlan(true)}
            disabled={isGenerating}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              {isGenerating ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              Refresh Plan
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6 mb-8">
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h3 className="font-bold text-gray-200 flex items-center gap-2">
              <Sparkles size={18} className="text-red-500" /> AI Placement Strategy
            </h3>
            {planResponse?.source && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 uppercase tracking-wide">
                {String(planResponse.source || '').includes('mistral') ? 'Mistral' : 'Fallback'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Selected: {selectedBranch}
            </span>
            {detectedBranch ? (
              <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-gray-300 border border-white/10">
                Detected from {detectedBranch.source}: {detectedBranch.branch}
              </span>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-gray-500 border border-white/10">
                Branch not auto-detected
              </span>
            )}
            {effectiveStudentData?.department && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                {effectiveStudentData.branch ? `${effectiveStudentData.branch} · ${effectiveStudentData.department}` : effectiveStudentData.department}
              </span>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {notice && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {notice}
            </div>
          )}

          {isGenerating && !aiPlan ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-5 py-8 text-center text-sm text-gray-400">
              <LoaderCircle size={20} className="animate-spin mx-auto mb-3 text-red-400" />
              Generating a branch-specific placement plan from your timetable.
              <div className="mt-4 text-left max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Live Generation</p>
                <pre className="whitespace-pre-wrap break-words text-xs text-gray-300 font-mono leading-relaxed">
                  {streamedPlanText || 'Waiting for streamed response...'}
                </pre>
              </div>
            </div>
          ) : aiPlan ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">{aiPlan.headline}</h2>
              <p className="text-sm text-gray-400 mb-5">{aiPlan.summary}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h4 className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                    <Briefcase size={16} className="text-amber-400" /> Target Roles
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(aiPlan.targetRoles || []).map(role => (
                      <span key={role} className="text-xs px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h4 className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                    <Target size={16} className="text-emerald-400" /> Core Skills
                  </h4>
                  <div className="space-y-2">
                    {(aiPlan.coreSkills || []).map(skill => (
                      <div key={skill} className="flex items-start gap-2 text-sm text-gray-300">
                        <ChevronRight size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{skill}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No placement strategy is available yet.</p>
          )}
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-200 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-red-500" /> Roadmap Progress
            </h3>
            <span className="text-sm font-bold text-red-400">{progress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8 }}
              className="h-3 rounded-full bg-gradient-to-r from-red-500 to-orange-500"
            />
          </div>
          <p className="text-xs text-gray-500 mb-6">{completedCount} of {totalTasks} roadmap tasks completed</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-400 mb-1">Weekly Prep</p>
              <p className="text-2xl font-bold text-blue-300">{metrics.weeklyHours}h</p>
              <p className="text-xs text-gray-500 mt-1">{metrics.weeklyMinutes} minutes mapped</p>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-1">Placement Pace</p>
              <p className="text-2xl font-bold text-emerald-300">{metrics.estimatedDays} days</p>
              <p className="text-xs text-gray-500 mt-1">at current free-slot usage</p>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-400 mb-1">Goal Coverage</p>
              <p className="text-2xl font-bold text-purple-300">{metrics.weeklyProgress}%</p>
              <p className="text-xs text-gray-500 mt-1">of a 120-hour prep target</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 p-5 mb-8">
        <h3 className="font-bold text-gray-200 mb-4 flex items-center gap-2">
          <CalendarRange size={18} className="text-blue-500" /> Slot Hours By Day Order
        </h3>
        {slotHours.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {slotHours.map(slot => (
              <div key={slot.label} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">{slot.label}</p>
                <p className="text-2xl font-bold text-blue-300 mt-2">{slot.availableHours}h</p>
                <p className="text-xs text-gray-500 mt-1">{slot.availableMinutes} free minutes</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No free slot longer than 30 minutes was found in the scraped timetable.</p>
        )}
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 p-5 mb-8">
        <h3 className="font-bold text-gray-200 mb-4 flex items-center gap-2">
          <Clock size={18} className="text-blue-500" /> Free Windows From Scraped Timetable
        </h3>
        {prepWindows.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {prepWindows.map((window, index) => (
              <div key={`${window.label}-${window.from}-${index}`} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{window.label}</p>
                    <p className="text-xs text-gray-500">{window.from} - {window.to}</p>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
                    {window.durationLabel}
                  </span>
                </div>
                <p className="text-sm text-gray-200 mb-1">{window.suggestion.title}</p>
                <p className="text-xs text-gray-500">{window.suggestion.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No usable placement-prep windows were detected from the timetable.</p>
        )}
      </div>

      {aiPlan && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
          <div className="bg-white/5 rounded-xl border border-white/10 p-5">
            <h3 className="font-bold text-gray-200 mb-6 flex items-center gap-2">
              <Target size={18} className="text-emerald-500" /> AI Roadmap
            </h3>
            <div className="space-y-8">
              {(aiPlan.roadmap || []).map((phase, phaseIndex) => (
                <div key={`${phase.phase}-${phase.title}`} className="border-l-4 border-red-500 pl-5 relative">
                  <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-red-500 border-4 border-black" />
                  <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">{phase.phase}</h4>
                  <div className="flex items-center justify-between gap-4 mt-1 mb-2">
                    <h3 className="text-lg font-bold text-gray-200">{phase.title}</h3>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">{phase.weeks}</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">{phase.focus}</p>
                  <div className="space-y-2">
                    {(phase.deliverables || []).map((task, taskIndex) => {
                      const taskKey = `${selectedBranch}-${phaseIndex}-${taskIndex}`;
                      const done = completedTasks[taskKey];
                      return (
                        <button
                          key={taskKey}
                          onClick={() => toggleTask(phaseIndex, taskIndex)}
                          className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-all ${
                            done ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-black/20 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <CheckCircle2 size={18} className={`flex-shrink-0 mt-0.5 ${done ? 'text-emerald-400' : 'text-gray-400'}`} />
                          <span className={`text-sm ${done ? 'text-emerald-300 line-through' : 'text-gray-300'}`}>{task}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/5 rounded-xl border border-white/10 p-5">
              <h3 className="font-bold text-gray-200 mb-4 flex items-center gap-2">
                <Clock size={18} className="text-amber-400" /> Day-Order Slot Plan
              </h3>
              <div className="space-y-4">
                {(aiPlan.slotPlan || []).map(slot => (
                  <div key={`${slot.dayOrder}-${slot.focus}`} className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{slot.dayOrder || slot.day}</p>
                        <p className="text-xs text-gray-500">{slot.day}</p>
                      </div>
                      <span className="text-[11px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">
                        {slot.weeklyHours}h/week
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-200 mb-2">{slot.focus}</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(slot.timeBlocks || []).map(block => (
                        <span key={block} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">
                          {block}
                        </span>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {(slot.tasks || []).map(task => (
                        <div key={task} className="flex items-start gap-2 text-sm text-gray-300">
                          <ChevronRight size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                          <span>{task}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl border border-white/10 p-5">
              <h3 className="font-bold text-gray-200 mb-4 flex items-center gap-2">
                <Briefcase size={18} className="text-purple-400" /> Projects, Certs, Interview Prep
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-5">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Projects</h4>
                  <div className="space-y-2">
                    {(aiPlan.projects || []).map(project => (
                      <div key={project} className="flex items-start gap-2 text-sm text-gray-300">
                        <ChevronRight size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                        <span>{project}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Certifications</h4>
                  <div className="space-y-2">
                    {(aiPlan.certifications || []).map(item => (
                      <div key={item} className="flex items-start gap-2 text-sm text-gray-300">
                        <ChevronRight size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Interview Prep</h4>
                  <div className="space-y-2">
                    {(aiPlan.interviewPrep || []).map(item => (
                      <div key={item} className="flex items-start gap-2 text-sm text-gray-300">
                        <ChevronRight size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlacementPlan;
