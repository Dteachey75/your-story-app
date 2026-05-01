import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Plus, Edit2, Trash2, Save, X, LogOut } from 'lucide-react';

// Separate Login Component - minimizes re-renders
const LoginForm = ({ onSubmit, isLoading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    onSubmit(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={isLoading}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base disabled:bg-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base disabled:bg-gray-100"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isLoading}
            className="absolute right-3 top-3 text-gray-500 disabled:opacity-50"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium py-3 rounded-lg hover:shadow-lg transition-shadow text-base disabled:opacity-50"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
};

// Separate MFA Component
const MFAForm = ({ onSubmit, onBack, isLoading }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!code || code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    onSubmit(code);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          maxLength="6"
          disabled={isLoading}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-center text-lg tracking-widest text-base disabled:bg-gray-100"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium py-3 rounded-lg hover:shadow-lg transition-shadow text-base disabled:opacity-50"
      >
        {isLoading ? 'Verifying...' : 'Verify'}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={isLoading}
        className="w-full text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-100 transition text-base disabled:opacity-50"
      >
        Back to Login
      </button>
    </form>
  );
};

// Main App Component
const StoryApp = () => {
  const [authState, setAuthState] = useState('login');
  const [generatedMfaCode, setGeneratedMfaCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [tempLoginEmail, setTempLoginEmail] = useState('');

  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem('storyAppUsers');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [stories, setStories] = useState(() => {
    try {
      const saved = localStorage.getItem('storyAppStories');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [editingStoryId, setEditingStoryId] = useState(null);
  const [formData, setFormData] = useState({
    id: null,
    theme: '',
    ageRange: '',
    themeDescription: '',
    lifeBefore: '',
    christEntered: '',
    changes: '',
    presentReality: '',
    conclusion: '',
    createdAt: '',
    updatedAt: '',
  });

  const handleLoginSubmit = useCallback((email, password) => {
    setIsLoading(true);
    const newCode = Math.random().toString().slice(2, 8);
    setGeneratedMfaCode(newCode);
    setTempLoginEmail(email);
    setAuthState('mfa');
    
    setTimeout(() => {
      alert(`Demo: Your MFA code is ${newCode}`);
      setIsLoading(false);
    }, 500);
  }, []);

  const handleMFASubmit = useCallback((code) => {
    setIsLoading(true);
    
    if (code !== generatedMfaCode) {
      setIsLoading(false);
      return false;
    }

    if (!users[tempLoginEmail]) {
      const newUsers = {
        ...users,
        [tempLoginEmail]: { createdAt: new Date().toISOString() }
      };
      setUsers(newUsers);
      localStorage.setItem('storyAppUsers', JSON.stringify(newUsers));
    }

    setCurrentUser(tempLoginEmail);
    setAuthState('dashboard');
    setIsLoading(false);
  }, [generatedMfaCode, users, tempLoginEmail]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setAuthState('login');
  }, []);

  const handleCreateStory = useCallback(() => {
    setFormData({
      id: null,
      theme: '',
      ageRange: '',
      themeDescription: '',
      lifeBefore: '',
      christEntered: '',
      changes: '',
      presentReality: '',
      conclusion: '',
      createdAt: '',
      updatedAt: '',
    });
    setEditingStoryId(null);
    setAuthState('story');
  }, []);

  const handleEditStory = useCallback((storyId) => {
    const story = stories[currentUser]?.find(s => s.id === storyId);
    if (story) {
      setFormData(story);
      setEditingStoryId(storyId);
      setAuthState('story');
    }
  }, [stories, currentUser]);

  const handleDeleteStory = useCallback((storyId) => {
    if (window.confirm('Are you sure you want to delete this story?')) {
      const updatedStories = stories[currentUser]?.filter(s => s.id !== storyId) || [];
      const newStories = { ...stories, [currentUser]: updatedStories };
      setStories(newStories);
      localStorage.setItem('storyAppStories', JSON.stringify(newStories));
    }
  }, [stories, currentUser]);

  const handleSaveStory = useCallback((e) => {
    e.preventDefault();

    if (!formData.theme.trim()) {
      alert('Please give your story a theme or title');
      return;
    }

    const storyId = editingStoryId || `story_${Date.now()}`;
    const storyToSave = {
      ...formData,
      id: storyId,
      updatedAt: new Date().toISOString(),
      createdAt: formData.createdAt || new Date().toISOString(),
    };

    let updatedStories;
    if (editingStoryId) {
      updatedStories = (stories[currentUser] || []).map(s =>
        s.id === storyId ? storyToSave : s
      );
    } else {
      updatedStories = [...(stories[currentUser] || []), storyToSave];
    }

    const newStories = { ...stories, [currentUser]: updatedStories };
    setStories(newStories);
    localStorage.setItem('storyAppStories', JSON.stringify(newStories));

    alert('Story saved successfully!
