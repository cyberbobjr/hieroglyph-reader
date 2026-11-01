import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Police Noto Sans Egyptian Hieroglyphs (licence OFL), incluse dans l'application.
import '@fontsource/noto-sans-egyptian-hieroglyphs/egyptian-hieroglyphs-400.css'
import './styles/main.css'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')
