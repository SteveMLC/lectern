import { Route, Routes } from "react-router";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { Agenda } from "./pages/admin/Agenda";
import { Communications } from "./pages/admin/Communications";
import { ComingSoon } from "./pages/admin/ComingSoon";
import { Dashboard } from "./pages/admin/Dashboard";
import { Integrations } from "./pages/admin/Integrations";
import { Reviews } from "./pages/admin/Reviews";
import { Speakers } from "./pages/admin/Speakers";
import { Submissions } from "./pages/admin/Submissions";
import { ApiDocs } from "./pages/ApiDocs";
import { CfpPage } from "./pages/CfpPage";
import { EmbedPreview } from "./pages/EmbedPreview";
import { EventPage } from "./pages/EventPage";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";
import { SpeakerPortal } from "./pages/SpeakerPortal";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/docs" element={<ApiDocs />} />
      <Route path="/api-docs" element={<ApiDocs />} />
      <Route path="/embed-preview" element={<EmbedPreview />} />
      <Route path="/e/:slug" element={<EventPage />} />
      <Route path="/e/:slug/cfp" element={<CfpPage />} />
      <Route path="/speaker/:token" element={<SpeakerPortal />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="submissions" element={<Submissions />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="speakers" element={<Speakers />} />
        <Route path="communications" element={<Communications />} />
        <Route
          path="resources"
          element={
            <ComingSoon
              title="Resources"
              lane="Lane C"
              body="Speaker guide and wiki pages with sanitized HTML embeds. A seeded Speaker Guide page is already in the database."
            />
          }
        />
        <Route path="integrations" element={<Integrations />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
