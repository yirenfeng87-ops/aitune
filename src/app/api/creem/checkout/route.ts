import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "缺少 CREEM_API_KEY", failureType: "code" }, { status: 500 });
  }
  let parsed: unknown = null;
  try {
    parsed = await req.json();
  } catch {}
  const productId =
    (parsed && typeof parsed === "object" && "productId" in parsed
      ? (parsed as { productId?: string }).productId
      : undefined) || process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID;
  if (!productId) {
    return NextResponse.json({ error: "缺少产品ID", failureType: "code" }, { status: 400 });
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const successUrl = `${base}/?paid=1`;
  try {
    const resp = await fetch("https://test-api.creem.io/v1/checkouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        product_id: productId,
        request_id: `req_${Date.now()}`,
        success_url: successUrl,
        metadata: {},
      }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok) {
      const status = resp.status;
      const failureType = [400, 401, 403, 404].includes(status) ? "code" : "API";
      return NextResponse.json(
        { error: data?.error || "创建失败", failureType },
        { status }
      );
    }
    const url = data?.checkout_url || data?.url || "";
    const id = data?.id || data?.checkout_id || "";
    return NextResponse.json({ id, url, successUrl }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "网络错误或服务不可用", failureType: "API" }, { status: 502 });
  }
}
