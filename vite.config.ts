import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base:"https://github.com/RenzWay/orbit.git",
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "static/app.js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "static/app.css";
          }

          return "static/[name][extname]";
        },
      },
    },
  },
});
