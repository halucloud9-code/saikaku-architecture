// vite.config.js
import { defineConfig } from "file:///sessions/great-sleepy-lovelace/mnt/saikaku-architecture/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/great-sleepy-lovelace/mnt/saikaku-architecture/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    }
  },
  build: {
    // チャンクサイズ警告の閾値を引き上げ（chart.js + jspdf が大きいため）
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // 大きなライブラリを別チャンクに分割して初期ロードを高速化
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore"],
          "vendor-chart": ["chart.js"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvZ3JlYXQtc2xlZXB5LWxvdmVsYWNlL21udC9zYWlrYWt1LWFyY2hpdGVjdHVyZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2dyZWF0LXNsZWVweS1sb3ZlbGFjZS9tbnQvc2Fpa2FrdS1hcmNoaXRlY3R1cmUvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2dyZWF0LXNsZWVweS1sb3ZlbGFjZS9tbnQvc2Fpa2FrdS1hcmNoaXRlY3R1cmUvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogdHJ1ZSxcbiAgICBwcm94eToge1xuICAgICAgJy9hcGknOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMScsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBcdTMwQzFcdTMwRTNcdTMwRjNcdTMwQUZcdTMwQjVcdTMwQTRcdTMwQkFcdThCNjZcdTU0NEFcdTMwNkVcdTk1QkVcdTUwMjRcdTMwOTJcdTVGMTVcdTMwNERcdTRFMEFcdTMwNTJcdUZGMDhjaGFydC5qcyArIGpzcGRmIFx1MzA0Q1x1NTkyN1x1MzA0RFx1MzA0NFx1MzA1Rlx1MzA4MVx1RkYwOVxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTYwMCxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgLy8gXHU1OTI3XHUzMDREXHUzMDZBXHUzMEU5XHUzMEE0XHUzMEQ2XHUzMEU5XHUzMEVBXHUzMDkyXHU1MjI1XHUzMEMxXHUzMEUzXHUzMEYzXHUzMEFGXHUzMDZCXHU1MjA2XHU1MjcyXHUzMDU3XHUzMDY2XHU1MjFEXHU2NzFGXHUzMEVEXHUzMEZDXHUzMEM5XHUzMDkyXHU5QUQ4XHU5MDFGXHU1MzE2XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICd2ZW5kb3ItcmVhY3QnOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbSddLFxuICAgICAgICAgICd2ZW5kb3ItZmlyZWJhc2UnOiBbJ2ZpcmViYXNlL2FwcCcsICdmaXJlYmFzZS9hdXRoJywgJ2ZpcmViYXNlL2ZpcmVzdG9yZSddLFxuICAgICAgICAgICd2ZW5kb3ItY2hhcnQnOiBbJ2NoYXJ0LmpzJ10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBMFYsU0FBUyxvQkFBb0I7QUFDdlgsT0FBTyxXQUFXO0FBRWxCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsTUFDaEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBO0FBQUEsSUFFTCx1QkFBdUI7QUFBQSxJQUN2QixlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUE7QUFBQSxRQUVOLGNBQWM7QUFBQSxVQUNaLGdCQUFnQixDQUFDLFNBQVMsV0FBVztBQUFBLFVBQ3JDLG1CQUFtQixDQUFDLGdCQUFnQixpQkFBaUIsb0JBQW9CO0FBQUEsVUFDekUsZ0JBQWdCLENBQUMsVUFBVTtBQUFBLFFBQzdCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
