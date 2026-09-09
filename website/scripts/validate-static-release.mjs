import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { metadataRoutes, pageRoutes, routeOutputPath } from "./static-routes.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(scriptDirectory, "..");
const workspaceRoot = path.resolve(websiteRoot, "..");
const releaseRoot = path.join(websiteRoot, "outputs", "release-site");
const failures = [];

// The website-only release is composed with these sibling applications/assets
// later in the Pages/Cloud Run workflows. Validate references against the exact
// sources that will be mounted into the final site instead of treating them as
// broken website-release links.
const composedSiteMounts = Object.freeze([
  Object.freeze({
    prefix: "/shared-ui/",
    root: path.join(workspaceRoot, "shared-ui"),
  }),
  Object.freeze({
    prefix: "/window-configurator/",
    root: path.join(workspaceRoot, "dist", "window-configurator-build"),
  }),
  Object.freeze({
    prefix: "/pergola-configurator/",
    root: path.join(workspaceRoot, "pergola-configurator", "dist"),
  }),
]);

async function isFile(file) {
  return (await stat(file).catch(() => null))?.isFile() || false;
}

async function requireFile(relativePath, label = relativePath) {
  if (!(await isFile(path.join(releaseRoot, relativePath)))) failures.push(`Missing ${label}: ${relativePath}`);
}

for (const route of pageRoutes) await requireFile(routeOutputPath(route), `page ${route}`);
for (const route of metadataRoutes) await requireFile(routeOutputPath(route), `metadata ${route}`);
await requireFile("404.html");
await requireFile(".nojekyll");
await requireFile("release-manifest.json");
await requireFile("sitemap-en.xml");
await requireFile("sitemap-ro.xml");
await requireFile("sitemap-de.xml");
await requireFile("favicon-32x32.png");
await requireFile("favicon-192x192.png");
await requireFile("favicon-512x512.png");
await requireFile("apple-touch-icon.png");

const htmlFiles = [];
async function collectHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectHtml(absolute);
    else if (entry.isFile() && entry.name.endsWith(".html")) htmlFiles.push(absolute);
  }
}
await collectHtml(releaseRoot);

function cleanReference(value) {
  return value.split("#", 1)[0].split("?", 1)[0];
}

