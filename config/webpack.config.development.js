const { resolve } = require('path');
const webpack = require('webpack');
const { merge } = require('webpack-merge');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const baseConfig = require('./webpack.config.base');

module.exports = merge(baseConfig, {
  devtool: 'cheap-module-eval-source-map',

  entry: {
    main: [
      // 'react-hot-loader/patch',
      resolve(__dirname, '../src/renderer/index.tsx')
    ],
    appPreferences: resolve(__dirname, '../src/renderer/preferences'),
    fileManager: resolve(__dirname, '../src/renderer/file-manager'),
    update: resolve(__dirname, '../src/renderer/update'),
    fileHostConnection: resolve(
      __dirname,
      '../src/renderer/file-host-connection'
    )
  },

  devServer: {
    hot: true,
    contentBase: baseConfig.output.path,
    publicPath: '/app',
    port: 3000,
    stats: 'minimal',
    disableHostCheck: true
  },

  output: {
    publicPath: 'http://localhost:3000/app/'
  },

  plugins: [
    new ForkTsCheckerWebpackPlugin(),
    // new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development')
    }),
    new webpack.LoaderOptionsPlugin({
      debug: true
    })
  ],

  externals: [],

  resolve: {
    alias: { 'react-dom': '@hot-loader/react-dom' }
  },

  node: {
    __dirname: false
  },
  mode: 'development',
  target: 'electron-renderer'
});
