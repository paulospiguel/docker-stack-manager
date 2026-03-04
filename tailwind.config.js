/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        dsm: {
          bg: "#0f1117",
          panel: "#161b22",
          panel2: "#1c2128",
          border: "#30363d",
          border2: "#21262d",
          muted: "#7d8590",
          text: "#c9d1d9",
          primary: "#1f6feb",
          "primary-h": "#388bfd",
          danger: "#da3633",
          "danger-h": "#f85149",
          success: "#238636",
          "success-h": "#2ea043",
          warning: "#d29922",
          accent: "#8957e5",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
