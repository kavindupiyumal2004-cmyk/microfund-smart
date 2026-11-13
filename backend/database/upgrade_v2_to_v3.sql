-- =====================================================================
-- MicroFund V2 -> V3 Five-Role Upgrade
-- Run this ONLY on an existing V2 database that you want to preserve.
-- Back up the database first.
-- =====================================================================
USE `microfund_db`;
SET FOREIGN_KEY_CHECKS = 0;

-- 1) Expand role enum temporarily so legacy values can be renamed safely.
ALTER TABLE `Role`
  MODIFY `name` ENUM('ADMIN','FIELD_OFFICER','OWNER','MANAGER','AGENT','CASHIER','CUSTOMER') NOT NULL;

UPDATE `Role` SET `name`='MANAGER' WHERE `name`='ADMIN';
UPDATE `Role` SET `name`='AGENT' WHERE `name`='FIELD_OFFICER';
INSERT IGNORE INTO `Role` (`name`) VALUES ('OWNER');

ALTER TABLE `Role`
  MODIFY `name` ENUM('OWNER','MANAGER','AGENT','CASHIER','CUSTOMER') NOT NULL;

-- 2) Add V3 application workflow statuses.
ALTER TABLE `LoanApplication`
  MODIFY `status` ENUM('DRAFT','SUBMITTED','ASSIGNED','VISIT_SCHEDULED','VERIFICATION_COMPLETED','DOCUMENT_REVIEW','CREDIT_REVIEW','RETURNED','APPROVED','REJECTED')
  NOT NULL DEFAULT 'SUBMITTED';

-- 3) Credit assessment before final approval.
CREATE TABLE IF NOT EXISTS `CreditAssessment` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` INT UNSIGNED NOT NULL,
  `assessed_by` INT UNSIGNED NOT NULL,
  `monthly_income_snapshot` DECIMAL(14,2) NOT NULL,
  `household_expenses` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `existing_loan_payments` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `other_commitments` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `disposable_income` DECIMAL(14,2) NOT NULL,
  `proposed_amount` DECIMAL(14,2) NOT NULL,
  `proposed_interest_rate` DECIMAL(6,2) NOT NULL,
  `proposed_duration_months` INT UNSIGNED NOT NULL,
  `estimated_installment` DECIMAL(14,2) NOT NULL,
  `risk_level` ENUM('LOW','MEDIUM','HIGH') NOT NULL,
  `recommendation` ENUM('APPROVE','REVIEW','REJECT') NOT NULL,
  `notes` TEXT NULL,
  `assessed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_credit_application` (`application_id`),
  KEY `idx_credit_assessor` (`assessed_by`),
  KEY `idx_credit_risk` (`risk_level`),
  CONSTRAINT `fk_credit_application` FOREIGN KEY (`application_id`) REFERENCES `LoanApplication` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_credit_assessor` FOREIGN KEY (`assessed_by`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Overdue collection cases and follow-up history.
CREATE TABLE IF NOT EXISTS `CollectionCase` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_no` VARCHAR(30) NOT NULL,
  `loan_id` INT UNSIGNED NOT NULL,
  `installment_id` INT UNSIGNED NOT NULL,
  `customer_id` INT UNSIGNED NOT NULL,
  `assigned_agent_id` INT UNSIGNED NULL,
  `status` ENUM('OPEN','CONTACTED','PROMISE_TO_PAY','ESCALATED','RESOLVED') NOT NULL DEFAULT 'OPEN',
  `priority` ENUM('NORMAL','HIGH','CRITICAL') NOT NULL DEFAULT 'NORMAL',
  `days_overdue` INT UNSIGNED NOT NULL DEFAULT 0,
  `overdue_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `promise_amount` DECIMAL(14,2) NULL,
  `promise_date` DATE NULL,
  `next_followup_date` DATE NULL,
  `manager_note` TEXT NULL,
  `resolved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_collection_case_no` (`case_no`),
  UNIQUE KEY `uq_collection_installment` (`installment_id`),
  KEY `idx_collection_agent_status` (`assigned_agent_id`,`status`),
  KEY `idx_collection_status_priority` (`status`,`priority`),
  KEY `idx_collection_customer` (`customer_id`),
  CONSTRAINT `fk_collection_loan` FOREIGN KEY (`loan_id`) REFERENCES `Loan` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_collection_installment` FOREIGN KEY (`installment_id`) REFERENCES `RepaymentSchedule` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_collection_customer` FOREIGN KEY (`customer_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_collection_agent` FOREIGN KEY (`assigned_agent_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `CollectionActivity` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` INT UNSIGNED NOT NULL,
  `actor_id` INT UNSIGNED NOT NULL,
  `action_type` ENUM('CALL','SMS','FIELD_VISIT','NOTE','PROMISE','ESCALATION','RESOLUTION') NOT NULL,
  `note` TEXT NOT NULL,
  `promise_amount` DECIMAL(14,2) NULL,
  `promise_date` DATE NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_collection_activity_case_date` (`case_id`,`created_at`),
  KEY `idx_collection_activity_actor` (`actor_id`),
  CONSTRAINT `fk_collection_activity_case` FOREIGN KEY (`case_id`) REFERENCES `CollectionCase` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_collection_activity_actor` FOREIGN KEY (`actor_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) Seed an Owner account only if one does not already exist.
-- Password: Password@123 (change it after first login).
INSERT INTO `User` (`full_name`,`email`,`password_hash`,`role_id`,`is_active`,`email_verified_at`)
SELECT 'MicroFund Owner','owner@microfund.local','$2b$12$cV/Y/M6KZ4mzZl/rqMNcBuhqAvkTgVexZKDKqEXuKEF4NiCuLSChy',r.id,1,CURRENT_TIMESTAMP
FROM `Role` r
WHERE r.name='OWNER'
  AND NOT EXISTS (SELECT 1 FROM `User` u WHERE u.email='owner@microfund.local');

SET FOREIGN_KEY_CHECKS = 1;
SELECT 'MicroFund V2 -> V3 upgrade completed.' AS message;
