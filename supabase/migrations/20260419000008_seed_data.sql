-- Seed data: contractor_types, workflow_templates, workflow_stages,
-- workspace_tabs, email_templates, intake_fields platform defaults

-- ── 1. workflow_templates (5) ─────────────────────────────────────────────────
INSERT INTO workflow_templates (key, name, description, max_stage_count) VALUES
  ('booking_first',     'Site Assessment Lead',  'Customer self-books assessment first', 10),
  ('standard',          'Standard Lead',          'Agent intake during phone call',       10),
  ('new_construction',  'New Construction',       'Home builders and large GC projects',  14),
  ('emergency_service', 'Emergency Service',      'Fast response emergency dispatch',      4),
  ('service_call',      'Service Call',           'Routine and recurring service',          4);

-- ── 2. contractor_types (12) ─────────────────────────────────────────────────
INSERT INTO contractor_types (key, name, permits_required, inspections_required, draw_schedules_enabled, emergency_dispatch_enabled, maintenance_contracts_enabled, site_assessment_required, default_workflow_template_id)
SELECT
  v.key, v.name, v.permits, v.inspections, v.draws, v.emergency, v.maintenance, v.site_assess,
  wt.id
FROM (VALUES
  ('remodeler',             'Remodeler',              false, false, true,  false, false, true,  'booking_first'),
  ('home_builder',          'Home Builder',            true,  true,  true,  false, false, false, 'new_construction'),
  ('electrician',           'Electrician',             true,  true,  false, false, false, false, 'standard'),
  ('plumber',               'Plumber',                 true,  true,  false, false, false, false, 'standard'),
  ('hvac',                  'HVAC',                    false, false, false, false, true,  false, 'standard'),
  ('roofer',                'Roofer',                  false, false, false, false, false, true,  'booking_first'),
  ('general_contractor',    'General Contractor',      true,  true,  true,  false, false, false, 'new_construction'),
  ('painter',               'Painter',                 false, false, false, false, false, false, 'standard'),
  ('flooring',              'Flooring',                false, false, false, false, false, false, 'standard'),
  ('landscaper',            'Landscaper',              false, false, false, false, true,  false, 'standard'),
  ('emergency_plumber',     'Emergency Plumber',       false, false, false, true,  false, false, 'emergency_service'),
  ('emergency_electrician', 'Emergency Electrician',   false, false, false, true,  false, false, 'emergency_service')
) AS v(key, name, permits, inspections, draws, emergency, maintenance, site_assess, template_key)
JOIN workflow_templates wt ON wt.key = v.template_key;

-- ── 3. workflow_stages ────────────────────────────────────────────────────────

-- booking_first
INSERT INTO workflow_stages (template_id, stage_key, stage_label, display_order, allowed_next, is_terminal, color_code)
SELECT wt.id, v.stage_key, v.stage_label, v.display_order, v.allowed_next::text[], v.is_terminal, v.color_code
FROM workflow_templates wt, (VALUES
  ('site_assessment',   'Site Assessment',   1, ARRAY['intake_in_progress','lost'],     false, '#6366F1'),
  ('intake_in_progress','Intake In Progress',2, ARRAY['estimate_pending','lost'],        false, '#F59E0B'),
  ('estimate_pending',  'Estimate Pending',  3, ARRAY['estimate_sent','lost'],           false, '#F97316'),
  ('estimate_sent',     'Estimate Sent',     4, ARRAY['contract_pending','lost'],        false, '#EAB308'),
  ('contract_pending',  'Contract Pending',  5, ARRAY['contract_signed','lost'],         false, '#84CC16'),
  ('contract_signed',   'Contract Signed',   6, ARRAY['scheduled','lost'],              false, '#22C55E'),
  ('scheduled',         'Scheduled',         7, ARRAY['in_progress','lost'],            false, '#14B8A6'),
  ('in_progress',       'In Progress',       8, ARRAY['complete','lost'],               false, '#3B82F6'),
  ('complete',          'Complete',          9, '{}',                                   true,  '#10B981'),
  ('lost',              'Lost',             10, '{}',                                   true,  '#6B7280')
) AS v(stage_key, stage_label, display_order, allowed_next, is_terminal, color_code)
WHERE wt.key = 'booking_first';

