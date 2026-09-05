// Tailwind CSS 4 integra-se ao Next.js pelo plugin PostCSS oficial
// (@tailwindcss/postcss); não existe tailwind.config.* na linha 4 — a
// configuração vive em CSS (app/globals.css, diretiva @theme).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
