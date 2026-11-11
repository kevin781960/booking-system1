"use client";

import { useEffect, useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { supabase } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Branch = { id: string; name: string; address: string | null };
type Slot = { slot_time: string; remaining: number };
type Result = { bookingCode: string; branchName: string; date: string; slot: string };

export default function BookingForm({
  branches, fixedBranchId,
}: { branches: Branch[]; fixedBranchId?: string }) {
  const [branchId, setBranchId] = useState(fixedBranchId ?? "");
  const [date, setDate] = useState<Date | undefined>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const today = startOfDay(new Date());
  const maxDate = addDays(today, 30);
  const dateStr = date ? format(date, "yyyy-MM-dd") : "";

  // 分店或日期改變 → 重新查詢可預約時段
  useEffect(() => {
    setSlot("");
    setSlots([]);
    if (!branchId || !dateStr) return;

    let cancelled = false;
    setLoadingSlots(true);
    supabase
      .rpc("get_available_slots", { p_branch_id: branchId, p_date: dateStr })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError("無法載入時段");
        else setSlots(((data as Slot[]) ?? []).filter((s) => s.remaining > 0));
        setLoadingSlots(false);
      });
    return () => { cancelled = true; };
  }, [branchId, dateStr]);

  const canSubmit =
    branchId && dateStr && slot && form.name.trim() && /^[0-9+\-\s]{8,20}$/.test(form.phone);

  async function submit() {
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, date: dateStr, slot, ...form }),
    });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(json.error ?? "預約失敗");
      if (res.status === 409) setDate(new Date(date!)); // 觸發重新載入時段
      return;
    }
    setResult(json);
  }

  // ---------- 成功確認卡片 ----------
  if (result) {
    return (
      <Card>
        <CardHeader><CardTitle>✅ 預約成功</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p>預約編號：<span className="font-mono text-lg font-bold">{result.bookingCode}</span></p>
          <p>分店：{result.branchName}</p>
          <p>時間：{result.date} {result.slot}</p>
          <p className="text-sm text-muted-foreground">請保留預約編號，如需變更請聯絡分店。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 分店：有帶 branch_id 就鎖定，否則顯示下拉 */}
      {fixedBranchId ? (
        <p className="text-lg">分店：<b>{branches.find((b) => b.id === fixedBranchId)?.name}</b></p>
      ) : (
        <div className="space-y-2">
            <Label>選擇分店</Label>
            {/* @ts-ignore */}
            <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger><SelectValue placeholder="請選擇分店" /></SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>選擇日期（30 天內）</Label>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={{ before: today, after: maxDate }}
          className="rounded-md border"
        />
      </div>

      {branchId && date && (
        <div className="space-y-2">
          <Label>選擇時段</Label>
          {loadingSlots ? (
            <p className="text-sm text-muted-foreground">載入中…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">當日無可預約時段</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => {
                const t = s.slot_time.slice(0, 5);
                return (
                  <Button
                    key={t}
                    type="button"
                    variant={slot === t ? "default" : "outline"}
                    onClick={() => setSlot(t)}
                  >
                    {t}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">姓名</Label>
          <Input id="name" maxLength={50} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">聯絡電話</Label>
          <Input id="phone" type="tel" inputMode="tel" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">備註</Label>
          <Textarea id="note" maxLength={500} value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button className="w-full" disabled={!canSubmit || submitting} onClick={submit}>
        {submitting ? "送出中…" : "送出預約"}
      </Button>
    </div>
  );
}