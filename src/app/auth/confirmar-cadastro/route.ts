import type { NextRequest } from "next/server";
import { openSignupEmailLink, submitSignupEmailLink } from "@/lib/auth/signup-confirmation-channel";

export const dynamic = "force-dynamic";
export const GET = (request: NextRequest) => openSignupEmailLink(request, "signup");
export const POST = (request: NextRequest) => submitSignupEmailLink(request, "signup");
