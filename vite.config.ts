import { reactRouter } from "@react-router/dev/vite";
import netlify from "@netlify/vite-plugin";
import netlifyReactRouter from "@netlify/vite-plugin-react-router";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), netlifyReactRouter(), netlify()],
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    // Prebundling wraps pdfjs-dist as a default export, which makes
    // GlobalWorkerOptions undefined on some Android WebViews.
    exclude: ["pdfjs-dist"],
  },
  worker: {
    format: "es",
  },
});
