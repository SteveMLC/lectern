-- SpeakerOps deterministic seed. Running this file is also the demo reset:
-- it deletes all rows (children first) and re-inserts identical fixed data.
-- Every id and timestamp is hand-written, so seed -> use -> seed always
-- returns the database to the exact same state.
--
-- Storylines baked in for the demo:
--   * 10 submissions across the full status spread.
--   * Two accepted submissions became sessions WITH lineage
--     (ses_from_sub_agents_prod, ses_from_sub_eval_pipelines).
--   * Three direct sessions with NO submission behind them
--     (ses_keynote, ses_ai_panel) — the invited/sponsor path.
--   * Agenda contains one room double-booking (Main Hall 17:30-17:45Z)
--     and one speaker double-booking (Ada Okafor in two overlapping slots).
--   * Speaker onboarding tasks are mid-flight: some complete, some pending.

-- ---------------------------------------------------------------------------
-- Reset (children -> parents)
-- ---------------------------------------------------------------------------
DELETE FROM delivery_attempts;
DELETE FROM messages;
DELETE FROM message_templates;
DELETE FROM speaker_tasks;
DELETE FROM task_definitions;
DELETE FROM external_id_map;
DELETE FROM sync_runs;
DELETE FROM integration_connections;
DELETE FROM resource_pages;
DELETE FROM agenda_slots;
DELETE FROM session_speakers;
DELETE FROM sessions;
DELETE FROM review_assignments;
DELETE FROM round_reviewers;
DELETE FROM reviews;
DELETE FROM rubric_criteria;
DELETE FROM evaluation_rounds;
DELETE FROM evaluation_plans;
DELETE FROM submission_speakers;
DELETE FROM submissions;
DELETE FROM speaker_assets;
DELETE FROM speakers;
DELETE FROM conditional_rules;
DELETE FROM form_fields;
DELETE FROM forms;
DELETE FROM rooms;
DELETE FROM tracks;
DELETE FROM events;

-- ---------------------------------------------------------------------------
-- Event
-- ---------------------------------------------------------------------------
INSERT INTO events (id, slug, name, tagline, description, starts_on, ends_on, timezone, venue, website_url, created_at, updated_at) VALUES
('evt_horizon2026', 'horizon-2026', 'Horizon Dev Summit 2026',
 'Two days on building software that ships.',
 'Horizon Dev Summit brings 600 engineers together for two days of talks, workshops, and panels on AI engineering, developer experience, infrastructure, and product craft.',
 '2026-10-14', '2026-10-15', 'America/Los_Angeles',
 'Fort Mason Center, San Francisco', 'https://speakerops.speakerops-go7.workers.dev/e/horizon-2026',
 '2026-07-15T09:00:00Z', '2026-08-01T09:00:00Z');

INSERT INTO tracks (id, event_id, name, description, color, sort_order) VALUES
('trk_ai',      'evt_horizon2026', 'AI Engineering',         'Agents, evals, and applied model work.',        '#6366f1', 0),
('trk_devex',   'evt_horizon2026', 'Developer Experience',   'Tooling, testing, and team productivity.',      '#0ea5e9', 1),
('trk_infra',   'evt_horizon2026', 'Infrastructure & Scale', 'Runtimes, data, and the edge.',                 '#f59e0b', 2),
('trk_product', 'evt_horizon2026', 'Product & Design',       'Building things users trust.',                  '#10b981', 3);

INSERT INTO rooms (id, event_id, name, capacity, sort_order) VALUES
('room_main',   'evt_horizon2026', 'Main Hall',       400, 0),
('room_studio', 'evt_horizon2026', 'Workshop Studio',  80, 1),
('room_loft',   'evt_horizon2026', 'Panel Loft',      120, 2);

