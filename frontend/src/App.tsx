import { Link, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { EmptyState } from "./components/States";
import { OverviewPage } from "./pages/OverviewPage";
import { ZonePage } from "./pages/ZonePage";
import { WorkerPage } from "./pages/WorkerPage";
import { WorkersPage } from "./pages/WorkersPage";
import { AlertsPage } from "./pages/AlertsPage";
import { AdminPage } from "./pages/AdminPage";
import { SimulatorPage } from "./pages/SimulatorPage";
import { MethodologyPage } from "./pages/MethodologyPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="zones/:id" element={<ZonePage />} />
        <Route path="workers" element={<WorkersPage />} />
        <Route path="workers/:id" element={<WorkerPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="simulator" element={<SimulatorPage />} />
        <Route path="methodology" element={<MethodologyPage />} />
        <Route
          path="*"
          element={
            <EmptyState
              title="Page not found"
              message="The page you're looking for doesn't exist."
              action={
                <Link to="/" className="btn-primary">
                  Back to overview
                </Link>
              }
            />
          }
        />
      </Route>
    </Routes>
  );
}
