import { Route, Routes } from "react-router";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { Agenda } from "./pages/admin/Agenda";
import { ComingSoon } from "./pages/admin/ComingSoon";
import { Dashboard } from "./pages/admin/Dashboard";
import { Reviews } from "./pages/admin/Reviews";
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
        <Route
          path="speakers"
          element={
            <ComingSoon
              title="Speakers"
              lane="Lane C"
              body="Speaker roster, onboarding task board, and the magic-link portal with real R2 uploads. The upload API and asset storage are already live."
            />
          }
        />
        <Route
          path="communications"
          element={
            <ComingSoon
              title="Communications"
              lane="Lane C"
              body="Templated reminders and calendar invites with real .ics files — simulated outbox by default, Resend behind a secret."
            />
          }
        />
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
        <Route
          path="integrations"
          element={
            <ComingSoon
              title="Integrations"
              lane="Lanes B + D"
              body="Accelevents one-way push with mapping preview, idempotent sync log, and CSV fallback; Airtable live persistence behind the repository adapter."
            />
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
