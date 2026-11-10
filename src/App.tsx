import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Welcome from './pages/Welcome'
import Dashboard from './pages/Dashboard'
import Workspace from './pages/Workspace'
import QualityLab from './pages/QualityLab'
import Designer from './pages/Designer'
import QueryBuilder from './pages/QueryBuilder'
import Sandbox from './pages/Sandbox'
import Learn from './pages/Learn'
import Benefits from './pages/Benefits'
import Takeaways from './pages/Takeaways'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Welcome />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="workspace" element={<Workspace />} />
          <Route path="quality" element={<QualityLab />} />
          <Route path="designer" element={<Designer />} />
          <Route path="query" element={<QueryBuilder />} />
          <Route path="sandbox" element={<Sandbox />} />
          <Route path="learn" element={<Learn />} />
          <Route path="benefits" element={<Benefits />} />
          <Route path="takeaways" element={<Takeaways />} />
          <Route path="*" element={<Welcome />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
