import webpack from 'webpack';
import path from 'path';
//import CopyWebpackPlugin from 'copy-webpack-plugin';
//const ExtractTextPlugin = require('extract-text-webpack-plugin');
//const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const autoprefixer = require('autoprefixer');
const { merge } = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
//const ManifestPlugin = require('webpack-manifest-plugin');
const DuplicatePackageCheckerPlugin = require("duplicate-package-checker-webpack-plugin");
//const AssetsPlugin = require('assets-webpack-plugin'); //dev
//https://medium.com/@poshakajay/heres-how-i-reduced-my-bundle-size-by-90-2e14c8a11c11
//https://gist.github.com/AjayPoshak/e41ec36d28437494d10294256e248bc6
//const BrotliPlugin = require('brotli-webpack-plugin');
//const BrotliGzipPlugin = require('brotli-gzip-webpack-plugin');
//https://github.com/webpack-contrib/compression-webpack-plugin
const CompressionPlugin = require('compression-webpack-plugin');
const zlib = require('zlib');

// mode
const testenv = {NODE_ENV: process.env.NODE_ENV};
// const paths = require("./paths");
const publicPath= "./";
const publicUrl = publicPath.slice(0, -1);

//const cssFilename = '[name].[contenthash:8].css'; //'static/css/'
//const extractTextPluginOptions = { publicPath: Array(cssFilename.split('/').length).join('../') }

const globOptions = {};
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

//https://github.com/preactjs/preact-cli/blob/81c7bb23e9c00ba96da1c4b9caec0350570b8929/src/lib/webpack/webpack-client-config.js
const other_config = (config, env) => {
  var entryx;
  var outputx = {
      filename: '[name].[chunkhash:8].js', //'static/js/'
      sourceMapFilename: '[name].[chunkhash:8].map',
      chunkFilename: '[name].[chunkhash:8].chunk.[id].js',
      publicPath: publicPath,
      //path: path.resolve(__dirname, 'build'),
      sourcePrefix: ''
  };

  if (testenv.NODE_ENV === "production") {
    console.log("Node env in production...");
    config.devtool = false; //'source-map'; //if not use sourceMap, set false
    entryx = [
      //require.resolve('./polyfills'),
      './src/index.js'
    ];
    outputx = {...outputx,
      path: path.resolve(__dirname, 'build')
    };
  } else {
    console.log("Node env in development...");

    entryx = [
      'webpack-dev-server/client?http://0.0.0.0:3000/',
      //'webpack-dev-server/client?https://localhost:3000/',
      //https://github.com/webpack/webpack-dev-server/issues/416
      //'webpack-dev-server/client?https://' + require("os").hostname() + ':3000/',
      //'webpack-dev-server/client?https://eco.odb.ntu.edu.tw:3000/',
      //'webpack-dev-server/client?https://' + require("ip").address() + ':3000/',
      './src/index.js'
    ];
    outputx = {
      ...outputx,
      path: path.resolve(__dirname, 'dist')
    };
  }

  return {
    //mode: prod ? "production" : "development",
    //externals: {
    //},
    context: __dirname,
    entry: entryx,
    output: outputx,
    unknownContextCritical : false,
    amd: {
      toUrlUndefined: true
    },
    node: {
      // Resolve node module use of fs
      fs: 'empty',
      net: 'empty',
      tls: 'empty',
      Buffer: false,
      http: "empty",
      https: "empty",
      zlib: "empty"
    },
    resolve: {
      fallback: path.resolve(__dirname, '..', 'src'),
      extensions: ['.js', '.json', '.jsx', ''],
      mainFields: ['module', 'main'],
      alias: {
        "react": "preact-compat",
        "react-dom": "preact-compat"
      }
    },
    module: {
        rules: [{
            test: /\.(css|scss)$/,
            use: [//{
                //loader: MiniCssExtractPlugin.loader,
              //},//ExtractTextPlugin.extract(
              //'style-loader',
              //'css?importLoaders=1!postcss',
                { loader: 'style-loader' },
                { loader: 'css-loader' },
                { loader: 'sass-loader' }
              //{ loader: 'css-loader' }
              ],
              sideEffects: true
              // extractTextPluginOptions
              // )
        }, {
            test: /\.(png|gif|jpg|jpeg|svg|xml|json)$/,
            use: [ 'url-loader' ],
            //name: 'static/media/[name].[hash:8].[ext]'
        },
        ]
    },
    devServer: {
      contentBase: path.join(__dirname, 'dist'),
      //https: true,
      host : '0.0.0.0',
      //host: 'localhost',
      port: 3000,
      proxy: {
	'**': {
          target: 'http://0.0.0.0:3000',
          // context: () => true, //https://webpack.js.org/configuration/dev-server/#devserverproxy
          changeOrigin: true
        }
      },
      hot: true,
      //sockjsPrefix: '/assets',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
      },
      historyApiFallback: {
        disableDotRule: true
      },
      public : 'localhost',
      publicPath: '/',
      disableHostCheck: true,
      quiet: true,
      inline: true,
      compress: true
    }, /* https://bit.ly/3fkiypj
    postcss: function() {
      return [
        autoprefixer({
          browsers: [
            '>1%',
            'last 4 versions',
            'Firefox ESR',
            'not ie < 9', // React doesn't support IE8 anyway
          ]
        }),
      ];
    },*/
    optimization: {
       usedExports: true,
       runtimeChunk: true, //'single'
       minimizer:
       [
         new TerserPlugin({
             cache: true,
             parallel: true,
             sourceMap: true,
             terserOptions: {
                compress: { drop_console: true },
		output: { comments: false }
             }, //https://github.com/preactjs/preact-cli/blob/master/packages/cli/lib/lib/webpack/webpack-client-config.js
             extractComments: false //{
               //filename: (fileData) => {
               //  return `${fileData.filename}.OTHER.LICENSE.txt${fileData.query}`;
               //}
             //}
         })
      ],
      splitChunks: {
        //name: 'vendors',
        chunks: "all",
        maxInitialRequests: Infinity,
	//minSize: 0,
        cacheGroups: {
        /*preactBase: {
            name: 'preactBase',
            test: (module) => {
              return /preact|prop-types/.test(module.context);
            },
            chunks: 'pre',
            priority: 10,
          },*/
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            chunks: 'initial',
            name: `chunk-vendors` //(module) {
              // get the name. E.g. node_modules/packageName/not/this/part.js
              // or node_modules/packageName
              //const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
              // npm package names are URL-safe, but some servers don't like @ symbols
              //return `npm.${packageName.replace('@', '')}`;
            //},
          } // https://blog.logrocket.com/guide-performance-optimization-webpack/
        }
      }
    }
    // you can add preact-cli plugins here
    //plugins: [
        //https://github.com/preactjs/preact-cli/wiki/Config-Recipes
        //config.plugins.push( new CopyWebpackPlugin([{ context: `${__dirname}/assets`, from: `*.*` }]) );
        // https://resium.darwineducation.com/installation1https://resium.darwineducation.com/installation1
    //  ],
  };
}