-- ---------------------------------------------------------------------------
-- CFP form (open until Aug 25), custom fields, one conditional rule
-- ---------------------------------------------------------------------------
INSERT INTO forms (id, event_id, kind, title, welcome_text, thank_you_text, is_open, opens_at, closes_at, max_speakers_per_submission, allow_drafts, created_at, updated_at) VALUES
('form_cfp', 'evt_horizon2026', 'cfp', 'Call for Speakers — Horizon Dev Summit 2026',
 'We want real lessons from real systems. First-time speakers welcome — tell us what you learned and what broke.',
 'Thanks — your proposal is in. The program committee reviews on a rolling basis and every submitter hears back by September 5.',
 1, '2026-07-20T07:00:00Z', '2026-08-25T07:00:00Z', 3, 0,
 '2026-07-15T09:00:00Z', '2026-07-20T09:00:00Z');

INSERT INTO form_fields (id, form_id, key, label, field_type, required, sort_order, help_text, options_json) VALUES
('ff_speaking',  'form_cfp', 'prior_speaking',  'Speaking experience',        'select',   1, 0, NULL, '["First time","1-5 talks","Conference regular"]'),
('ff_wslength',  'form_cfp', 'workshop_length', 'Preferred workshop length',  'select',   1, 1, 'Required for workshops; hidden for other formats.', '["90 minutes","Half day"]'),
('ff_travel',    'form_cfp', 'travel_support',  'I need travel support',      'checkbox', 0, 2, NULL, NULL);

-- Show the workshop-length field only when the proposal format is a workshop.
INSERT INTO conditional_rules (id, form_id, source_field_key, operator, values_json, action, target_field_key) VALUES
('rule_wslength', 'form_cfp', 'format', 'in', '["workshop"]', 'show', 'workshop_length');

-- ---------------------------------------------------------------------------
-- Speakers
-- ---------------------------------------------------------------------------
INSERT INTO speakers (id, event_id, email, name, company, title, bio, location, socials_json, created_at, updated_at) VALUES
('spk_ada',   'evt_horizon2026', 'ada@nimbuslabs.example',      'Ada Okafor',    'Nimbus Labs',      'Principal Engineer',  'Ada runs the agent platform team at Nimbus Labs and has spent two years getting LLM systems past the demo stage.', 'Lagos / Remote', '{"github":"adaokafor"}', '2026-07-22T10:00:00Z', '2026-08-02T10:00:00Z'),
('spk_lin',   'evt_horizon2026', 'lin@nimbuslabs.example',      'Lin Zhao',      'Nimbus Labs',      'Staff Engineer',      'Lin builds evaluation infrastructure and owns the incident reviews nobody else wants to run.', 'Vancouver', NULL, '2026-07-22T10:05:00Z', '2026-07-22T10:05:00Z'),
('spk_priya', 'evt_horizon2026', 'priya@evalworks.example',      'Priya Sharma',  'Evalworks',        'Co-founder',          'Priya co-founded Evalworks after five years of shipping ML platforms that had to answer to auditors.', 'Bengaluru', '{"twitter":"priyaships"}', '2026-07-23T11:00:00Z', '2026-07-23T11:00:00Z'),
('spk_marco', 'evt_horizon2026', 'marco@ferrostack.example',    'Marco Reyes',   'Ferrostack',       'SRE Lead',            'Marco keeps a nine-figure-request platform boring on purpose.', 'Mexico City', NULL, '2026-07-24T09:00:00Z', '2026-07-24T09:00:00Z'),
('spk_tom',   'evt_horizon2026', 'tom@plainsignal.example',      'Tom Ostrander', 'PlainSignal',      'Head of Platform',    'Tom has migrated three companies off Kubernetes and is still invited to KubeCon.', 'Austin', NULL, '2026-07-25T14:00:00Z', '2026-07-25T14:00:00Z'),
('spk_yuki',  'evt_horizon2026', 'yuki@typecraft.example',      'Yuki Tanaka',   'Typecraft',        'Developer Advocate',  'Yuki teaches type-level TypeScript to working teams without melting anyone. Author of the Typecraft workbook.', 'Tokyo', '{"github":"yukitype"}', '2026-07-26T08:00:00Z', '2026-07-26T08:00:00Z'),
('spk_dana',  'evt_horizon2026', 'dana@auroracompute.example',  'Dana Whitfield','Aurora Compute',   'CTO',                 'Dana is CTO of Aurora Compute, the headline partner of Horizon Dev Summit 2026.', 'Denver', NULL, '2026-07-28T16:00:00Z', '2026-07-28T16:00:00Z'),
('spk_omar',  'evt_horizon2026', 'omar@stackparliament.example','Omar Haddad',   'Stack Parliament', 'Moderator',           'Omar moderates hard panels well. Formerly infra lead at two unicorns.', 'Amsterdam', NULL, '2026-07-29T12:00:00Z', '2026-07-29T12:00:00Z');

