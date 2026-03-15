import type { LangopiaClient } from "../client";
import type {
  StudentRegisterRequest,
  StudentLoginRequest,
  StudentAuthResponse,
  AcademyInfo,
  StudentOnboardingRequest,
  SwitchLanguageRequest,
  StudentHome,
  StudentCourse,
  StudentCourseDetail,
  StudentLessonRunner,
  SubmitExerciseRequest,
  SubmitExerciseResponse,
  ReviewStats,
  ReviewItemResponse,
  SubmitReviewRequest,
  SubmitReviewResponse,
  StudentClassItem,
  StudentClassReport,
  StudentProfile,
  UpdateStudentProfileRequest,
  UpdatePreferencesRequest,
  StudentProgressData,
  StreakData,
  StudentLearningPathResponse,
} from "../types/student-app";

export class StudentAppResource {
  constructor(private client: LangopiaClient) {}

  // Auth (no guard)
  register(data: StudentRegisterRequest): Promise<StudentAuthResponse> {
    return this.client.request({ method: "POST", path: "/student/auth/register", auth: "none", body: data });
  }

  login(data: StudentLoginRequest): Promise<StudentAuthResponse> {
    return this.client.request({ method: "POST", path: "/student/auth/login", auth: "none", body: data });
  }

  resolveAcademy(slug: string): Promise<AcademyInfo> {
    return this.client.request({ method: "GET", path: `/student/auth/academy/${slug}`, auth: "none" });
  }

  // Onboarding
  saveOnboarding(data: StudentOnboardingRequest): Promise<{ success: boolean }> {
    return this.client.request({ method: "POST", path: "/student/onboarding", auth: "jwt", body: data });
  }

  switchLanguage(data: SwitchLanguageRequest): Promise<{ success: boolean }> {
    return this.client.request({ method: "PATCH", path: "/student/language", auth: "jwt", body: data });
  }

  // Home
  home(): Promise<StudentHome> {
    return this.client.request({ method: "GET", path: "/student/home", auth: "jwt" });
  }

  // Learning Path
  learningPath(): Promise<StudentLearningPathResponse> {
    return this.client.request({ method: "GET", path: "/student/learning-path", auth: "jwt" });
  }

  // Study
  courses(): Promise<StudentCourse[]> {
    return this.client.request({ method: "GET", path: "/student/courses", auth: "jwt" });
  }

  courseDetail(id: string): Promise<StudentCourseDetail> {
    return this.client.request({ method: "GET", path: `/student/courses/${id}`, auth: "jwt" });
  }

  lessonRunner(id: string): Promise<StudentLessonRunner> {
    return this.client.request({ method: "GET", path: `/student/lessons/${id}`, auth: "jwt" });
  }

  submitExercise(id: string, data: SubmitExerciseRequest): Promise<SubmitExerciseResponse> {
    return this.client.request({ method: "POST", path: `/student/exercises/${id}/submit`, auth: "jwt", body: data });
  }

  completeLesson(id: string): Promise<{ success: boolean; xp: number }> {
    return this.client.request({ method: "POST", path: `/student/lessons/${id}/complete`, auth: "jwt" });
  }

  // Review
  reviewStats(): Promise<ReviewStats> {
    return this.client.request({ method: "GET", path: "/student/review/stats", auth: "jwt" });
  }

  reviewQueue(): Promise<ReviewItemResponse[]> {
    return this.client.request({ method: "GET", path: "/student/review/queue", auth: "jwt" });
  }

  submitReview(id: string, data: SubmitReviewRequest): Promise<SubmitReviewResponse> {
    return this.client.request({ method: "POST", path: `/student/review/${id}`, auth: "jwt", body: data });
  }

  // Classes
  classes(tab?: "upcoming" | "past"): Promise<StudentClassItem[]> {
    return this.client.request({ method: "GET", path: "/student/classes", auth: "jwt", query: tab ? { tab } : undefined });
  }

  classReport(classId: string): Promise<StudentClassReport> {
    return this.client.request({ method: "GET", path: `/student/classes/${classId}/report`, auth: "jwt" });
  }

  // Explore
  exploreCourses(params?: { language?: string; level?: string }): Promise<StudentCourse[]> {
    return this.client.request({ method: "GET", path: "/student/explore/courses", auth: "jwt", query: params as Record<string, unknown> });
  }

  // Profile
  profile(): Promise<StudentProfile> {
    return this.client.request({ method: "GET", path: "/student/profile", auth: "jwt" });
  }

  updateProfile(data: UpdateStudentProfileRequest): Promise<{ success: boolean }> {
    return this.client.request({ method: "PATCH", path: "/student/profile", auth: "jwt", body: data });
  }

  updatePreferences(data: UpdatePreferencesRequest): Promise<{ success: boolean }> {
    return this.client.request({ method: "PATCH", path: "/student/preferences", auth: "jwt", body: data });
  }

  progress(): Promise<StudentProgressData> {
    return this.client.request({ method: "GET", path: "/student/progress", auth: "jwt" });
  }

  // Streak
  streak(): Promise<StreakData> {
    return this.client.request({ method: "GET", path: "/student/streak", auth: "jwt" });
  }

  useStreakFreeze(): Promise<{ freezesAvailable: number }> {
    return this.client.request({ method: "POST", path: "/student/streak/freeze", auth: "jwt" });
  }
}
