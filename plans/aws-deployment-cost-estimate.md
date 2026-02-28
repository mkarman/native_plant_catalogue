# AWS Deployment Cost Estimate — Fauquier Native Plant Catalogue

## Assumptions
- ~1,625 plants × up to 3 images = ~4,875 images max
- Average image size: ~200 KB (Wikimedia Commons thumbnails)
- **Total image store: ~1 GB** (generous estimate at full scrape)
- Low-to-moderate traffic: educational/community site, ~1,000–5,000 page views/month
- Neo4j graph data: ~50 MB (1,625 nodes + relationships)

---

## Option A: EC2 t3.medium (Keep Current Stack, Simplest)

| Service | Spec | Monthly Cost |
|---------|------|-------------|
| EC2 (backend + Neo4j) | t3.medium (2vCPU, 4GB RAM) | ~$30–35 |
| S3 + CloudFront (frontend + images) | 1 GB | ~$2 |
| Route 53 (DNS) | 1 hosted zone | ~$0.50 |
| ACM (SSL cert) | Free | $0 |
| EBS storage | 20 GB gp3 | ~$1.60 |
| **TOTAL** | | **~$34–39/month** |

---

## Option B: ECS Fargate + Neo4j AuraDB Free ⭐ RECOMMENDED

Fargate runs Docker containers without managing EC2 instances. Neo4j AuraDB Free is a managed cloud Neo4j that supports up to 200,000 nodes — more than enough for this project.

| Service | Spec | Monthly Cost |
|---------|------|-------------|
| ECS Fargate (FastAPI) | 0.5 vCPU, 1 GB RAM, always-on | ~$15–18 |
| Neo4j AuraDB Free | Up to 200K nodes, managed | **$0** |
| S3 + CloudFront (frontend + images) | 1 GB | ~$2 |
| Route 53 | DNS | ~$0.50 |
| ACM SSL | Free | $0 |
| **TOTAL (no ALB)** | | **~$18–21/month** |
| **TOTAL (with ALB)** | | **~$34–37/month** |

**AuraDB Free Tier Limits:**
- 200,000 nodes ✅ (we have ~1,625 plants + image nodes)
- 400,000 relationships ✅
- 1 database instance
- Community support only, no SLA

**Architecture:**
```
Browser
  ├── CloudFront → S3 (React frontend + plant images)
  └── Route 53 → ECS Fargate (FastAPI container)
                      └── Neo4j AuraDB (managed, free tier)
```

---

## Option C: ECS on EC2 (Managed Containers, Self-Hosted Neo4j)

ECS manages Docker containers on EC2 instances you provision — essentially your current Docker Compose setup but AWS-managed with rolling deployments and health checks.

| Service | Spec | Monthly Cost |
|---------|------|-------------|
| ECS EC2 cluster | t3.medium (1 instance) | ~$30 |
| EFS (persistent Neo4j storage) | 5 GB | ~$1.50 |
| S3 + CloudFront | Frontend + images | ~$2 |
| Route 53 | DNS | ~$0.50 |
| **TOTAL** | | **~$34/month** |

---

## Option D: ECS Fargate + Amazon Neptune (Fully Managed Graph DB)

| Service | Spec | Monthly Cost |
|---------|------|-------------|
| ECS Fargate (FastAPI) | 0.5 vCPU, 1 GB RAM | ~$15–18 |
| Neptune Serverless | 1–2.5 NCUs | ~$50–80 |
| S3 + CloudFront | Frontend + images | ~$2 |
| Route 53 | DNS | ~$0.50 |
| ALB | Load balancer | ~$16 |
| **TOTAL** | | **~$84–116/month** |

---

## Comparison Table

| Option | Monthly Cost | Neo4j | Managed? | Complexity |
|--------|-------------|-------|---------|-----------|
| A: EC2 t3.medium | ~$34–39 | Self-hosted | No | Low |
| **B: ECS Fargate + AuraDB Free** | **~$18–21** | **Managed** | **Yes** | **Medium** |
| C: ECS EC2 + self-hosted Neo4j | ~$34 | Self-hosted | Partial | Medium |
| D: ECS Fargate + Neptune | ~$84–116 | Managed | Yes | High |

---

## S3 Image Store Sizing

| Scenario | Images | Size | S3 Cost/mo |
|----------|--------|------|------------|
| Current (partial scrape) | ~325 images | ~65 MB | < $0.01 |
| Full scrape (3/plant) | ~4,875 images | ~975 MB | ~$0.02 |
| With thumbnails (2 sizes) | ~9,750 files | ~1.5 GB | ~$0.03 |

S3 storage is essentially **free** at this scale.

---

## Code Changes Needed for AWS Deployment

### 1. Neo4j AuraDB connection (Option B)
In [`backend/main.py`](../backend/main.py), change:
```python
NEO4J_URI = "bolt://neo4j:7687"
```
to:
```python
NEO4J_URI = "neo4j+s://xxxxxxxx.databases.neo4j.io"  # AuraDB URI
```

### 2. S3 image storage
In [`scraper.py`](../scraper.py), replace local file writes with `boto3` S3 uploads:
```python
import boto3
s3 = boto3.client('s3')
s3.upload_file(local_path, 'your-bucket', f'images/{filename}')
```

In [`backend/main.py`](../backend/main.py), change image URLs from:
```python
"/images/filename.jpg"
```
to:
```python
"https://cdn.yourdomain.com/images/filename.jpg"
```

### 3. ECS Task Definition
Replace [`docker-compose.yml`](../docker-compose.yml) with an ECS task definition JSON for the FastAPI container. The frontend moves to S3 static hosting.

---

## Deployment Steps (Option B: ECS Fargate + AuraDB Free)

1. Create Neo4j AuraDB Free account at https://neo4j.com/cloud/aura-free/
2. Get AuraDB connection URI and credentials
3. Build and push FastAPI Docker image to ECR (Elastic Container Registry)
4. Create ECS Fargate cluster and task definition
5. Build React frontend: `cd frontend && npm run build`
6. Upload `frontend/dist/` to S3 static website bucket
7. Upload `images/` to S3 image bucket
8. Create CloudFront distributions for both S3 buckets
9. Run `populate_neo4j.py` + `enrich_usda.py` against AuraDB
10. Configure Route 53 to point domain to CloudFront + ECS service
11. Request ACM certificate for HTTPS

---

## Migration: Neo4j → Neptune (if needed later)

| Task | Complexity | Notes |
|------|-----------|-------|
| openCypher queries | Minimal | Neptune supports Cypher natively |
| Connection string | Trivial | Swap `bolt://` for Neptune endpoint |
| IAM auth | Low | Replace password auth with boto3 token |
| VPC setup | Medium | Neptune must be in a VPC |
| Data migration | Low | Re-run populate + enrich scripts |

**Verdict:** Neptune is ~4–5× more expensive than AuraDB Free for this scale. Only consider Neptune if you need AWS-native HA, VPC isolation, or plan to use AWS graph analytics services.
