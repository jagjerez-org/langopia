#!/bin/bash

echo "🔍 Langopia K3s Deployment Status"
echo "=================================="

echo ""
echo "📊 Namespaces:"
sudo k3s kubectl get namespaces | grep langopia

echo ""
echo "🟢 Pods:"
sudo k3s kubectl get pods -n langopia -o wide

echo ""
echo "🌐 Services:"
sudo k3s kubectl get svc -n langopia

echo ""
echo "🔧 Ingress:"
sudo k3s kubectl get ingress -n langopia

echo ""
echo "💾 Persistent Volume Claims:"
sudo k3s kubectl get pvc -n langopia

echo ""
echo "🔧 ConfigMaps:"
sudo k3s kubectl get configmap -n langopia

echo ""
echo "🔐 Secrets:"
sudo k3s kubectl get secrets -n langopia

echo ""
echo "📋 Recent Events:"
sudo k3s kubectl get events -n langopia --sort-by='.lastTimestamp' | tail -10

echo ""
echo "🌍 Access URLs:"
echo "Web App: http://192.168.0.17"
echo "MinIO Console: http://192.168.0.17:9001"
echo "LiveKit WebSocket: ws://192.168.0.17:7880"

echo ""
echo "🔍 Quick Health Check:"
if sudo k3s kubectl get pods -n langopia --no-headers | grep -q Running; then
    echo "✅ Some pods are running"
else
    echo "❌ No pods are running"
fi

if sudo k3s kubectl get svc web-service -n langopia &>/dev/null; then
    echo "✅ Web service exists"
else
    echo "❌ Web service not found"
fi