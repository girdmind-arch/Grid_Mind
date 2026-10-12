import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    rolldownOptions: {
      output: {
        // Split big libraries into their own files so browsers cache them
        // separately from our code (which changes more often).
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            { name: "motion", test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/ },
            { name: "radix", test: /node_modules[\\/]@radix-ui[\\/]/ },
            { name: "charts", test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/ },
          ],
        },
      },
    },
  },
});