//module exports = {
const baseConfig = (config, env) => {
  if (!config.plugins) {
        config.plugins = [];
  }

  if (testenv.NODE_ENV === "production") {
    config.plugins.push(
      new HtmlWebpackPlugin({
         template: 'template.html',
         production : true,
         inject: true,
      minify: {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
      }
      })
    );
// see https://github.com/webpack-contrib/compression-webpack-plugin
// can replace BrotliPlugin and BrotliGzipPlugin
    config.plugins.push(
	//new BrotliPlugin({
        new CompressionPlugin({
	  filename: '[path][base].br', //asset: '[path].br[query]'
          algorithm: 'brotliCompress', //for CompressionPlugin
          deleteOriginalAssets: false, //for CompressionPlugin
	  test: /\.(js|css|html|svg)$/,
          compressionOptions: {
            // zlib’s `level` option matches Brotli’s `BROTLI_PARAM_QUALITY` option.
            level: 11,
          },
	  threshold: 10240,
	  minRatio: 0.8
	})
    );
    config.plugins.push(
        //new BrotliGzipPlugin({
        new CompressionPlugin({
          filename: '[path][base].gz', //asset: '[path].gz[query]'
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 10240,
          minRatio: 0.8
        })
    );
    config.plugins.push( new webpack.optimize.OccurrenceOrderPlugin() );
    // Try to dedupe duplicated modules, if any:
    config.plugins.push( new DuplicatePackageCheckerPlugin() );
    //config.plugins.push( new ExtractTextPlugin(cssFilename) );
    //config.plugins.push( new ManifestPlugin({
    //  fileName: 'asset-manifest.json'
    //}));
    config.plugins.push( new BundleAnalyzerPlugin({
      analyzerMode: 'static', //disabled
      generateStatsFile: true,
      statsOptions: { source: false }
    }));
  }

  //config.plugins.push( new MiniCssExtractPlugin()); //{extractTextPluginOptions}) );
  //    filename: cssFilename
  //}) );

  config.plugins.push( new BundleAnalyzerPlugin({
      analyzerMode: 'static', //disabled
      generateStatsFile: true,
      statsOptions: { source: false }
  }));

  return config;
};

//module exports = {
export default (config, env) => {
  return merge(
    baseConfig(config, env),
    other_config(config, env)
  );
};
