import webpack from 'webpack';
import path from 'path';
//import CopyWebpackPlugin from 'copy-webpack-plugin';
//const ExtractTextPlugin = require('extract-text-webpack-plugin');
//const MiniCssExtractPlugin = require("mini-css-extract-plugin");
//const autoprefixer = require('autoprefixer');
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

// https://stackoverflow.com/questions/53421773/cant-resolve-child-process-in-module-xmlhttprequest
// https://github.com/firebase/firebase-js-sdk/issues/1478
if (typeof XMLHttpRequest === 'undefined') {
  global.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
}

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
      'webpack-dev-server/client?https://0.0.0.0:3000/',
      './src/index.js'
    ];
    outputx = {
      ...outputx,
      path: path.resolve(__dirname, 'dist')
    };
  }

  return {
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
        rules: [
        { //https://github.com/storybookjs/storybook/issues/1493
            test: /\.(js|jsx)$/,
            exclude: [/bower_components/, /node_modules/, /styles/],
            loader: 'babel-loader',
            //include: path.resolve(__dirname, '../../src')
            options: {
              presets: [
                ['env', {
                  modules: false,
                  useBuiltIns: "usage",
                  corejs: 3,
                  bugfixes: true,
                  targets: {
                    browsers: [
                      //'Chrome >= 60',
                      //'Safari >= 10.1',
                      //'iOS >= 10.3',
                      //'Firefox >= 54',
                      //'Edge >= 15',
                      ">0.25%, not dead"
                    ],
                    "node": "current"
                  },
                }],
              ],
            }
        },
        {
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
      //https: true, //deprecated
      server: {
        type: 'https',
        options: {
          key: 'privkey.pem',
          cert: 'fullchain.pem'
        }
      },
      host : '0.0.0.0',
      //host: 'localhost',
      port: 3000,
      hot: true,
      //sockjsPrefix: '/assets',
      //sockHost: '0.0.0.0',
      //sockPort: 3004,
      //sockPath: '/serve/sockjs-node',
      proxy: { /*
        "/serve": {
            target: "https://ecodata.odb.ntu.edu.tw/",
            pathRewrite: { "^/serve": "/sockjs-node" },
            changeOrigin: true,
        },*/
	'**': {
          target: 'https://0.0.0.0:3000',
          // context: () => true, //https://webpack.js.org/configuration/dev-server/#devserverproxy
          changeOrigin: true
        }
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
      },
      historyApiFallback: {
        disableDotRule: true
      },
      //public : 'ecodata.odb.ntu.edu.tw',
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
             extractComments: false
         })
      ],
      splitChunks: {
        chunks: "all",
        maxInitialRequests: Infinity,
        reuseExistingChunk: true,
	//minSize: 0,
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            chunks: 'initial',
            name: `chunk-vendors` //(module) {
          }, // https://blog.logrocket.com/guide-performance-optimization-webpack/
          default: {
            minChunks: 2,
            priority: -20
          }
        }
      }
    }
  }
}

//module exports = {
const baseConfig = (config, env, helpers) => {
  if (!config.plugins) {
        config.plugins = [];
  }

  if (testenv.NODE_ENV === "production") {
    const htmlplug = helpers.getPluginsByName(config, 'HtmlWebpackPlugin')[0];
    if (htmlplug) {
      //console.log("Have htmlPlugin inject: ", htmlplug.plugin.options.inject);
      console.log("Have htmlPlugin preload: ", htmlplug.plugin.options.preload);
      console.log("Have htmlPlugin production: ", htmlplug.plugin.options.production);
      //console.log("Have htmlPlugin template: ", htmlplug.plugin.options.template);
      //console.log("Have htmlPlugin minify: ", htmlplug.plugin.options.minify);
      htmlplug.plugin.options.production = true;
      htmlplug.plugin.options.preload = true;
      console.log("After, have htmlPlugin production: ", htmlplug.plugin.options.production);
    }

    config.plugins.push(
        new HtmlWebpackPlugin({
           template: 'template.html',
           filename: 'index.html',
           cache: true,
           preload: true,
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

    const critters = helpers.getPluginsByName(config, 'Critters')[0];
    if (critters) {
        console.log("Have Critters option: ", critters.plugin.options.preload);
        // The default strategy in Preact CLI is "media",
        // but there are 6 different loading techniques:
        // https://github.com/GoogleChromeLabs/critters#preloadstrategy
        critters.plugin.options.preload = 'js'; //'swap';
    }

    //https://github.com/prateekbh/preact-cli-workbox-plugin/blob/master/replace-default-plugin.js
    //const precache_plug = helpers.getPluginsByName(config, 'SWPrecacheWebpackPlugin')[0];
    const precache_plug = helpers.getPluginsByName(config, 'InjectManifest')[0]; //'WorkboxPlugin'
    if (precache_plug) {
        console.log("Have options: ", precache_plug.plugin.config);
        console.log("Have maximumFileSizeToCacheInBytes: ", precache_plug.plugin.config.maximumFileSizeToCacheInBytes);
        console.log("Have exclude: ", precache_plug.plugin.config.exclude);
        precache_plug.plugin.config.maximumFileSizeToCacheInBytes= 5*1024*1024;
        precache_plug.plugin.config.exclude= [...precache_plug.plugin.config.exclude, "200.html"];
        precache_plug.plugin.config.mode= "production",
        console.log("After, InjectManifest: ", precache_plug.plugin.config, precache_plug.plugin.config.exclude, precache_plug.plugin.config.mode);
    }
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
    config.plugins.push(new webpack.optimize.MinChunkSizePlugin({
        minChunkSize: 5000, // Minimum number of characters
    }));
    config.plugins.push( new webpack.optimize.OccurrenceOrderPlugin() );
    config.plugins.push(new webpack.optimize.ModuleConcatenationPlugin());
    config.plugins.push(new webpack.NoEmitOnErrorsPlugin());
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

  return config;
};

//module exports = {
export default (config, env, helpers) => {
  return merge(
    baseConfig(config, env, helpers),
    other_config(config, env)
  );
};
