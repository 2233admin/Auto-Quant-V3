import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans-sc/wght.css'
import './design/fonts/fonts.css'
import './design/base.css'
import './design/tokens.css'
import './shell/shell.css'
import './pages/pages.css'
import './design/layout.css'
import './actions/actions.css'
import App from './App'
import './design/foundation.css'
import './design/direction-h.css'
import './design/batch2-sign.css'
import './design/batch2-library.css'
import './design/batch2-runs.css'
import './design/batch2-rhythm.css'
import { applySignConvention, storedSignConvention } from './design/signConvention'
import { applyMotion, storedMotion } from './motion/motion'
import './motion/motion.css'

applySignConvention(storedSignConvention())
applyMotion(storedMotion())
createRoot(document.getElementById('root')!).render(<App />)
