import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ResumeJdMatcher from '../components/ResumeJdMatcher';

const defaultJobs = [
  { id: '1', company: 'Google', role: 'Software Engineer', status: 'Interviewing', ctc: '25 LPA', date: '2023-10-12' },
  { id: '2', company: 'Microsoft', role: 'Frontend Developer', status: 'Applied', ctc: '20 LPA', date: '2023-11-01' },
  { id: '3', company: 'Amazon', role: 'SDE 1', status: 'Wishlist', ctc: '22 LPA', date: '' },
  { id: '4', company: 'Startup Inc', role: 'Full Stack', status: 'Offered', ctc: '15 LPA', date: '2023-09-15' },
];

const COLUMNS = ['Wishlist', 'Applied', 'Interviewing', 'Offered', 'Rejected'];

const JobTracker = () => {
  const [jobs, setJobs] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newJob, setNewJob] = useState({ company: '', role: '', status: 'Wishlist', ctc: '', date: '' });

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('lockedin_job_tracker');
    if (saved) {
      setJobs(JSON.parse(saved));
    } else {
      setJobs(defaultJobs);
      localStorage.setItem('lockedin_job_tracker', JSON.stringify(defaultJobs));
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (jobs.length > 0) {
      localStorage.setItem('lockedin_job_tracker', JSON.stringify(jobs));
    }
  }, [jobs]);

  const handleUpdateStatus = (id, newStatus) => {
    setJobs(jobs.map(job => job.id === id ? { ...job, status: newStatus } : job));
  };

  const handleDelete = (id) => {
    setJobs(jobs.filter(job => job.id !== id));
  };

  const handleAddJob = (e) => {
    e.preventDefault();
    if (!newJob.company || !newJob.role) return;
    
    setJobs([...jobs, { ...newJob, id: Date.now().toString() }]);
    setNewJob({ company: '', role: '', status: 'Wishlist', ctc: '', date: '' });
    setShowModal(false);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-200">Application Pipeline</h1>
          <p className="text-gray-500 mt-1">Track your placement journey and company statuses.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-[0_8px_24px_rgba(0,0,0,0.6)] flex items-center gap-2"
        >
          <span>+</span> Add Application
        </button>
      </div>

      <ResumeJdMatcher />

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max h-full">
          {COLUMNS.map((column) => (
            <div key={column} className="w-80 flex flex-col glass-panel rounded-2xl border border-white/10 p-4">
              <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="font-bold text-gray-300">{column}</h3>
                <span className="bg-white/10 text-gray-400 text-xs font-bold px-2.5 py-1 rounded-full border border-white/10">
                  {jobs.filter(j => j.status === column).length}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                <AnimatePresence>
                  {jobs.filter(j => j.status === column).map(job => (
                    <motion.div
                      key={job.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-white/5 p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-gray-200">{job.company}</h4>
                        <button 
                          onClick={() => handleDelete(job.id)}
                          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-sm font-medium text-indigo-600 mb-2">{job.role}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                        {job.ctc && <span className="flex items-center gap-1">💰 {job.ctc}</span>}
                        {job.date && <span className="flex items-center gap-1">📅 {job.date}</span>}
                      </div>

                      {/* Moving Controls (Simple buttons instead of complex drag/drop) */}
                      <div className="flex gap-1 overflow-x-auto hide-scrollbar pt-2 border-t border-white/5">
                        {COLUMNS.filter(c => c !== column).map(targetCol => (
                          <button
                            key={targetCol}
                            onClick={() => handleUpdateStatus(job.id, targetCol)}
                            className="whitespace-nowrap px-2.5 py-1 bg-white/5 hover:bg-indigo-500/20 text-gray-400 hover:text-indigo-400 text-[10px] rounded border border-white/10 transition-colors font-medium"
                          >
                            → {targetCol}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {jobs.filter(j => j.status === column).length === 0 && (
                  <div className="h-24 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-gray-500 text-sm">
                    No applications here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Job Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-black/95 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-white/10"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Add Application</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <form onSubmit={handleAddJob} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Company *</label>
                  <input required type="text" value={newJob.company} onChange={(e) => setNewJob({...newJob, company: e.target.value})} className="w-full px-4 py-2 border border-white/20 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. Netflix" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Role *</label>
                  <input required type="text" value={newJob.role} onChange={(e) => setNewJob({...newJob, role: e.target.value})} className="w-full px-4 py-2 border border-white/20 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. Backend Engineer" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Expected CTC</label>
                    <input type="text" value={newJob.ctc} onChange={(e) => setNewJob({...newJob, ctc: e.target.value})} className="w-full px-4 py-2 border border-white/20 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. 15 LPA" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
                    <input type="date" value={newJob.date} onChange={(e) => setNewJob({...newJob, date: e.target.value})} className="w-full px-4 py-2 border border-white/20 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                  <select value={newJob.status} onChange={(e) => setNewJob({...newJob, status: e.target.value})} className="w-full px-4 py-2 border border-white/20 rounded-lg focus:ring-2 focus:ring-indigo-500">
                    {COLUMNS.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg font-medium transition-colors">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">Save Application</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default JobTracker;