module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: { '@': './src' },
          extensions: ['.ios.ts', '.android.ts', '.ts', '.ios.tsx', '.android.tsx', '.tsx', '.jsx', '.js', '.json'],
        },
      ],
      // Required by react-native-reanimated v4. Transforms `'worklet'`
      // directives and hooks (useSharedValue / useAnimatedStyle / etc.) so
      // they install correctly into the worklets runtime. MUST be the LAST
      // plugin in the list per the reanimated docs.
      'react-native-worklets/plugin',
    ],
  };
};
