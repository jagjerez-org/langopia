# Langopia K3s Deployment

## 🚀 Deployment Overview

This deployment sets up the complete Langopia platform on K3s with the following components:

### Architecture
- **Web App**: Next.js application with TypeORM + PostgreSQL + LiveKit + NextAuth
- **PostgreSQL 16**: Database with persistent storage
- **Redis 7**: Caching and session storage
- **LiveKit Server**: Real-time communication (WebRTC)
- **MinIO**: S3-compatible object storage for recordings
- **LiveKit Egress**: Recording service that saves to MinIO

### Deployment Structure

```
k8s/
├── 01-namespace.yaml      # langopia namespace
├── 02-secrets.yaml        # Database credentials, API keys, etc.
├── 03-configmap.yaml      # LiveKit configuration
├── 04-pvc.yaml           # Persistent storage for PostgreSQL, Redis, MinIO
├── 05-postgres.yaml      # PostgreSQL StatefulSet + Service
├── 06-redis.yaml         # Redis Deployment + Service
├── 07-minio.yaml         # MinIO StatefulSet + Service + Init Job
├── 08-livekit.yaml       # LiveKit Deployment + Service (hostNetwork for UDP)
├── 09-egress.yaml        # LiveKit Egress Deployment
├── 10-web.yaml           # Next.js Web App Deployment + Service
└── 11-ingress.yaml       # Ingress for external access
```

## 🛠️ Quick Deployment

### Prerequisites
- K3s cluster running on 192.168.0.17
- Docker image built and saved to `/tmp/langopia-web.tar`
- Root/sudo access to K3s cluster

### Deploy Everything
```bash
cd /tmp/langopia
./deploy.sh
```

### Check Status
```bash
cd /tmp/langopia
./status.sh
```

## 🔧 Manual Deployment Steps

### 1. Build and Import Docker Image
```bash
cd /tmp/langopia
docker build -f apps/web/Dockerfile -t langopia-web:latest .
docker save langopia-web:latest -o /tmp/langopia-web.tar
sudo k3s ctr images import /tmp/langopia-web.tar
```

### 2. Deploy Kubernetes Manifests
```bash
cd /tmp/langopia/k8s
sudo k3s kubectl apply -f 01-namespace.yaml
sudo k3s kubectl apply -f 02-secrets.yaml
sudo k3s kubectl apply -f 03-configmap.yaml
sudo k3s kubectl apply -f 04-pvc.yaml
sudo k3s kubectl apply -f 05-postgres.yaml
sudo k3s kubectl apply -f 06-redis.yaml
sudo k3s kubectl apply -f 07-minio.yaml
sudo k3s kubectl apply -f 08-livekit.yaml
sudo k3s kubectl apply -f 09-egress.yaml
sudo k3s kubectl apply -f 10-web.yaml
sudo k3s kubectl apply -f 11-ingress.yaml
```

### 3. Wait for Deployment
```bash
sudo k3s kubectl wait --for=condition=Ready pod -l app=postgres -n langopia --timeout=300s
sudo k3s kubectl wait --for=condition=Ready pod -l app=web -n langopia --timeout=600s
```

## 🌍 Access URLs

- **Web Application**: http://192.168.0.17
- **MinIO Console**: http://192.168.0.17:9001
  - Username: `langopia`
  - Password: `langopia123`
- **LiveKit WebSocket**: ws://192.168.0.17:7880

## 🐛 Troubleshooting

### Check Pod Status
```bash
sudo k3s kubectl get pods -n langopia
sudo k3s kubectl describe pod <pod-name> -n langopia
sudo k3s kubectl logs <pod-name> -n langopia
```

### Check Services
```bash
sudo k3s kubectl get svc -n langopia
sudo k3s kubectl get ingress -n langopia
```

### Database Issues
```bash
# Connect to PostgreSQL pod
sudo k3s kubectl exec -it <postgres-pod> -n langopia -- psql -U langopia -d langopia

# Check database migrations
sudo k3s kubectl logs deployment/web -n langopia | grep migration
```

### LiveKit Issues
```bash
# Check LiveKit logs
sudo k3s kubectl logs deployment/livekit -n langopia

# Test LiveKit connectivity
curl http://192.168.0.17:7880
```

## 🔐 Environment Variables

The following environment variables are configured via secrets:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string  
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`: LiveKit authentication
- `NEXTAUTH_SECRET`: NextAuth.js secret
- `S3_*`: MinIO/S3 configuration for file storage

## 🚦 Health Checks

The web application includes readiness and liveness probes:
- **Readiness**: HTTP GET on port 3000 after 30s
- **Liveness**: HTTP GET on port 3000 after 60s

## 📊 Resource Requirements

### Minimum Resources
- **PostgreSQL**: 256Mi RAM, 250m CPU
- **Redis**: 128Mi RAM, 100m CPU
- **MinIO**: 256Mi RAM, 250m CPU
- **LiveKit**: 256Mi RAM, 250m CPU
- **Web App**: 512Mi RAM, 250m CPU
- **Total**: ~1.4Gi RAM, 1.05 CPU cores

### Storage
- **PostgreSQL**: 10Gi persistent storage
- **Redis**: 1Gi persistent storage
- **MinIO**: 50Gi persistent storage

## ⚠️ Important Notes

1. **LiveKit UDP Ports**: LiveKit uses `hostNetwork: true` to expose UDP ports 7882-7892 for WebRTC
2. **Database Migrations**: Automatically run on web app startup via `startup.sh`
3. **MinIO Bucket**: Automatically created by the `minio-init` Job
4. **Security**: All services are internal except for the web app (via Ingress)

## 🔄 Scaling

To scale the web application:
```bash
sudo k3s kubectl scale deployment web --replicas=3 -n langopia
```

## 🗑️ Cleanup

To remove the entire deployment:
```bash
sudo k3s kubectl delete namespace langopia
sudo k3s ctr images rm docker.io/library/langopia-web:latest
```