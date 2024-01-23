const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: {
    devtool: "inline-source-map",
    module: {
      rules: [
        {
          // this worked https://stackoverflow.com/questions/70420273/how-can-i-make-webpack-embed-my-wasm-for-use-in-a-web-worker
          test: /\.wasm$/,
          type: "asset/inline",
          // use: "arraybuffer-loader",
        },
      ],
    },
  },
});
