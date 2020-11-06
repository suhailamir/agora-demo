const path = require('path')
const loaders = require('./loaders')
const plugins = require('./plugins')

const NODE_ENV = process.env.NODE_ENV

const distPath = NODE_ENV == 'development' ? '../dist' : '../pages'

module.exports = {
  entry: {
    index: './src/index.js',
  },
  devtool: 'inline-source-map',
  module: loaders,
  plugins,
  resolve: {
    extensions: ['.js', '.jsx', '.scss','.css']
  },
  output: {
    filename: '[name].[hash].js',
    path: path.resolve(__dirname, distPath),
  },
  optimization: {
    minimize: false,
  },
  devServer: {
    overlay: {
      warnings: true,
      errors: true,
    },
    hot: true,
    contentBase: path.join(__dirname, './'),
    compress: true,
    progress: true,
    open: true
  },
}
