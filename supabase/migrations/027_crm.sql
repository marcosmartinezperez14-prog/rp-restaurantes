-- CRM tables para GestionBar (uso interno del equipo de ventas)

CREATE TABLE crm_contacts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Lead',
  value NUMERIC DEFAULT 0,
  last_contact TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_deals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  contact_id BIGINT REFERENCES crm_contacts(id) ON DELETE SET NULL,
  company TEXT DEFAULT '',
  value NUMERIC DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'Lead',
  owner TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  due TEXT DEFAULT '',
  contact_id BIGINT REFERENCES crm_contacts(id) ON DELETE SET NULL,
  contact_name TEXT DEFAULT '',
  done BOOLEAN DEFAULT FALSE,
  today BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_activities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'note',
  contact_id BIGINT REFERENCES crm_contacts(id) ON DELETE CASCADE,
  contact_name TEXT DEFAULT '',
  text TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