-- standard
INSERT INTO workflow_stages (template_id, stage_key, stage_label, display_order, allowed_next, is_terminal, color_code)
SELECT wt.id, v.stage_key, v.stage_label, v.display_order, v.allowed_next::text[], v.is_terminal, v.color_code
FROM workflow_templates wt, (VALUES
  ('new_lead',          'New Lead',          1, ARRAY['intake_in_progress','lost'],      false, '#8B5CF6'),
  ('intake_in_progress','Intake In Progress',2, ARRAY['estimate_pending','lost'],         false, '#F59E0B'),
  ('estimate_pending',  'Estimate Pending',  3, ARRAY['estimate_sent','lost'],            false, '#F97316'),
  ('estimate_sent',     'Estimate Sent',     4, ARRAY['contract_pending','lost'],         false, '#EAB308'),
  ('contract_pending',  'Contract Pending',  5, ARRAY['contract_signed','lost'],          false, '#84CC16'),
  ('contract_signed',   'Contract Signed',   6, ARRAY['scheduled','lost'],               false, '#22C55E'),
  ('scheduled',         'Scheduled',         7, ARRAY['in_progress','lost'],             false, '#14B8A6'),
  ('in_progress',       'In Progress',       8, ARRAY['complete','lost'],                false, '#3B82F6'),
  ('complete',          'Complete',          9, '{}',                                    true,  '#10B981'),
  ('lost',              'Lost',             10, '{}',                                    true,  '#6B7280')
) AS v(stage_key, stage_label, display_order, allowed_next, is_terminal, color_code)
WHERE wt.key = 'standard';

-- new_construction
INSERT INTO workflow_stages (template_id, stage_key, stage_label, display_order, allowed_next, is_terminal, color_code)
SELECT wt.id, v.stage_key, v.stage_label, v.display_order, v.allowed_next::text[], v.is_terminal, v.color_code
FROM workflow_templates wt, (VALUES
  ('lead_review',      'Lead Review',        1,  ARRAY['site_walkthrough','lost'],        false, '#8B5CF6'),
  ('site_walkthrough', 'Site Walkthrough',   2,  ARRAY['design_phase','lost'],            false, '#6366F1'),
  ('design_phase',     'Design Phase',       3,  ARRAY['estimate_pending','lost'],        false, '#A855F7'),
  ('estimate_pending', 'Estimate Pending',   4,  ARRAY['contract_signed','lost'],         false, '#F97316'),
  ('contract_signed',  'Contract Signed',    5,  ARRAY['permits_pending','lost'],         false, '#22C55E'),
  ('permits_pending',  'Permits Pending',    6,  ARRAY['permits_approved','lost'],        false, '#F59E0B'),
  ('permits_approved', 'Permits Approved',   7,  ARRAY['foundation','lost'],             false, '#84CC16'),
  ('foundation',       'Foundation',         8,  ARRAY['framing','lost'],                false, '#3B82F6'),
  ('framing',          'Framing',            9,  ARRAY['rough_in','lost'],               false, '#0EA5E9'),
  ('rough_in',         'Rough-In',           10, ARRAY['inspections','lost'],            false, '#06B6D4'),
  ('inspections',      'Inspections',        11, ARRAY['finishing','lost'],              false, '#14B8A6'),
  ('finishing',        'Finishing',          12, ARRAY['punch_list','lost'],             false, '#10B981'),
  ('punch_list',       'Punch List',         13, ARRAY['complete','lost'],              false, '#6EE7B7'),
  ('complete',         'Complete',           14, '{}',                                  true,  '#10B981'),
  ('lost',             'Lost',               15, '{}',                                  true,  '#6B7280')
) AS v(stage_key, stage_label, display_order, allowed_next, is_terminal, color_code)
WHERE wt.key = 'new_construction';

-- emergency_service
INSERT INTO workflow_stages (template_id, stage_key, stage_label, display_order, allowed_next, is_terminal, color_code)
SELECT wt.id, v.stage_key, v.stage_label, v.display_order, v.allowed_next::text[], v.is_terminal, v.color_code
FROM workflow_templates wt, (VALUES
  ('emergency_intake', 'Emergency Intake', 1, ARRAY['dispatched'],       false, '#EF4444'),
  ('dispatched',       'Dispatched',       2, ARRAY['in_progress'],      false, '#F97316'),
  ('in_progress',      'In Progress',      3, ARRAY['complete'],         false, '#3B82F6'),
  ('complete',         'Complete',         4, '{}',                      true,  '#10B981')
) AS v(stage_key, stage_label, display_order, allowed_next, is_terminal, color_code)
WHERE wt.key = 'emergency_service';

