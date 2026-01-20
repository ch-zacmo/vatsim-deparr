const path = require('path');

module.exports = {
  entry: {
    main: './public/js/main.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'public/dist'),
    clean: true
  },
  mode: 'development',
  devtool: 'source-map'
};
