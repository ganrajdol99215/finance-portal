# Finance Portal – Web → RDS → S3 → Snowflake Pipeline (Demo Project)

## 1) Overview
This project demonstrates an end-to-end data pipeline where data entered in a web application is:

**Web UI (EC2)** → **RDS (PostgreSQL)** → **S3 (CSV files)** → **Snowflake (Analytics)** → **Dashboard**

### Data Fields
- universe_id (auto-generated)
- pre_risk
- on_risk
- cusip
- isin

---

## 2) Architecture
```
User Browser
   |
   v
EC2 (Node.js Web App)
   |
   v
RDS PostgreSQL (Transactional DB)
   |
   v
S3 Bucket (CSV files per universe_id)
   |
   v
Snowflake (RAW Tables + View)
   |
   v
Snowsight Dashboard
```

---

## 3) EC2 Setup (Web Server)

### 3.1 Create EC2
- OS: Ubuntu 22.04
- Instance type: t2.micro

### 3.2 Security Group Rules
Inbound rules:
- SSH (22) → My IP
- Custom TCP (3000) → 0.0.0.0/0
- HTTP (80) → 0.0.0.0/0  ✅ (for Nginx)
- HTTPS (443) → 0.0.0.0/0 ✅ (optional for SSL)

### 3.3 Connect to EC2
```bash
ssh -i key.pem ubuntu@<EC2_PUBLIC_IP>
```

### 3.4 Install required packages
```bash
sudo apt update -y
sudo apt install -y git nodejs npm postgresql-client
node -v
npm -v
psql --version
```

---

## 4) Clone Project and Run
```bash
cd ~
git clone https://github.com/<your-github>/finance-portal.git
cd finance-portal
npm install
node server.js
```

App URL:
- http://<EC2_PUBLIC_IP>:3000

---

## 5) Run App in Background (PM2)
```bash
sudo npm install -g pm2
pm2 -v

cd ~/finance-portal
pm2 start server.js --name finance-portal
pm2 status

pm2 save
pm2 startup
```

Copy the command shown by `pm2 startup` and run it, then:
```bash
pm2 save
```

---

## 6) RDS PostgreSQL Setup

### 6.1 Create RDS PostgreSQL
- Engine: PostgreSQL
- DB name: finance
- Username: ganraj
- Allow inbound 5432 from EC2

### 6.2 Connect to RDS from EC2
```bash
psql -h <RDS_ENDPOINT> -U ganraj -d postgres
```

Create DB:
```sql
CREATE DATABASE finance;
```

Connect:
```sql
\c finance
```

Create table:
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

Verify:
```sql
SELECT * FROM oc_details;
```

---

## 7) S3 Setup

### 7.1 Create S3 Bucket
- finance-data-ganraj

### 7.2 Folder Structure
```
<universe_id>/
  pre_risk.csv
  on_risk.csv
  cusip.csv
  isin.csv
```

Verify:
```bash
aws s3 ls s3://finance-data-ganraj/ --recursive
```

---

## 8) IAM Role for EC2 to Access S3

Role:
- ec2-s3-access-role

Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::finance-data-ganraj"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": ["arn:aws:s3:::finance-data-ganraj/*"]
    }
  ]
}
```

Attach role to EC2 instance.

Verify:
```bash
aws s3 ls
aws s3 cp /etc/hosts s3://finance-data-ganraj/test.txt
```

---

## 9) Snowflake Setup

### 9.1 Database & Schema
```sql
USE ROLE ACCOUNTADMIN;

CREATE DATABASE IF NOT EXISTS FINANCE;
CREATE SCHEMA IF NOT EXISTS FINANCE.RAW;

USE DATABASE FINANCE;
USE SCHEMA RAW;
```

### 9.2 Create RAW tables
```sql
CREATE OR REPLACE TABLE PRE_RISK (universe_id INT, pre_risk STRING);
CREATE OR REPLACE TABLE ON_RISK  (universe_id INT, on_risk STRING);
CREATE OR REPLACE TABLE CUSIP    (universe_id INT, cusip STRING);
CREATE OR REPLACE TABLE ISIN     (universe_id INT, isin STRING);
```

---

## 10) Snowflake S3 Integration

### 10.1 Create AWS role
Role:
- snowflake-s3-role

Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::finance-data-ganraj"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::finance-data-ganraj/*"]
    }
  ]
}
```

