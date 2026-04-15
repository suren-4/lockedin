import React from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  Briefcase,
  BrainCircuit,
  Building2,
  Mic,
  MicOff,
  PlayCircle,
  Sparkles,
  Square,
  Volume2,
  Upload,
} from 'lucide-react';
import { apiUrl } from '../services/api';

const MODES = [
  {
    id: 'hr',
    label: 'HR',
    description: 'Behavioral and communication round focused on self-awareness and motivation.',
    icon: Briefcase,
    accent: 'from-pink-500 to-rose-500',
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'System thinking, CS fundamentals, problem-solving, and tradeoff explanations.',
    icon: BrainCircuit,
    accent: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'resume',
    label: 'Resume',
    description: 'Project ownership, impact, metrics, and resume-depth probing.',
    icon: Sparkles,
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'company',
    label: 'Company',
    description: 'Company-fit questions shaped around motivation, culture, and adaptability.',
    icon: Building2,
    accent: 'from-amber-500 to-orange-500',
  },
];

const STORAGE_KEY = 'lockedin_mock_interview_history';

function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function persistSession(session) {
  const existing = readHistory();
  const next = [session, ...existing].slice(0, 8);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

const scoreTone = (value) => {
  if (value >= 80) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
  if (value >= 60) return 'text-amber-300 border-amber-500/20 bg-amber-500/10';
  return 'text-rose-300 border-rose-500/20 bg-rose-500/10';
};

const MockInterviewer = () => {
  const [mode, setMode] = React.useState('hr');
  const [companyName, setCompanyName] = React.useState('Google');
  const [isSessionActive, setIsSessionActive] = React.useState(false);
  const [currentQuestion, setCurrentQuestion] = React.useState('');
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [answer, setAnswer] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const [transcript, setTranscript] = React.useState([]);
  const [currentFeedback, setCurrentFeedback] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [resumeText, setResumeText] = React.useState('');
  const [anticipatedQuestions, setAnticipatedQuestions] = React.useState([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [savedSessions, setSavedSessions] = React.useState(() => readHistory());
  const [speechSupported, setSpeechSupported] = React.useState(false);
  const [voiceActive, setVoiceActive] = React.useState(false);
  const [voiceStatus, setVoiceStatus] = React.useState('Voice ready');
  const recognitionRef = React.useRef(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    setSpeechSupported(Boolean(getSpeechRecognition()));
  }, []);

  React.useEffect(() => {
    if (!speechSupported) return undefined;

    const SpeechRecognition = getSpeechRecognition();
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setVoiceActive(true);
      setVoiceStatus('Listening...');
    };

    recognition.onend = () => {
      setVoiceActive(false);
      setVoiceStatus('Voice ready');
    };

    recognition.onerror = () => {
      setVoiceActive(false);
      setVoiceStatus('Voice unavailable right now');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        finalTranscript += event.results[i][0].transcript;
      }
      setAnswer(finalTranscript.trim());
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [speechSupported]);

  const selectedMode = MODES.find((item) => item.id === mode) || MODES[0];
  const studentDataRef = React.useRef(null);

  if (studentDataRef.current === null) {
    try {
      studentDataRef.current = JSON.parse(localStorage.getItem('student_data') || 'null');
    } catch {
      studentDataRef.current = null;
    }
  }

  const speak = (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) return;
    if (voiceActive) {
      recognitionRef.current.stop();
      return;
    }
    recognitionRef.current.start();
  };

  const resetSession = () => {
    setIsSessionActive(false);
    setCurrentQuestion('');
    setQuestionIndex(0);
    setAnswer('');
    setTranscript([]);
    setCurrentFeedback(null);
    setSummary(null);
    window.speechSynthesis?.cancel();
    recognitionRef.current?.stop();
  };

  const completeSession = async (finalTranscript) => {
    try {
        const response = await axios.post(apiUrl('/api/interview/summary'), {
          mode,
          transcript: finalTranscript,
          student_data: studentDataRef.current,
        });

      const sessionSummary = {
        ...response.data,
        createdAt: new Date().toISOString(),
        companyName,
      };

      setSummary(sessionSummary);
      persistSession(sessionSummary);
      setSavedSessions(readHistory());
    } catch (error) {
      console.error('Summary error', error);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('resume', file);
    
    try {
      const { data } = await axios.post(apiUrl('/api/interview/upload-resume'), formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResumeText(data.text);
    } catch (error) {
      console.error('Upload error', error);
      alert('Failed to upload and parse resume. Please try a standard PDF.');
    } finally {
      setIsUploading(false);
    }
  };

  const generateAnticipatedQuestions = async () => {
    if (!resumeText) return;
    setIsGeneratingQuestions(true);
    try {
      const { data } = await axios.post(apiUrl('/api/interview/generate-resume-questions'), {
        resumeText,
      });
      if (data && data.questions) {
        setAnticipatedQuestions(data.questions);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const startInterview = async () => {
    setIsStarting(true);
    setSummary(null);
    setCurrentFeedback(null);
    setTranscript([]);

    try {
      const response = await axios.post(apiUrl('/api/interview/start'), {
        mode,
        companyName,
        student_data: { ...studentDataRef.current, resumeContext: resumeText },
      });

      setIsSessionActive(true);
      setCurrentQuestion(response.data.question);
      setQuestionIndex(response.data.questionIndex || 0);
      setAnswer('');
      speak(response.data.question);
    } catch (error) {
      console.error('Interview start failed', error);
    } finally {
      setIsStarting(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim() || isSubmitting || !currentQuestion) return;

    recognitionRef.current?.stop();
    setIsSubmitting(true);

    try {
      const response = await axios.post(apiUrl('/api/interview/respond'), {
        mode,
        companyName,
        questionIndex,
        answer,
        history: transcript,
        student_data: { ...studentDataRef.current, resumeContext: resumeText },
      });

      const nextEntry = {
        question: currentQuestion,
        answer,
        score: response.data.score,
        communication: response.data.communication,
        technicalDepth: response.data.technicalDepth,
        confidence: response.data.confidence,
        feedback: response.data.feedback,
        idealAnswer: response.data.idealAnswer,
        strengths: response.data.strengths || [],
        gaps: response.data.gaps || [],
      };

      const nextTranscript = [...transcript, nextEntry];
      setTranscript(nextTranscript);
      setCurrentFeedback(nextEntry);
      setAnswer('');

      if (response.data.shouldEnd) {
        setCurrentQuestion('');
        await completeSession(nextTranscript);
        setIsSessionActive(false);
      } else {
        setCurrentQuestion(response.data.followUpQuestion);
        setQuestionIndex(response.data.questionIndex ?? questionIndex + 1);
        speak(response.data.followUpQuestion);
      }
    } catch (error) {
      console.error('Interview response failed', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const averageLiveScore = transcript.length
    ? Math.round(transcript.reduce((sum, item) => sum + (item.score || 0), 0) / transcript.length)
    : 0;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8">
      <div className="flex flex-col gap-6">
        <section className="glass-panel border border-white/10 rounded-3xl overflow-hidden">
          <div className="border-b border-white/10 p-6 bg-gradient-to-r from-white/[0.03] to-transparent">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-red-300">AI Mock Interviewer</p>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-100 mt-2">Practice interviews with voice, scoring, and follow-up pressure</h1>
                <p className="text-gray-400 mt-3 max-w-3xl">
                  Free browser speech recognition handles the voice round. The backend interviewer adapts questions, scores answers, and generates a post-round report.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 min-w-[220px]">
                <p className="text-xs text-gray-500 uppercase tracking-[0.22em]">Live Score</p>
                <p className="text-4xl font-black text-gray-100 mt-2">{averageLiveScore || '--'}</p>
                <p className="text-sm text-gray-400 mt-2">{transcript.length} answered in this round</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {MODES.map((item) => {
                const Icon = item.icon;
                const active = item.id === mode;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      active
                        ? 'border-red-500/30 bg-red-500/10 shadow-[inset_0_0_24px_rgba(239,68,68,0.08)]'
                        : 'border-white/10 bg-black/20 hover:bg-black/30'
                    }`}
                  >
                    <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent}`}>
                      <Icon size={20} className="text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-100 mt-4">{item.label}</h2>
                    <p className="text-sm text-gray-400 mt-2">{item.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-4 mt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-gray-300">Target company (Optional)</span>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Google, Zoho, TCS, Amazon..."
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-gray-100 outline-none focus:border-red-400/40"
                  />
                </label>
                
                {mode === 'resume' && (
                  <label className="block">
                    <span className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                       <Sparkles size={16}/> Upload Resume (PDF)
                    </span>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleResumeUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="w-full rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-emerald-400/70 py-3 flex items-center justify-center gap-2">
                          <Upload size={18} />
                          {isUploading ? 'Parsing Resume...' : resumeText ? 'Resume Uploaded ✓' : 'Click to Upload PDF'}
                        </div>
                      </div>
                      {resumeText && (
                        <button
                          onClick={generateAnticipatedQuestions}
                          disabled={isGeneratingQuestions}
                          className="px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-all"
                        >
                          {isGeneratingQuestions ? 'Scanning...' : 'Suggest Questions'}
                        </button>
                      )}
                    </div>
                  </label>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={startInterview}
                  disabled={isStarting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-8 py-3 font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-60 shadow-[0_4px_12px_rgba(239,68,68,0.3)]"
                >
                  <PlayCircle size={18} />
                  {isStarting ? 'Preparing...' : 'Start Interview'}
                </button>
                <button
                  type="button"
                  onClick={resetSession}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-5 py-3 font-semibold text-gray-200 transition-colors hover:bg-black/30"
                >
                  <Square size={16} />
                  Reset
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#0b0b12] p-5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gray-500">Current prompt</p>
                  <h3 className="text-2xl font-semibold text-gray-100 mt-2">
                    {currentQuestion || 'Start a session to get the first question'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => speak(currentQuestion)}
                  disabled={!currentQuestion}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 disabled:opacity-40"
                >
                  <Volume2 size={16} />
                  Read aloud
                </button>
              </div>

              <div className="mt-6">
                <label className="text-sm font-semibold text-gray-300">Your answer</label>
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  rows={7}
                  placeholder="Speak or type your answer here..."
                  className="mt-2 w-full rounded-3xl border border-white/10 bg-black/40 px-4 py-4 text-gray-100 outline-none focus:border-red-400/40"
                />
                <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleVoice}
                      disabled={!speechSupported}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                        voiceActive ? 'bg-rose-600 text-white' : 'border border-white/10 bg-black/20 text-gray-200'
                      } disabled:opacity-40`}
                    >
                      {voiceActive ? <MicOff size={16} /> : <Mic size={16} />}
                      {voiceActive ? 'Stop Voice' : 'Use Voice'}
                    </button>
                    <span className="text-sm text-gray-400">{speechSupported ? voiceStatus : 'SpeechRecognition not supported in this browser'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={submitAnswer}
                    disabled={!isSessionActive || isSubmitting || !answer.trim()}
                    className="rounded-2xl bg-white text-black px-5 py-3 font-semibold disabled:opacity-40"
                  >
                    {isSubmitting ? 'Evaluating...' : 'Submit Answer'}
                  </button>
                </div>
              </div>
            </div>

            {currentFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-white/10 bg-black/20 p-5"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    ['Overall', currentFeedback.score],
                    ['Communication', currentFeedback.communication],
                    ['Confidence', currentFeedback.confidence],
                  ].map(([label, value]) => (
                    <div key={label} className={`rounded-2xl border px-4 py-3 ${scoreTone(value)}`}>
                      <p className="text-xs uppercase tracking-[0.22em]">{label}</p>
                      <p className="text-2xl font-bold mt-2">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
                  <div className="rounded-2xl bg-[#0b0b12] border border-white/10 p-4">
                    <p className="text-sm font-semibold text-gray-200">Coach feedback</p>
                    <p className="text-sm text-gray-400 mt-2">{currentFeedback.feedback}</p>
                    <p className="text-sm font-semibold text-gray-200 mt-4">Ideal answer pattern</p>
                    <p className="text-sm text-gray-400 mt-2">{currentFeedback.idealAnswer}</p>
                  </div>
                  <div className="rounded-2xl bg-[#0b0b12] border border-white/10 p-4">
                    <p className="text-sm font-semibold text-gray-200">Strengths</p>
                    <ul className="mt-2 space-y-2 text-sm text-gray-400">
                      {currentFeedback.strengths.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                    <p className="text-sm font-semibold text-gray-200 mt-4">Improve next</p>
                    <ul className="mt-2 space-y-2 text-sm text-gray-400">
                      {currentFeedback.gaps.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {mode === 'resume' && anticipatedQuestions.length > 0 && (
              <div className="mt-8">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-500 flex items-center gap-2 mb-4"><Sparkles size={14} /> Anticipated Questions</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {anticipatedQuestions.map((q, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      key={idx} 
                      className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4"
                    >
                      <p className="text-sm font-semibold text-emerald-400">Question {idx + 1}</p>
                      <p className="text-sm text-gray-300 mt-1">{q}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default MockInterviewer;
