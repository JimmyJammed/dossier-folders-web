/** Original mock interface assets. No external assets, brands, fonts, or network requests. */
import { mkdir, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
const out = resolve("public/assets");
const recordings = await mkdtemp(join(tmpdir(), "dossier-recordings-"));
await mkdir(out, { recursive: true });
const marks = [
  `<ellipse cx="20" cy="20" rx="17" ry="9" transform="rotate(-35 20 20)"/><circle cx="20" cy="20" r="6"/>`,
  `<path d="M5 31L16 8L23 23L29 13L36 31Z"/>`,
  `<path d="M6 8H29L18 20L29 32H6Z"/>`,
  `<path d="M20 35V7M20 20L7 10M20 28L33 15M20 14L28 6"/>`,
  `<rect x="7" y="5" width="26" height="30" rx="3"/><path d="M13 13H27M13 20H27M13 27H21"/>`,
];
for (let i = 0; i < 5; i++)
  await writeFile(
    `${out}/logo-${i}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${i === 2 ? 140 : 40}" height="40" viewBox="0 0 ${i === 2 ? 140 : 40} 40"><g fill="none" stroke="#fff5e7" stroke-width="3">${marks[i]}</g>${i === 2 ? '<text x="46" y="28" font-family="sans-serif" font-size="24" font-weight="700" fill="#fff5e7">RELAY</text>' : ""}</svg>`,
  );
function screen(title, step = 0, w = 390, h = 720) {
  const landscape = w > h,
    colors = ["#f0a66e", "#75afc0", "#b0a1de", "#8db997"];
  const headings = title.includes("Wander")
    ? [
        "A little further.",
        "Your next discovery",
        "Places to remember",
        "A note from the trail",
        "Make a day of it",
      ]
    : [
        "Good finds, together.",
        "Made for everyday",
        "Your saved collection",
        "A thoughtful basket",
        "Ready for tomorrow",
      ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#f6f3ee"/><rect width="${w}" height="84" fill="#162b38"/><text x="28" y="48" font-family="sans-serif" font-size="20" font-weight="700" fill="#fff">${title}</text><text x="28" y="125" font-family="sans-serif" font-size="12" letter-spacing="2" fill="#48606d">${landscape ? "EXPERIMENT BOARD" : "A FICTIONAL PRODUCT / 0" + (step + 1)}</text><text x="28" y="171" font-family="sans-serif" font-size="${landscape ? 34 : 25}" font-weight="700" fill="#183342">${landscape ? "Every question starts somewhere." : headings[step % 5]}</text>${Array.from(
    { length: landscape ? 3 : 4 },
    (_, i) => {
      const x = landscape ? 28 + i * 302 : 28,
        y = landscape ? 218 : 210 + i * 100,
        width = landscape ? 280 : 334,
        height = landscape ? 270 : 82;
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${colors[(i + step) % 4]}"/><text x="${x + 18}" y="${y + 30}" font-family="sans-serif" font-size="12" fill="#172b36">${landscape ? ["OBSERVATION", "IN PROGRESS", "REVIEW"][i] : ["COLLECTION", "DISCOVERY", "SAVED", "FOR YOU"][i]}</text><text x="${x + 18}" y="${y + 57}" font-family="sans-serif" font-size="18" font-weight="700" fill="#172b36">${["A fresh perspective", "Useful little things", "Room to explore", "Start with curiosity"][(i + step) % 4]}</text>${landscape ? `<rect x="${x + 18}" y="${y + 85}" width="244" height="130" rx="8" fill="#ffffff88"/><text x="${x + 32}" y="${y + 118}" font-family="sans-serif" font-size="14" fill="#172b36">Experiment ${step + 1}.${i + 1}</text><text x="${x + 32}" y="${y + 150}" font-family="sans-serif" font-size="12" fill="#172b36">Keep the context with the result.</text>` : ""}`;
    },
  ).join(
    "",
  )}<rect x="28" y="${h - 64}" width="${w - 56}" height="40" rx="20" fill="#183342"/><text x="${w / 2}" y="${h - 39}" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#fff">${landscape ? "SAVE OBSERVATION" : "EXPLORE THE COLLECTION"}</text></svg>`;
}
for (let i = 0; i < 5; i++)
  await writeFile(`${out}/wander-${i}.svg`, screen("Wander Atlas", i));
await writeFile(`${out}/relay.svg`, screen("Relay Studio", 1, 960, 600));
await writeFile(`${out}/juniper.svg`, screen("Juniper Works", 2, 960, 600));
const browser = await chromium.launch();
for (const [name, title, width, height] of [
  ["orbit", "Orbit Market", 390, 720],
  ["fieldnote", "Fieldnote Labs", 960, 600],
]) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    recordVideo: {
      dir: recordings,
      size: { width, height },
    },
  });
  const page = await ctx.newPage();
  await page.setContent(
    "<style>body{margin:0}svg{display:block}</style>" +
      screen(title, 0, width, height),
  );
  await page.screenshot({ path: `${out}/${name}-poster.png` });
  for (let step = 0; step < 5; step++) {
    await page.locator("svg").evaluate(
      (el, svg) => {
        el.outerHTML = svg;
      },
      screen(title, step, width, height),
    );
    await page.waitForTimeout(1100);
  }
  const video = page.video();
  await ctx.close();
  const file = await video.path();
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      file,
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-crf",
      "28",
      `${out}/${name}-demo.mp4`,
    ],
    { stdio: "ignore" },
  );
}
await browser.close();
await rm(recordings, { recursive: true, force: true });
await writeFile(
  `${out}/NOTICE.txt`,
  "All logos, interface illustrations, and silent interface recordings in this directory are original fictional demonstrations created for Dossier Folders. MIT license. No real organizations, user data, or third-party imagery. Regenerate with npm run generate:assets (requires ffmpeg and Playwright Chromium).\n",
);
console.log(
  "Generated 5 logos, 7 interface illustrations, 2 posters, and 2 videos.",
);
