# Finance Portal – End-to-End Data Pipeline

## 1. Project Summary
Finance Portal is a demo application that shows how transactional data flows from a web application into an analytics platform.

**Flow:**
Web UI → RDS (PostgreSQL) → S3 (CSV) → Snowflake → Dashboard

This project is designed for **demo and interview presentation** purposes.

---

## 2. Architecture Overview
```
User
 │
 ▼
EC2 (Node.js Web App)
 │
 ▼
RDS – PostgreSQL (Transactional Data)
 │
 ▼
S3 – CSV files (per universe_id)
 │
 ▼
Snowflake – RAW Tables & Views
 │
 ▼
Snowflake Snowsight Dashboard
```

---

## 3. EC2 Configuration

### Instance
- OS: Ubuntu 22.04
- Type: t2.micro

### Security Group
- SSH (22) – My IP
- HTTP (80) – 0.0.0.0/0
- App (3000) – 0.0.0.0/0

### Install Packages
```bash
sudo apt update
sudo apt install -y nodejs npm git
```

---

## 4. RDS (PostgreSQL) Configuration

### Database
- DB Name: finance

### Table
```sql
CREATE TABLE oc_details (
  universe_id SERIAL PRIMARY KEY,
  pre_risk VARCHAR(100),
  on_risk VARCHAR(100),
  cusip VARCHAR(50),
  isin VARCHAR(50),
  created_at TIMESTAMP DEFAULT now()
);
```

### Verify
```sql
SELECT * FROM oc_details;
```

---

## 5. IAM Role for EC2 (S3 Access)

### Role
- Name: ec2-s3-access-role
- Trusted Entity: EC2

### Policy
```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
  "Resource": [
    "arn:aws:s3:::finance-data-ganraj",
    "arn:aws:s3:::finance-data-ganraj/*"
  ]
}
```

Attach this role to the EC2 instance.

---

## 6. S3 Configuration

### Bucket
- Name: finance-data-ganraj

### Folder Structure
```
<universe_id>/
 ├── pre_risk.csv
 ├── on_risk.csv
 ├── cusip.csv
 └── isin.csv
```

### Verify
```bash
aws s3 ls s3://finance-data-ganraj/ --recursive
```

---

## 7. Application Setup

### Run Application
```bash
git clone <repo-url>
cd finance-portal
npm install
node server.js
```

### URLs
- Data Entry: http://<EC2_IP>:3000
- RDS Visualization: http://<EC2_IP>:3000/records

---

## 8. Snowflake Configuration

### Database & Schema
```sql
CREATE DATABASE FINANCE;
CREATE SCHEMA FINANCE.RAW;
```

### Tables
```sql
CREATE TABLE PRE_RISK (universe_id INT, pre_risk STRING);
CREATE TABLE ON_RISK (universe_id INT, on_risk STRING);
CREATE TABLE CUSIP (universe_id INT, cusip STRING);
CREATE TABLE ISIN (universe_id INT, isin STRING);
```

---

## 9. Snowflake S3 Integration

```sql
CREATE STORAGE INTEGRATION snowflake_s3_integration
TYPE = EXTERNAL_STAGE
STORAGE_PROVIDER = S3
ENABLED = TRUE
STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::<ACCOUNT_ID>:role/snowflake-s3-role'
STORAGE_ALLOWED_LOCATIONS = ('s3://finance-data-ganraj/');
```

---

## 10. Stage & Load

### Stage
```sql
CREATE STAGE FINANCE.RAW.S3_STAGE
URL = 's3://finance-data-ganraj/'
STORAGE_INTEGRATION = snowflake_s3_integration;
```

### Load Data
```sql
COPY INTO FINANCE.RAW.PRE_RISK
FROM @FINANCE.RAW.S3_STAGE
PATTERN='.*pre_risk.csv'
FILE_FORMAT=(TYPE=CSV SKIP_HEADER=1);
```

(Repeat for ON_RISK, CUSIP, ISIN)

---

## 11. Analytics View

```sql
CREATE OR REPLACE VIEW FINANCE.RAW.OC_DETAILS_VIEW AS
SELECT
  p.universe_id,
  p.pre_risk,
  o.on_risk,
  c.cusip,
  i.isin
FROM PRE_RISK p
LEFT JOIN ON_RISK o USING (universe_id)
LEFT JOIN CUSIP c USING (universe_id)
LEFT JOIN ISIN i USING (universe_id);
```

---

## 12. Dashboard Queries

```sql
SELECT pre_risk, COUNT(*) 
FROM OC_DETAILS_VIEW 
GROUP BY pre_risk;
```

```sql
SELECT * 
FROM OC_DETAILS_VIEW 
ORDER BY universe_id DESC;
```

---

## 13. Web Visualization (RDS Data)

A **Visualize** button on the home page opens `/records`, which displays all RDS records (one row per universe_id).

---

## 14. Demo Verification Checklist

**RDS**
```sql
SELECT * FROM oc_details;
```

**S3**
```bash
aws s3 ls s3://finance-data-ganraj/ --recursive
```

**Snowflake**
```sql
SELECT * FROM FINANCE.RAW.OC_DETAILS_VIEW;
```

---

## 15. Interview One-Liner
Transactional data is stored in PostgreSQL, staged in S3, ingested into Snowflake for analytics, and visualized using Snowflake dashboards, while the web UI provides real-time access to RDS data.
