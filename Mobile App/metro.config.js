// Default Metro config for Expo. The `@/*` path alias is resolved via
// babel-plugin-module-resolver (see babel.config.js).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
