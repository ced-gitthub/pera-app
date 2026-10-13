// Share the website's pure TypeScript logic (money, parser, validate) instead of copying it.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../src/core'), path.resolve(__dirname, '../src/lib')];
module.exports = config;
