-- Akun default: username admin, password admin123 — segera ganti setelah login.
INSERT INTO admins (username, password_hash)
VALUES (
  'admin',
  '$2b$10$XtDi3gttXXB9KUTRCFhp7eggV16SWgEEQ7MFcYqmivz6viT6WDpQe'
)
ON DUPLICATE KEY UPDATE id = id;
