import { defineConfig } from 'vite';

export default defineConfig({
  // Build optimizations
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info']
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['leaflet', 'chart.js'],
          utils: ['./assets/js/utils.js'],
          components: [
            './assets/js/components/IssueCard.js',
            './assets/js/components/NotificationManager.js',
            './assets/js/components/LoadingManager.js'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false
  },
  
  // Development server
  server: {
    port: 3000,
    host: true,
    cors: true
  },
  
  // CSS optimizations
  css: {
    devSourcemap: false,
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./assets/css/variables.scss";`
      }
    }
  },
  
  // Asset optimizations
  assetsInclude: ['**/*.php'],
  
  // Plugin configurations
  plugins: [],
  
  // Dependency optimization
  optimizeDeps: {
    include: ['leaflet', 'chart.js'],
    exclude: []
  },
  
  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  }
});