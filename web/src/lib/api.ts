import axios, { AxiosInstance, AxiosError } from 'axios';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('engagio_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to catch 401 redirects
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('engagio_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// === Courses ===
export interface Course {
  id: string;
  title: string;
  description: string | null;
  instructorId: string;
  tenantId: string;
  instructor?: { id: string; email: string };
  enrollments?: { id: string; status: string }[];
  sessions?: { id: string; startedAt: string; endedAt: string | null }[];
  _count?: { enrollments: number; sessions: number };
  createdAt?: string;
  updatedAt?: string;
}

export async function getCourses(): Promise<Course[]> {
  const { data } = await api.get<Course[]>('/courses');
  return data;
}

export async function createCourse(dto: { title: string; description?: string; instructorId: string }): Promise<Course> {
  const { data } = await api.post<Course>('/courses', dto);
  return data;
}

export async function deleteCourse(id: string): Promise<void> {
  await api.delete(`/courses/${id}`);
}

// === Sessions ===
export interface Session {
  id: string;
  tenantId: string;
  courseId: string;
  userId: string;
  classroomCode: string;
  startedAt: string;
  endedAt: string | null;
  dwellTime: number;
  course?: { id: string; title: string };
  user?: { id: string; email: string };
  _count?: { events: number };
}

export async function getActiveSessions(): Promise<Session[]> {
  const { data } = await api.get<Session[]>('/sessions/active');
  return data;
}

export async function startSession(dto: { courseId: string }): Promise<Session> {
  const { data } = await api.post<Session>('/sessions/start', dto);
  return data;
}

export async function endSession(id: string): Promise<Session> {
  const { data } = await api.post<Session>(`/sessions/${id}/end`);
  return data;
}

export async function getSession(id: string): Promise<Session> {
  const { data } = await api.get<Session>(`/sessions/${id}`);
  return data;
}

export async function getSessionHistory(courseId?: string): Promise<Session[]> {
  const params = courseId ? `?courseId=${courseId}` : '';
  const { data } = await api.get<Session[]>(`/sessions/history${params}`);
  return data;
}

export async function getSessionByCode(code: string): Promise<Session> {
  const { data } = await api.get<Session>(`/sessions/code/${code}`);
  return data;
}

// === Enrollments ===
export interface Enrollment {
  id: string;
  tenantId: string;
  userId: string;
  courseId: string;
  status: string;
  createdAt: string;
  user?: { id: string; email: string; role: string };
  course?: { id: string; title: string };
}

export async function getEnrollmentsByCourse(courseId: string): Promise<Enrollment[]> {
  const { data } = await api.get<Enrollment[]>(`/enrollments/course/${courseId}`);
  return data;
}

export async function getEnrollmentsByUser(userId: string): Promise<Enrollment[]> {
  const { data } = await api.get<Enrollment[]>(`/enrollments/user/${userId}`);
  return data;
}

export async function enrollUser(dto: { courseId: string; userId: string }): Promise<Enrollment> {
  const { data } = await api.post<Enrollment>('/enrollments', dto);
  return data;
}

export async function unenrollUser(courseId: string, userId: string): Promise<void> {
  await api.delete(`/enrollments/course/${courseId}/user/${userId}`);
}

// === Analytics ===
export interface RealtimeStats {
  activeSessions: number;
  liveEvents: number;
  totalUsers: number;
  timestamp: string;
}

export async function getRealtimeStats(): Promise<RealtimeStats> {
  const { data } = await api.get<RealtimeStats>('/analytics/realtime');
  return data;
}

export interface EngagementOverview {
  totalSessions: number;
  activeSessions: number;
  totalDwellTime: number;
  avgDwellTime: number;
  eventTypeCounts: Record<string, number>;
  eventsBySession: { id: string; dwellTime: number; _count: { events: number } }[];
}

export async function getEngagementOverview(courseId?: string): Promise<EngagementOverview> {
  const params = courseId ? `?courseId=${courseId}` : '';
  const { data } = await api.get<EngagementOverview>(`/analytics/overview${params}`);
  return data;
}

export interface CourseAnalytics {
  course: { id: string; title: string };
  enrollments: number;
  totalSessions: number;
  totalDwellTime: number;
  totalEvents: number;
  eventTypeBreakdown: { type: string; count: number; firstEvent: string; lastEvent: string }[];
}

export async function getCourseAnalytics(courseId: string): Promise<CourseAnalytics | null> {
  const { data } = await api.get<CourseAnalytics | null>(`/analytics/course/${courseId}`);
  return data;
}

// === Live Engagement Scores ===
export interface LiveScore {
  userId: string;
  email: string;
  score: number;
  color: string;
}

export async function getLiveScores(sessionId: string): Promise<LiveScore[]> {
  const { data } = await api.get<LiveScore[]>(`/analytics/session/${sessionId}/live-scores`);
  return data;
}

export interface ScoreHistoryPoint {
  time: string;
  score: number;
}

export interface SessionScoreHistory {
  classPulse: ScoreHistoryPoint[];
  byUser: Record<string, { email: string; history: ScoreHistoryPoint[] }>;
}

export async function getSessionScoreHistory(sessionId: string): Promise<SessionScoreHistory> {
  const { data } = await api.get<SessionScoreHistory>(`/analytics/session/${sessionId}/history`);
  return data;
}
