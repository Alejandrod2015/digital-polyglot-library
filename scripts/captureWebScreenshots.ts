import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";

type PageCaptureConfig = {
  id: string;
  path: string;
  waitFor?: string;
};

type WebScreenshotConfig = {
  baseUrl: string;
  outputDir: string;
  pages: PageCaptureConfig[];
};

type CaptureResult = {
  id: string;
  path: string;
  url: string;
  file?: string;
  status: "ok" | "error";
  error?: string;
};

const repoRoot = process.cwd();
const configFile = process.env.QA_SCREENSHOT_CONFIG || "qa/web-screenshots.config.json";
const configPath = path.join(repoRoot, configFile);
const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as WebScreenshotConfig;
const outputDir = path.join(repoRoot, config.outputDir);

function sanitizeBaseUrl(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function assertServerReachable(baseUrl: string) {
  try {
    const response = await fetch(baseUrl, { method: "GET" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Web server is not reachable at ${baseUrl}. ${detail}`);
  }
}

async function waitForStablePage(page: Page, waitFor?: string) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  if (!waitFor) return;
  await page.waitForSelector(waitFor, { timeout: 8000 }).catch(() => undefined);
}

async function capturePage(browser: Browser, baseUrl: string, entry: PageCaptureConfig): Promise<CaptureResult> {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    colorScheme: "dark",
  });
  const targetUrl = `${baseUrl}${entry.path}`;
  page.setDefaultTimeout(12000);

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 12000 });
    await waitForStablePage(page, entry.waitFor);

    const outputPath = path.join(outputDir, `${entry.id}.png`);
    await page.screenshot({ path: outputPath, fullPage: true });

    return {
      id: entry.id,
      path: entry.path,
      url: targetUrl,
      file: path.relative(repoRoot, outputPath),
      status: "ok",
    };
  } catch (error) {
    return {
      id: entry.id,
      path: entry.path,
      url: targetUrl,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const baseUrl = sanitizeBaseUrl(process.env.QA_WEB_BASE_URL || config.baseUrl);
  fs.mkdirSync(outputDir, { recursive: true });

  await assertServerReachable(baseUrl);

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  try {
    const captures: CaptureResult[] = [];
    for (const entry of config.pages) {
      captures.push(await capturePage(browser, baseUrl, entry));
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      baseUrl,
      config: configFile,
      captures,
    };
    fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    const successCount = captures.filter((capture) => capture.status === "ok").length;
    const errorCount = captures.length - successCount;
    process.stdout.write(`Captured ${captures.length} web screenshots into ${path.relative(repoRoot, outputDir)}\n`);
    process.stdout.write(`Successful: ${successCount}. Errors: ${errorCount}.\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${detail}\n`);
  process.exit(1);
});