function localTarget(value, htmlFile) {
  const clean = cleanReference(value);
  if (!clean || /^(?:[a-z]+:|\/\/|#)/i.test(clean)) return null;
  const absolute = clean.startsWith("/")
    ? path.join(releaseRoot, clean.replace(/^\/+/, ""))
    : path.resolve(path.dirname(htmlFile), clean);
  if (absolute !== releaseRoot && !absolute.startsWith(`${releaseRoot}${path.sep}`)) return null;
  return absolute;
}

function composedSiteTarget(value) {
  const clean = cleanReference(value);
  if (!clean.startsWith("/")) return null;

  for (const mount of composedSiteMounts) {
    if (!clean.startsWith(mount.prefix)) continue;
    const relative = clean.slice(mount.prefix.length);
    const target = path.resolve(mount.root, relative || ".");
    if (target !== mount.root && !target.startsWith(`${mount.root}${path.sep}`)) return null;
    return target;
  }

  return null;
}

async function resolvesToStaticTarget(target) {
  if (!target) return false;
  const info = await stat(target).catch(() => null);
  if (info?.isFile()) return true;
  if (info?.isDirectory() && (await isFile(path.join(target, "index.html")))) return true;
  if (!path.extname(target) && (await isFile(path.join(target, "index.html")))) return true;
  return false;
}

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");
  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
  for (const reference of references) {
    const target = localTarget(reference, htmlFile);
    if (!target) continue;
    if (await resolvesToStaticTarget(target)) continue;

    const composedTarget = composedSiteTarget(reference);
    if (await resolvesToStaticTarget(composedTarget)) continue;

    failures.push(`${path.relative(releaseRoot, htmlFile)} -> ${reference}`);
  }
}

const brokenRenderMarkers = [
  "This page couldn’t load",
  "This page couldn't load",
  "Connection closed.",
];

for (const route of pageRoutes) {
  const html = await readFile(path.join(releaseRoot, routeOutputPath(route)), "utf8");

  for (const marker of brokenRenderMarkers) {
    if (html.includes(marker)) failures.push(`${route} contains a broken RSC/static-render marker: ${marker}`);
  }

  if (!html.includes("site-shell")) failures.push(`${route} is missing the expected site shell`);
  if (route.includes("/configurators/") && !html.includes("detail-page")) {
    failures.push(`${route} is missing the configurator detail-page shell`);
  }
  const expectedLanguage = route === "/ro" || route.startsWith("/ro/") ? "ro" : route === "/de" || route.startsWith("/de/") ? "de" : "en";
  const expectedOrigin = expectedLanguage === "ro"
    ? "https://www.360configurator.ro"
    : expectedLanguage === "de"
      ? "https://www.360konfigurator.de"
      : "https://www.360configurator.com";
  if (!html.includes(expectedOrigin)) failures.push(`${route} lacks its localized canonical origin ${expectedOrigin}`);
  const legacyLocalePrefixedUrlPattern = /https:\/\/(?:www\.)?360configurator\.com\/(?:ro|de)(?![A-Za-z0-9_-])/;
  if (legacyLocalePrefixedUrlPattern.test(html)) failures.push(`${route} contains a legacy locale-prefixed .com URL`);
  if (html.includes("https://www.360configurator.roof-configurator/")) {
    failures.push(`${route} contains the corrupted English roof configurator URL`);
  }
  if (
    route === "/configurators/roof" &&
    !html.includes("https://www.360configurator.com/roof-configurator/")
  ) {
    failures.push(`${route} is missing the correct English roof configurator URL`);
  }
  if (!html.includes(`<html lang="${expectedLanguage}"`)) failures.push(`${route} has an incorrect document language; expected ${expectedLanguage}`);
}

const sitemapExpectations = {
  en: {
    origin: "https://www.360configurator.com",
    apps: ["/pergola-configurator/", "/roof-configurator/", "/window-configurator/", "/hall-configurator/", "/solar-configurator/", "/fence-configurator/", "/cardbox-configurator/"],
  },
  ro: {
    origin: "https://www.360configurator.ro",
    apps: ["/configurator-pergola/", "/configurator-acoperis/", "/configurator-ferestre/", "/configurator-hala/", "/configurator-solar/", "/configurator-garduri/", "/configurator-cutii-carton/"],
  },
  de: {
    origin: "https://www.360konfigurator.de",
    apps: ["/pergola-konfigurator/", "/dach-konfigurator/", "/fenster-konfigurator/", "/hallen-konfigurator/", "/solar-konfigurator/", "/zaun-konfigurator/", "/karton-konfigurator/"],
  },
};
const marketingSlugs = ["pergola", "roof", "window", "hall", "solar", "fence"];
const allOrigins = Object.values(sitemapExpectations).map(({ origin }) => origin);

for (const [locale, { origin, apps }] of Object.entries(sitemapExpectations)) {
  const xml = await readFile(path.join(releaseRoot, `sitemap-${locale}.xml`), "utf8");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expected = [
    `${origin}/`,
    `${origin}/about`,
    `${origin}/contact`,
    `${origin}/pricing`,
    `${origin}/book-a-demo`,
    ...marketingSlugs.map((slug) => `${origin}/configurators/${slug}`),
    ...apps.map((appPath) => `${origin}${appPath}`),
  ];

  if (urls.length !== expected.length) failures.push(`sitemap-${locale}.xml has ${urls.length} URLs; expected ${expected.length}`);
  for (const url of expected) if (!urls.includes(url)) failures.push(`sitemap-${locale}.xml is missing ${url}`);
  for (const url of urls) {
    if (!url.startsWith(`${origin}/`)) failures.push(`sitemap-${locale}.xml contains a foreign-domain URL: ${url}`);
  }
  for (const foreignOrigin of allOrigins.filter((candidate) => candidate !== origin)) {
    if (xml.includes(foreignOrigin)) failures.push(`sitemap-${locale}.xml contains foreign origin ${foreignOrigin}`);
  }
}

const defaultSitemap = await readFile(path.join(releaseRoot, "sitemap.xml"), "utf8");
const englishSitemap = await readFile(path.join(releaseRoot, "sitemap-en.xml"), "utf8");
if (defaultSitemap !== englishSitemap) failures.push("default sitemap.xml does not match sitemap-en.xml");

if (failures.length) {
  console.error("Static release validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${pageRoutes.length} website pages, ${metadataRoutes.length} metadata routes, ${htmlFiles.length} HTML files, canonical metadata, and internal/composed-site links.`);
}