-- service_call
INSERT INTO workflow_stages (template_id, stage_key, stage_label, display_order, allowed_next, is_terminal, color_code)
SELECT wt.id, v.stage_key, v.stage_label, v.display_order, v.allowed_next::text[], v.is_terminal, v.color_code
FROM workflow_templates wt, (VALUES
  ('new_lead',    'New Lead',    1, ARRAY['scheduled'],   false, '#8B5CF6'),
  ('scheduled',   'Scheduled',  2, ARRAY['in_progress'], false, '#14B8A6'),
  ('in_progress', 'In Progress',3, ARRAY['complete'],    false, '#3B82F6'),
  ('complete',    'Complete',   4, '{}',                 true,  '#10B981')
) AS v(stage_key, stage_label, display_order, allowed_next, is_terminal, color_code)
WHERE wt.key = 'service_call';

-- ── 4. workspace_tabs (15) ────────────────────────────────────────────────────
INSERT INTO workspace_tabs (tab_key, label, icon_name, visible_for_types, display_order) VALUES
  ('overview',      'Overview',     'LayoutDashboard', '{}',                                                                                                    1),
  ('estimate',      'Estimate',     'FileText',        '{}',                                                                                                    2),
  ('contract',      'Contract',     'FileSignature',   '{}',                                                                                                    3),
  ('invoice',       'Invoice',      'Receipt',         '{}',                                                                                                    4),
  ('materials',     'Materials',    'ShoppingCart',    '{}',                                                                                                    5),
  ('files',         'Files',        'FolderOpen',      '{}',                                                                                                    6),
  ('notes',         'Notes',        'StickyNote',      '{}',                                                                                                    7),
  ('job_costs',     'Job Costs',    'DollarSign',      '{}',                                                                                                    8),
  ('daily_logs',    'Daily Logs',   'ClipboardList',   '{}',                                                                                                    9),
  ('change_orders', 'Changes',      'RefreshCw',       '{}',                                                                                                   10),
  ('portal_preview','Portal',       'Globe',           '{}',                                                                                                   11),
  ('assessment',    'Assessment',   'MapPin',          ARRAY['remodeler','roofer','general_contractor'],                                                        12),
  ('permits',       'Permits',      'Shield',          ARRAY['electrician','plumber','home_builder','general_contractor','roofer'],                             13),
  ('inspections',   'Inspections',  'CheckSquare',     ARRAY['home_builder','electrician','plumber','hvac','general_contractor'],                               14),
  ('draw_schedule', 'Draw Schedule','BarChart2',       ARRAY['remodeler','home_builder','general_contractor'],                                                  15);

