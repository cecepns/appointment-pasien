-- Database & tabel appointment pasien
-- Jalankan di MySQL: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS appointment_pasien
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE appointment_pasien;

CREATE TABLE IF NOT EXISTS appointments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  appointment_datetime DATETIME NOT NULL,
  homecare_address TEXT NOT NULL,
  allergy_history TEXT NULL,
  phone_number VARCHAR(64) NOT NULL,
  treatment TEXT NOT NULL,
  signature_path VARCHAR(512) NULL COMMENT 'Relatif ke folder upload',
  transfer_proof_path VARCHAR(512) NULL COMMENT 'Bukti transfer',
  admin_note TEXT NULL COMMENT 'Catatan admin untuk hasil treatment',
  status ENUM('pending', 'confirmed', 'cancelled', 'completed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_appointments_datetime (appointment_datetime),
  KEY idx_appointments_status (status),
  KEY idx_appointments_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin (disarankan pakai npm run migrate agar tercatat di schema_migrations)
CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_admins_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
