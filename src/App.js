import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Plus, Edit2, Trash2, Save, X, LogOut } from 'lucide-react';

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
        <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={isLoading} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base disabled:bg-gray-100" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
        <div className="relative">
          <input type={showPassword ? 'text' : 'password'} autoComplete="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" disabled={isLoading} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base disabled:bg-gray-100" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={isLoading} className="absolute right-3 top-3 text-gray-500 disabled:opacity-50">
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">{error}</div>}

      <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium py-3 rounded-lg hover:shadow-lg transition-shadow text-base disabled:opacity-50">
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
};

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
        <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength="6" disabled={isLoading} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-center text-lg tracking-widest text-base disabled:bg-gray-100" />
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">{error}</div>}

      <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium py-3 rounded-lg hover:shadow-lg transition-shadow text-base disabled:opacity-50">
        {isLoading ? 'Verifying...' : 'Verify'}
      </button>

      <button type="button" onClick={onBack} disabled={isLoading} className="w-full text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-100 transition text-base disabled:opacity-50">
        Back to Login
      </button>
    </form>
  );
};

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
      alert(`Your MFA code is: ${newCode}`);
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
      updatedStories = (stories[currentUser] || []).map(s => s.id === storyId ? storyToSave : s);
    } else {
      updatedStories = [...(stories[currentUser] || []), storyToSave];
    }

    const newStories = { ...stories, [currentUser]: updatedStories };
    setStories(newStories);
    localStorage.setItem('storyAppStories', JSON.stringify(newStories));

    alert('Story saved successfully!');
    setAuthState('dashboard');
  }, [editingStoryId, formData, stories, currentUser]);

  const handleFormChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const getUserStories = useCallback(() => {
    return stories[currentUser] || [];
  }, [stories, currentUser]);

  if (authState === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-amber-100">
            <div className="text-center mb-8">
              <div className="inline-block mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xl">📖</span>
                </div>
              </div>
              <h1 className="text-3xl font-serif text-gray-800 mb-2">Your Story Matters</h1>
              <p className="text-gray-600">Capture how God's story intersects with yours</p>
            </div>

            <LoginForm onSubmit={handleLoginSubmit} isLoading={isLoading} />

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-600 text-center">New user? Sign in with your email and a password.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authState === 'mfa') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-amber-100">
            <h1 className="text-2xl font-serif text-gray-800 mb-2">Verify Your Identity</h1>
            <p className="text-gray-600 mb-6">Enter the code shown in the alert</p>

            <MFAForm onSubmit={handleMFASubmit} onBack={() => setAuthState('login')} isLoading={isLoading} />

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-600 text-center">Check your alert popup for the code</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (authState === 'dashboard') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-serif text-gray-800 mb-1">Welcome Back</h1>
              <p className="text-gray-600 text-sm">{currentUser}</p>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition text-sm">
              <LogOut size={18} />
              Sign Out
            </button>
          </div>

          <button onClick={handleCreateStory} className="mb-8 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:shadow-lg transition-shadow font-medium text-base">
            <Plus size={20} />
            Start a New Story
          </button>

          {getUserStories().length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-amber-300 p-12 text-center">
              <p className="text-gray-600 mb-4">You haven't captured any stories yet.</p>
              <p className="text-sm text-gray-500">Begin by creating a new story to explore how God's story intersects with yours.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {getUserStories().map(story => (
                <div key={story.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-amber-100 p-6">
                  <h3 className="text-xl font-serif text-gray-800 mb-2">{story.theme}</h3>
                  {story.ageRange && <p className="text-sm text-gray-600 mb-4">Ages {story.ageRange}</p>}
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">{story.themeDescription}</p>
                  <div className="text-xs text-gray-500 mb-4">Last updated: {new Date(story.updatedAt).toLocaleDateString()}</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditStory(story.id)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition text-sm">
                      <Edit2 size={16} />
                      Edit
                    </button>
                    <button onClick={() => handleDeleteStory(story.id)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition text-sm">
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (authState === 'story') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-serif text-gray-800">{editingStoryId ? 'Edit Your Story' : 'Capture Your Story'}</h1>
            <button onClick={() => setAuthState('dashboard')} className="text-gray-600 hover:text-gray-800">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSaveStory} className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-amber-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Story Theme or Title</label>
              <input type="text" value={formData.theme} onChange={(e) => handleFormChange('theme', e.target.value)} placeholder="Enter your story theme..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-base" />
            </div>

            <div className="bg-white rounded-xl p-6 border border-amber-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Age Range</label>
              <input type="text" value={formData.ageRange} onChange={(e) => handleFormChange('ageRange', e.target.value)} placeholder="e.g., Ages 8-12" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-base" />
            </div>

            <div className="bg-white rounded-xl p-6 border border-amber-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">What made this theme significant?</label>
              <textarea value={formData.themeDescription} onChange={(e) => handleFormChange('themeDescription', e.target.value)} placeholder="Describe what made this theme important..." rows="4" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
            </div>

            <div className="bg-white rounded-xl p-6 border border-amber-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Life Before</label>
              <textarea value={formData.lifeBefore} onChange={(e) => handleFormChange('lifeBefore', e.target.value)} placeholder="What was most important to you?" rows="5" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
            </div>

            <div className="bg-white rounded-xl p-6 border border-amber-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">How Christ Met You in This</label>
              <textarea value={formData.christEntered} onChange={(e) => handleFormChange('christEntered', e.target.value)} placeholder="How did Christ rescue or redeem you?" rows="5" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
            </div>

            <div className="bg-white rounded-xl p-6 border border-amber-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Changes Christ Has Made</label>
              <textarea value={formData.changes} onChange={(e) => handleFormChange('changes', e.target.value)} placeholder="How has Christ changed you?" rows="5" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
            </div>

            <div className="bg-white rounded-xl p-6 border border-amber-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Present Reality</label>
              <textarea value={formData.presentReality} onChange={(e) => handleFormChange('presentReality', e.target.value)} placeholder="Where is God working now?" rows="5" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
            </div>

            <div className="bg-white rounded-xl p-6 border border-amber-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Concluding Statement</label>
              <textarea value={formData.conclusion} onChange={(e) => handleFormChange('conclusion', e.target.value)} placeholder="Summarize your story..." rows="4" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button type="submit" className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:shadow-lg transition-shadow font-medium text-base">
                <Save size={20} />
                Save Story
              </button>
              <button type="button" onClick={() => setAuthState('dashboard')} className="flex-1 px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition font-medium text-base">
                Cancel
              </button>
            </div>
          </form>

          <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <h3 className="font-serif text-lg text-gray-800 mb-3">💡 As You Write</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>✓ Write what comes to mind</li>
              <li>✓ Include sensory details</li>
              <li>✓ Be honest about struggles</li>
              <li>✓ Look for God's presence</li>
              <li>✓ Remember: God is the hero</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
};

export default StoryApp;
