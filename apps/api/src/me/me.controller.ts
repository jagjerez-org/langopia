import { Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { User } from "../database/entities/user.entity.js";
import { MeService } from "./me.service.js";
import { QueryMyClassesDto } from "./dto/query-my-classes.dto.js";
import { QueryMyReportsDto } from "./dto/query-my-reports.dto.js";
import { QueryMyExercisesDto } from "./dto/query-my-exercises.dto.js";
import { QueryMyLessonsDto } from "./dto/query-my-lessons.dto.js";
import { QueryMyStudentsDto } from "./dto/query-my-students.dto.js";
import { QueryMyNotificationsDto } from "./dto/query-my-notifications.dto.js";

@ApiTags("Me")
@ApiBearerAuth()
@Controller("me")
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get("stats")
  @ApiOperation({ summary: "Get teacher stats across all academies" })
  getStats(@CurrentUser() user: User) {
    return this.meService.getStats(user);
  }

  @Get("classes")
  @ApiOperation({ summary: "Get my classes (where I am teacher)" })
  getClasses(@CurrentUser() user: User, @Query() query: QueryMyClassesDto) {
    return this.meService.getClasses(user, query);
  }

  @Get("classes/:id")
  @ApiOperation({ summary: "Get class detail" })
  getClassDetail(@CurrentUser() user: User, @Param("id") id: string) {
    return this.meService.getClassDetail(user, id);
  }

  @Get("reports")
  @ApiOperation({ summary: "Get reports from my classes" })
  getReports(@CurrentUser() user: User, @Query() query: QueryMyReportsDto) {
    return this.meService.getReports(user, query);
  }

  @Get("reports/:id")
  @ApiOperation({ summary: "Get report detail" })
  getReportDetail(@CurrentUser() user: User, @Param("id") id: string) {
    return this.meService.getReportDetail(user, id);
  }

  @Get("academies")
  @ApiOperation({ summary: "Get my academy memberships" })
  getAcademies(@CurrentUser() user: User) {
    return this.meService.getAcademies(user);
  }

  @Get("exercises")
  @ApiOperation({ summary: "Get exercises from my academies" })
  getExercises(
    @CurrentUser() user: User,
    @Query() query: QueryMyExercisesDto,
  ) {
    return this.meService.getExercises(user, query);
  }

  @Get("exercises/:id")
  @ApiOperation({ summary: "Get exercise detail" })
  getExerciseDetail(@CurrentUser() user: User, @Param("id") id: string) {
    return this.meService.getExerciseDetail(user, id);
  }

  @Get("lessons")
  @ApiOperation({ summary: "Get lessons from my academies" })
  getLessons(@CurrentUser() user: User, @Query() query: QueryMyLessonsDto) {
    return this.meService.getLessons(user, query);
  }

  @Get("lessons/:id")
  @ApiOperation({ summary: "Get lesson detail with exercises" })
  getLessonDetail(@CurrentUser() user: User, @Param("id") id: string) {
    return this.meService.getLessonDetail(user, id);
  }

  @Get("students")
  @ApiOperation({ summary: "Get students I have taught" })
  getStudents(@CurrentUser() user: User, @Query() query: QueryMyStudentsDto) {
    return this.meService.getStudents(user, query);
  }

  @Get("students/:id")
  @ApiOperation({ summary: "Get student detail with class history" })
  getStudentDetail(@CurrentUser() user: User, @Param("id") id: string) {
    return this.meService.getStudentDetail(user, id);
  }

  @Get("notifications")
  @ApiOperation({ summary: "Get my notifications" })
  getNotifications(
    @CurrentUser() user: User,
    @Query() query: QueryMyNotificationsDto,
  ) {
    return this.meService.getNotifications(user, query);
  }

  @Patch("notifications/:id/read")
  @ApiOperation({ summary: "Mark notification as read" })
  markNotificationRead(
    @CurrentUser() user: User,
    @Param("id") id: string,
  ) {
    return this.meService.markNotificationRead(user, id);
  }

  @Post("notifications/read-all")
  @ApiOperation({ summary: "Mark all notifications as read" })
  markAllNotificationsRead(@CurrentUser() user: User) {
    return this.meService.markAllNotificationsRead(user);
  }
}
