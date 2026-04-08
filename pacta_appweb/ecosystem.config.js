module.exports = {
  apps: [{
    name: 'pacta',
    script: 'node',
    args: 'start-production.js',
    cwd: 'e:\\03-mowDev\\pactajs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
