import { AuthProvider } from '@/context/AuthContext'
import { RouterView } from '@/router'

function App() {
  return (
    <AuthProvider>
      <RouterView />
    </AuthProvider>
  )
}

export default App
