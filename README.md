# Finance Portal – End-to-End Data Pipeline

## Project Overview
This project demonstrates an end-to-end data pipeline:
Web Application → RDS (PostgreSQL) → S3 (CSV) → Snowflake → Dashboard

Users enter financial data through a web UI. The data is stored in RDS, exported to S3,
ingested into Snowflake, and visualized using Snowflake Snowsight dashboards.

---

## Architecture
User
→ EC2 (Node.js Web App)
→ RDS (PostgreSQL)
→ S3 (CSV files per universe_id)
→ Snowflake (RAW tables + Views)
→ Snowflake Dashboard

---

## EC2 Setup
- Ubuntu 22.04
- Open ports: 22, 80, 3000
- Install:
  sudo apt update
  sudo apt install -y nodejs npm git

---

## RDS Setup
Database: finance

Table:
CREATE TABLE oc_details (
  universe_id SERIAL PRIMARY KEY,
  pre_risk VARCHAR(100),
  on_risk VARCHAR(100),
  cusip VARCHAR(50),
  isin VARCHAR(50),
  created_at TIMESTAMP DEFAULT now()
);

Verify:
SELECT * FROM oc_details;

---

## IAM Role for EC2
Role: ec2-s3-access-role
Permissions:
- s3:PutObject
- s3:GetObject
- s3:ListBucket

---

## S3 Setup
Bucket: finance-data-ganraj

Structure:
<universe_id>/
  pre_risk.csv
  on_risk.csv
  cusip.csv
  isin.csv

Verify:
aws s3 ls s3://finance-data-ganraj/ --recursive

---

## Snowflake Setup
CREATE DATABASE FINANCE;
CREATE SCHEMA FINANCE.RAW;

Tables:
CREATE TABLE PRE_RISK (universe_id INT, pre_risk STRING);
CREATE TABLE ON_RISK (universe_id INT, on_risk STRING);
CREATE TABLE CUSIP (universe_id INT, cusip STRING);
CREATE TABLE ISIN (universe_id INT, isin STRING);

---

## Storage Integration
CREATE STORAGE INTEGRATION snowflake_s3_integration
TYPE = EXTERNAL_STAGE
STORAGE_PROVIDER = S3
ENABLED = TRUE
STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::<ACCOUNT_ID>:role/snowflake-s3-role'
STORAGE_ALLOWED_LOCATIONS = ('s3://finance-data-ganraj/');

---

## Stage
CREATE STAGE FINANCE.RAW.S3_STAGE
URL = 's3://finance-data-ganraj/'
STORAGE_INTEGRATION = snowflake_s3_integration;

---

## Load Data
COPY INTO FINANCE.RAW.PRE_RISK
FROM @FINANCE.RAW.S3_STAGE
PATTERN='.*pre_risk.csv'
FILE_FORMAT=(TYPE=CSV SKIP_HEADER=1);

(Same for ON_RISK, CUSIP, ISIN)

---

## Analytics View
CREATE OR REPLACE VIEW FINANCE.RAW.OC_DETAILS_VIEW AS
SELECT p.universe_id, p.pre_risk, o.on_risk, c.cusip, i.isin
FROM PRE_RISK p
LEFT JOIN ON_RISK o USING (universe_id)
LEFT JOIN CUSIP c USING (universe_id)
LEFT JOIN ISIN i USING (universe_id);

---

## Dashboard Queries
SELECT pre_risk, COUNT(*) FROM OC_DETAILS_VIEW GROUP BY pre_risk;
SELECT * FROM OC_DETAILS_VIEW ORDER BY universe_id DESC;

---

## Web UI – Visualize RDS Data
Button on home page redirects to /records
This page shows all RDS entries per universe_id.

---

## Demo Verification
RDS:
SELECT * FROM oc_details;

S3:
aws s3 ls s3://finance-data-ganraj/ --recursive

Snowflake:
SELECT * FROM FINANCE.RAW.OC_DETAILS_VIEW;

---

## Interview Summary
Transactional data is stored in PostgreSQL, staged in S3, ingested into Snowflake for analytics,
and visualized using dashboards, while the web app provides real-time access to RDS data.
