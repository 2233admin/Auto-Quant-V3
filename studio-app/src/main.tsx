import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import './design/base.css'
import './design/tokens.css'
import './shell/shell.css'
import './pages/pages.css'
import './design/layout.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
