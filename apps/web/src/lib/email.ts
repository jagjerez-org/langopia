import { Resend } from "resend";

let resendInstance: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — emails will be skipped");
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Langopia <noreply@langopia.com>";

export async function sendClassScheduled({
  to,
  classTitle,
  scheduledAt,
  durationMinutes,
  teacherName,
  joinUrl,
}: {
  to: string;
  classTitle: string;
  scheduledAt: Date;
  durationMinutes: number;
  teacherName?: string;
  joinUrl: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const date = new Date(scheduledAt).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Class Scheduled: ${classTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">Class Scheduled</h2>
          <p>You have a class scheduled:</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px 0; color: #666;">Class</td><td style="padding: 8px 0; font-weight: bold;">${classTitle}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Date & Time</td><td style="padding: 8px 0;">${date}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Duration</td><td style="padding: 8px 0;">${durationMinutes} minutes</td></tr>
            ${teacherName ? `<tr><td style="padding: 8px 0; color: #666;">Teacher</td><td style="padding: 8px 0;">${teacherName}</td></tr>` : ""}
          </table>
          <p style="margin-top: 24px;">
            <a href="${joinUrl}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Join Class
            </a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">Langopia - Language Learning Platform</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send class scheduled email:", err);
  }
}

export async function sendClassCancelled({
  to,
  classTitle,
  scheduledAt,
  reason,
}: {
  to: string;
  classTitle: string;
  scheduledAt: Date;
  reason?: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const date = new Date(scheduledAt).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Class Cancelled: ${classTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Class Cancelled</h2>
          <p>The following class has been cancelled:</p>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px 0; color: #666;">Class</td><td style="padding: 8px 0; font-weight: bold;">${classTitle}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Was Scheduled</td><td style="padding: 8px 0;">${date}</td></tr>
            ${reason ? `<tr><td style="padding: 8px 0; color: #666;">Reason</td><td style="padding: 8px 0;">${reason}</td></tr>` : ""}
          </table>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">Langopia - Language Learning Platform</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send class cancelled email:", err);
  }
}
