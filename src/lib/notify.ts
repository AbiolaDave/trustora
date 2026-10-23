import { Types } from "mongoose";
import { Notification } from "../models/misc";
import { User } from "../models/user";
import { sendEmail } from "./email";
import { env } from "./env";

/** In-app notification, plus an email when Gmail is configured. Bodies must stay free of payment/contact details. */
export async function notify(userId: Types.ObjectId | string, title: string, body: string, link: string) {
  await Notification.create({ user: userId, title, body, link });
  try {
    const u = await User.findById(userId).select("email emailVerifiedAt").lean();
    if (u?.emailVerifiedAt && env.GMAIL_USER) await sendEmail(u.email, title, `${body}\n\nOpen: ${env.APP_URL}${link}`);
  } catch (e) {
    console.error("[notify] email failed", (e as Error).message); // never block the main action on email
  }
}
