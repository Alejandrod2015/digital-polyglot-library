import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { isStudioMember } from "@/lib/studio-access";

export type QAIssue = {
  id: string;
  severity: "critical" | "warning" | "info";
  category: string;
  title: string;
  file: string;
  description: string;
  affected: string;
  fix: string;
};

export type QAReport = {
  generatedAt: string;
  summary: { critical: number; warning: number; info: number; total: number };
  issues: QAIssue[];
};

/**
 * GET /api/studio/qa
 *
 * Returns the latest QA audit report.
 * The report is stored as a JSON file that gets updated
 * each time Claude runs an audit via the app-audit skill.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const reportPath = join(process.cwd(), "qa", "latest-report.json");
    const raw = await readFile(reportPath, "utf-8");
    const report: QAReport = JSON.parse(raw);
    return NextResponse.json(report);
  } catch {
    // No report file yet — return empty report
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summary: { critical: 0, warning: 0, info: 0, total: 0 },
      issues: [],
    } satisfies QAReport);
  }
}
