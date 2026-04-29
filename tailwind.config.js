/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 20px 70px -28px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [],
};
