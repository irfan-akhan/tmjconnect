ALTER TABLE profiles
  ADD COLUMN country varchar(2) NOT NULL DEFAULT 'US';

ALTER TABLE profiles
  ADD CONSTRAINT profiles_country_check CHECK (country IN ('US', 'CA', 'IN'));