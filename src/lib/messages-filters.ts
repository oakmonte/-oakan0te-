import {
  CalendarDays,
  CircleDollarSign,
  CircleHelp,
  Flag,
  Inbox,
  ShoppingCart,
  Tag,
  Truck,
} from "lucide-react";
import type { FilterKey } from "@/lib/messages-seed";

export const FILTERS: { key: FilterKey; label: string; icon: typeof Inbox }[] = [
  { key: "unread", label: "Unread", icon: Inbox },
  { key: "unanswered", label: "Unanswered", icon: CircleHelp },
  { key: "flagged", label: "Flagged", icon: Flag },
  { key: "booked", label: "Booked", icon: CalendarDays },
  { key: "ordered", label: "Ordered", icon: ShoppingCart },
  { key: "paid", label: "Paid", icon: CircleDollarSign },
  { key: "dispatched", label: "Dispatched", icon: Truck },
  { key: "lead", label: "Lead", icon: Tag },
];
