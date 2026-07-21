import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  output: 'static',
  server: {
    port: 4321,
    host: true,
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: ['src/styles'],
          additionalData: `@import "variables"; @import "mixins";\n`,
        },
      },
    },
  },
});
