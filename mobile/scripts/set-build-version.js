const { writeFileSync } = require("fs");
const { resolve } = require("path");

const findArgValue = (name) => {
  const prefix = `--${name}`;
  const index = process.argv.findIndex((arg) => arg === prefix);
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return null;
};

const version = findArgValue("version");
const build = findArgValue("build");

if (!version || !build) {
  console.error("Usage: node scripts/set-build-version.js --version <app-version> --build <ios-build-number>");
  process.exit(1);
}

const content = `APP_VERSION=${version}
IOS_BUILD_NUMBER=${build}
`;

const outPath = resolve(__dirname, "../.env.build");
writeFileSync(outPath, content, { encoding: "utf-8" });
console.log(`✅ wrote ${outPath}`);
