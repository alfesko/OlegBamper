CREATE TABLE users
  (
      id       SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password TEXT                NOT NULL
  );
CREATE TABLE "session"
(
    "sid"    varchar      NOT NULL COLLATE "default",
    "sess"   json         NOT NULL,
    "expire" timestamp(6) NOT NULL
)htl
WITH (OIDS=FALSE);

ALTER TABLE "session"
    ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
CREATE TABLE announcements
(
    id            SERIAL PRIMARY KEY,
    brand         VARCHAR(100),
    year          VARCHAR(4),
    model         VARCHAR(100),
    engine_volume VARCHAR(50),
    transmission  VARCHAR(50),
    body_type     VARCHAR(50),
    photo         VARCHAR(255)
);

ALTER TABLE announcements
    ADD COLUMN photos TEXT[];
ALTER TABLE announcements
    ALTER COLUMN photos SET DATA TYPE TEXT[];
ALTER TABLE announcements
    ADD COLUMN description TEXT;
ALTER TABLE announcements
    ADD COLUMN part_number VARCHAR(50);
ALTER TABLE announcements
DROP
COLUMN photo;
ALTER TABLE announcements
    ADD COLUMN fuel_type VARCHAR(50);
ALTER TABLE announcements
    ADD COLUMN fuel_subtype VARCHAR(50);
ALTER TABLE announcements
    ADD COLUMN part VARCHAR(50);
ALTER TABLE announcements
    ADD COLUMN price NUMERIC(10, 2);
CREATE TABLE currency_rates
(
    id         SERIAL PRIMARY KEY,
    eur_to_byn NUMERIC(10, 4) NOT NULL,
    usd_to_byn NUMERIC(10, 4) NOT NULL,
    rub_to_byn NUMERIC(10, 4) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE announcements
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE announcements
    ADD COLUMN article VARCHAR(8) UNIQUE;