import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";

// Em desenvolvimento, /api/... é repassado ao backend Django (python manage.py runserver).
// Assim o navegador fala só com o Vite e não há problema de CORS.
//
// "npm run celular" (modo celular): abre o site na rede Wi-Fi com https, para testar o
// check-in pelo celular. A câmera do navegador só funciona em https (ou no próprio
// computador); o certificado é gerado na hora, então o celular mostra um aviso para aceitar.
export default defineConfig(({ mode }) => {
  const celular = mode === "celular";
  return {
    plugins: [react(), ...(celular ? [basicSsl()] : [])],
    server: {
      port: 5173,
      host: celular ? true : undefined,
      proxy: {
        "/api": { target: process.env.API_PROXY || "http://127.0.0.1:8000", changeOrigin: true },
      },
    },
  };
});
