import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn("RESEND_API_KEY not set — emails will be skipped");
    }
    this.fromEmail =
      this.config.get<string>("RESEND_FROM_EMAIL") ??
      "Langopia <noreply@langopia.com>";
  }

  async sendClassScheduled(opts: {
    to: string;
    classTitle: string;
    scheduledAt: Date;
    durationMinutes: number;
    teacherName?: string;
    joinUrl: string;
  }) {
    if (!this.resend) return;

    const date = new Date(opts.scheduledAt).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: opts.to,
        subject: `Class Scheduled: ${opts.classTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">Class Scheduled</h2>
            <p>You have a class scheduled:</p>
            <table style="border-collapse: collapse; width: 100%;">
              <tr><td style="padding: 8px 0; color: #666;">Class</td><td style="padding: 8px 0; font-weight: bold;">${opts.classTitle}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Date & Time</td><td style="padding: 8px 0;">${date}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Duration</td><td style="padding: 8px 0;">${opts.durationMinutes} minutes</td></tr>
              ${opts.teacherName ? `<tr><td style="padding: 8px 0; color: #666;">Teacher</td><td style="padding: 8px 0;">${opts.teacherName}</td></tr>` : ""}
            </table>
            <p style="margin-top: 24px;">
              <a href="${opts.joinUrl}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                Join Class
              </a>
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 32px;">Langopia - Language Learning Platform</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error("Failed to send class scheduled email:", err);
    }
  }

  async sendTeacherInvitation(opts: {
    to: string;
    teacherName: string;
    academyName: string;
  }) {
    if (!this.resend) return;

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: opts.to,
        subject: `You've been invited to teach at ${opts.academyName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">Welcome to ${opts.academyName}!</h2>
            <p>Hi ${opts.teacherName},</p>
            <p>You have been added as a <strong>teacher</strong> at <strong>${opts.academyName}</strong> on Langopia.</p>
            <p>You can now be assigned to classes and your students will be able to see your profile.</p>
            <p style="color: #999; font-size: 12px; margin-top: 32px;">Langopia - Language Learning Platform</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error("Failed to send teacher invitation email:", err);
    }
  }

  async sendClassCancelled(opts: {
    to: string;
    classTitle: string;
    scheduledAt: Date;
    reason?: string;
  }) {
    if (!this.resend) return;

    const date = new Date(opts.scheduledAt).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: opts.to,
        subject: `Class Cancelled: ${opts.classTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Class Cancelled</h2>
            <p>The following class has been cancelled:</p>
            <table style="border-collapse: collapse; width: 100%;">
              <tr><td style="padding: 8px 0; color: #666;">Class</td><td style="padding: 8px 0; font-weight: bold;">${opts.classTitle}</td></tr>
              <tr><td style="padding: 8px 0; color: #666;">Was Scheduled</td><td style="padding: 8px 0;">${date}</td></tr>
              ${opts.reason ? `<tr><td style="padding: 8px 0; color: #666;">Reason</td><td style="padding: 8px 0;">${opts.reason}</td></tr>` : ""}
            </table>
            <p style="color: #999; font-size: 12px; margin-top: 32px;">Langopia - Language Learning Platform</p>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error("Failed to send class cancelled email:", err);
    }
  }
}
