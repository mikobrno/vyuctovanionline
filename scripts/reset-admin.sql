-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Update or insert admin user with bcrypt hashed password for 'admin123'
INSERT INTO users (id, email, name, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@vyuctovani.cz',
  'Administrátor',
  '$2b$10$hxfhrKdBnXkcRcbvI7lU6.Y44Y2ytexXLUsBOdmL9uMK.b45OuXEi',
  'ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT (email) 
DO UPDATE SET 
  password = '$2b$10$hxfhrKdBnXkcRcbvI7lU6.Y44Y2ytexXLUsBOdmL9uMK.b45OuXEi',
  role = 'ADMIN',
  "updatedAt" = NOW();