-- ---------------------------------------------------------------------------
-- Submissions (applications to speak) — the full status spread
-- ---------------------------------------------------------------------------
INSERT INTO submissions (id, event_id, form_id, track_id, title, abstract, format, status, answers_json, submitted_at, created_at, updated_at) VALUES
('sub_agents_prod',  'evt_horizon2026', 'form_cfp', 'trk_ai',      'Agents in Production: What Breaks First',
 'Everyone has a demo. Almost nobody has an agent system surviving real users. We will walk through the six failure modes we hit running agents for 40k daily tasks — tool drift, context rot, silent retries, cost spirals, eval blind spots, and human handoff — and the guardrails that actually held.',
 'talk', 'accepted', '{"prior_speaking":"Conference regular"}', '2026-07-24T18:12:00Z', '2026-07-24T18:12:00Z', '2026-08-03T09:00:00Z'),

('sub_eval_pipelines', 'evt_horizon2026', 'form_cfp', 'trk_ai',    'Eval Pipelines That Do Not Lie',
 'Offline evals said ship it. Users said otherwise. This talk covers building evaluation pipelines with teeth: adversarial test sets, drift alarms, human-label budgets that fit a startup, and how to keep a model change from quietly wrecking a workflow your revenue depends on.',
 'talk', 'accepted', '{"prior_speaking":"1-5 talks"}', '2026-07-25T09:30:00Z', '2026-07-25T09:30:00Z', '2026-08-03T09:05:00Z'),

('sub_rag_dead',     'evt_horizon2026', 'form_cfp', 'trk_ai',      'RAG Is Dead, Long Live RAG',
 'Long-context models were supposed to kill retrieval. Our latency bills disagree. A practical tour of where retrieval still wins, where it genuinely lost, and the hybrid patterns that cut our token spend 70 percent without hurting answer quality.',
 'talk', 'under_review', '{"prior_speaking":"1-5 talks"}', '2026-07-26T15:45:00Z', '2026-07-26T15:45:00Z', '2026-08-02T10:00:00Z'),

('sub_dx_metrics',   'evt_horizon2026', 'form_cfp', 'trk_devex',   'Measuring Developer Experience Without Vanity Metrics',
 'DORA numbers went up and the team still hated the codebase. We rebuilt our DX measurement around time-to-confidence, interruption cost, and review latency — and changed what leadership actually funds. Comes with the survey and dashboard templates we use.',
 'talk', 'under_review', '{"prior_speaking":"First time"}', '2026-07-27T11:20:00Z', '2026-07-27T11:20:00Z', '2026-08-02T10:05:00Z'),

