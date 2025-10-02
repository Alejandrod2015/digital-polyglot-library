/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}", // escanea todos tus componentes en /src
  ],
  theme: {
    extend: {
      colors: {
        background: "#121212", // fondo oscuro neutro
        foreground: "#E0E0E0", // gris claro para texto
      },
    },
  },
  plugins: [],
};
