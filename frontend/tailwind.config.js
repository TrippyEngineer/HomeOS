/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Figtree", "system-ui", "sans-serif"],
                display: ["Fraunces", "ui-serif", "Georgia", "serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            colors: {
                /* Punchier earthy palette — sand stays warm, but accents are deeper and bolder */
                bg: {
                    base: "#F5F1EA",      /* warmer sand */
                    surface: "#FFFFFF",
                    muted: "#E8E1D5",
                    accent: "#1F2A24",     /* deep forest (used for dark surfaces / CTAs) */
                },
                ink: {
                    DEFAULT: "#1A1F1B",   /* near-black with green undertone */
                    secondary: "#4A4F47",
                    muted: "#7A8077",
                    inverse: "#FFFFFF",
                },
                sage: {
                    DEFAULT: "#3B5A3F",   /* deeper forest sage — bolder primary */
                    hover: "#2D4732",
                    soft: "#E2E8DD",
                    deep: "#1F2A24",
                },
                terracotta: {
                    DEFAULT: "#C0512A",   /* punchier orange */
                    hover: "#A04220",
                    soft: "#FBEFE6",
                },
                saffron: "#E89A36",      /* new bright accent for highlights */
                amber: "#D4A338",
                stoke: "#DCD4C2",        /* warm bone border */
                warn: "#D4791E",
                good: "#4A7C50",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            boxShadow: {
                "soft-lift": "0 12px 28px -18px rgba(26, 31, 27, 0.32), 0 2px 6px -2px rgba(26, 31, 27, 0.08)",
                "hard": "0 8px 0 0 #1F2A24",
                "accent": "0 8px 24px -10px rgba(192, 81, 42, 0.5)",
            },
            keyframes: {
                "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
                "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
                "fade-up": {
                    "0%": { opacity: "0", transform: "translateY(10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                "marquee": {
                    "0%": { transform: "translateX(0%)" },
                    "100%": { transform: "translateX(-50%)" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
                "marquee": "marquee 30s linear infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
