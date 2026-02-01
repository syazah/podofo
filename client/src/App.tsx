import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import Layout from "./components/Layout.tsx";
import UploadPage from "./pages/UploadPage.tsx";
import DataPage from "./pages/DataPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/upload" replace />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="data/:lotId" element={<DataPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
