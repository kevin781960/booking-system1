import { supabase } from "@/lib/supabase-browser";
import BookingForm from "./booking-form";

export const dynamic = "force-dynamic";

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ branch_id?: string }>;
}) {
  const { branch_id } = await searchParams;

  // 只選公開欄位（notify_webhook_url 沒有 select 權限）
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, address")
    .order("name");

  const valid = branches?.some((b) => b.id === branch_id);

  return (
    <main className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-bold">線上預約</h1>
      <BookingForm branches={branches ?? []} fixedBranchId={valid ? branch_id : undefined} />
    </main>
  );
}