const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [
  ...config.resolver.assetExts.filter((ext) => ext !== 'json'),
  'html',
  'wasm',
];

module.exports = config;
