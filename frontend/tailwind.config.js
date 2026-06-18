/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        nav:     '#0A0B0C',
        bg:      '#111214',
        surface: '#1A1C1F',
        card:    '#222528',
        border:  '#2A3035',
        accent: {
          DEFAULT: '#008FD0',
          hover:   '#006FA3',
        },
        dim:     '#4A6080',
        // Article type colours
        type: {
          consumable: '#A855F7',
          bundle:     '#F97316',
          equipment:  '#008FD0',
          rental:     '#14B8A6',
          cable:      '#EAB308',
        },
      },
      textColor: {
        base:  '#E4EDFF',
        muted: '#4A6080',
      },
      borderColor: {
        DEFAULT: '#2A3035',
      },
      ringColor: {
        DEFAULT: '#008FD0',
      },
    },
  },
  plugins: [],
}
