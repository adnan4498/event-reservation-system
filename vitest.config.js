import { defineConfig } from "vitest/config";
// import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({
    // plugins: [tsconfigPaths()],
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["./src/tests/setup.ts"],
        fileParallelism: false,
        pool: "forks",
        maxWorkers: 1,
        isolate: false,
        testTimeout: 15000,
    },
});
//# sourceMappingURL=vitest.config.js.map