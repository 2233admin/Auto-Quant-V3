import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './design/base.css'
import './design/tokens.css'
import './shell/shell.css'
import './pages/pages.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
