import type { LangopiaClient } from "../client";
import type {
  MyStats,
  MyClassesList,
  QueryMyClassesParams,
  MyClassDetail,
  MyReportsList,
  QueryMyReportsParams,
  MyReportDetail,
  MyAcademyMembership,
  MyExercisesList,
  QueryMyExercisesParams,
  ExerciseResponse,
  MyLessonsList,
  QueryMyLessonsParams,
  MyLessonDetail,
  MyNotificationsList,
  QueryMyNotificationsParams,
} from "../types";

export class MeResource {
  constructor(private client: LangopiaClient) {}

  stats(): Promise<MyStats> {
    return this.client.request({
      method: "GET",
      path: "/me/stats",
      auth: "jwt",
    });
  }

  classes(params?: QueryMyClassesParams): Promise<MyClassesList> {
    return this.client.request({
      method: "GET",
      path: "/me/classes",
      auth: "jwt",
      query: params as Record<string, unknown>,
    });
  }

  classDetail(id: string): Promise<MyClassDetail> {
    return this.client.request({
      method: "GET",
      path: `/me/classes/${id}`,
      auth: "jwt",
    });
  }

  reports(params?: QueryMyReportsParams): Promise<MyReportsList> {
    return this.client.request({
      method: "GET",
      path: "/me/reports",
      auth: "jwt",
      query: params as Record<string, unknown>,
    });
  }

  reportDetail(id: string): Promise<MyReportDetail> {
    return this.client.request({
      method: "GET",
      path: `/me/reports/${id}`,
      auth: "jwt",
    });
  }

  academies(): Promise<MyAcademyMembership[]> {
    return this.client.request({
      method: "GET",
      path: "/me/academies",
      auth: "jwt",
    });
  }

  exercises(params?: QueryMyExercisesParams): Promise<MyExercisesList> {
    return this.client.request({
      method: "GET",
      path: "/me/exercises",
      auth: "jwt",
      query: params as Record<string, unknown>,
    });
  }

  exerciseDetail(id: string): Promise<ExerciseResponse> {
    return this.client.request({
      method: "GET",
      path: `/me/exercises/${id}`,
      auth: "jwt",
    });
  }

  lessons(params?: QueryMyLessonsParams): Promise<MyLessonsList> {
    return this.client.request({
      method: "GET",
      path: "/me/lessons",
      auth: "jwt",
      query: params as Record<string, unknown>,
    });
  }

  lessonDetail(id: string): Promise<MyLessonDetail> {
    return this.client.request({
      method: "GET",
      path: `/me/lessons/${id}`,
      auth: "jwt",
    });
  }

  notifications(params?: QueryMyNotificationsParams): Promise<MyNotificationsList> {
    return this.client.request({
      method: "GET",
      path: "/me/notifications",
      auth: "jwt",
      query: params as Record<string, unknown>,
    });
  }

  markNotificationRead(id: string): Promise<{ success: boolean }> {
    return this.client.request({
      method: "PATCH",
      path: `/me/notifications/${id}/read`,
      auth: "jwt",
    });
  }

  markAllNotificationsRead(): Promise<{ success: boolean }> {
    return this.client.request({
      method: "POST",
      path: "/me/notifications/read-all",
      auth: "jwt",
    });
  }
}
