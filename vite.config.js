import { defineConfig } from 'vite'
import { createVuePlugin } from 'vite-plugin-vue2'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 8000,
  },
  resolve: {
    alias: {
      vue: 'vue/dist/vue.js',
    },
  },
  plugins: [createVuePlugin()],
  base: './',
})
