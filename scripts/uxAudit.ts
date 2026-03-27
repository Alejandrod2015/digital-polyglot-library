import fs from "node:fs";
import path from "node:path";

type AppConfig = {
  id: string;
  name: string;
  kind: "web" | "mobile" | "studio";
  sourceRoots: string[];
  screenshotRoots: string[];
};

type AutofixMapping = {
  file: string;
  duplicateText: string;
  replacementEyebrow: string;
};

type AuditConfig = {
  apps: AppConfig[];
  autofixMappings: AutofixMapping[];
};

type Finding = {
  appId: string;
  appName: string;
  code: "duplicate_heading_copy" | "oversized_ui_surface" | "missing_visual_artifacts" | "long_book_detail_intro_copy";
  severity: "info" | "warning";
  message: string;
  filePath?: string;
  line?: number;
  evidence?: string;
  fixable?: boolean;
  suggestedFix?: string;
};

type AuditReport = {
  generatedAt: string;
  fixedCount: number;
  apps: {
    id: string;
    name: string;
    kind: string;
    screenshotCount: number;
    sourceFileCount: number;
    findings: Finding[];
  }[];
  findings: Finding[];
};

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, "qa", "ux-audit.config.json");
const reportsDir = path.join(repoRoot, "qa", "reports");
const fixMode = process.argv.includes("--fix");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function isDirectory(entryPath: string) {
  try {
    return fs.statSync(entryPath).isDirectory();
  } catch {
    return false;
  }
}

