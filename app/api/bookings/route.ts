import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { bookingSchema } from "../../../lib/schema";

export async function POST(req: Request) {
  const parsed = bookingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "資料格式錯誤" }, { status: 400 });
  }
  const { branchId, date, slot, name, phone, note } = parsed.data;

  // 1) 原子性建立預約（名額檢查在 DB 內完成）
  const { data, error } = await supabaseAdmin.rpc("create_appointment", {
    p_branch_id: branchId,
    p_date: date,
    p_slot: slot,
    p_name: name,
    p_phone: phone,
    p_note: note,
  });

  if (error) {
    if (error.message.includes("SLOT_UNAVAILABLE")) {
      return NextResponse.json(
        { error: "此時段已額滿或不可預約，請重新選擇" },
        { status: 409 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: "預約失敗，請稍後再試" }, { status: 500 });
  }
  const { out_code: bookingCode } = data[0];

  // 2) 取得分店資訊並發送 Webhook（失敗不影響預約結果）
  const { data: branch } = await supabaseAdmin
    .from("branches")
    .select("name, notify_webhook_url")
    .eq("id", branchId)
    .single();

  if (branch?.notify_webhook_url) {
    try {
      await fetch(branch.notify_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "appointment.created",
          booking_code: bookingCode,
          branch_name: branch.name,
          appointment_datetime: `${date} ${slot}`,
          customer_name: name,
          customer_phone: phone,
        }),
        signal: AbortSignal.timeout(5000), // Vercel 上需 await，否則函式結束後請求會被中斷
      });
    } catch (e) {
      console.error("Webhook failed", e);
    }
  }

  return NextResponse.json({
    bookingCode,
    branchName: branch?.name ?? "",
    date,
    slot,
  });
}