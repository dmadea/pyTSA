const path = require('path');
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  entry: path.resolve(__dirname, 'src', 'index.ts'),  // this took me along time to solve, the path needs to be specific
  context: __dirname,
  devtool: 'inline-source-map',
  module: {
    rules: [
      {
        test: /\.ts?$/,
        use: 'ts-loader',  //babel-loader for babel
        exclude: /node_modules/,
      },
      {
        test: /\.css?$/,
        // use: [MiniCssExtractPlugin.loader, 'css-loader'],
        use: ["style-loader", "css-loader"],
      },
      {  // this worked https://stackoverflow.com/questions/70420273/how-can-i-make-webpack-embed-my-wasm-for-use-in-a-web-worker
        test: /\.wasm$/,
        type: "asset/inline"
        // use: "arraybuffer-loader",
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new HtmlWebpackPlugin({
        title: 'pyTSA', 
        template: path.resolve(__dirname, 'src', 'index.html') }),
      // new MiniCssExtractPlugin({
      //     filename:"bundle.css"})
   ],
  devServer: {
    static: path.join(__dirname, "dist"),
    compress: true,
    port: 4000,
  },
  // runtimeCompiler: true,
  // externals: {
  //   experiments: {
  //     asyncWebAssembly: true,
  //   },
  // },
  // configureWebpack: {
  //   externals: {
  //     experiments: {
  //       asyncWebAssembly: true,
  //     },
  //   },
  // }
};