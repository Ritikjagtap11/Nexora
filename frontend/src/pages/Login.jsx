import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';
import { Database, Loader2, ArrowLeft, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setToken, loginWithGoogle, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const loading = authLoading || isSubmitting;
  const setLoading = setIsSubmitting;
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme, getLogo, setIsDarkMode } = useTheme();

  // Enforce light theme on auth pages
  useEffect(() => {
    setIsDarkMode(false);
  }, [setIsDarkMode]);

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      // Step 1: Sign in with Firebase
      const { signInWithEmailAndPassword } 
        = await import('firebase/auth')
      
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      )
      const user = userCredential.user
      
      // Step 2: Get Firebase ID token
      const token = await user.getIdToken()
      
      // Step 3: Create session with backend
      await fetch('http://localhost:8000/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token })
      })
      
      // Step 4: Update AuthContext
      setToken(token)  // or login(token) — match existing AuthContext
      
      // Step 5: Navigate to dashboard
      navigate('/app', { replace: true })
      
    } catch (err) {
      if (err.code === 'auth/user-not-found' ||
          err.code === 'auth/wrong-password' ||
          err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.')
      } else {
        setError(err.message || 'Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    const res = await loginWithGoogle();
    if (res.success) {
      navigate('/app');
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark flex flex-col justify-center items-center p-4 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
        <Link to="/" className="p-2 rounded-full bg-white/50 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 transition-colors shadow-sm text-gray-700 dark:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <button onClick={toggleTheme} className="p-2 rounded-full bg-white/50 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 transition-colors shadow-sm text-gray-700 dark:text-gray-300">
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
      
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-accent/20 dark:bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/20 dark:bg-primary/10 blur-[100px] pointer-events-none" />
      
      <div className="glass-card w-full max-w-md p-8 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-25 h-16 bg-white dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-gray-100 dark:border-white/10">
            <img src={getLogo()} alt="NEXORA Logo" className="h-7 " />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">Welcome Back to NEXORA</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center">Sign in to continue to your intelligent workspace.</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 text-red-600 dark:text-red-400 p-3 rounded-xl mb-6 text-sm text-center font-medium">
            {error}
          </div>
        )}

        <button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold py-3.5 rounded-xl shadow-sm hover:shadow-md transition-all flex justify-center items-center gap-2 mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="my-6 flex items-center before:flex-1 before:border-t before:border-gray-200 dark:before:border-gray-700 after:flex-1 after:border-t after:border-gray-200 dark:after:border-gray-700">
          <span className="px-3 text-sm text-gray-500 dark:text-gray-400">— or continue with email —</span>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full bg-white/80 dark:bg-background-dark/50 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
            </div>
            <input 
              type="password" 
              required
              className="w-full bg-white/80 dark:bg-background-dark/50 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-3.5 rounded-xl mt-8 shadow-md hover:shadow-lg transition-all flex justify-center items-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
          </button>
        </form>

        <p className="text-center text-gray-500 dark:text-gray-400 mt-8 text-sm">
          Don't have an account? <Link to="/signup" className="text-primary font-semibold hover:underline transition-all">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
