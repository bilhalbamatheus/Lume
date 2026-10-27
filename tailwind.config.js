/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0F172A',     // Azul Slate (Sidebar e texto forte)
          primary: '#0284C7',  // Azul Ação/Destaque
          accent: '#F59E0B',   // Laranja Canteiro (Alertas e badges)
          bg: '#F8FAFC',       // Fundo limpo
        }
      }
    },
  },
  plugins: [],
}