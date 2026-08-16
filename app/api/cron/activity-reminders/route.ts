import {
  NextResponse,
} from "next/server";

import {
  sendActivityReminders,
} from "@/lib/activity-reminders";

export const dynamic =
  "force-dynamic";

function isAuthorized(
  request: Request,
) {
  /*
   * Local development stays easy to test.
   * In production, CRON_SECRET is mandatory.
   */
  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    return true;
  }

  const secret =
    process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return (
    request.headers.get(
      "authorization",
    ) ===
    `Bearer ${secret}`
  );
}

export async function GET(
  request: Request,
) {
  if (
    !isAuthorized(request)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "UNAUTHORIZED",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const result =
      await sendActivityReminders();

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error(
      "Activity reminder job failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          "REMINDER_JOB_FAILED",
      },
      {
        status: 500,
      },
    );
  }
}
