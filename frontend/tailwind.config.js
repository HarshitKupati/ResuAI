/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Primary brand ramp (indigo)
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Accent ramp (fuchsia — warmer, more distinctive vs default violet)
        accent: {
          50: "#fdf4ff",
          100: "#fae8ff",
          200: "#f5d0fe",
          300: "#f0abfc",
          400: "#e879f9",
          500: "#d946ef",
          600: "#c026d3",
          700: "#a21caf",
          800: "#86198f",
          900: "#701a75",
        },
        // Semantic surface tokens for consistent theming
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f8fafc",
          subtle: "#f1f5f9",
          inverted: "#0f172a",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        display: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        // Slightly tighter line-heights on headings for a modern feel
        "display-xl": ["2.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-lg": ["2.25rem", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        "display-md": ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.015em", fontWeight: "700" }],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        card: "0 4px 24px -8px rgb(15 23 42 / 0.08)",
        "card-hover": "0 12px 32px -12px rgb(15 23 42 / 0.18)",
        glow: "0 0 0 1px rgb(99 102 241 / 0.14), 0 8px 24px -8px rgb(99 102 241 / 0.28)",
        "glow-accent": "0 0 0 1px rgb(192 38 211 / 0.14), 0 8px 24px -8px rgb(192 38 211 / 0.28)",
        "inner-soft": "inset 0 1px 2px 0 rgb(15 23 42 / 0.04)",
        "premium": "0 20px 50px -12px rgb(79 70 229 / 0.25), 0 8px 16px -8px rgb(15 23 42 / 0.08)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%)",
        "shell-gradient":
          "radial-gradient(1200px 600px at 0% 0%, #c7d2fe 0%, transparent 55%), radial-gradient(900px 500px at 100% 30%, #f5d0fe 0%, transparent 55%), radial-gradient(1000px 600px at 50% 100%, #e0e7ff 0%, transparent 60%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        "hero-aurora":
          "radial-gradient(800px 400px at 20% 0%, rgba(99,102,241,0.45) 0%, transparent 60%), radial-gradient(700px 400px at 80% 100%, rgba(217,70,239,0.40) 0%, transparent 60%), linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #c026d3 100%)",
        "grid-fade":
          "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.6) 100%)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.25s ease-out",
        shimmer: "shimmer 1.4s linear infinite",
        "float-slow": "float-slow 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
