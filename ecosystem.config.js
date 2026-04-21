module.exports = {
  apps: [
    {
      name: 'engagio-api',
      cwd: './api',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Add your DB or JWT secrets here if they aren't in your .env
      },
      restart_delay: 3000, // Wait 3s before restarting to prevent crash loops
      max_memory_restart: '500M'
    },
    {
      name: 'engagio-web',
      cwd: './web',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        // This ensures the frontend knows where the secure API is
        NEXT_PUBLIC_API_URL: 'https://engagio.duckdns.org/api'
      },
      restart_delay: 3000,
      max_memory_restart: '1G'
    }
  ]
};
