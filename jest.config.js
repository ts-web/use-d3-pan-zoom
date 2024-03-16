const esModules = [
  'd3-array',
  'd3-color',
  'd3-format',
  'd3-interpolate',
  'd3-scale',
  'd3-time',
  'internmap',
].join('|');

module.exports = {
  testMatch: [__dirname + '/src/specs/**/*.spec.ts'],
  moduleNameMapper: {
    '~/(.*)': '<rootDir>/src/app/$1',
  },
  transform: {
    '\\.(j|t)sx?$': ['babel-jest', {rootMode: 'upward'}]
  },
  transformIgnorePatterns: [`/node_modules/(?!${esModules})`],
};
