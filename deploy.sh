#!/bin/bash
set -e

echo "🚀 Deploying Langopia to K3s..."

# Check if K3s is running
if ! sudo k3s kubectl get nodes &>/dev/null; then
    echo "❌ K3s is not running or not accessible"
    exit 1
fi

echo "✅ K3s is accessible"

# Import Docker image to K3s
echo "📦 Importing langopia-web Docker image..."
if [ -f /tmp/langopia-web.tar ]; then
    sudo k3s ctr images import /tmp/langopia-web.tar
    echo "✅ Image imported"
else
    echo "❌ Docker image not found. Please build first:"
    echo "cd /tmp/langopia && docker build -f apps/web/Dockerfile -t langopia-web:latest ."
    echo "docker save langopia-web:latest -o /tmp/langopia-web.tar"
    exit 1
fi

# Apply Kubernetes manifests
echo "🔧 Applying Kubernetes manifests..."

cd /tmp/langopia/k8s

# Apply manifests in order
for manifest in $(ls *.yaml | sort); do
    echo "Applying $manifest..."
    sudo k3s kubectl apply -f "$manifest"
done

echo "⏳ Waiting for pods to be ready..."

# Wait for namespace to be created
sudo k3s kubectl wait --for=condition=Ready namespace/langopia --timeout=30s

# Wait for PostgreSQL to be ready
sudo k3s kubectl wait --for=condition=Ready pod -l app=postgres -n langopia --timeout=300s

# Wait for Redis to be ready
sudo k3s kubectl wait --for=condition=Ready pod -l app=redis -n langopia --timeout=300s

# Wait for MinIO to be ready
sudo k3s kubectl wait --for=condition=Ready pod -l app=minio -n langopia --timeout=300s

# Wait for LiveKit to be ready
sudo k3s kubectl wait --for=condition=Ready pod -l app=livekit -n langopia --timeout=300s

# Wait for web app to be ready
sudo k3s kubectl wait --for=condition=Ready pod -l app=web -n langopia --timeout=600s

echo "🎉 Deployment completed!"

echo "📊 Pod status:"
sudo k3s kubectl get pods -n langopia

echo "🌐 Services:"
sudo k3s kubectl get svc -n langopia

echo "📝 Access URLs:"
echo "Web App: http://192.168.0.17 (via Ingress)"
echo "MinIO Console: http://192.168.0.17:9001"

echo "🔍 To check logs:"
echo "sudo k3s kubectl logs -f deployment/web -n langopia"

echo "✅ Langopia deployed successfully to K3s!"