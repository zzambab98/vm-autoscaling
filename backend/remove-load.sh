#!/bin/bash
# VM에서 부하를 제거하는 스크립트

VM_IPS=("10.255.48.230" "10.255.48.231")
SSH_KEY="/home/ubuntu/workspace/vm-autoscaling/pemkey/dana-cocktail"
SSH_USER="ubuntu"

echo "=== VM에서 부하 제거 시작 ==="
echo ""

for VM_IP in "${VM_IPS[@]}"; do
    echo "VM: $VM_IP"
    
    # stress-ng 프로세스 종료
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$VM_IP" \
        "sudo pkill stress-ng || true"
    
    echo "  ✅ 부하 제거 완료"
    echo ""
done

echo "=== 부하 제거 완료 ==="
echo "메트릭 확인: ./check-current-vms.sh"