-- ── 5. email_templates (28) ───────────────────────────────────────────────────
INSERT INTO email_templates (template_key, subject, body_html, variables) VALUES
  -- booking_first
  ('site_assessment_confirmation', 'Your Site Assessment is Confirmed', '<p>Hi {{customer_first_name}},</p><p>Your site assessment with {{contractor_name}} is confirmed for {{assessment_date}} at {{assessment_time}}. Your confirmation number is <strong>{{confirmation_number}}</strong>.</p>', ARRAY['customer_first_name','contractor_name','assessment_date','assessment_time','confirmation_number','property_address']),
  ('site_assessment_reminder',     'Reminder: Site Assessment Tomorrow', '<p>Hi {{customer_first_name}},</p><p>Just a reminder — your site assessment with {{contractor_name}} is tomorrow at {{assessment_time}}. Weather forecast: {{weather_forecast}}.</p>', ARRAY['customer_first_name','contractor_name','assessment_time','property_address','weather_forecast']),

  -- new_lead
  ('new_lead_confirmation', 'We Received Your Request', '<p>Hi {{customer_first_name}},</p><p>Thank you for reaching out to {{contractor_name}}. We received your project inquiry and will be in touch shortly.</p>', ARRAY['customer_first_name','contractor_name']),

  -- new_construction
  ('permit_submitted',   'Permit Application Submitted',  '<p>Hi {{customer_first_name}},</p><p>We have submitted your permit application to {{permit_authority}}. Expected timeline: {{permit_timeline}}.</p>', ARRAY['customer_first_name','contractor_name','permit_authority','permit_timeline']),
  ('permit_approved',    'Permit Approved — Work Can Begin', '<p>Hi {{customer_first_name}},</p><p>Your permit #{{permit_number}} has been approved. Construction can begin as scheduled.</p>', ARRAY['customer_first_name','contractor_name','permit_number']),
  ('inspection_scheduled','Inspection Scheduled',          '<p>Hi {{customer_first_name}},</p><p>An inspection has been scheduled for {{inspection_date}} at {{inspection_time}}. Type: {{inspection_type}}.</p>', ARRAY['customer_first_name','contractor_name','inspection_date','inspection_time','inspection_type']),
  ('inspection_passed',  'Inspection Passed',               '<p>Hi {{customer_first_name}},</p><p>Great news — your {{inspection_type}} inspection passed. The next phase will begin soon.</p>', ARRAY['customer_first_name','contractor_name','inspection_type']),
  ('draw_released',      'Draw Payment Released',           '<p>Hi {{customer_first_name}},</p><p>Draw #{{draw_number}} for {{draw_amount}} has been released for milestone: {{milestone_label}}.</p>', ARRAY['customer_first_name','contractor_name','draw_number','draw_amount','milestone_label']),
  ('punch_list_issued',  'Punch List Issued',               '<p>Hi {{customer_first_name}},</p><p>We have issued your punch list. Expected completion: {{completion_date}}. Please review via your portal.</p>', ARRAY['customer_first_name','contractor_name','completion_date','portal_url']),
  ('warranty_issued',    'Your Warranty is Active',         '<p>Hi {{customer_first_name}},</p><p>Your project is complete and your warranty is now active. Coverage details are available in your portal.</p>', ARRAY['customer_first_name','contractor_name','portal_url']),

  -- emergency_service
  ('emergency_confirmation','Emergency Request Received',   '<p>Hi {{customer_first_name}},</p><p>We received your emergency request. Our team has been notified and will respond immediately.</p>', ARRAY['customer_first_name','contractor_name']),
  ('dispatch_confirmation', 'Technician On The Way',         '<p>Hi {{customer_first_name}},</p><p>{{technician_name}} is on the way and should arrive by {{eta}}. Call {{contractor_phone}} with questions.</p>', ARRAY['customer_first_name','contractor_name','technician_name','eta','contractor_phone']),
  ('technician_arrived',    'Technician Has Arrived',        '<p>Hi {{customer_first_name}},</p><p>{{technician_name}} has arrived at your property and is assessing the issue.</p>', ARRAY['customer_first_name','contractor_name','technician_name']),
  ('same_day_invoice',      'Your Invoice Is Ready',         '<p>Hi {{customer_first_name}},</p><p>Service complete. Your invoice total is {{invoice_amount}}. Pay here: {{stripe_link}}</p>', ARRAY['customer_first_name','contractor_name','invoice_amount','stripe_link']),

  -- service_call
  ('service_request_confirmation','Service Request Received', '<p>Hi {{customer_first_name}},</p><p>We received your service request and will contact you to schedule soon.</p>', ARRAY['customer_first_name','contractor_name']),
  ('next_service_scheduled',      'Your Next Service is Scheduled', '<p>Hi {{customer_first_name}},</p><p>Your next service visit is scheduled for {{service_date}}. Type: {{service_type}}.</p>', ARRAY['customer_first_name','contractor_name','service_date','service_type']),

  -- shared (all paths)
  ('new_lead_alert',           'New Lead: {{lead_name}}',       '<p>New lead received: <strong>{{lead_name}}</strong> — {{lead_source}}. Phone: {{lead_phone}}. Stage: {{pipeline_stage}}.</p>', ARRAY['lead_name','lead_source','lead_phone','pipeline_stage']),
  ('consultation_fee_request', 'Consultation Fee Payment',       '<p>Hi {{customer_first_name}},</p><p>A consultation fee of {{fee_amount}} is required. Pay here: {{stripe_link}}</p>', ARRAY['customer_first_name','contractor_name','fee_amount','stripe_link']),
  ('estimate_ready',           'Your Estimate Is Ready to Review','<p>Hi {{customer_first_name}},</p><p>Your estimate from {{contractor_name}} is ready. Review it in your portal: {{portal_url}}</p>', ARRAY['customer_first_name','contractor_name','portal_url']),
  ('contract_ready',           'Your Contract Is Ready to Sign', '<p>Hi {{customer_first_name}},</p><p>Your contract is ready for your signature. Sign it here: {{portal_url}}</p>', ARRAY['customer_first_name','contractor_name','portal_url']),
  ('deposit_invoice',          'Deposit Invoice',                '<p>Hi {{customer_first_name}},</p><p>A deposit of {{deposit_amount}} is due. Pay here: {{stripe_link}}</p>', ARRAY['customer_first_name','contractor_name','deposit_amount','stripe_link']),
  ('payment_received',         'Payment Confirmed',              '<p>Hi {{customer_first_name}},</p><p>We received your payment of {{amount}}. Thank you! Next step: {{next_step}}.</p>', ARRAY['customer_first_name','contractor_name','amount','next_step']),
  ('payment_reminder',         'Payment Reminder',               '<p>Hi {{customer_first_name}},</p><p>A reminder that you have an outstanding invoice for {{amount}}. Pay here: {{stripe_link}}</p>', ARRAY['customer_first_name','contractor_name','amount','stripe_link']),
  ('booking_confirmation',     'Your Appointment Is Confirmed',  '<p>Hi {{customer_first_name}},</p><p>Your appointment with {{contractor_name}} is confirmed for {{appointment_date}} at {{appointment_time}}.</p>', ARRAY['customer_first_name','contractor_name','appointment_date','appointment_time','property_address']),
  ('booking_reminder',         'Appointment Reminder: Tomorrow', '<p>Hi {{customer_first_name}},</p><p>Reminder: your appointment with {{contractor_name}} is tomorrow at {{appointment_time}} at {{property_address}}.</p>', ARRAY['customer_first_name','contractor_name','appointment_time','property_address']),
  ('project_started',          'Work Has Begun on Your Project', '<p>Hi {{customer_first_name}},</p><p>Work has begun on your project. Track progress in your portal: {{portal_url}}</p>', ARRAY['customer_first_name','contractor_name','portal_url']),
  ('daily_update',             'Daily Update from {{contractor_name}}', '<p>Hi {{customer_first_name}},</p><p>Today''s update: {{work_summary}}. Photos available in your portal.</p>', ARRAY['customer_first_name','contractor_name','work_summary','portal_url']),
  ('project_complete',         'Your Project Is Complete!',      '<p>Hi {{customer_first_name}},</p><p>Your project with {{contractor_name}} is complete. View photos and documents in your portal: {{portal_url}}</p>', ARRAY['customer_first_name','contractor_name','portal_url']),
  ('portal_invite',            'Access Your Project Portal',     '<p>Hi {{customer_first_name}},</p><p>Your project portal is ready. Track progress, view documents, and communicate with your contractor here: {{portal_url}}</p>', ARRAY['customer_first_name','contractor_name','portal_url']),
  ('weekly_summary',           'Your Weekly CRM Summary',        '<p>Hi {{agent_name}},</p><p>Week of {{week_start}}: {{new_leads}} new leads · {{estimates_sent}} estimates sent · {{revenue}} in revenue.</p>', ARRAY['agent_name','week_start','new_leads','estimates_sent','revenue']);

