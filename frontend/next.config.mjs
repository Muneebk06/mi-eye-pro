export default {
  webpack(config) {
    config.module.rules.push({
      test: /globals\.css$/,
      enforce: 'pre',
      use: ['@tailwindcss/turbopack'],
    });
    return config;
  },
};
