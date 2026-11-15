import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // fresh throwaway local database for every run, against the real production build
    command: `node -e "require('fs').rmSync('.pglite-e2e',{recursive:true,force:true})" && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/welcome`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ALLOW_LOCAL_DB: "1",
      PGLITE_DIR: ".pglite-e2e",
      FAMILY_PASSCODE: "Snowman26",
      PALMBOS_PASSCODE: "Tinsel",
      SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret",
    },
  },
});
