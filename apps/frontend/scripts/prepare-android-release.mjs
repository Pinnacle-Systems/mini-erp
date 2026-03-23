import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const frontendRoot = resolve(import.meta.dirname, "..");
const packageJsonPath = resolve(frontendRoot, "package.json");
const buildGradlePath = resolve(frontendRoot, "android/app/build.gradle");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const versionName = String(packageJson.version ?? "0.1.0");
const buildGradle = readFileSync(buildGradlePath, "utf8");

const versionCodeMatch = buildGradle.match(/versionCode\s+(\d+)/);
if (!versionCodeMatch) {
  throw new Error("Could not find versionCode in android/app/build.gradle");
}

const currentVersionCode = Number(versionCodeMatch[1]);
if (!Number.isInteger(currentVersionCode)) {
  throw new Error(`Invalid Android versionCode: ${versionCodeMatch[1]}`);
}

const nextVersionCode = currentVersionCode + 1;

const updatedBuildGradle = buildGradle
  .replace(/versionCode\s+\d+/, `versionCode ${nextVersionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

writeFileSync(buildGradlePath, updatedBuildGradle);

console.log(
  `Prepared Android release metadata: versionCode ${nextVersionCode}, versionName ${versionName}`,
);
