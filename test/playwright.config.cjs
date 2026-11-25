const { defineConfig } = require("@playwright/test");
const path = require("node:path");

const baseURL = "http://127.0.0.1:18765";

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: "e2e-smoke.spec.js",
  webServer: {
    command: "python3 -m http.server 18765 --bind 127.0.0.1",
    cwd: path.resolve(__dirname, ".."),
    url: baseURL
  },
  use: {
    baseURL,
    launchOptions: { executablePath: process.env.CHROME_PATH }
  }
});
