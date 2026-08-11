import stylexPlugin from "@stylexjs/rollup-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    stylexPlugin({
      dev: mode !== "production",
      runtimeInjection: true,
      treeshakeCompensation: true,
    }),
    react(),
  ],
  build: {
    target: "es2022",
  },
}));
