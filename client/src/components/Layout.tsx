import { NavLink, Outlet } from "react-router-dom";
import { UploadProvider } from "../context/UploadContext.tsx";

export default function Layout() {
  return (
    <UploadProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 flex items-center h-14">
            <span className="text-lg font-semibold text-gray-900 mr-8">
              PODOFO
            </span>
            <nav className="flex gap-1">
              <NavLink
                to="/upload"
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`
                }
              >
                Upload
              </NavLink>
              <NavLink
                to="/data"
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  }`
                }
              >
                Data
              </NavLink>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </main>
      </div>
    </UploadProvider>
  );
}
