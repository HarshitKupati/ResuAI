import axios from 'axios';

// Base URL for the backend API
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;
    const requestUrl = error?.config?.url || '';
    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
    const isTokenIssue =
      detail === 'Invalid token' ||
      detail === 'Authentication required' ||
      detail === 'Not authenticated';

    if (status === 401 && !isAuthEndpoint && isTokenIssue) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');

      // Force clean app auth state so stale JWTs do not keep the UI in a broken state.
      if (window.location.pathname !== '/') {
        window.location.assign('/');
      } else {
        window.location.reload();
      }
    }

    return Promise.reject(error);
  }
);

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
};

/**
 * Health check endpoint
 * @returns {Promise} API health status
 */
export const healthCheck = async () => {
  try {
    // Derive backend base URL from API_BASE_URL (remove /api suffix)
    const backendBaseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
    const response = await axios.get(`${backendBaseUrl}/health`);
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// ============================================
// Unified Analysis Pipeline
// ============================================

/**
 * Run the full analysis pipeline in a single request.
 * Resume parse -> JD parse -> Match -> ATS -> Roles -> Recommendations
 * @param {File} resumeFile - Resume PDF or DOCX
 * @param {string} jdText - Job description text
 * @param {string} [jobTitle] - Optional job title label
 */
export const analyzeResume = async (resumeFile, jdText, jobTitle = '', jdFile = null) => {
  const formData = new FormData();
  formData.append('resume_file', resumeFile);
  if (jdFile) {
    formData.append('jd_file', jdFile);
  } else {
    formData.append('jd_text', jdText || '');
  }
  if (jobTitle) formData.append('job_title', jobTitle);

  const { data } = await api.post('/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return data;
};

/**
 * Bulk-rank multiple resumes against a single JD.
 * @param {File[]} resumeFiles
 * @param {string} jdText
 * @param {string} [jobTitle]
 * @param {File|null} [jdFile]
 */
export const analyzeBulk = async (resumeFiles, jdText, jobTitle = '', jdFile = null) => {
  const formData = new FormData();
  resumeFiles.forEach((f) => formData.append('resume_files', f));
  if (jdFile) {
    formData.append('jd_file', jdFile);
  } else {
    formData.append('jd_text', jdText || '');
  }
  if (jobTitle) formData.append('job_title', jobTitle);

  const { data } = await api.post('/analyze/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  });
  return data;
};

export const updateUserProfile = async (userId, payload) => {
  const { data } = await api.put(`/auth/users/${userId}`, payload);
  return data;
};

export const changePasswordRequest = async (currentPassword, newPassword) => {
  const { data } = await api.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
};

// ============================================
// Forgot password / OTP flow
// ============================================
export const forgotPasswordRequest = async (email) => {
  const { data } = await api.post('/auth/forgot-password', { email });
  return data;
};

export const verifyOtpRequest = async (email, otp) => {
  const { data } = await api.post('/auth/verify-otp', { email, otp });
  return data;
};

export const resetPasswordRequest = async (resetToken, newPassword) => {
  const { data } = await api.post('/auth/reset-password', {
    reset_token: resetToken,
    new_password: newPassword,
  });
  return data;
};

export const getAnalysisHistory = async () => {
  const { data } = await api.get('/analyze/history');
  return data;
};

export const deleteAnalysisHistoryItem = async (analysisId) => {
  const { data } = await api.delete(`/analyze/history/${analysisId}`);
  return data;
};

export const deleteAnalysisHistoryBulk = async ({ ids = [], all = false } = {}) => {
  const { data } = await api.post('/analyze/history/delete', {
    analysis_ids: ids,
    all,
  });
  return data;
};

export const downloadAnalysisReport = async (analysisId) => {
  const { data } = await api.get(`/analyze/${analysisId}/report`, {
    responseType: 'blob',
  });
  return data;
};

// ============================================
// User Profile (single resume per user)
// ============================================

export const getUserProfile = async () => {
  try {
    const { data } = await api.get('/profile');
    return data;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
};

export const uploadProfileResume = async (file) => {
  const formData = new FormData();
  formData.append('resume_file', file);
  const { data } = await api.post('/profile/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return data;
};

export const deleteUserProfile = async () => {
  const { data } = await api.delete('/profile');
  return data;
};

// ============================================
// AI: Role Explorer (career roadmap)
// ============================================

/**
 * Fetch an AI-generated career roadmap for an arbitrary job role.
 * @param {string} role e.g. "Data Scientist", "Cloud Engineer"
 */
export const getRoleGuide = async (role) => {
  const { data } = await api.post('/ai/role-guide', { role });
  return data?.data || null;
};

// ============================================
// AI: Role Coach chat
// ============================================

export const listChatSessions = async () => {
  const { data } = await api.get('/chat/sessions');
  return data?.sessions || [];
};

export const getChatSession = async (sessionId) => {
  const { data } = await api.get(`/chat/sessions/${sessionId}`);
  return data;
};

export const deleteChatSession = async (sessionId) => {
  const { data } = await api.delete(`/chat/sessions/${sessionId}`);
  return data;
};

/**
 * Send a message in a chat session.
 * @param {string} message
 * @param {string|null} sessionId  pass null/undefined to start a new session
 */
export const sendChatMessage = async (message, sessionId = null) => {
  const payload = { message };
  if (sessionId) payload.session_id = sessionId;
  const { data } = await api.post('/chat/send', payload, { timeout: 60000 });
  return data;
};

/**
 * Discard the trailing assistant message in `sessionId` and ask the LLM
 * for a new reply to the same preceding user prompt.
 */
export const regenerateLastReply = async (sessionId) => {
  const { data } = await api.post(
    '/chat/regenerate',
    { session_id: sessionId },
    { timeout: 60000 },
  );
  return data;
};

// ============================================
// Saved roadmaps
// ============================================

export const saveRoadmap = async (guide) => {
  // Strip out anything the backend doesn't accept (e.g. _note from fallback).
  const payload = {
    role: guide.role || '',
    summary: guide.summary || '',
    key_skills: guide.key_skills || [],
    tools: guide.tools || [],
    requirements: guide.requirements || [],
    learning_path: (guide.learning_path || []).map((s) => ({
      step: s.step || 1,
      title: s.title || '',
      duration: s.duration || '',
      description: s.description || '',
      resources: s.resources || [],
    })),
    estimated_time: guide.estimated_time || '',
    career_growth: guide.career_growth || [],
    source: guide.source || 'ai',
  };
  const { data } = await api.post('/roadmaps', payload);
  return data?.roadmap || null;
};

export const listSavedRoadmaps = async () => {
  const { data } = await api.get('/roadmaps');
  return data?.roadmaps || [];
};

export const getSavedRoadmap = async (id) => {
  const { data } = await api.get(`/roadmaps/${id}`);
  return data?.roadmap || null;
};

export const deleteSavedRoadmap = async (id) => {
  const { data } = await api.delete(`/roadmaps/${id}`);
  return data;
};

/**
 * Download a saved roadmap as a PDF and trigger a browser download.
 */
export const downloadRoadmapPdf = async (id, suggestedName) => {
  const response = await api.get(`/roadmaps/${id}/pdf`, {
    responseType: 'blob',
    timeout: 60000,
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName || 'roadmap.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke a moment later so the browser actually has time to use it.
  setTimeout(() => window.URL.revokeObjectURL(url), 4000);
};

export const viewProfileResume = async () => {
  const response = await api.get('/profile/resume/file', { responseType: 'blob' });
  const blob = response.data;
  const url = window.URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  // Revoke after a delay so the new tab has time to load
  setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  return win;
};

export default api;
