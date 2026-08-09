import { Route, Routes } from "react-router";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { ComingSoon } from "./pages/admin/ComingSoon";
import { Dashboard } from "./pages/admin/Dashboard";
import { Submissions } from "./pages/admin/Submissions";
import { CfpPage } from "./pages/CfpPage";
import { EventPage } from "./pages/EventPage";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/e/:slug" element={<EventPage />} />
      <Route path="/e/:slug/cfp" element={<CfpPage />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="submissions" element={<Submissions />} />
        <Route
          path="reviews"
          element={
            <ComingSoon
              title="Reviews"
              lane="Lane A"
              body="Reviewer assignments, two scoring rounds against the rubric, comments, and accept/reject decisions land here."
            />
          }
        />
        <Route
          path="agenda"
          element={
            <ComingSoon
              title="Agenda"
              lane="Lane B"
              body="Drag-and-drop day/room grid with live room and speaker conflict detection, plus list, day, and week projections. The conflict engine already ships in src/shared/domain/schedule.ts with seeded conflicts to find."
            />
          }
        />
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
