import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import '@mantine/core/styles.css';
import { createTheme, MantineColorsTuple, MantineProvider } from '@mantine/core'

const grabColors: MantineColorsTuple = [ '#ecfef1', '#d7fbe0', '#a9f7bd', '#79f498', '#55f179', '#41ef65', '#37ef5a', '#2bd44a', '#21bc40', '#0ba333' ];

const theme = createTheme({
  primaryColor: "green",
  colors: {
    myColor: grabColors,
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
)
