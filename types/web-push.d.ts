declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    expirationTime?: number | null;
    keys: { p256dh: string; auth: string };
  };

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string,
    options?: { TTL?: number; urgency?: "very-low" | "low" | "normal" | "high" },
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: string }>;
}