-- ── 6. intake_fields platform defaults ───────────────────────────────────────
-- Section: who_where (all types)
INSERT INTO intake_fields (client_id, field_key, field_label, field_type, section, display_order, required, visible_for_types, maps_to_leads_column, placeholder) VALUES
  (NULL, 'full_name',       'Full Name',           'text',     'who_where', 1,  true,  '{}', 'full_name',       'John Smith'),
  (NULL, 'phone',           'Phone Number',        'tel',      'who_where', 2,  true,  '{}', 'phone',           '(555) 000-0000'),
  (NULL, 'email',           'Email Address',       'email',    'who_where', 3,  true,  '{}', 'email',           'john@example.com'),
  (NULL, 'street_address',  'Street Address',      'text',     'who_where', 4,  true,  '{}', 'property_address','123 Main St'),
  (NULL, 'city',            'City',                'text',     'who_where', 5,  true,  '{}', null,              'Miami'),
  (NULL, 'state',           'State',               'select',   'who_where', 6,  false, '{}', null,              null),
  (NULL, 'zip',             'ZIP Code',            'text',     'who_where', 7,  false, '{}', null,              '33101'),
  -- Section: what_when (all types)
  (NULL, 'project_type',    'Project Type',        'select',   'what_when', 1,  true,  '{}', 'project_type',    null),
  (NULL, 'budget_range',    'Budget Range',        'select',   'what_when', 2,  false, '{}', 'budget_range',    null),
  (NULL, 'preferred_date',  'Preferred Date',      'date',     'what_when', 3,  false, '{}', 'preferred_date',  null),
  (NULL, 'preferred_time',  'Preferred Time',      'select',   'what_when', 4,  false, '{}', 'preferred_time',  null),
  (NULL, 'description',     'Project Description', 'textarea', 'what_when', 5,  false, '{}', null,              'Describe the project...'),
  -- Section: trade_details — electrician
  (NULL, 'panel_size',      'Panel Size (amps)',   'select',   'trade_details', 1, false, ARRAY['electrician'], null, null),
  (NULL, 'circuit_types',   'Circuit Types',       'multiselect','trade_details',2,false, ARRAY['electrician'], null, null),
  -- Section: trade_details — plumber
  (NULL, 'pipe_material',   'Pipe Material',       'select',   'trade_details', 1, false, ARRAY['plumber'], null, null),
  (NULL, 'fixture_count',   'Fixture Count',       'number',   'trade_details', 2, false, ARRAY['plumber'], null, null),
  -- Section: trade_details — roofer/remodeler
  (NULL, 'roof_type',       'Roof Type',           'select',   'trade_details', 1, false, ARRAY['roofer','remodeler'], null, null),
  (NULL, 'roof_sqft',       'Roof Sq Ft',          'number',   'trade_details', 2, false, ARRAY['roofer','remodeler'], null, null),
  (NULL, 'storm_damage',    'Storm Damage?',       'boolean',  'trade_details', 3, false, ARRAY['roofer'], null, null),
  -- Section: trade_details — hvac
  (NULL, 'system_type',     'System Type',         'select',   'trade_details', 1, false, ARRAY['hvac'], null, null),
  (NULL, 'tonnage',         'Tonnage',             'select',   'trade_details', 2, false, ARRAY['hvac'], null, null),
  -- Section: trade_details — painter
  (NULL, 'surface_type',    'Surface Type',        'select',   'trade_details', 1, false, ARRAY['painter'], null, null),
  (NULL, 'paint_sqft',      'Square Footage',      'number',   'trade_details', 2, false, ARRAY['painter'], null, null),
  (NULL, 'interior_exterior','Interior or Exterior','select',  'trade_details', 3, false, ARRAY['painter'], null, null),
  -- Section: trade_details — flooring
  (NULL, 'floor_type',      'Floor Type',          'select',   'trade_details', 1, false, ARRAY['flooring'], null, null),
  (NULL, 'floor_sqft',      'Square Footage',      'number',   'trade_details', 2, false, ARRAY['flooring'], null, null),
  (NULL, 'subfloor_condition','Subfloor Condition','select',   'trade_details', 3, false, ARRAY['flooring'], null, null),
  -- Section: trade_details — home_builder
  (NULL, 'lot_number',      'Lot Number',          'text',     'trade_details', 1, false, ARRAY['home_builder'], null, null),
  (NULL, 'total_sqft',      'Total Sq Ft',         'number',   'trade_details', 2, false, ARRAY['home_builder','general_contractor'], null, null),
  -- Section: trade_details — landscaper
  (NULL, 'property_sqft',   'Property Sq Ft',      'number',   'trade_details', 1, false, ARRAY['landscaper'], null, null),
  (NULL, 'has_irrigation',  'Has Irrigation?',     'boolean',  'trade_details', 2, false, ARRAY['landscaper'], null, null),
  (NULL, 'recurring_service','Recurring Service?', 'boolean',  'trade_details', 3, false, ARRAY['landscaper'], null, null),
  -- Section: trade_details — emergency
  (NULL, 'issue_type',      'Issue Type',          'text',     'trade_details', 1, true,  ARRAY['emergency_plumber','emergency_electrician'], null, 'Describe the emergency...'),
  (NULL, 'urgency_level',   'Urgency Level',       'select',   'trade_details', 2, true,  ARRAY['emergency_plumber','emergency_electrician'], 'urgency_level', null),
  (NULL, 'access_notes',    'Access Notes',        'textarea', 'trade_details', 3, false, ARRAY['emergency_plumber','emergency_electrician'], null, 'Gate code, pet in yard...'),
  -- Section: notes (all types)
  (NULL, 'call_notes',      'Call Notes',          'textarea', 'notes', 1, false, '{}', null, 'Internal notes from the call...');
