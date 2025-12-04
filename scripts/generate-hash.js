const bcrypt = require('bcryptjs');
const password = 'admin123';
bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Chyba:', err);
  } else {
    console.log('Bcrypt hash pro "admin123":');
    console.log(hash);
    console.log('\nSQL příkaz:');
    console.log(`INSERT INTO users (id, email, name, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@vyuctovani.cz',
  'Administrátor',
  '${hash}',
  'ADMIN',
  NOW(),
  NOW()
)
ON CONFLICT (email) 
DO UPDATE SET 
  password = '${hash}',
  role = 'ADMIN',
  "updatedAt" = NOW();`);
  }
});
