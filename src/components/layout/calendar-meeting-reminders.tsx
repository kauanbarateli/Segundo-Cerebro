"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDemoApplication, useDemoQuery, DEMO_LOGOUT_EVENT } from "@/lib/demo/demo-provider";
import { useDemoAccess } from "@/lib/navigation/demo-access-provider";
import { resolveAccess } from "@/core/access/resolve-access";
import { dueMeetingReminders, type CalendarEvent } from "@/core/calendario";
import { useToast } from "@/components/ui/toast";
export function CalendarMeetingReminders() {
 const app = useDemoApplication(), { policy, ready } = useDemoAccess(), access = resolveAccess("calendario", policy), enabled = app.mode === "connected" && ready && access.allowed && access.visible;
 const agenda = useDemoQuery("agenda", enabled), { toast, dismiss } = useToast(), router = useRouter(), seen = useRef(new Set<string>()), notices = useRef<number[]>([]);
 useEffect(() => { function clear() { seen.current.clear(); notices.current.forEach(dismiss); notices.current = []; } window.addEventListener(DEMO_LOGOUT_EVENT, clear); return () => { window.removeEventListener(DEMO_LOGOUT_EVENT, clear); clear(); }; }, [app.userId, dismiss]);
 useEffect(() => {
  if (!enabled || agenda.status !== "ready" || !agenda.data?.preferences?.meeting_reminders_enabled) { notices.current.forEach(dismiss); notices.current = []; return; }
  const data = agenda.data, preferences = data.preferences!;
  const notify = () => { if (document.visibilityState !== "visible") return; const rows = data.items.filter((event): event is CalendarEvent => "user_id" in event && event.user_id === app.userId); for (const event of dueMeetingReminders(rows, preferences, new Date().toISOString())) { const key = event.id + ":" + event.starts_at; if (seen.current.has(key)) continue; seen.current.add(key); notices.current.push(toast({ message: "Em breve: " + event.title, action: { label: "Abrir compromisso", onClick: () => router.push("/calendario?event=" + encodeURIComponent(event.id)) } })); } };
  notify(); const timer = setInterval(notify, 30_000); return () => clearInterval(timer);
 }, [enabled, agenda.status, agenda.data, app.userId, toast, dismiss, router]);
 return null;
}
