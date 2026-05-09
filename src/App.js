import React, { useState, useCallback, useEffect } from 'react';
import { Eye, EyeOff, Plus, Edit2, Trash2, Save, X, LogOut, Mail, FileText } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { api, setSession, clearSession, hasToken, getStoredEmail } from './api';

const escapeHTML = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeWithBreaks = (s) => escapeHTML(s).replace(/\n/g, '<br>');

const safeFilename = (s) =>
  (String(s || 'story')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'story');

const newStoryId = () =>
  (crypto.randomUUID
    ? crypto.randomUUID()
    : `story_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0]}`);

const emptyForm = () => ({
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

const Modal = ({ open, title, children, onCancel, onConfirm, confirmLabel = 'OK', cancelLabel = 'Cancel', destructive = false }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        {title && <h2 className="text-lg font-semibold text-gray-800 mb-3">{title}</h2>}
        <div className="text-sm text-gray-700 mb-5">{children}</div>
        <div className="flex gap-2 justify-end">
          {onCancel && (
            <button onClick={onCancel} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm text-white ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const AuthForm = ({ mode, onSubmit, isLoading, defaultEmail = '' }) => {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const isSignup = mode === 'signup';

  const handleSubmit = async (e) => {
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
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const result = await onSubmit(email.trim().toLowerCase(), password);
    if (result?.error) setError(result.error);
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
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            disabled={isLoading}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base disabled:bg-gray-100"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isLoading}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-3 text-gray-500 disabled:opacity-50"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      {isSignup && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Confirm password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            disabled={isLoading}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-base disabled:bg-gray-100"
          />
        </div>
      )}

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
        {isLoading ? (isSignup ? 'Creating account...' : 'Signing in...') : (isSignup ? 'Create account' : 'Sign in')}
      </button>
    </form>
  );
};

const StoryApp = () => {
  const [authState, setAuthState] = useState(hasToken() ? 'loading' : 'login');
  const [authMode, setAuthMode] = useState('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [stories, setStories] = useState([]);
  const [editingStoryId, setEditingStoryId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [modal, setModal] = useState(null);

  useEffect(() => {
    if (!hasToken()) return;
    const storedEmail = getStoredEmail();
    if (!storedEmail) {
      clearSession();
      setAuthState('login');
      return;
    }
    setIsLoading(true);
    api.getVault()
      .then((loaded) => {
        setCurrentUser(storedEmail);
        setStories(Array.isArray(loaded) ? loaded : []);
        setAuthState('dashboard');
      })
      .catch((err) => {
        if (err.status === 401) clearSession();
        setAuthState('login');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleSigninSubmit = useCallback(async (email, password) => {
    setIsLoading(true);
    try {
      const { token, email: serverEmail } = await api.login({ email, password });
      setSession(token, serverEmail);
      const loaded = await api.getVault();
      setCurrentUser(serverEmail);
      setStories(Array.isArray(loaded) ? loaded : []);
      setAuthState('dashboard');
      return null;
    } catch (err) {
      clearSession();
      return { error: err.message || 'Sign in failed' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignupSubmit = useCallback(async (email, password) => {
    setIsLoading(true);
    try {
      const { token, email: serverEmail } = await api.signup({ email, password });
      setSession(token, serverEmail);
      setCurrentUser(serverEmail);
      setStories([]);
      setAuthState('dashboard');
      return null;
    } catch (err) {
      clearSession();
      return { error: err.message || 'Sign up failed' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
    setStories([]);
    setEditingStoryId(null);
    setFormData(emptyForm());
    setAuthState('login');
    setAuthMode('signin');
  }, []);

  const handleDeleteAccount = useCallback(() => {
    setModal({
      title: 'Delete your account?',
      body: 'This permanently deletes your account and all your stories from the server. This cannot be undone.',
      confirmLabel: 'Delete account',
      destructive: true,
      onConfirm: async () => {
        try { await api.deleteAccount(); } catch {}
        setModal(null);
        handleLogout();
      },
    });
  }, [handleLogout]);

  const handleCreateStory = useCallback(() => {
    setFormData(emptyForm());
    setEditingStoryId(null);
    setAuthState('story');
  }, []);

  const handleEditStory = useCallback(
    (storyId) => {
      const story = stories.find((s) => s.id === storyId);
      if (story) {
        setFormData(story);
        setEditingStoryId(storyId);
        setAuthState('story');
      }
    },
    [stories]
  );

  const handleDeleteStory = useCallback(
    (storyId) => {
      setModal({
        title: 'Delete this story?',
        body: 'This cannot be undone.',
        confirmLabel: 'Delete',
        destructive: true,
        onConfirm: async () => {
          const updated = stories.filter((s) => s.id !== storyId);
          try {
            await api.putVault(updated);
            setStories(updated);
            setModal(null);
          } catch (err) {
            setModal({
              title: 'Delete failed',
              body: err.message || 'Could not delete story. Please try again.',
              onConfirm: () => setModal(null),
            });
          }
        },
      });
    },
    [stories]
  );

  const handleSaveStory = useCallback(
    async (e) => {
      e.preventDefault();
      if (!formData.theme.trim()) {
        setModal({
          title: 'Theme required',
          body: 'Please give your story a theme or title.',
          onConfirm: () => setModal(null),
        });
        return;
      }
      const storyId = editingStoryId || newStoryId();
      const now = new Date().toISOString();
      const storyToSave = {
        ...formData,
        id: storyId,
        createdAt: formData.createdAt || now,
        updatedAt: now,
      };
      const updated = editingStoryId
        ? stories.map((s) => (s.id === storyId ? storyToSave : s))
        : [...stories, storyToSave];
      try {
        await api.putVault(updated);
        setStories(updated);
        setAuthState('dashboard');
      } catch (err) {
        setModal({
          title: 'Save failed',
          body: err.message || 'Could not save your story. Please try again.',
          onConfirm: () => setModal(null),
        });
      }
    },
    [editingStoryId, formData, stories]
  );

  const handleFormChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const formatStoryContent = (story) => `STORY: ${story.theme}

AGE RANGE: ${story.ageRange || 'Not specified'}

---

CREATION - Life & Beauty:
${story.themeDescription}

---

FALL - Loss & Brokenness:
${story.lifeBefore}

---

REDEMPTION - Love & Liberty:

How Christ Met Me:
${story.christEntered}

Changes Christ Has Made:
${story.changes}

---

CONSUMMATION - Life & Glory:

My Present Reality:
${story.presentReality}

---

CONCLUSION:
${story.conclusion}

---
Created: ${new Date(story.createdAt).toLocaleDateString()}
Last Updated: ${new Date(story.updatedAt).toLocaleDateString()}`;

  const exportToPDF = useCallback((story) => {
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h1 style="color: #92400e; border-bottom: 3px solid #f59e0b; padding-bottom: 10px;">${escapeHTML(story.theme)}</h1>
        <p style="color: #666; font-style: italic;">Ages: ${escapeHTML(story.ageRange || 'Not specified')}</p>

        <h2 style="color: #b45309; margin-top: 20px;">CREATION - Life &amp; Beauty</h2>
        <p>${escapeWithBreaks(story.themeDescription)}</p>

        <h2 style="color: #b45309; margin-top: 20px;">FALL - Loss &amp; Brokenness</h2>
        <p>${escapeWithBreaks(story.lifeBefore)}</p>

        <h2 style="color: #b45309; margin-top: 20px;">REDEMPTION - Love &amp; Liberty</h2>
        <h3 style="color: #666; margin-top: 10px;">How Christ Met Me:</h3>
        <p>${escapeWithBreaks(story.christEntered)}</p>
        <h3 style="color: #666; margin-top: 10px;">Changes Christ Has Made:</h3>
        <p>${escapeWithBreaks(story.changes)}</p>

        <h2 style="color: #b45309; margin-top: 20px;">CONSUMMATION - Life &amp; Glory</h2>
        <h3 style="color: #666; margin-top: 10px;">My Present Reality:</h3>
        <p>${escapeWithBreaks(story.presentReality)}</p>
        <h3 style="color: #666; margin-top: 10px;">Conclusion:</h3>
        <p>${escapeWithBreaks(story.conclusion)}</p>

        <hr style="margin-top: 30px; border: none; border-top: 1px solid #ccc;">
        <p style="font-size: 12px; color: #999; margin-top: 20px;">
          Created: ${escapeHTML(new Date(story.createdAt).toLocaleDateString())}<br>
          Last Updated: ${escapeHTML(new Date(story.updatedAt).toLocaleDateString())}<br>
          Captured in Your Story Matters
        </p>
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `${safeFilename(story.theme)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    };

    html2pdf().set(opt).from(element).save();
  }, []);

  const sendViaEmail = useCallback((story) => {
    const subject = `My Story: ${story.theme}`;
    const body = formatStoryContent(story);
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, []);

  const modalNode = modal && (
    <Modal
      open={true}
      title={modal.title}
      onConfirm={modal.onConfirm || (() => setModal(null))}
      onCancel={modal.onConfirm && modal.confirmLabel !== 'OK' ? () => setModal(null) : undefined}
      confirmLabel={modal.confirmLabel || 'OK'}
      destructive={modal.destructive}
    >
      {modal.body}
    </Modal>
  );

  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
        <div className="text-gray-600 text-sm">Loading your stories...</div>
      </div>
    );
  }

  if (authState === 'login') {
    return (
      <>
        {modalNode}
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

              <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition ${authMode === 'signin' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'}`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition ${authMode === 'signup' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'}`}
                >
                  Create account
                </button>
              </div>

              <AuthForm
                mode={authMode}
                onSubmit={authMode === 'signup' ? handleSignupSubmit : handleSigninSubmit}
                isLoading={isLoading}
                defaultEmail={getStoredEmail() || ''}
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (authState === 'dashboard') {
    return (
      <>
        {modalNode}
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-4xl font-serif text-gray-800 mb-1">Welcome Back</h1>
                <p className="text-gray-600 text-sm">{currentUser}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-red-700 rounded-lg border border-red-200 hover:bg-red-50 transition text-sm"
                  title="Permanently delete your account"
                >
                  <Trash2 size={18} />
                  Delete account
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition text-sm"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            </div>

            <button
              onClick={handleCreateStory}
              className="mb-8 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:shadow-lg transition-shadow font-medium text-base"
            >
              <Plus size={20} />
              Start a New Story
            </button>

            {stories.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-amber-300 p-12 text-center">
                <p className="text-gray-600 mb-4">You haven't captured any stories yet.</p>
                <p className="text-sm text-gray-500">Begin by creating a new story to explore how God's story intersects with yours.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stories.map((story) => (
                  <div key={story.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-amber-100 p-6">
                    <h3 className="text-xl font-serif text-gray-800 mb-2">{story.theme}</h3>
                    {story.ageRange && <p className="text-sm text-gray-600 mb-4">Ages {story.ageRange}</p>}
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{story.themeDescription}</p>
                    <div className="text-xs text-gray-500 mb-4">Last updated: {new Date(story.updatedAt).toLocaleDateString()}</div>
                    <div className="flex flex-col gap-2">
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
                      <div className="flex gap-2">
                        <button onClick={() => exportToPDF(story)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm">
                          <FileText size={16} />
                          PDF
                        </button>
                        <button onClick={() => sendViaEmail(story)} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm">
                          <Mail size={16} />
                          Email
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  if (authState === 'story') {
    return (
      <>
        {modalNode}
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4 sm:p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-serif text-gray-800">{editingStoryId ? 'Edit Your Story' : 'Capture Your Story'}</h1>
              <button onClick={() => setAuthState('dashboard')} className="text-gray-600 hover:text-gray-800" aria-label="Close">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveStory} className="space-y-6">
              <div className="bg-white rounded-xl p-6 border border-amber-100">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Story Theme or Title</label>
                <p className="text-xs text-gray-600 mb-3">What is the central theme? (e.g., "Finding Trust During Loss", "God's Provision in My Childhood")</p>
                <input type="text" value={formData.theme} onChange={(e) => handleFormChange('theme', e.target.value)} placeholder="Enter your story theme..." className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-base" />
              </div>

              <div className="bg-white rounded-xl p-6 border border-amber-100">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Age Range</label>
                <p className="text-xs text-gray-600 mb-3">When did this story take place? (e.g., "Ages 8-12" or "my whole life")</p>
                <input type="text" value={formData.ageRange} onChange={(e) => handleFormChange('ageRange', e.target.value)} placeholder="e.g., Ages 8-12 or my whole life" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-base" />
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
                <h3 className="font-serif text-lg text-amber-900 mb-4">🌱 CREATION - Life & Beauty</h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">What made this theme significant?</label>
                  <p className="text-xs text-gray-600 mb-3">When was the last time you felt all was right with the world? What about this theme made you feel free, peaceful, or at home? What did you enjoy doing and with whom? Think about surrounding events, sights and smells.</p>
                  <textarea value={formData.themeDescription} onChange={(e) => handleFormChange('themeDescription', e.target.value)} placeholder="Describe the beauty, peace, joy, or harmony you experienced..." rows="4" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-xl p-6 border border-red-200">
                <h3 className="font-serif text-lg text-red-900 mb-4">💔 FALL - Loss & Brokenness</h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Your Life Before - The Shattering</label>
                  <p className="text-xs text-gray-600 mb-3">What was most important to you? Where did you find security, identity, or happiness? When did you first notice brokenness in this area? How did you respond? What did you do to try to fix it, hide from it, or blame others?</p>
                  <textarea value={formData.lifeBefore} onChange={(e) => handleFormChange('lifeBefore', e.target.value)} placeholder="What was your life like before the brokenness? What were you seeking? How did you respond?" rows="5" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <h3 className="font-serif text-lg text-green-900 mb-4">✝️ REDEMPTION - Love & Liberty</h3>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">How Christ Met You in This</label>
                  <p className="text-xs text-gray-600 mb-3">Where were you waiting for rescue? How did Christ show up and save you—not just eternally, but right here and now? What does this reveal about sin, grace, and God's character? Is there a Bible story, character, or Psalm that reminds you of your story?</p>
                  <textarea value={formData.christEntered} onChange={(e) => handleFormChange('christEntered', e.target.value)} placeholder="How did Christ rescue or redeem you? What changed? What did you learn about His love?" rows="5" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Changes Christ Has Made</label>
                  <p className="text-xs text-gray-600 mb-3">How has your relationship with Christ impacted your character, attitudes, or decisions? What parts of your "glory self" are emerging? What motivates you now? Include people, places, or Scripture that have shaped you.</p>
                  <textarea value={formData.changes} onChange={(e) => handleFormChange('changes', e.target.value)} placeholder="How are you different? What has healed? What has been restored?" rows="5" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <h3 className="font-serif text-lg text-blue-900 mb-4">👑 CONSUMMATION - Life & Glory</h3>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Your Present Reality</label>
                  <p className="text-xs text-gray-600 mb-3">Where do you see the Lord working in your heart now? What struggles or idols remain? Where are you longing for full restoration? What does hope look like for you in this current chapter? How might knowing your secured future in God impact your present uncertainty?</p>
                  <textarea value={formData.presentReality} onChange={(e) => handleFormChange('presentReality', e.target.value)} placeholder="What joys and challenges are you experiencing now? Where is Christ still working? What promises of His character do you hope to see become more real?" rows="5" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Concluding Statement</label>
                  <p className="text-xs text-gray-600 mb-3">What does this story reveal about God's character? What glimpses of your fully redeemed glory-self do you catch? How does this story connect to God's larger story of grace?</p>
                  <textarea value={formData.conclusion} onChange={(e) => handleFormChange('conclusion', e.target.value)} placeholder="Summarize your story and connect it back to your theme. What have you learned about God?" rows="4" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-base" />
                </div>
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
              <h3 className="font-serif text-lg text-gray-800 mb-3">💡 Reflection Tips</h3>
              <ul className="text-sm text-gray-700 space-y-2">
                <li>✓ Do you think in forests (big themes) or trees (specific moments)? Choose what feels natural</li>
                <li>✓ Include sensory details—sights, sounds, smells, textures bring stories to life</li>
                <li>✓ Be honest about struggles, hiding, and blame—God's grace covers it all</li>
                <li>✓ Look for God even when He seemed hidden—He was there</li>
                <li>✓ Remember: God is the hero of your story, not you</li>
              </ul>
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
};

export default StoryApp;
