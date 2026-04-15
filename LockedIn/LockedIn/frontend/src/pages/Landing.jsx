import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import FeatureGrid from '../components/FeatureGrid';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-500 selection:text-white">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-10 py-6 border-b border-white/10 backdrop-blur-md fixed w-full top-0 z-50">
        <div className="font-bold text-2xl tracking-tighter">Locked<span className="text-red-600">In</span></div>
        <div className="space-x-8">
          <a href="#features" className="text-sm font-medium hover:text-red-400 transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm font-medium hover:text-red-400 transition-colors">How it Works</a>
          <button 
            onClick={() => navigate('/login')}
            className="px-5 py-2 bg-[#151521] text-black text-sm font-bold rounded-full hover:bg-gray-200 transition-transform hover:scale-105"
          >
            Enter Portal
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6 md:px-10 max-w-7xl mx-auto flex flex-col items-center justify-center text-center min-h-screen">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          <div className="inline-block px-4 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-medium mb-4">
            SRM Academia Integration ⚡️
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight leading-tight">
            Master your schedule.<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
              Get LockedIn.
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mt-6">
            The ultimate productivity suite for SRM students. Track your timetable, monitor attendance, manage daily activities, solve LeetCode problems, and get AI-powered placement guidance — all in one premium dashboard.
          </p>
          
          <div className="flex gap-4 justify-center mt-10">
            <button 
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-lg transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(220,38,38,0.6)]"
            >
              Start Your Journey
            </button>
            <button className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg text-lg transition-colors border border-white/10">
              View Demo
            </button>
          </div>
        </motion.div>
      </main>

      {/* Features */}
      <section id="features" className="px-6 md:px-10 pb-20">
        <div className="max-w-7xl mx-auto">
          <FeatureGrid
            theme="dark"
            eyebrow="Key Features"
            title="Built Different, Built Smarter"
            description="Every feature is tuned for student energy cycles, campus schedule constraints, and placement pressure."
          />
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-6 md:px-10 pb-24">
        <div className="max-w-5xl mx-auto rounded-3xl border border-red-500/20 bg-gradient-to-b from-red-500/10 to-transparent p-8 md:p-12">
          <h2 className="text-3xl md:text-4xl font-black text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {[
              {
                title: 'Connect Data',
                body: 'Sync timetable, attendance, and priorities in under 2 minutes.',
              },
              {
                title: 'Get Smart Plan',
                body: 'LockedIn creates focused micro-sprints around your free windows.',
              },
              {
                title: 'Execute Daily',
                body: 'Stay consistent with contextual reminders and momentum tracking.',
              },
            ].map((step, idx) => (
              <div key={step.title} className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-red-400 font-semibold text-sm">Step 0{idx + 1}</p>
                <h3 className="text-xl font-bold mt-1">{step.title}</h3>
                <p className="text-gray-300 mt-2">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors font-semibold"
            >
              Enter Portal
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
