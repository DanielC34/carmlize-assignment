/**
 * Compile contracts, then start the frontend (keeps running until Ctrl+C).
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

console.log("\n> Compile finished — starting frontend\n");

const dev = spawn("npm", ["run", "dev"], {
  stdio: "inherit",
  shell: true,
});

const shutdown = () => dev.kill("SIGINT");
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await new Promise((resolve) => {
  dev.on("exit", resolve);
});
process.exit(0);
