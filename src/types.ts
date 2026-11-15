export type ShiftPeriod = "morning" | "afternoon";
export type RequestStatus = "pending" | "approved" | "rejected";
export interface Shift {
  id: number;
  shift_date: string;
  period: ShiftPeriod;
  capacity: number;
  booked: number;
  is_open: number;
}
export interface ShiftRequest {
  id: number;
  full_name: string;
  mobile: string;
  note: string | null;
  status: RequestStatus;
  shift_date: string;
  period: ShiftPeriod;
  created_at: string;
}