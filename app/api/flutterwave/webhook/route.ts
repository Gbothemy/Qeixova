import { NextRequest, NextResponse } from "next/server";
import { completeFlutterwaveWalletFunding } from "@/lib/businessWalletFunding";
import { verifyFlutterwaveWebhook } from "@/lib/flutterwave";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("verif-hash");

  if (!verifyFlutterwaveWebhook(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody || "{}") as {
    event?: string;
    data?: {
      tx_ref?: string;
      reference?: string;
      status?: string;
    };
  };

  const reference = event.data?.tx_ref || event.data?.reference;
  const status = String(event.data?.status || "").toLowerCase();

  if (event.event === "charge.completed" && reference && ["successful", "succeeded", "completed"].includes(status)) {
    try {
      await completeFlutterwaveWalletFunding(reference);
    } catch (error) {
      console.error("Flutterwave webhook processing error:", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
