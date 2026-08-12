import { chromium } from "playwright";
const html = `<!doctype html><html><head><style>
  * { margin:0; box-sizing:border-box; }
  body { width:1200px; height:630px; font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;
         background:#fafafa; display:flex; flex-direction:column; justify-content:center; padding:96px; }
  .mark { width:72px; height:72px; border-radius:16px; background:#4338ca; color:#fff;
          font-size:40px; font-weight:800; display:flex; align-items:center; justify-content:center; }
  h1 { margin-top:36px; font-size:88px; letter-spacing:-0.03em; color:#18181b; font-weight:700; }
  p.tag { margin-top:18px; font-size:38px; color:#3f3f46; }
  p.meta { margin-top:56px; font-size:26px; color:#71717a; }
  p.url { margin-top:10px; font-size:24px; color:#a1a1aa; }
</style></head><body>
  <div class="mark">L</div>
  <h1>Lectern</h1>
  <p class="tag">CFP to published agenda, without the enterprise tax.</p>
  <p class="meta">Open source &middot; Cloudflare Workers + D1 + R2 &middot; Live demo, no login</p>
  <p class="url">lectern.lectern-go7.workers.dev</p>
</body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: new URL("../public/og-lectern.png", import.meta.url).pathname });
await browser.close();
console.log("og card rendered");
