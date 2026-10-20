import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento, /api/... é repassado ao backend Django (python manage.py runserver).
// Assim o navegador fala só com o Vite e não há problema de CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.API_PROXY || "http://127.0.0.1:8000",
    },
  },
});
