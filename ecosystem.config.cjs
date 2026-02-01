module.exports = {
  apps: [
    {
      name: "podofo-api",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 4444,
      },
      // Restart if memory exceeds 500MB
      max_memory_restart: "500M",
      // Logging
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Restart settings
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 4000,
      // Watch (disable in production)
      watch: false,
    },
  ],
};
