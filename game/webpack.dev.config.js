import webpack from 'webpack'
import config from './webpack.config.js'

const devConfig = {
  ...config,
  devtool: 'cheap-module-eval-source-map',
  plugins: [
    ...(config.plugins.slice(1) /* remove ModuleConcatenationPlugin */),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development')
    }),
  ],
}

export default devConfig
