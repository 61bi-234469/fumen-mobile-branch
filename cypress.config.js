module.exports = {
    video: false,
    e2e: {
        baseUrl: 'http://localhost:8080/',
        viewportWidth: 375,
        viewportHeight: 667,
        chromeWebSecurity: false,
        supportFile: false,
        specPattern: 'cypress/integration/**/*.js',
    },
};