### 10.2 Storage integration
```sql
CREATE OR REPLACE STORAGE INTEGRATION snowflake_s3_integration
TYPE = EXTERNAL_STAGE
STORAGE_PROVIDER = S3
ENABLED = TRUE
STORAGE_AWS_ROLE_ARN = 'arn:aws:iam::<ACCOUNT_ID>:role/snowflake-s3-role'
STORAGE_ALLOWED_LOCATIONS = ('s3://finance-data-ganraj/');
```

Get values:
```sql
DESC INTEGRATION snowflake_s3_integration;
```

Update AWS role trust policy using:
- STORAGE_AWS_EXTERNAL_ID
- STORAGE_AWS_IAM_USER_ARN

---

## 11) Stage + Copy

Create stage:
```sql
CREATE OR REPLACE STAGE FINANCE.RAW.S3_STAGE
URL = 's3://finance-data-ganraj/'
STORAGE_INTEGRATION = snowflake_s3_integration;
```

Verify:
```sql
LIST @FINANCE.RAW.S3_STAGE;
```

Load:
```sql
COPY INTO FINANCE.RAW.PRE_RISK
FROM @FINANCE.RAW.S3_STAGE
PATTERN='.*pre_risk.csv'
FILE_FORMAT=(TYPE=CSV SKIP_HEADER=1);
```

Repeat for ON_RISK / CUSIP / ISIN.

---

## 12) Create Dashboard View
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

Test:
```sql
SELECT * FROM FINANCE.RAW.OC_DETAILS_VIEW ORDER BY universe_id DESC;
```

---

## 13) Snowsight Dashboard Queries

Count by Pre Risk:
```sql
SELECT pre_risk, COUNT(*) AS total
FROM FINANCE.RAW.OC_DETAILS_VIEW
GROUP BY pre_risk;
```

Latest 10:
```sql
SELECT *
FROM FINANCE.RAW.OC_DETAILS_VIEW
ORDER BY universe_id DESC
LIMIT 10;
```

---

## 14) Demo Verification Checklist

RDS:
```sql
SELECT * FROM oc_details ORDER BY universe_id DESC;
```

S3:
```bash
aws s3 ls s3://finance-data-ganraj/ --recursive
```

Snowflake:
```sql
LIST @FINANCE.RAW.S3_STAGE;
SELECT * FROM FINANCE.RAW.OC_DETAILS_VIEW ORDER BY universe_id DESC;
```

---

## 15) Interview Summary
Transactional data is stored in PostgreSQL (RDS) and synchronized to S3, then ingested into Snowflake for analytics and visualized through dashboards.

---

## 16) Nginx Reverse Proxy (Hide port :3000)

### Why Nginx?
Currently the app runs on:
- http://<EC2_PUBLIC_IP>:3000

After Nginx reverse proxy setup:
- http://<EC2_PUBLIC_IP> ✅ (no port)
- http://yourdomain.com ✅

---

### 16.1 Install Nginx
```bash
sudo apt update -y
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx
```

---

### 16.2 Create Nginx configuration
Create file:
```bash
sudo nano /etc/nginx/sites-available/finance-portal
```

Paste below config:
```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### 16.3 Enable site and reload Nginx
```bash
sudo ln -s /etc/nginx/sites-available/finance-portal /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

---

### 16.4 Verify
Now open:
- http://<EC2_PUBLIC_IP>

---

### 16.5 PM2 reminder
Node.js should run in background using PM2:
```bash
pm2 status
pm2 restart finance-portal
pm2 save
```

---

## 17) (Optional) Connect Domain

1. Go to domain DNS settings
2. Create **A Record**:
   - Name: @ or www
   - Value: <EC2_PUBLIC_IP>

Update Nginx config:
```bash
sudo nano /etc/nginx/sites-available/finance-portal
```

Change:
```nginx
server_name yourdomain.com www.yourdomain.com;
```

Reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 18) (Optional) Enable HTTPS (SSL)
Install certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

Run SSL:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
