var webpack = require('webpack');
var path = require('path');
var ExtractTextPlugin = require("extract-text-webpack-plugin");

var BUILD_DIR = path.resolve(__dirname, 'build');
var APP_DIR = path.resolve(__dirname, 'src');

var config = {
  entry: {
    index: APP_DIR + '/index.jsx',
    admin: APP_DIR + '/admin.jsx',
  },
  output: {
    path: BUILD_DIR,
    filename: '[name].bundle.js'
  },
  module: {
    loaders: [
      {
        test: /\.jsx?/,
        include: APP_DIR,
        loader: 'babel'
      },
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract("style-loader", "css-loader")
      },
      {
        test: /\.(png|jpe?g|eot|svg|ttf|woff2?)$/,
        loader: "file?name=images/[name].[ext]"
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify('production')
      }
    }),
    new ExtractTextPlugin("[name].bundle.css"),
    new webpack.ProvidePlugin({
      "jQuery": path.resolve(
        __dirname,
        "assets/bower_components/jquery/dist/jquery"
      ),
      "$": path.resolve(
        __dirname,
        "assets/bower_components/jquery/dist/jquery"
      )
    })
  ],

};

module.exports = config;