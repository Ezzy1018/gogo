import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"],
        },
      },
    },
    chunkSizeWarningLimit: 2000,
  },
})
