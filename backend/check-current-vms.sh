#!/bin/bash
echo "=== 현재 VM 상태 확인 ==="
echo ""

# Prometheus에서 현재 VM 목록 조회
PROMETHEUS_URL="http://10.255.1.254:9090"
JOB_NAME="auto-vm-test-service-job"

echo "1. Prometheus Job에서 Target 목록:"
TARGETS=$(curl -s "${PROMETHEUS_URL}/api/v1/targets" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
targets = []
for target in data.get('data', {}).get('activeTargets', []):
    if target.get('labels', {}).get('job') == '${JOB_NAME}':
        instance = target.get('labels', {}).get('instance', '')
        health = target.get('health', 'unknown')
        targets.append({'instance': instance, 'health': health})
print(json.dumps(targets))
" 2>/dev/null)

if [ -z "$TARGETS" ] || [ "$TARGETS" = "[]" ]; then
    echo "  ❌ 등록된 VM이 없습니다."
else
    VM_COUNT=$(echo "$TARGETS" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))")
    echo "  ✅ 현재 VM 개수: $VM_COUNT"
    echo "$TARGETS" | python3 -c "
import sys, json
for i, t in enumerate(json.load(sys.stdin), 1):
    print(f'    {i}. {t[\"instance\"]} (상태: {t[\"health\"]})')
"
fi

echo ""
echo "2. CPU 사용률:"
CPU_QUERY="100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\",job=\"${JOB_NAME}\"}[5m])) * 100)"
curl -s "${PROMETHEUS_URL}/api/v1/query?query=${CPU_QUERY}" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('status') == 'success' and data.get('data', {}).get('result'):
    for result in data['data']['result']:
        instance = result.get('metric', {}).get('instance', 'unknown')
        value = float(result.get('value', [0, 0])[1])
        print(f'  - {instance}: {value:.2f}%')
else:
    print('  데이터 없음')
" 2>/dev/null

echo ""
echo "3. Memory 사용률:"
MEM_QUERY="(1 - (avg by (instance) (node_memory_MemAvailable_bytes{job=\"${JOB_NAME}\"}) / avg by (instance) (node_memory_MemTotal_bytes{job=\"${JOB_NAME}\"}))) * 100"
curl -s "${PROMETHEUS_URL}/api/v1/query?query=${MEM_QUERY}" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('status') == 'success' and data.get('data', {}).get('result'):
    for result in data['data']['result']:
        instance = result.get('metric', {}).get('instance', 'unknown')
        value = float(result.get('value', [0, 0])[1])
        print(f'  - {instance}: {value:.2f}%')
else:
    print('  데이터 없음')
" 2>/dev/null

echo ""
echo "=== 확인 완료 ==="
