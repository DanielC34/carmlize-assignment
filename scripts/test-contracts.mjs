/**
 * Compile + test contracts, and start the frontend at the same time.
 * Frontend keeps running after tests finish (Ctrl+C to stop).
 */
import { spawn } from "node:child_process";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: true });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`));
    });
  });
}

await run("npx", [
  "hardhat",
  "compile",
  "--config",
  "contracts/hardhat.config.cjs",
]);

// Start frontend alongside tests
const dev = spawn("npm", ["run", "dev"], {
  stdio: "inherit",
  shell: true,
});

let stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  dev.kill("SIGINT");
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

try {
  await run("npx", [
    "hardhat",
    "test",
    "--config",
    "contracts/hardhat.config.cjs",
  ]);
  console.log("\n> Contract tests finished — frontend still running (Ctrl+C to stop)\n");
} catch (err) {
  console.error(`\n> ${err.message}`);
  console.log("> Frontend still running (Ctrl+C to stop)\n");
}

await new Promise((resolve) => {
  dev.on("exit", resolve);
});
process.exit(0);
