const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
  stories: [
    '../src/stories/01.stories.tsx',
    '../src/**/*.stories.@(js|jsx|ts|tsx)',
  ],

  features: {
    buildStoriesJson: true,
    babelModeV7: true,
    modernInlineRender: true,
  },

  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  },

  typescript: {
    check: false,
    checkOptions: {},
    reactDocgen: 'react-docgen-typescript'
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

    config.module.rules.push(
      {test: /\.csv$/, loader: 'raw-loader'},
    );

    return config;
  },

  addons: ['@storybook/addon-webpack5-compiler-babel'],

  disableWhatsNewNotifications: true,
};
