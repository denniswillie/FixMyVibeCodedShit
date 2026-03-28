import "dotenv/config";

import { gracefulShutdown } from "./db.js";
import { runForever } from "./worker.js";

async function main() {
  await runForever();
}

main()
  .catch((error) => {
    console.error("[triage-runner] fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await gracefulShutdown();
  });
