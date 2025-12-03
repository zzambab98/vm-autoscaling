#!/bin/bash
# VM에 부하를 생성하는 스크립트

VM_IPS=("10.255.48.230" "10.255.48.231")
SSH_KEY="/home/ubuntu/workspace/vm-autoscaling/pemkey/dana-cocktail"
SSH_USER="ubuntu"

echo "=== VM에 부하 생성 시작 ==="
echo ""

for VM_IP in "${VM_IPS[@]}"; do
    echo "VM: $VM_IP"
    
    # stress-ng 설치 확인 및 설치
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$VM_IP" \
        "sudo apt-get update -qq && sudo apt-get install -y stress-ng > /dev/null 2>&1" || echo "  ⚠️ stress-ng 설치 실패 (계속 진행)"
    
    # 기존 stress-ng 프로세스 종료
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$VM_IP" \
        "sudo pkill stress-ng || true"
    
    # CPU 부하 생성 (4코어, 5분)
    echo "  - CPU 부하 생성 중..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$VM_IP" \
        "nohup stress-ng --cpu 4 --timeout 300s > /dev/null 2>&1 &" || echo "  ⚠️ CPU 부하 생성 실패"
    
    # Memory 부하 생성 (1GB, 5분)
    echo "  - Memory 부하 생성 중..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$VM_IP" \
        "nohup stress-ng --vm 1 --vm-bytes 1G --timeout 300s > /dev/null 2>&1 &" || echo "  ⚠️ Memory 부하 생성 실패"
    
    echo "  ✅ 부하 생성 완료"
    echo ""
done

echo "=== 부하 생성 완료 ==="
echo "메트릭 확인: ./check-current-vms.sh"

