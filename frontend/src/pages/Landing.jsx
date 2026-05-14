import { Link, useNavigate } from 'react-router-dom';
import {
  FileText, ArrowRight, UploadCloud, MessageSquare, SearchCheck,
  CheckCircle2, Settings, FileSearch, HelpCircle, FileType2,
  ShieldAlert, Download, Layers, Sun, Moon, Github, Linkedin,
  Mail, Sparkles
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

export default function Landing() {
  const { isDarkMode, setIsDarkMode, getLogo, toggleTheme } = useTheme();
  const { token } = useAuth();
  const navigate = useNavigate();

  // Enforce light theme on landing page by default
  useEffect(() => {
    setIsDarkMode(false);
  }, [setIsDarkMode]);

  const handleStartExploring = () => {
    if (token) {
      navigate('/app');
    } else {
      navigate('/signup');
    }
  };

  const teamMembers = [
    {
      name: 'Sachin Patil',
      photo: '/assets/sachin.png',
      github: 'https://github.com/sachinpatil1109',
      linkedin: 'https://linkedin.com/in/sachin-patil11',
      email: 'mailto:sachinmpatil11699@gmail.com',
    },
    {
      name: 'Sumit Bhoi',
      photo: '/assets/sumit.png',
      github: 'https://github.com/MrSumitBhoi1307',
      linkedin: 'https://www.linkedin.com/in/sumit-bhoi1307',
      email: 'mailto:sumitbhoi2839@gmail.com',
    },
    {
      name: 'Chetan Satote',
      photo: '/assets/chetan.png',
      github: 'https://github.com/chetansatote',
      linkedin: 'https://www.linkedin.com/in/chetan-satote',
      email: 'mailto:satotechetan507@gmail.com',
    },
  ];

  return (
    <div className="app-background min-h-screen text-gray-900 dark:text-white transition-colors duration-300 font-sans overflow-x-hidden">

      {/* ────────────────────────── FLOATING NAVBAR ────────────────────────── */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] w-[calc(100%-2rem)] max-w-5xl">
        <div className="bg-white/70 dark:bg-cards-dark/70 backdrop-blur-2xl rounded-2xl border border-gray-200/60 dark:border-white/10 shadow-lg shadow-black/[0.04] dark:shadow-black/30 px-5 sm:px-6 h-14 flex items-center justify-between transition-colors duration-300">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src={getLogo()} alt="NEXORA Logo" className="h-7" />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-200"
              aria-label="Toggle Theme"
            >
              {isDarkMode
                ? <Sun className="w-5 h-5 text-secondary" />
                : <Moon className="w-5 h-5 text-gray-500" />}
            </button>

            {token ? (
              <Link
                to="/app"
                className="text-sm font-semibold text-white bg-primary hover:bg-primary-light transition-all duration-200 rounded-xl px-5 py-2 shadow-md shadow-primary/20"
              >
                Dashboard
              </Link>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary transition-colors px-3 py-2 rounded-xl"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="text-sm font-semibold text-white bg-primary hover:bg-primary-light transition-all duration-200 rounded-xl px-5 py-2 shadow-md shadow-primary/20"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ────────────────── HERO FULL-SCREEN WITH GRADIENT BG ────────────────── */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      >
        {/* Animated floating orbs for depth */}
        <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
          <div
            className="absolute top-[-8%] left-[10%] w-[30%] h-[30%] rounded-full bg-primary/10 blur-[100px]"
            style={{ animation: 'pulse 8s ease-in-out infinite' }}
          />
          <div
            className="absolute top-[30%] right-[5%] w-[25%] h-[35%] rounded-full bg-accent/15 blur-[100px]"
            style={{ animation: 'pulse 10s ease-in-out infinite' }}
          />
          <div
            className="absolute bottom-[10%] left-[20%] w-[18%] h-[18%] rounded-full bg-secondary/15 blur-[80px]"
            style={{ animation: 'pulse 12s ease-in-out infinite' }}
          />
        </div>

        {/* Hero Content */}
        <main className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-24 pb-0 max-w-4xl mx-auto flex-1">
          {/* Badge pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 dark:bg-white/10 border border-primary/20 dark:border-primary/30 mb-8 backdrop-blur-md shadow-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Document Intelligence</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6 leading-[1.1]">
            Your Knowledge,{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-pink-400 to-accent">
              Instantly Searchable
            </span>
          </h1>

          {/* Subtext */}
          <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 mb-10 max-w-2xl leading-relaxed">
            Upload any document. Ask anything. Get answers with exact page
            citations — powered by advanced AI retrieval.
          </p>

          {/* CTA Button */}
          <button
            onClick={handleStartExploring}
            className="group flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-bold text-lg bg-primary hover:bg-primary-light text-white transition-all duration-300 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/35 hover:-translate-y-0.5 cursor-pointer"
          >
            Start Exploring
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
          </button>
        </main>

        {/* Stats Panel — inside hero, at the bottom */}
        <div className="relative z-10 flex justify-center px-4 pb-10 pt-8 w-full">
          <div className="glass-card max-w-xl w-full px-6 sm:px-8 py-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-200/60 dark:divide-white/10">
              {[
                { value: '500', label: 'Page Limit', colors: 'from-primary to-pink-400' },
                { value: '8', label: 'File Formats', colors: 'from-primary to-pink-400' },
                { value: '100%', label: 'Page Citations', colors: 'from-primary to-pink-400' },
              ].map((stat, i) => (
                <div key={i} className="flex-1 flex flex-col items-center text-center pt-3 sm:pt-0">
                  <span className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${stat.colors} mb-0.5`}>
                    {stat.value}
                  </span>
                  <span className="text-[11px] font-medium text-gray-400 uppercase tracking-widest">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* ────────────────────────── HOW IT WORKS ────────────────────────── */}
      <section className="relative z-10 py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 dark:bg-white/10 border border-primary/20 dark:border-primary/30 mb-8 backdrop-blur-md shadow-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">How It Works</span>
          </div>
          <p className="text-gray-400 mb-10 text-sm">
            Three simple steps to unlock your documents
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-1/2 left-[17%] right-[17%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent -z-10" />

            {[
              { step: 1, Icon: UploadCloud, title: 'Upload your document', desc: 'Support for PDF, DOCX, TXT and more formats.' },
              { step: 2, Icon: MessageSquare, title: 'Ask any question', desc: 'Use natural language to query your entire document context.' },
              { step: 3, Icon: SearchCheck, title: 'Get precise answers', desc: 'Receive answers with exact page citations and source previews.' },
            ].map(({ step, Icon, title, desc }) => (
              <div
                key={step}
                className="flex flex-col items-center bg-white/80 dark:bg-cards-dark/80 backdrop-blur-sm p-7 rounded-2xl border border-gray-100 dark:border-white/5 relative z-10 group hover:border-primary/20 dark:hover:border-primary/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/[0.06]"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center text-primary mb-5 text-lg font-bold">
                  {step}
                </div>
                <Icon className="w-8 h-8 text-primary/50 mb-3 group-hover:text-primary/70 transition-colors duration-200" />
                <h3 className="text-lg font-bold mb-1.5">{title}</h3>
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────── SUPPORTED FILE FORMATS ──────────────────── */}
      <section className="relative z-10 py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 dark:bg-white/10 border border-primary/20 dark:border-primary/30 mb-8 backdrop-blur-md shadow-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Supported File Formats</span>
          </div>
          <p className="text-gray-400 mb-10 text-sm text-center">
            Wide format support with more coming soon
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { ext: 'PDF', status: 'live', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <FileText className="w-5 h-5 text-primary" /> },
              { ext: 'DOCX', status: 'live', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <FileType2 className="w-5 h-5 text-primary" /> },
              { ext: 'TXT', status: 'live', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <FileText className="w-5 h-5 text-primary" /> },
              { ext: 'MD/MDX', status: 'planned', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', icon: <FileText className="w-5 h-5 text-gray-400" /> },
              { ext: 'CSV/XLSX', status: 'live', color: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400', icon: <FileText className="w-5 h-5 text-primary" /> },
              { ext: 'PPTX', status: 'live', color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', icon: <FileType2 className="w-5 h-5 text-primary" /> },
              { ext: 'JSON/XML', status: 'future', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', icon: <Settings className="w-5 h-5 text-gray-400" /> },
              { ext: 'PNG/JPG', status: 'future', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', icon: <FileText className="w-5 h-5 text-gray-400" /> },
            ].map((fmt, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center p-5 bg-white/80 dark:bg-cards-dark/80 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-white/5 hover:border-primary/20 dark:hover:border-primary/20 transition-all duration-300 group hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/[0.04]"
              >
                <div className="mb-2.5 group-hover:scale-110 transition-transform duration-200">
                  {fmt.icon}
                </div>
                <span className="font-bold text-gray-900 dark:text-white mb-2 text-sm">
                  {fmt.ext}
                </span>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${fmt.color}`}>
                  {fmt.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────── POWERFUL FEATURES ────────────────────── */}
      <section className="relative z-10 py-16 px-4">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 dark:bg-white/10 border border-primary/20 dark:border-primary/30 mb-8 backdrop-blur-md shadow-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Powerful Features  </span>
          </div>
          <p className="text-gray-400 mb-10 text-sm text-center">
            Everything you need for intelligent document exploration
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { Icon: FileSearch, title: 'Document Summary', desc: 'Auto-generates a concise summary immediately after indexing your document.' },
              { Icon: HelpCircle, title: 'Suggested Questions', desc: 'Smart question chips to help you get started with your new document.' },
              { Icon: Layers, title: 'Multi-Document Chat', desc: 'Ask questions across multiple files simultaneously for cross-reference.' },
              { Icon: CheckCircle2, title: 'Confidence Badge', desc: 'Color-coded accuracy indicators help you trust the generated answers.' },
              { Icon: Download, title: 'Export Chat as PDF', desc: 'Download your full Q&A session with all exact page citations.' },
              { Icon: ShieldAlert, title: 'Smart Page Limit', desc: 'Warns about large documents and lets you select specific page ranges.' },
            ].map(({ Icon, title, desc }, i) => (
              <div
                key={i}
                className="p-5 bg-white/80 dark:bg-cards-dark/80 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-white/5 group hover:border-primary/20 dark:hover:border-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/[0.06]"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-3 group-hover:from-primary/20 group-hover:to-accent/20 transition-all duration-300">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-bold mb-1">{title}</h3>
                <p className="text-gray-400 dark:text-gray-500 text-sm leading-relaxed">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────── FOOTER WITH CREATOR CARDS ──────────────────── */}
      <footer className="relative z-10 border-t border-gray-200/50 dark:border-white/10 bg-gray-50/80 dark:bg-cards-dark/40 backdrop-blur-sm pt-14 pb-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          {/* Logo + tagline */}
          {/* Badge pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 dark:bg-white/10 border border-primary/20 dark:border-primary/30 mb-8 backdrop-blur-md shadow-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Meet The Creators</span>
          </div>

          {/* Creator Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {teamMembers.map((member, i) => (
              <div
                key={i}
                className="flex flex-col items-center p-6 bg-white/70 dark:bg-cards-dark/70 backdrop-blur-sm rounded-2xl border border-gray-100 dark:border-white/5 group hover:border-primary/20 dark:hover:border-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/[0.06]"
              >
                {/* Profile Photo */}
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-30 h-30 rounded-full object-cover  mb-3 shadow-md ring-2 ring-white dark:ring-white/10 group-hover:ring-primary/30 group-hover:shadow-lg group-hover:scale-105 transition-all duration-300"
                />
                <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-3">
                  {member.name}
                </h4>
                {/* Social links */}
                <div className="flex items-center gap-2">
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-200 text-gray-400 hover:text-primary"
                    aria-label={`${member.name} GitHub`}
                  >
                    <Github className="w-4 h-4" />
                  </a>
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-200 text-gray-400 hover:text-primary"
                    aria-label={`${member.name} LinkedIn`}
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                  <a
                    href={member.email}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all duration-200 text-gray-400 hover:text-primary"
                    aria-label={`${member.name} Email`}
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Copyright */}
          <div className="text-center text-xs text-gray-400 pt-6 border-t border-gray-200/50 dark:border-white/10">
            © 2026 NEXORA — All rights reserved
          </div>
        </div>
      </footer>

    </div>
  );
}