-- =====================================================================
-- MicroFund Smart Microfinance System V3 - Five Role Edition
-- Complete MySQL / MariaDB schema and starter data
-- Import this file in phpMyAdmin. It creates the database automatically.
-- WARNING: Existing MicroFund tables are dropped before they are rebuilt.
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `microfund_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE `microfund_db`;

DROP TABLE IF EXISTS `ReportTemplate`;
DROP TABLE IF EXISTS `EmailToken`;
DROP TABLE IF EXISTS `AuditLog`;
DROP TABLE IF EXISTS `Notification`;
DROP TABLE IF EXISTS `PaymentSubmissionMessage`;
DROP TABLE IF EXISTS `PaymentSubmissionHistory`;
DROP TABLE IF EXISTS `Payment`;
DROP TABLE IF EXISTS `CollectionActivity`;
DROP TABLE IF EXISTS `CollectionCase`;
DROP TABLE IF EXISTS `OnlinePaymentSubmission`;
DROP TABLE IF EXISTS `RepaymentSchedule`;
DROP TABLE IF EXISTS `Loan`;
DROP TABLE IF EXISTS `CreditAssessment`;
DROP TABLE IF EXISTS `DocumentReview`;
DROP TABLE IF EXISTS `FieldOfficerDocument`;
DROP TABLE IF EXISTS `VerificationReport`;
DROP TABLE IF EXISTS `FieldVisit`;
DROP TABLE IF EXISTS `LoanApplication`;
DROP TABLE IF EXISTS `CustomerDocument`;
DROP TABLE IF EXISTS `LoanType`;
DROP TABLE IF EXISTS `AgentArea`;
DROP TABLE IF EXISTS `CashierProfile`;
DROP TABLE IF EXISTS `CustomerProfile`;
DROP TABLE IF EXISTS `Area`;
DROP TABLE IF EXISTS `User`;
DROP TABLE IF EXISTS `Role`;

CREATE TABLE `Role` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` ENUM('OWNER','MANAGER','AGENT','CASHIER','CUSTOMER') NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_role_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `User` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(160) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role_id` INT UNSIGNED NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `email_verified_at` DATETIME NULL,
  `last_login_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_user_email` (`email`),
  KEY `idx_user_role` (`role_id`), KEY `idx_user_active` (`is_active`),
  CONSTRAINT `fk_user_role` FOREIGN KEY (`role_id`) REFERENCES `Role` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Area` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `district` VARCHAR(100) NOT NULL,
  `province` VARCHAR(100) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_area_name_district` (`name`,`district`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `CustomerProfile` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `nic` VARCHAR(20) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `address_line1` VARCHAR(255) NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `area_id` INT UNSIGNED NOT NULL,
  `occupation` VARCHAR(120) NULL,
  `monthly_income` DECIMAL(14,2) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_customer_user` (`user_id`), UNIQUE KEY `uq_customer_nic` (`nic`),
  KEY `idx_customer_area` (`area_id`),
  CONSTRAINT `fk_customer_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_customer_area` FOREIGN KEY (`area_id`) REFERENCES `Area` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `CashierProfile` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `branch_name` VARCHAR(120) NULL,
  `is_available` TINYINT(1) NOT NULL DEFAULT 1,
  `max_pending_reviews` INT UNSIGNED NOT NULL DEFAULT 50,
  `last_assigned_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_cashier_user` (`user_id`),
  CONSTRAINT `fk_cashier_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `AgentArea` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `area_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_agent_area` (`user_id`,`area_id`), KEY `idx_agent_area_area` (`area_id`),
  CONSTRAINT `fk_agent_area_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_agent_area_area` FOREIGN KEY (`area_id`) REFERENCES `Area` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `LoanType` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `min_amount` DECIMAL(14,2) NOT NULL,
  `max_amount` DECIMAL(14,2) NOT NULL,
  `annual_interest_rate` DECIMAL(6,2) NOT NULL,
  `duration_months` INT UNSIGNED NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_loan_type_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `CustomerDocument` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `document_type` ENUM('NIC_FRONT','NIC_BACK','RESIDENCE_PROOF','INCOME_PROOF','OTHER') NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `size_bytes` INT UNSIGNED NOT NULL,
  `file_hash` VARCHAR(64) NULL,
  `status` ENUM('PENDING','ACCEPTED','REJECTED','REUPLOAD_REQUIRED') NOT NULL DEFAULT 'PENDING',
  `review_note` TEXT NULL,
  `reviewed_by` INT UNSIGNED NULL,
  `reviewed_at` DATETIME NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `is_current` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_customer_document_current` (`user_id`,`document_type`,`is_current`), KEY `idx_customer_document_status` (`status`),
  CONSTRAINT `fk_customer_document_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_customer_document_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `LoanApplication` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_no` VARCHAR(30) NOT NULL,
  `customer_id` INT UNSIGNED NOT NULL,
  `loan_type_id` INT UNSIGNED NOT NULL,
  `area_id` INT UNSIGNED NOT NULL,
  `requested_duration_months` INT UNSIGNED NULL,
  `requested_amount` DECIMAL(14,2) NOT NULL,
  `purpose` TEXT NOT NULL,
  `monthly_income` DECIMAL(14,2) NOT NULL,
  `status` ENUM('DRAFT','SUBMITTED','ASSIGNED','VISIT_SCHEDULED','VERIFICATION_COMPLETED','DOCUMENT_REVIEW','CREDIT_REVIEW','RETURNED','APPROVED','REJECTED') NOT NULL DEFAULT 'SUBMITTED',
  `submitted_at` DATETIME NULL,
  `assigned_agent_id` INT UNSIGNED NULL,
  `admin_note` TEXT NULL,
  `rejection_reason` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_application_no` (`application_no`),
  KEY `idx_application_customer` (`customer_id`), KEY `idx_application_type` (`loan_type_id`), KEY `idx_application_area` (`area_id`), KEY `idx_application_agent` (`assigned_agent_id`), KEY `idx_application_status` (`status`),
  CONSTRAINT `fk_application_customer` FOREIGN KEY (`customer_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_application_type` FOREIGN KEY (`loan_type_id`) REFERENCES `LoanType` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_application_area` FOREIGN KEY (`area_id`) REFERENCES `Area` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_application_agent` FOREIGN KEY (`assigned_agent_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `FieldVisit` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` INT UNSIGNED NOT NULL,
  `agent_id` INT UNSIGNED NOT NULL,
  `scheduled_at` DATETIME NOT NULL,
  `status` ENUM('SCHEDULED','IN_PROGRESS','COMPLETED','RESCHEDULED','CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  `priority` ENUM('LOW','NORMAL','HIGH') NOT NULL DEFAULT 'NORMAL',
  `admin_instructions` TEXT NULL,
  `completed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_visit_agent_schedule` (`agent_id`,`scheduled_at`), KEY `idx_visit_application` (`application_id`),
  CONSTRAINT `fk_visit_application` FOREIGN KEY (`application_id`) REFERENCES `LoanApplication` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_visit_agent` FOREIGN KEY (`agent_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `VerificationReport` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `visit_id` INT UNSIGNED NOT NULL,
  `residence_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `income_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `business_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `documents_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `guarantor_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `recommendation` ENUM('APPROVE','REJECT','REVIEW_AGAIN') NOT NULL,
  `comments` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_verification_visit` (`visit_id`),
  CONSTRAINT `fk_verification_visit` FOREIGN KEY (`visit_id`) REFERENCES `FieldVisit` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `FieldOfficerDocument` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `visit_id` INT UNSIGNED NOT NULL,
  `agent_id` INT UNSIGNED NOT NULL,
  `document_type` ENUM('RESIDENCE_PHOTO','BUSINESS_PHOTO','INCOME_EVIDENCE','SIGNED_FORM','VISIT_REPORT','OTHER') NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `file_path` VARCHAR(500) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `size_bytes` INT UNSIGNED NOT NULL,
  `file_hash` VARCHAR(64) NULL,
  `status` ENUM('PENDING','ACCEPTED','REJECTED','REUPLOAD_REQUIRED') NOT NULL DEFAULT 'PENDING',
  `review_note` TEXT NULL,
  `reviewed_by` INT UNSIGNED NULL,
  `reviewed_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_field_doc_visit` (`visit_id`), KEY `idx_field_doc_agent` (`agent_id`), KEY `idx_field_doc_status` (`status`),
  CONSTRAINT `fk_field_doc_visit` FOREIGN KEY (`visit_id`) REFERENCES `FieldVisit` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_field_doc_agent` FOREIGN KEY (`agent_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_field_doc_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `DocumentReview` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `document_source` ENUM('CUSTOMER','FIELD') NOT NULL,
  `document_id` INT UNSIGNED NOT NULL,
  `reviewer_id` INT UNSIGNED NOT NULL,
  `decision` ENUM('ACCEPTED','REJECTED','REUPLOAD_REQUIRED') NOT NULL,
  `note` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_document_review_document` (`document_source`,`document_id`), KEY `idx_document_review_reviewer` (`reviewer_id`),
  CONSTRAINT `fk_document_review_reviewer` FOREIGN KEY (`reviewer_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `CreditAssessment` (
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
  PRIMARY KEY (`id`), UNIQUE KEY `uq_credit_application` (`application_id`),
  KEY `idx_credit_assessor` (`assessed_by`), KEY `idx_credit_risk` (`risk_level`),
  CONSTRAINT `fk_credit_application` FOREIGN KEY (`application_id`) REFERENCES `LoanApplication` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_credit_assessor` FOREIGN KEY (`assessed_by`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Loan` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `loan_no` VARCHAR(30) NOT NULL,
  `application_id` INT UNSIGNED NOT NULL,
  `customer_id` INT UNSIGNED NOT NULL,
  `principal` DECIMAL(14,2) NOT NULL,
  `interest_rate` DECIMAL(6,2) NOT NULL,
  `duration_months` INT UNSIGNED NOT NULL,
  `total_interest` DECIMAL(14,2) NOT NULL,
  `total_payable` DECIMAL(14,2) NOT NULL,
  `monthly_installment` DECIMAL(14,2) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `remaining_balance` DECIMAL(14,2) NOT NULL,
  `status` ENUM('ACTIVE','COMPLETED','DEFAULTED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_loan_no` (`loan_no`), UNIQUE KEY `uq_loan_application` (`application_id`), KEY `idx_loan_customer` (`customer_id`), KEY `idx_loan_status` (`status`),
  CONSTRAINT `fk_loan_application` FOREIGN KEY (`application_id`) REFERENCES `LoanApplication` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_loan_customer` FOREIGN KEY (`customer_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `RepaymentSchedule` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `loan_id` INT UNSIGNED NOT NULL,
  `installment_no` INT UNSIGNED NOT NULL,
  `due_date` DATE NOT NULL,
  `amount_due` DECIMAL(14,2) NOT NULL,
  `amount_paid` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('PENDING','PARTIAL','PAID','OVERDUE') NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_schedule_installment` (`loan_id`,`installment_no`), KEY `idx_schedule_due_status` (`due_date`,`status`),
  CONSTRAINT `fk_schedule_loan` FOREIGN KEY (`loan_id`) REFERENCES `Loan` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `CollectionCase` (
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
  PRIMARY KEY (`id`), UNIQUE KEY `uq_collection_case_no` (`case_no`), UNIQUE KEY `uq_collection_installment` (`installment_id`),
  KEY `idx_collection_agent_status` (`assigned_agent_id`,`status`), KEY `idx_collection_status_priority` (`status`,`priority`), KEY `idx_collection_customer` (`customer_id`),
  CONSTRAINT `fk_collection_loan` FOREIGN KEY (`loan_id`) REFERENCES `Loan` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_collection_installment` FOREIGN KEY (`installment_id`) REFERENCES `RepaymentSchedule` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_collection_customer` FOREIGN KEY (`customer_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_collection_agent` FOREIGN KEY (`assigned_agent_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `CollectionActivity` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` INT UNSIGNED NOT NULL,
  `actor_id` INT UNSIGNED NOT NULL,
  `action_type` ENUM('CALL','SMS','FIELD_VISIT','NOTE','PROMISE','ESCALATION','RESOLUTION') NOT NULL,
  `note` TEXT NOT NULL,
  `promise_amount` DECIMAL(14,2) NULL,
  `promise_date` DATE NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_collection_activity_case_date` (`case_id`,`created_at`), KEY `idx_collection_activity_actor` (`actor_id`),
  CONSTRAINT `fk_collection_activity_case` FOREIGN KEY (`case_id`) REFERENCES `CollectionCase` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_collection_activity_actor` FOREIGN KEY (`actor_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `OnlinePaymentSubmission` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `submission_no` VARCHAR(30) NOT NULL,
  `customer_id` INT UNSIGNED NOT NULL,
  `loan_id` INT UNSIGNED NOT NULL,
  `installment_id` INT UNSIGNED NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `bank_name` VARCHAR(120) NOT NULL,
  `reference_no` VARCHAR(120) NOT NULL,
  `slip_path` VARCHAR(500) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `size_bytes` INT UNSIGNED NOT NULL,
  `file_hash` VARCHAR(64) NULL,
  `customer_note` TEXT NULL,
  `status` ENUM('SUBMITTED','ASSIGNED','UNDER_REVIEW','NEEDS_CLARIFICATION','ACCEPTED','REJECTED') NOT NULL DEFAULT 'SUBMITTED',
  `assigned_cashier_id` INT UNSIGNED NULL,
  `cashier_note` TEXT NULL,
  `duplicate_warning` TINYINT(1) NOT NULL DEFAULT 0,
  `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` DATETIME NULL,
  `review_deadline_at` DATETIME NULL,
  `resubmission_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_submission_no` (`submission_no`), KEY `idx_submission_customer` (`customer_id`), KEY `idx_submission_cashier_status` (`assigned_cashier_id`,`status`), KEY `idx_submission_reference` (`reference_no`), KEY `idx_submission_date` (`submitted_at`),
  CONSTRAINT `fk_submission_customer` FOREIGN KEY (`customer_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_submission_loan` FOREIGN KEY (`loan_id`) REFERENCES `Loan` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_submission_installment` FOREIGN KEY (`installment_id`) REFERENCES `RepaymentSchedule` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_submission_cashier` FOREIGN KEY (`assigned_cashier_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Payment` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `receipt_no` VARCHAR(30) NOT NULL,
  `loan_id` INT UNSIGNED NOT NULL,
  `installment_id` INT UNSIGNED NULL,
  `customer_id` INT UNSIGNED NOT NULL,
  `recorded_by` INT UNSIGNED NOT NULL,
  `source_submission_id` INT UNSIGNED NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `method` ENUM('CASH','BANK_TRANSFER','CARD','OTHER') NOT NULL DEFAULT 'CASH',
  `paid_at` DATETIME NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_payment_receipt` (`receipt_no`), UNIQUE KEY `uq_payment_source_submission` (`source_submission_id`), KEY `idx_payment_date` (`paid_at`), KEY `idx_payment_loan` (`loan_id`),
  CONSTRAINT `fk_payment_loan` FOREIGN KEY (`loan_id`) REFERENCES `Loan` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_payment_installment` FOREIGN KEY (`installment_id`) REFERENCES `RepaymentSchedule` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_payment_customer` FOREIGN KEY (`customer_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_payment_recorder` FOREIGN KEY (`recorded_by`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_payment_submission` FOREIGN KEY (`source_submission_id`) REFERENCES `OnlinePaymentSubmission` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `PaymentSubmissionHistory` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `submission_id` INT UNSIGNED NOT NULL,
  `actor_id` INT UNSIGNED NULL,
  `from_status` VARCHAR(40) NULL,
  `to_status` VARCHAR(40) NOT NULL,
  `note` TEXT NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_submission_history` (`submission_id`),
  CONSTRAINT `fk_history_submission` FOREIGN KEY (`submission_id`) REFERENCES `OnlinePaymentSubmission` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_history_actor` FOREIGN KEY (`actor_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `PaymentSubmissionMessage` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `submission_id` INT UNSIGNED NOT NULL,
  `sender_id` INT UNSIGNED NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_submission_message` (`submission_id`,`created_at`),
  CONSTRAINT `fk_message_submission` FOREIGN KEY (`submission_id`) REFERENCES `OnlinePaymentSubmission` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_message_sender` FOREIGN KEY (`sender_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Notification` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(160) NOT NULL,
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'INFO',
  `link` VARCHAR(255) NULL,
  `read_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_notification_user_read` (`user_id`,`read_at`),
  CONSTRAINT `fk_notification_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `AuditLog` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(80) NULL,
  `entity_id` VARCHAR(80) NULL,
  `metadata` JSON NULL,
  `ip_address` VARCHAR(64) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_audit_user` (`user_id`), KEY `idx_audit_action` (`action`), KEY `idx_audit_date` (`created_at`),
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `EmailToken` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` INT UNSIGNED NOT NULL,
  `type` ENUM('VERIFY_EMAIL','RESET_PASSWORD') NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_email_token_hash` (`token_hash`), KEY `idx_email_token_user_type` (`user_id`,`type`), KEY `idx_email_token_expiry` (`expires_at`),
  CONSTRAINT `fk_email_token_user` FOREIGN KEY (`user_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ReportTemplate` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `owner_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `report_type` VARCHAR(60) NOT NULL,
  `columns` JSON NOT NULL,
  `filters` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_report_template_owner_type` (`owner_id`,`report_type`),
  CONSTRAINT `fk_report_template_owner` FOREIGN KEY (`owner_id`) REFERENCES `User` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Starter roles, areas, staff accounts and loan products.
INSERT INTO `Role` (`id`,`name`) VALUES
  (1,'OWNER'),(2,'MANAGER'),(3,'AGENT'),(4,'CASHIER'),(5,'CUSTOMER');
INSERT INTO `Area` (`id`,`name`,`district`,`province`,`is_active`) VALUES
  (1,'Peradeniya','Kandy','Central',1),(2,'Katugastota','Kandy','Central',1),(3,'Gampola','Kandy','Central',1),
  (4,'Maharagama','Colombo','Western',1),(5,'Nugegoda','Colombo','Western',1);

-- Password for all seeded staff users: Password@123
INSERT INTO `User` (`id`,`full_name`,`email`,`password_hash`,`role_id`,`is_active`,`email_verified_at`) VALUES
  (1,'MicroFund Owner','owner@microfund.local','$2b$12$cV/Y/M6KZ4mzZl/rqMNcBuhqAvkTgVexZKDKqEXuKEF4NiCuLSChy',1,1,CURRENT_TIMESTAMP),
  (2,'Operations Manager','manager@microfund.local','$2b$12$cV/Y/M6KZ4mzZl/rqMNcBuhqAvkTgVexZKDKqEXuKEF4NiCuLSChy',2,1,CURRENT_TIMESTAMP),
  (3,'Main Cashier','cashier@microfund.local','$2b$12$cV/Y/M6KZ4mzZl/rqMNcBuhqAvkTgVexZKDKqEXuKEF4NiCuLSChy',4,1,CURRENT_TIMESTAMP),
  (4,'Kandy Cashier','cashier2@microfund.local','$2b$12$cV/Y/M6KZ4mzZl/rqMNcBuhqAvkTgVexZKDKqEXuKEF4NiCuLSChy',4,1,CURRENT_TIMESTAMP),
  (5,'Kasun Agent','agent@microfund.local','$2b$12$cV/Y/M6KZ4mzZl/rqMNcBuhqAvkTgVexZKDKqEXuKEF4NiCuLSChy',3,1,CURRENT_TIMESTAMP);
INSERT INTO `CashierProfile` (`user_id`,`branch_name`,`is_available`,`max_pending_reviews`) VALUES
  (3,'Colombo Main Branch',1,50),(4,'Kandy Branch',1,50);
INSERT INTO `AgentArea` (`user_id`,`area_id`) VALUES (5,1),(5,2),(5,3);
INSERT INTO `LoanType` (`id`,`name`,`description`,`min_amount`,`max_amount`,`annual_interest_rate`,`duration_months`,`is_active`) VALUES
  (1,'Small Business Loan','Working capital for micro and small businesses.',25000,500000,12,12,1),
  (2,'Agriculture Loan','Seasonal and equipment finance for agriculture.',20000,300000,10,10,1),
  (3,'Education Support Loan','Education and professional training expenses.',15000,250000,8,12,1);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'MicroFund database imported successfully.' AS message;
SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='microfund_db';
SELECT `id`,`full_name`,`email`,`role_id`,`is_active` FROM `User` ORDER BY `id`;