function walkFiles(rootPath: string, allowedExtensions: Set<string>, files: string[] = []): string[] {
  if (!fs.existsSync(rootPath)) return files;
  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
      walkFiles(entryPath, allowedExtensions, files);
      continue;
    }
    if (allowedExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

function lineNumberForIndex(text: string, index: number) {
  return text.slice(0, index).split("\n").length;
}

function normalizeLabel(value: string) {
  return value.replace(/&apos;/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

function countScreenshots(roots: string[]) {
  const allowedExtensions = new Set([".png", ".jpg", ".jpeg"]);
  let count = 0;
  for (const root of roots) {
    const absoluteRoot = path.join(repoRoot, root);
    if (!fs.existsSync(absoluteRoot)) continue;
    if (isDirectory(absoluteRoot)) {
      count += walkFiles(absoluteRoot, allowedExtensions).length;
      continue;
    }
    if (allowedExtensions.has(path.extname(absoluteRoot))) {
      count += 1;
    }
  }
  return count;
}

function findDuplicateHeadingFindings(app: AppConfig, filePath: string, source: string): Finding[] {
  const findings: Finding[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const eyebrowMatch = lines[i]?.match(
      /<Text style=\{styles\.(sectionEyebrow|eyebrow)\}>\s*([^<{][^<]*)\s*<\/Text>/,
    );
    if (!eyebrowMatch) continue;
    const eyebrowText = eyebrowMatch[2]?.trim();
    if (!eyebrowText) continue;
    for (let j = i + 1; j <= Math.min(i + 6, lines.length - 1); j += 1) {
      const titleMatch = lines[j]?.match(
        /<Text style=\{styles\.(sectionTitle|title)\}>\s*([^<{][^<]*)\s*<\/Text>/,
      );
      if (!titleMatch) continue;
      const titleText = titleMatch[2]?.trim();
      if (!titleText) break;
      if (normalizeLabel(eyebrowText) !== normalizeLabel(titleText)) break;
      findings.push({
        appId: app.id,
        appName: app.name,
        code: "duplicate_heading_copy",
        severity: "warning",
        message: `Duplicate eyebrow/title copy: "${titleText}"`,
        filePath: path.relative(repoRoot, filePath),
        line: i + 1,
        evidence: `${eyebrowText} -> ${titleText}`,
        fixable: true,
        suggestedFix: "Differentiate the eyebrow or remove it so the title carries the weight alone.",
      });
      break;
    }
  }
  return findings;
}

function findOversizedSurfaceFinding(app: AppConfig, filePath: string, source: string): Finding[] {
  const relativePath = path.relative(repoRoot, filePath);
  if (!relativePath.endsWith(".tsx")) return [];
  const lineCount = source.split("\n").length;
  if (lineCount < 2500) return [];
  return [
    {
      appId: app.id,
      appName: app.name,
      code: "oversized_ui_surface",
      severity: "info",
      message: `Large UI surface with ${lineCount} lines`,
      filePath: relativePath,
      line: 1,
      evidence: "Large files slow down autonomous fixes and increase regression risk.",
      suggestedFix: "Split by screen or card family before the next major product sweep.",
    },
  ];
}

function findLongBookDetailIntroCopy(app: AppConfig, filePath: string, source: string): Finding[] {
  const relativePath = path.relative(repoRoot, filePath);
  if (app.kind !== "mobile") return [];
  if (!relativePath.endsWith("MobileLibraryShell.tsx")) return [];
  if (!source.includes("selectedBook.description?.trim()")) return [];
  if (source.includes("selectedBookDescriptionExpanded")) return [];
  return [
    {
      appId: app.id,
      appName: app.name,
      code: "long_book_detail_intro_copy",
      severity: "warning",
      message: "Book detail intro shows full descriptive copy before core actions",
      filePath: relativePath,
      evidence: "Long descriptions above the stories tab create unnecessary scrolling before the user reaches the main task.",
      suggestedFix: "Clamp the intro copy and add a small Show more / Show less affordance.",
    },
  ];
}

function applyAutofixMappings(config: AuditConfig) {
  let fixedCount = 0;
  for (const mapping of config.autofixMappings) {
    const absolutePath = path.join(repoRoot, mapping.file);
    if (!fs.existsSync(absolutePath)) continue;
    const source = fs.readFileSync(absolutePath, "utf8");
    const before = source;
    const escapedDuplicateText = mapping.duplicateText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(<Text style=\\{styles\\.(?:sectionEyebrow|eyebrow)\\}>\\s*)${escapedDuplicateText}(\\s*<\\/Text>[\\s\\S]{0,200}?<Text style=\\{styles\\.(?:sectionTitle|title)\\}>\\s*)${escapedDuplicateText}(\\s*<\\/Text>)`,
      "m",
    );
    const updated = source.replace(
      pattern,
      `$1${mapping.replacementEyebrow}$2${mapping.duplicateText}$3`,
    );
    if (updated !== before) {
      fs.writeFileSync(absolutePath, updated);
      fixedCount += 1;
    }
  }
  return fixedCount;
}

function ensureReportsDir() {
  fs.mkdirSync(reportsDir, { recursive: true });
}

function writeReport(report: AuditReport) {
  ensureReportsDir();
  fs.writeFileSync(path.join(reportsDir, "ux-audit-latest.json"), JSON.stringify(report, null, 2));

  const lines: string[] = [];
  lines.push("# UX Audit Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Safe autofixes applied: ${report.fixedCount}`);
  lines.push("");

  for (const app of report.apps) {
    lines.push(`## ${app.name}`);
    lines.push("");
    lines.push(`- Kind: \`${app.kind}\``);
    lines.push(`- Source files scanned: \`${app.sourceFileCount}\``);
    lines.push(`- Screenshots/artifacts found: \`${app.screenshotCount}\``);
    lines.push(`- Findings: \`${app.findings.length}\``);
    lines.push("");
    if (app.findings.length === 0) {
      lines.push("No findings.");
      lines.push("");
      continue;
    }
    for (const finding of app.findings) {
      lines.push(
        `- [${finding.severity}] ${finding.message}${finding.filePath ? ` in \`${finding.filePath}${finding.line ? `:${finding.line}` : ""}\`` : ""}`,
      );
      if (finding.evidence) {
        lines.push(`  Evidence: ${finding.evidence}`);
      }
      if (finding.suggestedFix) {
        lines.push(`  Suggested fix: ${finding.suggestedFix}`);
      }
    }
    lines.push("");
  }

  fs.writeFileSync(path.join(reportsDir, "ux-audit-latest.md"), `${lines.join("\n")}\n`);
}

function main() {
  const config = readJson<AuditConfig>(configPath);
  const fixedCount = fixMode ? applyAutofixMappings(config) : 0;

  const appReports = config.apps.map((app) => {
    const sourceFiles = app.sourceRoots.flatMap((root) =>
      walkFiles(path.join(repoRoot, root), new Set([".ts", ".tsx", ".js", ".jsx"])),
    );
    const findings: Finding[] = [];
    for (const filePath of sourceFiles) {
      const source = fs.readFileSync(filePath, "utf8");
      findings.push(...findDuplicateHeadingFindings(app, filePath, source));
      findings.push(...findOversizedSurfaceFinding(app, filePath, source));
      findings.push(...findLongBookDetailIntroCopy(app, filePath, source));
    }

    const screenshotCount = countScreenshots(app.screenshotRoots);
    if (screenshotCount === 0) {
      findings.push({
        appId: app.id,
        appName: app.name,
        code: "missing_visual_artifacts",
        severity: "info",
        message: "No recent visual artifacts found for this app",
        suggestedFix: "Add a screenshot runner so the UX auditor can compare visual states instead of code only.",
      });
    }

    return {
      id: app.id,
      name: app.name,
      kind: app.kind,
      screenshotCount,
      sourceFileCount: sourceFiles.length,
      findings,
    };
  });

  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    fixedCount,
    apps: appReports,
    findings: appReports.flatMap((app) => app.findings),
  };

  writeReport(report);

  const warningCount = report.findings.filter((finding) => finding.severity === "warning").length;
  const infoCount = report.findings.filter((finding) => finding.severity === "info").length;
  process.stdout.write(
    `UX audit complete. Findings: ${report.findings.length} (${warningCount} warning, ${infoCount} info). Reports written to qa/reports/ux-audit-latest.{json,md}\n`,
  );
}

main();
