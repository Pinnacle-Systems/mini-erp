/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        tabular: {
          border: "hsl(var(--tabular-frame-border-color))",
          header: "hsl(var(--tabular-header-bg))",
          "header-text": "hsl(var(--tabular-header-text))",
          grid: "hsl(var(--tabular-grid-line-color))",
          hover: "hsl(var(--tabular-row-hover-bg))"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px hsl(var(--primary) / 0.35), 0 0 24px hsl(var(--primary) / 0.3), 0 10px 35px hsl(var(--primary) / 0.2)"
      }
    }
  },
  plugins: []
};
