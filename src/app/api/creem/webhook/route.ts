import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "缺少 CREEM_WEBHOOK_SECRET", failureType: "code" }, { status: 500 });
  }
  const payload = await req.text();
  const signature = req.headers.get("creem-signature");
  if (!signature) {
    return NextResponse.json({ error: "缺少签名", failureType: "code" }, { status: 401 });
  }
  const computed = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (computed !== signature) {
    return NextResponse.json({ error: "签名无效", failureType: "code" }, { status: 401 });
  }
  let event: unknown = null;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "负载格式错误", failureType: "code" }, { status: 400 });
  }
  const type = (event && typeof event === "object" && "type" in event) ? (event as { type?: string }).type || "" : "";
  return NextResponse.json({ ok: true, type }, { status: 200 });
}
