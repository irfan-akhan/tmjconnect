module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      // Reanimated plugin MUST be the last plugin in the list — its worklets
      // transform has to see every other transform's output.
      'react-native-reanimated/plugin',
    ],
  };
};
