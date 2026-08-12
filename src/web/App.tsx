import { Route, Routes } from "react-router";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { Agenda } from "./pages/admin/Agenda";
import { Communications } from "./pages/admin/Communications";
import { ComingSoon } from "./pages/admin/ComingSoon";
import { Dashboard } from "./pages/admin/Dashboard";
import { Integrations } from "./pages/admin/Integrations";
import { Embeds } from "./pages/admin/Embeds";
import { Reviews } from "./pages/admin/Reviews";
import { Evaluations } from "./pages/admin/Evaluations";
import { Speakers } from "./pages/admin/Speakers";
import { Submissions } from "./pages/admin/Submissions";
import { Settings } from "./pages/admin/Settings";
import { Files } from "./pages/admin/Files";
import { ApiDocs } from "./pages/ApiDocs";
import { CfpPage } from "./pages/CfpPage";
import { EmbedPreview } from "./pages/EmbedPreview";
import { EventPage } from "./pages/EventPage";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";
import { SpeakerPortal } from "./pages/SpeakerPortal";
import { ReviewerPortal } from "./pages/ReviewerPortal";

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
      <Route path="/review/:token" element={<ReviewerPortal />} />
      {/* Alias: the API namespace says /api/reviewer/:token, and people
          predictably type the page the same way. Both spellings work. */}
      <Route path="/reviewer/:token" element={<ReviewerPortal />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="submissions" element={<Submissions />} />
        <Route path="settings" element={<Settings />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="evaluations" element={<Evaluations />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="speakers" element={<Speakers />} />
        <Route path="files" element={<Files />} />
        <Route path="communications" element={<Communications />} />
        <Route path="embeds" element={<Embeds />} />
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
