import React, { useState } from 'react';
import { apiUrl } from '../services/api';
import { FileText, Briefcase, ChevronRight, Activity, CheckCircle, AlertTriangle } from 'lucide-react';

const ResumeJdMatcher = () => {
  const [file, setFile] = useState(null);
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleMatch = async () => {
    if (!file) {
      setError("Please upload your resume PDF.");
      return;
    }
    if (!jdText.trim()) {
      setError("Please paste the job description text.");
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // 1. Upload & Parse Resume
      const formData = new FormData();
      formData.append('resume', file);
      
      const parseRes = await fetch(apiUrl('/api/interview/upload-resume'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      
      if (!parseRes.ok) throw new Error("Failed to parse resume PDF. Ensure it's valid.");
      const parseData = await parseRes.json();
      const resumeText = parseData.text;

      // 2. ML Match against JD
      const matchRes = await fetch(apiUrl('/api/ml/resume-match'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ resume_text: resumeText, jd_text: jdText })
      });

      if (!matchRes.ok) throw new Error("Failed to run Cosine Similarity Match.");
      const matchData = await matchRes.json();
      setResult(matchData);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-8 max-w-4xl w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
          <Activity size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-200">AI Resume Matcher</h2>
          <p className="text-sm text-gray-500">Compare your Resume against any Job Description using TF-IDF NLP.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Resume Box */}
        <div className="border border-dashed border-white/20 rounded-xl p-4 bg-black/20 flex flex-col items-center justify-center text-center">
          <FileText size={32} className="text-gray-400 mb-2" />
          <h3 className="text-sm font-bold text-gray-300 mb-1">Upload Resume</h3>
          <p className="text-xs text-gray-500 mb-4">PDF format only</p>
          <input 
            type="file" 
            accept=".pdf" 
            className="text-xs text-gray-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-white/10 file:text-white/80 hover:file:bg-white/20 cursor-pointer"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>

        {/* JD Box */}
        <div className="flex flex-col h-full relative">
          <Briefcase size={16} className="absolute top-3 left-3 text-gray-500" />
          <textarea 
            placeholder="Paste Job Description here..."
            className="w-full h-full min-h-[140px] bg-black/20 border border-white/10 rounded-xl pl-9 pr-3 py-3 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 resize-none"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          ></textarea>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Action Area */}
      <div className="flex items-center gap-4">
        <button 
          onClick={handleMatch}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex items-center gap-2"
        >
          {loading ? 'Analyzing NLP Features...' : 'Run Mathematical Match'}
        </button>

        {result && (
          <div className="flex-1 flex gap-4 ml-4">
            <div className="flex flex-col px-4 py-2 bg-black/30 rounded-lg border border-white/5 whitespace-nowrap">
              <span className="text-xs text-gray-500 font-bold uppercase">Similarity Score</span>
              <span className={`text-xl font-bold ${result.match_score >= 70 ? 'text-emerald-400' : result.match_score >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                {result.match_score}%
              </span>
            </div>
            {result.missing_keywords && result.missing_keywords.length > 0 && (
              <div className="flex flex-col px-4 py-2 bg-black/30 rounded-lg border border-white/5 w-full">
                <span className="text-xs text-gray-500 font-bold uppercase mb-1">Missing Keywords Found In JD</span>
                <div className="flex flex-wrap gap-2">
                  {result.missing_keywords.map(kw => (
                    <span key={kw} className="bg-red-500/10 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-500/20">{kw}</span>
                  ))}
                </div>
              </div>
            )}
            {result.missing_keywords && result.missing_keywords.length === 0 && (
              <div className="flex flex-col justify-center px-4 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400 text-sm font-medium">
                <CheckCircle size={16} className="inline mr-1" /> Perfect Keyword Match!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeJdMatcher;
