const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')

const publicPath = path.resolve(__dirname, 'test/lib')

module.exports = {
  entry: {
    index: [
      path.resolve(__dirname, 'test/src/index.js'),
    ],
    vendor: ['react', 'react-dom'],
  },
  output: {
    path: publicPath,
    filename: '[name].js?[hash]',
  },
  resolve: {
    extension: ['', '.js', '.jsx', '.json'],
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loaders: ['babel'],
        exclude: path.resolve(__dirname, 'node_modules'),
      },
      {
        test: /\.(png|jpg)$/,
        loader: 'url?limit=8192',
      },
      {
        test: /\.(woff|woff2|ttf|svg|eot)(\?v=\d+\.\d+\.\d+)?$/,
        loader: 'url?limit=10000',
      },
    ],
  },
  plugins: [
    // 出现异常不退出进程
    new webpack.NoErrorsPlugin(),
    // 自动创建html
    new HtmlWebpackPlugin({
      title: 'react',
      template: './test/src/index.html',
    }),
    // 定义环境变量
    new webpack.DefinePlugin({
      'process.env': { NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development') },
    }),
  ],
}
