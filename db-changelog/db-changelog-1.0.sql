CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL
);
CREATE TABLE "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
)htl
WITH (OIDS=FALSE);

ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");

CREATE INDEX "IDX_session_expire" ON "session" ("expire");
CREATE TABLE announcements (
                               id SERIAL PRIMARY KEY,
                               brand VARCHAR(100),
                               year VARCHAR(4),
                               model VARCHAR(100),
                               engine_volume VARCHAR(50),
                               transmission VARCHAR(50),
                               body_type VARCHAR(50),
                               photo VARCHAR(255)
);
