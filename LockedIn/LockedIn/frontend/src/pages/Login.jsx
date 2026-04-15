import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiUrl } from '../services/api';

const STEPS = [
  { key: 'email',      label: 'Verifying username...' },
  { key: 'password',   label: 'Verifying password...' },
  { key: 'loggedin',   label: 'Login successful! Fetching data...' },
  { key: 'discover',   label: 'Syncing academic records...' },
  { key: 'attendance', label: 'Fetching attendance & marks...' },
  { key: 'timetable',  label: 'Fetching timetable...' },
  { key: 'done',       label: 'All done! Loading your dashboard...' },
];

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);
  const eventSourceRef = useRef(null);

  // Captcha state
  const [captchaState, setCaptchaState] = useState(null);
  const [captchaInput, setCaptchaInput] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setCurrentStep(null);
    setCompletedSteps([]);
    setCaptchaState(null);

    const sessionId = crypto.randomUUID();

    // Start SSE listener for progress updates
    const evtSource = new EventSource(apiUrl(`/api/auth/login/status/${sessionId}`));
    eventSourceRef.current = evtSource;

    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.step === 'error') {
          setError(data.message);
          return;
        }
        setCurrentStep(data);
        setCompletedSteps(prev => {
          if (prev.some(s => s.step === data.step)) return prev;
          return [...prev, data];
        });
      } catch (_) { }
    };

    evtSource.onerror = () => {
      evtSource.close();
    };

    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, sessionId }),
      });

      const data = await response.json();

      evtSource.close();
      eventSourceRef.current = null;

      // Handle captcha requirement
      if (data.requiresCaptcha) {
        setCaptchaState({
          image: data.captchaImage,
          digest: data.captchaDigest,
          loginDigest: data.digest,
          identifier: data.identifier,
        });
        setLoading(false);
        setCompletedSteps([]);
        setCurrentStep(null);
        setError(data.message || 'Please solve the captcha to continue.');
        return;
      }

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('creds', JSON.stringify(formData));
        localStorage.setItem('student_data', JSON.stringify(data.student_data));
        localStorage.setItem('login_status_message', data.message || 'Login successful.');
        if (data.student_data?.attendance) {
          localStorage.setItem('attendance_data', JSON.stringify(data.student_data.attendance));
          if (data.student_data.marks) {
            localStorage.setItem('marks_data', JSON.stringify(data.student_data.marks));
          }
        }
        navigate('/dashboard');
      } else {
        setError(data.detail || 'Authentication failed');
      }
    } catch (err) {
      if (eventSourceRef.current) eventSourceRef.current.close();
      setError('Could not connect to the authentication server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptchaSubmit = async (e) => {
    e.preventDefault();
    if (!captchaInput.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/api/login/captcha'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cdigest: captchaState.digest,
          password: formData.password,
          digest: captchaState.loginDigest,
          identifier: captchaState.identifier,
          captcha: captchaInput,
        }),
      });

      const data = await response.json();

      if (data.isAuthenticated && data.cookies) {
        // Captcha passed — now fetch academic data with the session cookies
        setCaptchaState(null);
        setCompletedSteps([{ step: 'loggedin', message: 'Login successful!' }]);

        const syncRes = await fetch(apiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, sessionId: crypto.randomUUID() }),
        });
        const syncData = await syncRes.json();

        if (syncRes.ok && !syncData.requiresCaptcha) {
          localStorage.setItem('token', syncData.token);
          localStorage.setItem('creds', JSON.stringify(formData));
          localStorage.setItem('student_data', JSON.stringify(syncData.student_data));
          localStorage.setItem('login_status_message', syncData.message || 'Login successful.');
          if (syncData.student_data?.attendance) {
            localStorage.setItem('attendance_data', JSON.stringify(syncData.student_data.attendance));
            if (syncData.student_data.marks) {
              localStorage.setItem('marks_data', JSON.stringify(syncData.student_data.marks));
            }
          }
          navigate('/dashboard');
        } else {
          setError('Login succeeded but data sync failed. Please try again.');
        }
      } else {
        setError(data.message || 'Captcha verification failed. Try again.');
      }
    } catch (err) {
      setError('Failed to verify captcha. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-gray-400">Login with your SRM NetID to continue.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Progress Steps */}
        {loading && completedSteps.length > 0 && (
          <div className="mb-6 space-y-2">
            {completedSteps.map((step, idx) => {
              const isLatest = idx === completedSteps.length - 1;
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-2 text-sm ${
                    isLatest ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {isLatest ? (
                    <span className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  ) : (
                    <span className="text-green-400 flex-shrink-0">&#10003;</span>
                  )}
                  <span>{step.message}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Captcha Form */}
        {captchaState && !loading && (
          <form onSubmit={handleCaptchaSubmit} className="space-y-4">
            <p className="text-sm text-gray-300 mb-2">SRM requires a captcha verification. Please solve it below:</p>
            {captchaState.image && (
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${captchaState.image}`}
                  alt="Captcha"
                  className="rounded-lg border border-white/20"
                />
              </div>
            )}
            <input
              type="text"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              placeholder="Enter captcha text"
              className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder-gray-600"
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-lg shadow-lg transition-all"
            >
              Submit Captcha
            </button>
            <button
              type="button"
              onClick={() => { setCaptchaState(null); setError(''); }}
              className="w-full py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Cancel and try again
            </button>
          </form>
        )}

        {/* Login Form */}
        {!loading && !captchaState && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                NetID / Email
              </label>
              <input
                type="text"
                name="username"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder-gray-600"
                placeholder="ab1234@srmist.edu.in"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all placeholder-gray-600"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold rounded-lg shadow-lg flex justify-center items-center transition-all"
            >
              Connect to Academia
            </button>
          </form>
        )}

        {loading && completedSteps.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8">
            <span className="w-8 h-8 border-2 border-white/5 border-t-red-500 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Connecting to server...</p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-500">
          Your credentials are securely sent to the API. We do not store your password.
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
