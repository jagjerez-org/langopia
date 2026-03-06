import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { RoomInternalModule } from "./room-internal/room-internal.module.js";
import { AcademiesModule } from "./academies/academies.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { UserProfileModule } from "./user-profile/user-profile.module.js";
import { StripeModule } from "./stripe/stripe.module.js";
import { ClassesModule } from "./classes/classes.module.js";
import { V1RoomsModule } from "./v1-rooms/v1-rooms.module.js";
import { StudentsModule } from "./students/students.module.js";
import { TeachersModule } from "./teachers/teachers.module.js";
import { UsageStatsModule } from "./usage-stats/usage-stats.module.js";
import { LessonsModule } from "./lessons/lessons.module.js";
import { LearningPathsModule } from "./learning-paths/learning-paths.module.js";
import { ExercisesModule } from "./exercises/exercises.module.js";
import { MediaModule } from "./media/media.module.js";
import { MeModule } from "./me/me.module.js";
import { PushNotificationModule } from "./push-notification/push-notification.module.js";
import { AcademyLevelsModule } from "./academy-levels/academy-levels.module.js";
import { AcademyLanguagesModule } from "./academy-languages/academy-languages.module.js";
import { CoursesModule } from "./courses/courses.module.js";
import { AcademyPlansModule } from "./academy-plans/academy-plans.module.js";
import { StudentSubscriptionsModule } from "./student-subscriptions/student-subscriptions.module.js";
import { TeacherApplicationsModule } from "./teacher-applications/teacher-applications.module.js";
import { TeamModule } from "./team/team.module.js";
import { FinancingsModule } from "./financings/financings.module.js";
import { OnboardingModule } from "./onboarding/onboarding.module.js";
import { AcademyLandingModule } from "./academy-landing/academy-landing.module.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    DatabaseModule,
    AuthModule,
    RoomInternalModule,
    AcademiesModule,
    DashboardModule,
    UserProfileModule,
    StripeModule,
    ClassesModule,
    V1RoomsModule,
    StudentsModule,
    TeachersModule,
    UsageStatsModule,
    LessonsModule,
    LearningPathsModule,
    ExercisesModule,
    MediaModule,
    MeModule,
    PushNotificationModule,
    AcademyLevelsModule,
    AcademyLanguagesModule,
    CoursesModule,
    AcademyPlansModule,
    StudentSubscriptionsModule,
    TeacherApplicationsModule,
    TeamModule,
    FinancingsModule,
    OnboardingModule,
    AcademyLandingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
