import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { StudentAppService } from "./student-app.service.js";
import { StudentAuthGuard } from "./student-auth.guard.js";
import { CurrentStudent } from "./current-student.decorator.js";
import { StudentRegisterDto } from "./dto/student-register.dto.js";
import { StudentLoginDto } from "./dto/student-login.dto.js";
import { StudentOnboardingDto } from "./dto/student-onboarding.dto.js";
import { SwitchLanguageDto } from "./dto/switch-language.dto.js";
import { SubmitExerciseDto } from "./dto/submit-exercise.dto.js";
import { SubmitReviewDto } from "./dto/submit-review.dto.js";
import { UpdateStudentProfileDto } from "./dto/update-profile.dto.js";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto.js";
import type { Student } from "../database/entities/index.js";

// ─── Auth (no guard) ───────────────────────────────────

@Controller("student/auth")
export class StudentAuthController {
  constructor(private readonly service: StudentAppService) {}

  @Post("register")
  register(@Body() dto: StudentRegisterDto) {
    return this.service.register(dto);
  }

  @Post("login")
  login(@Body() dto: StudentLoginDto) {
    return this.service.login(dto);
  }

  @Get("academy/:slug")
  resolveAcademy(@Param("slug") slug: string) {
    return this.service.resolveAcademy(slug);
  }
}

// ─── Protected endpoints ───────────────────────────────

@Controller("student")
@UseGuards(StudentAuthGuard)
export class StudentAppController {
  constructor(private readonly service: StudentAppService) {}

  // Onboarding
  @Post("onboarding")
  onboarding(@CurrentStudent() student: Student, @Body() dto: StudentOnboardingDto) {
    return this.service.saveOnboarding(student.id, dto);
  }

  @Patch("language")
  switchLanguage(@CurrentStudent() student: Student, @Body() dto: SwitchLanguageDto) {
    return this.service.switchLanguage(student.id, dto);
  }

  // Home
  @Get("home")
  home(@CurrentStudent() student: Student) {
    return this.service.getHome(student);
  }

  // Learning Path
  @Get("learning-path")
  learningPath(@CurrentStudent() student: Student) {
    return this.service.getStudentLearningPath(student);
  }

  // Study
  @Get("courses")
  courses(@CurrentStudent() student: Student) {
    return this.service.getCourses(student);
  }

  @Get("courses/:id")
  courseDetail(@CurrentStudent() student: Student, @Param("id") id: string) {
    return this.service.getCourseDetail(student, id);
  }

  @Get("lessons/:id")
  lessonRunner(@CurrentStudent() student: Student, @Param("id") id: string) {
    return this.service.getLessonForRunner(student, id);
  }

  @Post("exercises/:id/submit")
  submitExercise(
    @CurrentStudent() student: Student,
    @Param("id") id: string,
    @Body() dto: SubmitExerciseDto,
  ) {
    return this.service.submitExercise(student, id, dto);
  }

  @Post("lessons/:id/complete")
  completeLesson(@CurrentStudent() student: Student, @Param("id") id: string) {
    return this.service.completeLesson(student, id);
  }

  // Review
  @Get("review/stats")
  reviewStats(@CurrentStudent() student: Student) {
    return this.service.getReviewStats(student.id);
  }

  @Get("review/queue")
  reviewQueue(@CurrentStudent() student: Student) {
    return this.service.getReviewQueue(student.id);
  }

  @Post("review/:id")
  submitReview(
    @CurrentStudent() student: Student,
    @Param("id") id: string,
    @Body() dto: SubmitReviewDto,
  ) {
    return this.service.submitReview(student.id, id, dto);
  }

  // Classes
  @Get("classes")
  classes(
    @CurrentStudent() student: Student,
    @Query("tab") tab?: "upcoming" | "past",
  ) {
    return this.service.getClasses(student, tab || "upcoming");
  }

  @Get("classes/:id/report")
  classReport(@CurrentStudent() student: Student, @Param("id") id: string) {
    return this.service.getClassReport(student, id);
  }

  // Explore
  @Get("explore/courses")
  exploreCourses(
    @CurrentStudent() student: Student,
    @Query("language") language?: string,
    @Query("level") level?: string,
  ) {
    return this.service.exploreCourses(student, language, level);
  }

  // Profile
  @Get("profile")
  profile(@CurrentStudent() student: Student) {
    return this.service.getProfile(student);
  }

  @Patch("profile")
  updateProfile(@CurrentStudent() student: Student, @Body() dto: UpdateStudentProfileDto) {
    return this.service.updateProfile(student.id, dto);
  }

  @Patch("preferences")
  updatePreferences(@CurrentStudent() student: Student, @Body() dto: UpdatePreferencesDto) {
    return this.service.updatePreferences(student.id, dto);
  }

  @Get("progress")
  progress(@CurrentStudent() student: Student) {
    return this.service.getProgress(student);
  }

  // Streak
  @Get("streak")
  streak(@CurrentStudent() student: Student) {
    return this.service.getStreak(student.id);
  }

  @Post("streak/freeze")
  streakFreeze(@CurrentStudent() student: Student) {
    return this.service.useStreakFreeze(student.id);
  }
}
