import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { App } from "firebase-admin/app";
import type { Messaging } from "firebase-admin/messaging";
import { User } from "../database/entities/user.entity.js";
import { Notification } from "../database/entities/notification.entity.js";

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private app: App | null = null;
  private messaging: Messaging | null = null;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly config: ConfigService,
  ) {
    this.initFirebase();
  }

  private initFirebase() {
    const serviceAccount = this.config.get<string>(
      "FIREBASE_SERVICE_ACCOUNT",
    );
    const credentialsFile = this.config.get<string>(
      "GOOGLE_APPLICATION_CREDENTIALS",
    );

    if (!serviceAccount && !credentialsFile) {
      this.logger.warn(
        "FIREBASE_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS not set — push notifications will be skipped",
      );
      return;
    }

    try {
      // Lazy import to avoid issues when firebase-admin is not configured
      const { initializeApp, cert } = require("firebase-admin/app");
      const { getMessaging } = require("firebase-admin/messaging");

      if (serviceAccount) {
        this.app = initializeApp({
          credential: cert(JSON.parse(serviceAccount)),
        });
      } else {
        // GOOGLE_APPLICATION_CREDENTIALS is auto-detected by the SDK
        this.app = initializeApp();
      }

      this.messaging = getMessaging(this.app);
      this.logger.log("Firebase Admin SDK initialized for push notifications");
    } catch (err) {
      this.logger.error("Failed to initialize Firebase Admin SDK:", err);
    }
  }

  async sendClassScheduled(
    userId: string,
    data: {
      classId: string;
      classTitle: string;
      scheduledAt: string;
      durationMinutes: number;
    },
  ) {
    const date = new Date(data.scheduledAt).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    await this.sendToUser(userId, {
      notification: {
        title: "Class Scheduled",
        body: `${data.classTitle} — ${date} (${data.durationMinutes} min)`,
      },
      data: {
        type: "class_scheduled",
        classId: data.classId,
      },
    });
  }

  async sendClassCancelled(
    userId: string,
    data: { classId: string; classTitle: string; reason?: string },
  ) {
    await this.sendToUser(userId, {
      notification: {
        title: "Class Cancelled",
        body: data.reason
          ? `${data.classTitle} — ${data.reason}`
          : `${data.classTitle} has been cancelled`,
      },
      data: {
        type: "class_cancelled",
        classId: data.classId,
      },
    });
  }

  async sendReportReady(
    userId: string,
    data: { reportId: string; roomId: string; classTitle?: string },
  ) {
    await this.sendToUser(userId, {
      notification: {
        title: "Report Ready",
        body: data.classTitle
          ? `Report for ${data.classTitle} is ready`
          : "Your class report is ready to view",
      },
      data: {
        type: "report_ready",
        reportId: data.reportId,
        roomId: data.roomId,
      },
    });
  }

  private async sendToUser(
    userId: string,
    payload: {
      notification: { title: string; body: string };
      data: Record<string, string>;
    },
  ) {
    // Always persist to DB, even if push is unavailable
    try {
      await this.notificationRepo.save(
        this.notificationRepo.create({
          userId,
          type: payload.data.type ?? "general",
          title: payload.notification.title,
          body: payload.notification.body,
          data: payload.data,
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to persist notification for user ${userId}:`, err);
    }

    if (!this.messaging) return;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.fcmTokens?.length) return;

    const tokens = user.fcmTokens.map((t) => t.token);

    try {
      const response = await this.messaging.sendEachForMulticast({
        tokens,
        notification: payload.notification,
        data: payload.data,
      });

      // Clean up stale tokens
      const staleTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (
          resp.error &&
          (resp.error.code === "messaging/registration-token-not-registered" ||
            resp.error.code === "messaging/invalid-registration-token")
        ) {
          staleTokens.push(tokens[idx]);
        }
      });

      if (staleTokens.length > 0) {
        user.fcmTokens = user.fcmTokens.filter(
          (t) => !staleTokens.includes(t.token),
        );
        await this.userRepo.save(user);
        this.logger.log(
          `Cleaned ${staleTokens.length} stale FCM token(s) for user ${userId}`,
        );
      }

      this.logger.debug(
        `Push sent to user ${userId}: ${response.successCount}/${tokens.length} succeeded`,
      );
    } catch (err) {
      this.logger.error(`Failed to send push to user ${userId}:`, err);
    }
  }
}
