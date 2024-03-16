const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  stories: [
    '../src/**/*.stories.mdx',
    '../src/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [
  ],
  features: {
    storyStoreV7: true,
    buildStoriesJson: true,
    babelModeV7: true,
    modernInlineRender: true,
  },
  framework: '@storybook/react',
  typescript: {
    check: false,
    checkOptions: {},
  },
  core: {
    builder: 'webpack5',
  },
  babel: async () => {
    const babelConfig = require('../babel.config');
    return babelConfig();
  },
  webpackFinal: async (config) => {
    config.resolve.plugins ??= [];
    config.resolve.plugins.push(new TsconfigPathsPlugin({
      configFile: './src/stories/tsconfig.json',
    }));

    return config;
  },
};
