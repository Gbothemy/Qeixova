import crypto from "crypto";

const PRODUCTION_APP_URL = "https://qeixova.vercel.app";

type FlutterwaveCheckoutResponse = {
  status: string;
  message: string;
  data?: {
    id?: string;
    link?: string;
    amount?: number;
    currency?: string;
  };
};

type FlutterwaveListChargesResponse = {
  status: string;
  message: string;
  data?: {
    id?: number | string;
    tx_ref?: string;
    status?: string;
    amount?: number;
    charged_amount?: number;
    currency?: string;
    payment_type?: string;
    processor_response?: string;
    created_at?: string;
  };
};

export function getAppBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    try {
      const url = new URL(withProtocol);
      const host = url.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") continue;
      url.pathname = "";
      url.search = "";
      url.hash = "";
      return url.toString().replace(/\/$/, "");
    } catch {
      // Ignore malformed values and keep looking.
    }
  }

  return PRODUCTION_APP_URL;
}

export function qltToFlutterwaveNaira(amountQlt: number) {
  // Project rate: 10 QLT = 1 NGN. Flutterwave V3 expects NGN, not kobo.
  return Math.round((amountQlt / 10) * 100) / 100;
}

function getFlutterwaveSecretKey() {
  const key = process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY;
  if (!key) throw new Error("FLUTTERWAVE_SECRET_KEY is not configured");
  return key;
}

function normalizeCheckoutEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : "payments@qeixova.com";
}

function getFlutterwaveV3BaseUrl() {
  return (process.env.FLUTTERWAVE_V3_API_BASE_URL || "https://api.flutterwave.com/v3").replace(/\/$/, "");
}

function makeTraceId(reference?: string) {
  return `qeixova-${reference || Date.now()}-${crypto.randomBytes(4).toString("hex")}`.slice(0, 64);
}

function makeV3Headers(reference?: string) {
  return {
    Authorization: `Bearer ${getFlutterwaveSecretKey()}`,
    "Content-Type": "application/json",
    "X-Trace-Id": makeTraceId(reference),
  };
}

async function readFlutterwaveJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & {
    message?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `Flutterwave request failed with status ${response.status}`);
  }
  return data;
}

export async function initializeFlutterwavePayment(input: {
  email: string;
  amountQlt: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}) {
  const amount = qltToFlutterwaveNaira(input.amountQlt);

  const response = await fetch(`${getFlutterwaveV3BaseUrl()}/payments`, {
    method: "POST",
    headers: makeV3Headers(input.reference),
    body: JSON.stringify({
      tx_ref: input.reference,
      amount,
      currency: "NGN",
      payment_options: "card,banktransfer,ussd",
      redirect_url: input.callbackUrl,
      customer: {
        email: normalizeCheckoutEmail(input.email),
        name: typeof input.metadata?.businessName === "string" ? input.metadata.businessName : "Qeixova Business",
        phonenumber: "08000000000",
      },
      customizations: {
        title: "Qeixova Wallet Funding",
        description: "Top up your Qeixova business campaign wallet.",
      },
      meta: {
        ...input.metadata,
        amountQlt: input.amountQlt,
      },
    }),
  });

  const data = await readFlutterwaveJson<FlutterwaveCheckoutResponse>(response);
  const checkoutUrl = data.data?.link;

  if (data.status !== "success" || !checkoutUrl || !/^https?:\/\//i.test(checkoutUrl)) {
    throw new Error(data.message || "Flutterwave did not return a hosted payment link");
  }

  return {
    ...data,
    data: {
      ...data.data,
      link: checkoutUrl,
    },
  };
}

export async function verifyFlutterwavePayment(reference: string) {
  const url = `${getFlutterwaveV3BaseUrl()}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`;
  const response = await fetch(url, {
    headers: makeV3Headers(`${reference}-verify`),
  });

  const data = await readFlutterwaveJson<FlutterwaveListChargesResponse>(response);
  if (data.status !== "success") {
    throw new Error(data.message || "Flutterwave charge verification failed");
  }

  const charge = data.data;
  return {
    status: data.status,
    message: data.message,
    data: charge
      ? {
          id: charge.id,
          tx_ref: charge.tx_ref,
          status: charge.status,
          amount: charge.amount,
          charged_amount: charge.charged_amount,
          currency: charge.currency,
          payment_type: charge.payment_type,
          processor_response: charge.processor_response,
          created_at: charge.created_at,
        }
      : undefined,
  };
}

export function verifyFlutterwaveWebhook(rawBody: string, receivedHash: string | null) {
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || process.env.FLW_WEBHOOK_SECRET_HASH;
  if (secretHash) {
    if (!receivedHash) return false;
    const expected = Buffer.from(secretHash);
    const received = Buffer.from(receivedHash);
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(expected, received);
  }

  // Payment verification is still performed before wallet credit.
  return rawBody.trim().length > 0;
}
