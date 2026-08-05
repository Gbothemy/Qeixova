import { NextRequest, NextResponse } from "next/server";
import { completeFlutterwaveWalletFunding } from "@/lib/businessWalletFunding";

export async function GET(req: NextRequest) {
  const reference =
    req.nextUrl.searchParams.get("reference") ||
    req.nextUrl.searchParams.get("tx_ref") ||
    req.nextUrl.searchParams.get("transaction_id");
  const redirectUrl = new URL("/business/wallet", req.nextUrl.origin);

  if (!reference) {
    redirectUrl.searchParams.set("payment", "missing_reference");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const result = await completeFlutterwaveWalletFunding(reference);
    redirectUrl.searchParams.set("payment", result.ok ? "success" : result.status === "pending" ? "pending" : "failed");
    redirectUrl.searchParams.set("reference", reference);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Flutterwave verification error:", error);
    redirectUrl.searchParams.set("payment", "failed");
    redirectUrl.searchParams.set("reference", reference);
    return NextResponse.redirect(redirectUrl);
  }
}
