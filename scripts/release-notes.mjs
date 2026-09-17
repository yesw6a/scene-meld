import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function releaseVersion(tag) {
  if (!/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(tag)) {
    throw new Error("Release tag must be a stable version such as v1.10.1.");
  }
  return tag.slice(1);
}

export function extractReleaseNotes(changelog, tag, repository) {
  releaseVersion(tag);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error("Repository must use owner/repo format.");
  }
  const text = changelog.replace(/\r\n?/g, "\n");
  const headings = [...text.matchAll(/^##[ \t]+(.+)$/gm)];
  const matches = headings.filter(
    (heading) => heading[1].split(/[ \t]+/)[0] === tag,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one CHANGELOG section for ${tag}; found ${matches.length}.`,
    );
  }
  const heading = matches[0];
  const next = headings[headings.indexOf(heading) + 1];
  const section = text.slice(
    heading.index + heading[0].length,
    next?.index ?? text.length,
  );
  const sections = section.split(/(?=^###[ \t]+)/m);
  const isInternalSection = (part, name) =>
    new RegExp(`^###[ \\t]+(?:[^\\p{L}\\p{N}\\n]+[ \\t]*)?(?:${name})[ \\t]*$`, "u")
      .test(part.split("\n")[0]);
  const notes = sections
    .filter((part) => !isInternalSection(part, "Version|Verify"))
    .join("")
    .trim();
  if (!/^[ \t]*[-*][ \t]+\S/m.test(notes)) {
    throw new Error(`CHANGELOG section ${tag} has no user-facing update entries.`);
  }
  const verification = sections
    .filter((part) => isInternalSection(part, "Verify"))
    .map((part) => part.split("\n").slice(1).join("\n").trim())
    .filter(Boolean)
    .join("\n\n");
  const details = verification
    ? `\n\n<details>\n<summary>验证记录与已知限制</summary>\n\n${verification}\n\n</details>`
    : "";
  return `SceneMeld Desktop ${tag}\n\n${notes}${details}\n\n### 安装提示\n\n当前构建未配置 Windows 代码签名或 macOS 公证，可能触发 SmartScreen 或 Gatekeeper 提示。请先核对仓库来源和校验值。\n\n[完整更新记录](https://github.com/${repository}/blob/${tag}/CHANGELOG.md)\n`;
}

export function validateReleaseVersions(tag, root = ".") {
  const expected = releaseVersion(tag);
  const read = (path) =>
    readFileSync(resolve(root, path), "utf8").replace(/\r\n?/g, "\n");
  const cargoPackage = read("src-tauri/Cargo.toml")
    .split(/^\[package\][ \t]*\n/m)[1]?.split(/^\[/m)[0];
  const lockedPackage = read("src-tauri/Cargo.lock")
    .split("[[package]]")
    .find((part) => /^name = "scenemeld"$/m.test(part));
  const versions = {
    "package.json": JSON.parse(read("package.json")).version,
    "src-tauri/tauri.conf.json": JSON.parse(read("src-tauri/tauri.conf.json")).version,
    "src-tauri/Cargo.toml": cargoPackage?.match(/^version = "([^"]+)"$/m)?.[1],
    "src-tauri/Cargo.lock": lockedPackage?.match(/^version = "([^"]+)"$/m)?.[1],
  };
  for (const [path, version] of Object.entries(versions)) {
    if (version !== expected) {
      throw new Error(`${path}: expected ${expected}, found ${version}.`);
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [tag, outputPath] = process.argv.slice(2);
    validateReleaseVersions(tag);
    const notes = extractReleaseNotes(
      readFileSync("CHANGELOG.md", "utf8"),
      tag,
      process.env.GITHUB_REPOSITORY || "yesw6a/scene-meld",
    );
    if (outputPath) writeFileSync(outputPath, notes, "utf8");
    else process.stdout.write(notes);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
