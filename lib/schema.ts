import { z } from "zod";

export const bookingSchema = z.object({
  branchId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(1).max(50),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, "電話格式不正確"),
  note: z.string().trim().max(500).optional().default(""),
});
export type BookingInput = z.infer<typeof bookingSchema>;