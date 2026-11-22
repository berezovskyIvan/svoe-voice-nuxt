// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],
  compatibilityDate: '2025-07-15',
  devtools: {
    enabled: true
  },
  runtimeConfig: {
    public: {
      zoyaApiBase: 'https://api.svoe-voice.ru',
    },
  },
  alias: {
    '@components': './app/components',
    '@composables': './app/composables',
    '@types': './app/types',
    '@assets': './app/assets',
  },
  css: ['~/assets/css/variables.css'],
})
