const CopyPlugin = require("copy-webpack-plugin");
const { GenerateSW } = require('workbox-webpack-plugin');

const path = require('path');
// GitHub Actionsへの移行に合わせて、ビルド番号は1000から開始する
const buildNumber = process.env.GITHUB_RUN_NUMBER
    ? parseInt(process.env.GITHUB_RUN_NUMBER) + 1000
    : undefined
const version = buildNumber ? `${buildNumber}` : `dev-${new Date().toISOString()}`;
const isDebug = process.env.DEBUG_ON || 'true'
const cacheId = 'fumen-for-mobile';
const destDirectory = path.join(__dirname, 'dest')

module.exports = {
    entry: {
        main: './src/actions.ts',
    },
    output: {
        filename: '[name].bundle.js',
        path: destDirectory,
    },
    experiments: {
        asyncWebAssembly: true,
    },
    module: {
        rules: [
            {
                test: /env\.ts$/,
                loader: 'string-replace-loader',
                options: {
                    search: '###VERSION###',
                    replace: version,
                }
            },
            {
                test: /env\.ts$/,
                loader: 'string-replace-loader',
                options: {
                    search: '###DEBUG###',
                    replace: isDebug,
                }
            },
            {
                test: /cold_clear[\\/](ColdClearWrapper|cold_clear\.worker)\.ts$/,
                use: [{ loader: 'ts-loader', options: { instance: 'worker', configFile: 'tsconfig.worker.json' } }],
            },
            {
                test: /\.tsx?$/,
                exclude: /cold_clear[\\/](ColdClearWrapper|cold_clear\.worker)\.ts$/,
                use: [{ loader: 'ts-loader', options: { ignoreDiagnostics: [1343] } }],
            },
            {
                test: /\.css$/i,
                use: 'css-loader',
            },
        ]
    },
    optimization: {
        splitChunks: {
            name: 'vendor',
            chunks: 'all',
        },
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: path.join(__dirname, 'resources'),
                    to: destDirectory,
                },
                {
                    from: path.join(__dirname, 'node_modules/materialize-css/dist/js/materialize.min.js'),
                    to: path.join(destDirectory, 'materialize'),
                },
                {
                    from: path.join(__dirname, 'node_modules/materialize-css/dist/css/materialize.min.css'),
                    to: path.join(destDirectory, 'materialize'),
                },
                {
                    from: path.join(__dirname, 'node_modules/material-icons/iconfont'),
                    to: path.join(destDirectory, 'material-iconfont'),
                },
            ],
        }),
        new GenerateSW({
            cacheId: cacheId,
            swDest: 'sw.js',
            clientsClaim: true,
            skipWaiting: true,
            offlineGoogleAnalytics: true,
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB for WASM files
        }),
    ]
};