('sub_ship_fast',    'evt_horizon2026', 'form_cfp', 'trk_product', 'Shipping Fast Without Breaking Trust',
 'We ship to production forty times a day in a product handling money. The trick is not more process — it is designing changes users cannot be surprised by. Feature exposure budgets, reversibility rules, and the launch checklist that fits on one screen.',
 'talk', 'submitted', '{"prior_speaking":"1-5 talks"}', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z', '2026-07-29T19:00:00Z'),

('sub_edge_data',    'evt_horizon2026', 'form_cfp', 'trk_infra',   'Data at the Edge: Running SQLite in Anger',
 'We moved a read-heavy product database to edge SQLite replicas and lived to tell. Replication lag traps, write-path design, migration discipline, and the operational dashboards that saved us during two regional incidents.',
 'talk', 'submitted', '{"prior_speaking":"Conference regular","travel_support":true}', '2026-07-30T08:40:00Z', '2026-07-30T08:40:00Z', '2026-07-30T08:40:00Z'),

('sub_ts_types',     'evt_horizon2026', 'form_cfp', 'trk_devex',   'Type-Level TypeScript for Working Engineers',
 'A hands-on workshop building the five type-level patterns that pay rent in application code: branded ids, exhaustive unions, template-literal routing, safe builders, and inference-friendly APIs. Bring a laptop; leave with a repo of drills.',
 'workshop', 'waitlisted', '{"prior_speaking":"Conference regular","workshop_length":"90 minutes"}', '2026-07-28T13:10:00Z', '2026-07-28T13:10:00Z', '2026-08-04T12:00:00Z'),

('sub_k8s_escape',   'evt_horizon2026', 'form_cfp', 'trk_infra',   'Escaping Kubernetes: A Love Story',
 'We left Kubernetes and nothing bad happened. A candid migration retro: what we kept, what we replaced with boring VMs, and the honest total-cost math either way.',
 'talk', 'rejected', '{"prior_speaking":"1-5 talks"}', '2026-07-26T22:05:00Z', '2026-07-26T22:05:00Z', '2026-08-04T12:10:00Z'),

('sub_design_evals', 'evt_horizon2026', 'form_cfp', 'trk_product', 'Designing AI Products Users Actually Trust',
 'A panel-style deep dive into trust surfaces in AI products: confidence displays, undo paths, provenance, and the UX of being wrong. Case studies from three shipped products with real usage numbers.',
 'panel', 'under_review', '{"prior_speaking":"1-5 talks"}', '2026-07-31T17:30:00Z', '2026-07-31T17:30:00Z', '2026-08-02T10:10:00Z'),

('sub_llm_cost',     'evt_horizon2026', 'form_cfp', 'trk_ai',      'Cutting LLM Cost 10x Without Losing Quality',
 'Our inference bill was growing faster than revenue. We cut it 10x with routing, caching, distillation, and honest quality gates — and we will show the graphs, including the two optimizations that backfired.',
 'talk', 'submitted', '{"prior_speaking":"First time","travel_support":true}', '2026-08-01T10:15:00Z', '2026-08-01T10:15:00Z', '2026-08-01T10:15:00Z');

INSERT INTO submission_speakers (submission_id, speaker_id, role, sort_order) VALUES
('sub_agents_prod',   'spk_ada',   'primary',    0),
('sub_agents_prod',   'spk_lin',   'co_speaker', 1),
('sub_eval_pipelines','spk_priya', 'primary',    0),
('sub_rag_dead',      'spk_marco', 'primary',    0),
('sub_dx_metrics',    'spk_yuki',  'primary',    0),
('sub_ship_fast',     'spk_tom',   'primary',    0),
('sub_edge_data',     'spk_marco', 'primary',    0),
('sub_ts_types',      'spk_yuki',  'primary',    0),
('sub_k8s_escape',    'spk_tom',   'primary',    0),
('sub_design_evals',  'spk_omar',  'primary',    0),
('sub_llm_cost',      'spk_lin',   'primary',    0);

-- ---------------------------------------------------------------------------
-- Evaluation: one plan, two rounds, three rubric criteria, sample reviews
-- ---------------------------------------------------------------------------
INSERT INTO evaluation_plans (id, event_id, name, description, created_at) VALUES
('plan_pc2026', 'evt_horizon2026', 'Program Committee Review', 'Two-round review: screening pass, then final selection against the rubric.', '2026-07-20T09:00:00Z');

INSERT INTO evaluation_rounds (id, plan_id, name, round_number, status, opens_at, closes_at, blind_mode) VALUES
('round_screen', 'plan_pc2026', 'Screening',    1, 'closed', '2026-07-26T07:00:00Z', '2026-08-02T07:00:00Z', 0),
('round_final',  'plan_pc2026', 'Final Review', 2, 'open',   '2026-08-02T07:00:00Z', '2026-08-28T07:00:00Z', 0);

INSERT INTO rubric_criteria (id, plan_id, round_id, key, label, description, max_score, weight, sort_order) VALUES
('crit_relevance', 'plan_pc2026', 'round_screen', 'relevance', 'Audience relevance', 'Does this serve working engineers at Horizon?', 5, 1.0, 0),
('crit_depth',     'plan_pc2026', 'round_screen', 'depth',     'Technical depth',    'Real systems and real numbers beat theory.',    5, 1.0, 1),
('crit_readiness', 'plan_pc2026', 'round_screen', 'readiness', 'Speaker readiness',  'Evidence the speaker can deliver this well.',   5, 0.5, 2),
('crit_f_originality', 'plan_pc2026', 'round_final', 'originality', 'Originality', 'Would a Horizon regular learn something new?', 5, 2.0, 0),
('crit_f_impact',      'plan_pc2026', 'round_final', 'impact',      'Audience impact', 'Will attendees change how they work on Monday?', 5, 1.0, 1);

-- A working reviewer queue out of the box: Sam is in the open Final Review
-- pool with a stable demo token, two live assignments, and blind mode off.
-- Judges (human or agent) land on /reviewer/rev_sam_demo and can score
-- immediately — the token is a capability link, not a credential.
INSERT INTO round_reviewers (round_id, reviewer_name, reviewer_email, reviewer_token, assignment_cap, created_at) VALUES
('round_final', 'Sam Peters', 'sam@horizonsummit.example', 'rev_sam_demo', 5, '2026-08-02T09:00:00Z');

INSERT INTO review_assignments (round_id, reviewer_email, submission_id, assigned_at) VALUES
('round_final', 'sam@horizonsummit.example', 'sub_rag_dead',     '2026-08-02T09:05:00Z'),
('round_final', 'sam@horizonsummit.example', 'sub_design_evals', '2026-08-02T09:05:00Z');

INSERT INTO reviews (id, round_id, submission_id, reviewer_name, reviewer_email, scores_json, overall_comment, recommendation, submitted_at) VALUES
('rev_screen_rag_sam',    'round_screen', 'sub_rag_dead',     'Sam Peters',  'sam@horizonsummit.example',  '{"relevance":4,"depth":4,"readiness":4}', 'Strong practical angle. Verify the 70 percent claim has a chart behind it.', 'accept',  '2026-07-28T20:00:00Z'),
('rev_screen_rag_ines',   'round_screen', 'sub_rag_dead',     'Ines Farrow', 'ines@horizonsummit.example', '{"relevance":4,"depth":3,"readiness":4}', 'Title is bait but the content reads real.', 'accept', '2026-07-29T08:30:00Z'),
('rev_screen_dx_sam',     'round_screen', 'sub_dx_metrics',   'Sam Peters',  'sam@horizonsummit.example',  '{"relevance":4,"depth":3,"readiness":3}', 'First-time speaker; pair with a mentor if accepted.', 'waitlist', '2026-07-29T21:15:00Z'),
('rev_screen_design_ines','round_screen', 'sub_design_evals', 'Ines Farrow', 'ines@horizonsummit.example', '{"relevance":5,"depth":3,"readiness":5}', 'Would make a great Panel Loft session.', 'accept', '2026-07-30T09:45:00Z'),
('rev_screen_k8s_sam',    'round_screen', 'sub_k8s_escape',   'Sam Peters',  'sam@horizonsummit.example',  '{"relevance":3,"depth":2,"readiness":3}', 'We ran a nearly identical talk last year.', 'reject', '2026-07-30T10:00:00Z');

-- ---------------------------------------------------------------------------
-- Sessions. Two carry submission lineage; two are direct-added.
-- ---------------------------------------------------------------------------
INSERT INTO sessions (id, event_id, source_submission_id, track_id, title, abstract, format, status, origin, created_at, updated_at) VALUES
('ses_from_sub_agents_prod', 'evt_horizon2026', 'sub_agents_prod', 'trk_ai',
 'Agents in Production: What Breaks First',
 'Everyone has a demo. Almost nobody has an agent system surviving real users. We will walk through the six failure modes we hit running agents for 40k daily tasks — tool drift, context rot, silent retries, cost spirals, eval blind spots, and human handoff — and the guardrails that actually held.',
 'talk', 'confirmed', 'accepted_submission', '2026-08-03T09:00:00Z', '2026-08-03T09:00:00Z'),

('ses_from_sub_eval_pipelines', 'evt_horizon2026', 'sub_eval_pipelines', 'trk_ai',
 'Eval Pipelines That Do Not Lie',
 'Offline evals said ship it. Users said otherwise. This talk covers building evaluation pipelines with teeth: adversarial test sets, drift alarms, human-label budgets that fit a startup, and how to keep a model change from quietly wrecking a workflow your revenue depends on.',
 'talk', 'confirmed', 'accepted_submission', '2026-08-03T09:05:00Z', '2026-08-03T09:05:00Z'),

('ses_keynote', 'evt_horizon2026', NULL, NULL,
 'Opening Keynote: The Next Decade of Building',
 'Aurora Compute CTO Dana Whitfield opens Horizon 2026 with a grounded look at what the last two years of AI tooling actually changed for working teams — and what did not.',
 'keynote', 'confirmed', 'direct', '2026-08-04T15:00:00Z', '2026-08-04T15:00:00Z'),

('ses_ai_panel', 'evt_horizon2026', NULL, 'trk_ai',
 'Panel: Agents, Agents Everywhere',
 'Practitioners who run agent systems in production argue about what is real. Moderated by Omar Haddad.',
 'panel', 'confirmed', 'direct', '2026-08-04T15:10:00Z', '2026-08-04T15:10:00Z'),

('ses_day_two_clinic', 'evt_horizon2026', NULL, 'trk_infra',
 'Day Two Reliability Clinic',
 'Lin Zhao turns the previous day’s production failures into a hands-on reliability clinic: incident timelines, fallback drills, and the smallest guardrails that prevent expensive surprises.',
 'workshop', 'confirmed', 'direct', '2026-08-04T15:20:00Z', '2026-08-04T15:20:00Z');

INSERT INTO session_speakers (session_id, speaker_id, role, sort_order) VALUES
('ses_from_sub_agents_prod',    'spk_ada',   'primary',    0),
('ses_from_sub_agents_prod',    'spk_lin',   'co_speaker', 1),
('ses_from_sub_eval_pipelines', 'spk_priya', 'primary',    0),
('ses_keynote',                 'spk_dana',  'primary',    0),
('ses_ai_panel',                'spk_omar',  'primary',    0),
('ses_ai_panel',                'spk_ada',   'co_speaker', 1),
('ses_day_two_clinic',          'spk_lin',   'primary',    0);

-- ---------------------------------------------------------------------------
-- Agenda (2026-10-14..15, times UTC; 16:00Z = 09:00 PT).
-- slot_agents vs slot_evals: SAME ROOM overlap 17:30-17:45Z  -> room conflict.
-- slot_agents vs slot_panel: Ada is in both, overlap 17:15-17:45Z -> speaker conflict.
-- ---------------------------------------------------------------------------
INSERT INTO agenda_slots (id, event_id, session_id, room_id, starts_at, ends_at, created_at, updated_at) VALUES
('slot_keynote', 'evt_horizon2026', 'ses_keynote',                 'room_main', '2026-10-14T16:00:00Z', '2026-10-14T16:45:00Z', '2026-08-04T16:00:00Z', '2026-08-04T16:00:00Z'),
('slot_agents',  'evt_horizon2026', 'ses_from_sub_agents_prod',    'room_main', '2026-10-14T17:00:00Z', '2026-10-14T17:45:00Z', '2026-08-04T16:05:00Z', '2026-08-04T16:05:00Z'),
('slot_evals',   'evt_horizon2026', 'ses_from_sub_eval_pipelines', 'room_main', '2026-10-14T17:30:00Z', '2026-10-14T18:15:00Z', '2026-08-04T16:10:00Z', '2026-08-04T16:10:00Z'),
('slot_panel',   'evt_horizon2026', 'ses_ai_panel',                'room_loft', '2026-10-14T17:15:00Z', '2026-10-14T18:00:00Z', '2026-08-04T16:15:00Z', '2026-08-04T16:15:00Z'),
('slot_day_two', 'evt_horizon2026', 'ses_day_two_clinic',          'room_studio','2026-10-15T17:00:00Z', '2026-10-15T18:30:00Z', '2026-08-04T16:20:00Z', '2026-08-04T16:20:00Z');

-- ---------------------------------------------------------------------------
-- Speaker onboarding tasks
-- ---------------------------------------------------------------------------
INSERT INTO task_definitions (id, event_id, key, label, description, applies_to, due_at, sort_order) VALUES
('taskdef_bio',      'evt_horizon2026', 'bio',      'Confirm speaker bio',      'Review and confirm the bio that will appear on the public site.', 'accepted_speakers', '2026-09-15T07:00:00Z', 0),
('taskdef_headshot', 'evt_horizon2026', 'headshot', 'Upload headshot',          'High-resolution headshot for the speaker gallery.',               'accepted_speakers', '2026-09-15T07:00:00Z', 1),
('taskdef_slides',   'evt_horizon2026', 'slides',   'Upload draft slides',      'Draft deck for tech check. Final version due at the event.',      'accepted_speakers', '2026-10-01T07:00:00Z', 2),
('taskdef_release',  'evt_horizon2026', 'release',  'Sign recording release',   'Required before any session is recorded or streamed.',            'accepted_speakers', '2026-09-22T07:00:00Z', 3);

INSERT INTO speaker_tasks (id, event_id, speaker_id, task_definition_id, status, completed_at, updated_at) VALUES
('task_ada_bio',        'evt_horizon2026', 'spk_ada',   'taskdef_bio',      'complete', '2026-08-05T10:00:00Z', '2026-08-05T10:00:00Z'),
('task_ada_headshot',   'evt_horizon2026', 'spk_ada',   'taskdef_headshot', 'pending',  NULL, '2026-08-04T16:20:00Z'),
('task_ada_slides',     'evt_horizon2026', 'spk_ada',   'taskdef_slides',   'pending',  NULL, '2026-08-04T16:20:00Z'),
('task_ada_release',    'evt_horizon2026', 'spk_ada',   'taskdef_release',  'complete', '2026-08-05T10:02:00Z', '2026-08-05T10:02:00Z'),
('task_lin_bio',        'evt_horizon2026', 'spk_lin',   'taskdef_bio',      'pending',  NULL, '2026-08-04T16:20:00Z'),
('task_lin_headshot',   'evt_horizon2026', 'spk_lin',   'taskdef_headshot', 'complete', '2026-08-06T09:00:00Z', '2026-08-06T09:00:00Z'),
('task_lin_slides',     'evt_horizon2026', 'spk_lin',   'taskdef_slides',   'pending',  NULL, '2026-08-04T16:20:00Z'),
('task_lin_release',    'evt_horizon2026', 'spk_lin',   'taskdef_release',  'pending',  NULL, '2026-08-04T16:20:00Z'),
('task_priya_bio',      'evt_horizon2026', 'spk_priya', 'taskdef_bio',      'complete', '2026-08-05T14:00:00Z', '2026-08-05T14:00:00Z'),
('task_priya_headshot', 'evt_horizon2026', 'spk_priya', 'taskdef_headshot', 'pending',  NULL, '2026-08-04T16:20:00Z'),
('task_priya_slides',   'evt_horizon2026', 'spk_priya', 'taskdef_slides',   'pending',  NULL, '2026-08-04T16:20:00Z'),
('task_priya_release',  'evt_horizon2026', 'spk_priya', 'taskdef_release',  'complete', '2026-08-05T14:05:00Z', '2026-08-05T14:05:00Z'),
('task_dana_bio',       'evt_horizon2026', 'spk_dana',  'taskdef_bio',      'complete', '2026-08-05T09:00:00Z', '2026-08-05T09:00:00Z'),
('task_dana_headshot',  'evt_horizon2026', 'spk_dana',  'taskdef_headshot', 'complete', '2026-08-05T09:01:00Z', '2026-08-05T09:01:00Z'),
('task_dana_slides',    'evt_horizon2026', 'spk_dana',  'taskdef_slides',   'pending',  NULL, '2026-08-04T16:20:00Z'),
('task_dana_release',   'evt_horizon2026', 'spk_dana',  'taskdef_release',  'complete', '2026-08-05T09:02:00Z', '2026-08-05T09:02:00Z'),
('task_omar_bio',       'evt_horizon2026', 'spk_omar',  'taskdef_bio',      'pending',  NULL, '2026-08-04T16:20:00Z'),
('task_omar_headshot',  'evt_horizon2026', 'spk_omar',  'taskdef_headshot', 'pending',  NULL, '2026-08-04T16:20:00Z'),
('task_omar_release',   'evt_horizon2026', 'spk_omar',  'taskdef_release',  'pending',  NULL, '2026-08-04T16:20:00Z');

-- ---------------------------------------------------------------------------
-- Communications
-- ---------------------------------------------------------------------------
INSERT INTO message_templates (id, event_id, key, name, channel, subject, body_md, created_at, updated_at) VALUES
('tmpl_missing_assets', 'evt_horizon2026', 'missing_assets', 'Missing assets reminder', 'email',
 'Action needed for {{event_name}}: {{missing_count}} item(s) outstanding',
 'Hi {{speaker_name}},

We are excited to have your session at {{event_name}}. Our records show the following items are still outstanding:

{{missing_tasks}}

You can complete everything in your speaker portal: {{portal_url}}

Thanks!
The {{event_name}} team',
 '2026-08-01T09:00:00Z', '2026-08-01T09:00:00Z'),

('tmpl_calendar_invite', 'evt_horizon2026', 'calendar_invite', 'Session calendar invite', 'email',
 'Your session at {{event_name}}: {{session_title}}',
 'Hi {{speaker_name}},

Your session **{{session_title}}** is scheduled for {{session_time}} in {{room_name}}.

A calendar invite (.ics) is attached. Please arrive 20 minutes early for tech check.

The {{event_name}} team',
 '2026-08-01T09:05:00Z', '2026-08-01T09:05:00Z');

INSERT INTO messages (id, event_id, template_id, speaker_id, to_email, subject, body_md, status, created_at) VALUES
('msg_ada_assets_draft', 'evt_horizon2026', 'tmpl_missing_assets', 'spk_ada', 'ada@nimbuslabs.example',
 'Action needed for Horizon Dev Summit 2026: 2 item(s) outstanding',
 'Hi Ada Okafor,

We are excited to have your session at Horizon Dev Summit 2026. Our records show the following items are still outstanding:

- Upload headshot (due Sep 15)
- Upload draft slides (due Oct 1)

You can complete everything in your speaker portal (linked from your acceptance email).

Thanks!
The Horizon Dev Summit 2026 team',
 'draft', '2026-08-06T10:00:00Z');

-- ---------------------------------------------------------------------------
-- Resources, integrations
-- ---------------------------------------------------------------------------
INSERT INTO resource_pages (id, event_id, slug, title, body_md, embed_html, is_published, updated_at) VALUES
('page_speaker_guide', 'evt_horizon2026', 'speaker-guide', 'Speaker Guide',
 '# Speaker Guide

Welcome to Horizon Dev Summit 2026. Everything you need before the event:

- **Tech check:** 20 minutes before your slot, side stage.
- **Slides:** 16:9, PDF or Keynote. Upload a draft by October 1.
- **Recording:** all Main Hall sessions are recorded. Sign the release in your portal.
- **AV:** HDMI and USB-C at the podium. Confidence monitor with timer.',
 '<iframe src="https://speakerops.speakerops-go7.workers.dev/api/embeds/events/horizon-2026/schedule" title="Live event schedule" width="100%" height="360" loading="lazy"></iframe>',
 1, '2026-08-02T12:00:00Z');

INSERT INTO integration_connections (id, event_id, system, status, config_json, updated_at) VALUES
('conn_accelevents', 'evt_horizon2026', 'accelevents', 'awaiting_credentials', '{"direction":"push","note":"Sandbox key requested from organizer."}', '2026-08-09T18:00:00Z'),
('conn_airtable',    'evt_horizon2026', 'airtable',    'not_configured',       '{}', '2026-08-09T18:00:00Z');
