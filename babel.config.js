module.exports = (api) => {
  const isTest = api?.env('test');
  return {
    sourceType: 'unambiguous',
    presets: [
      isTest ?
        ['@babel/preset-env', {targets: {node: 'current'}}] :
        '@babel/preset-env'
      ,
      '@babel/preset-typescript',
      [
        '@babel/preset-react',
        {
          runtime: 'automatic',
        }
      ]
    ],
    plugins: [
    ],
  };
};
