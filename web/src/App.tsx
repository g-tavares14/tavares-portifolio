import { Navigate, Route, Routes } from 'react-router-dom';
import { DataGate } from './context/data';
import { About } from './pages/About';
import { Projects } from './pages/Projects';
import { Writing } from './pages/Writing';

export function App() {
  return (
    <DataGate>
      <Routes>
        <Route path="/" element={<About />} />
        {/* Mesma rota com slug opcional: abrir um texto não remonta a página (mantém filtro e posição). */}
        <Route path="/escrita/:slug?" element={<Writing />} />
        <Route path="/projetos" element={<Projects />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DataGate>
  );
}
