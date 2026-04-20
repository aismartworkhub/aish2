import { createDoc, COLLECTIONS } from "@/lib/firestore";
import { loadFeatureFlags } from "@/lib/site-settings-public";

export type NotificationType =
  | "comment"
  | "reply"
  | "like"
  | "system"
  | "welcome"
  | "content-approved"
  | "POST_APPROVED";

interface CreateNotificationParams {
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
  linkUrl?: string;
  linkTab?: string;
  linkTargetId?: string;
  senderUid?: string;
  senderName?: string;
}

export async function createNotification({
  recipientUid,
  type,
  title,
  message,
  linkUrl,
  linkTab,
  linkTargetId,
  senderUid,
  senderName,
}: CreateNotificationParams): Promise<string | null> {
  if (!recipientUid) return null;

  const flags = await loadFeatureFlags();
  if (!flags.phase4.enabled || flags.phase4.notificationSystem !== true) return null;

  try {
    return await createDoc(COLLECTIONS.NOTIFICATIONS, {
      recipientUid,
      type,
      title,
      message,
      linkUrl: linkUrl ?? "",
      linkTab: linkTab ?? "",
      linkTargetId: linkTargetId ?? "",
      senderUid: senderUid ?? "",
      senderName: senderName ?? "",
      isRead: false,
    });
  } catch {
    return null;
  }
}
