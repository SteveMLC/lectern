import { access } from "node:fs/promises";
import { platform } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = resolve(root, process.env.LECTERN_WALKTHROUGH_SOURCE ?? "output/playwright/lectern-walkthrough-submission.mp4");
const narration = resolve(root, process.env.LECTERN_NARRATION_SCRIPT ?? "docs/WALKTHROUGH_NARRATION.txt");
const audio = resolve(root, process.env.LECTERN_NARRATION_AUDIO ?? "output/playwright/lectern-walkthrough-narration.aiff");
const output = resolve(root, process.env.LECTERN_WALKTHROUGH_OUTPUT ?? "output/playwright/lectern-walkthrough-final.mp4");
const voice = process.env.LECTERN_NARRATION_VOICE ?? "Samantha";
const rate = process.env.LECTERN_NARRATION_RATE ?? "150";

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

if (platform() !== "darwin") throw new Error("The bundled fallback narrator uses the macOS `say` voice. Record a human voiceover or provide an audio track on other platforms.");
await Promise.all([access(source), access(narration)]);

run("say", ["-v", voice, "-r", rate, "-f", narration, "-o", audio]);
run("ffmpeg", [
  "-y", "-v", "error", "-i", source, "-i", audio,
  "-filter:a", "afade=t=in:st=0:d=0.2,afade=t=out:st=175.8:d=0.5,apad",
  "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", output,
]);

const probe = JSON.parse(run("ffprobe", [
  "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", output,
]));
const visual = probe.streams?.find((stream) => stream.codec_type === "video");
const sound = probe.streams?.find((stream) => stream.codec_type === "audio");
const duration = Number(probe.format?.duration);
if (visual?.codec_name !== "h264" || visual.width < 1280 || visual.height < 720 || sound?.codec_name !== "aac" || duration > 180) {
  throw new Error(`Narrated walkthrough failed media validation: ${JSON.stringify({ visual, sound, duration })}`);
}

run("ffmpeg", ["-v", "error", "-i", output, "-f", "null", "-"]);
console.log(`Narrated walkthrough ready: ${output} (${duration.toFixed(2)}s, ${visual.width}x${visual.height}, H.264 + AAC).`);
