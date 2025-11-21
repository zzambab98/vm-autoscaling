#!/usr/bin/env python3
"""
IP Pool에서 사용 가능한 IP 조회 스크립트
"""
import argparse
import ipaddress
import subprocess
import sys

def ping_ip(ip):
    """IP에 ping 테스트"""
    try:
        result = subprocess.run(
            ['ping', '-c', '1', '-W', '2', str(ip)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5
        )
        return result.returncode == 0
    except:
        return False

def get_available_ip(start_ip, end_ip, subnet='255.255.255.0'):
    """IP Pool에서 사용 가능한 IP 찾기"""
    try:
        start = ipaddress.IPv4Address(start_ip)
        end = ipaddress.IPv4Address(end_ip)
        
        if start > end:
            print(f"Error: 시작 IP({start_ip})가 종료 IP({end_ip})보다 큽니다.", file=sys.stderr)
            return None
        
        # IP 범위 순회
        current = start
        while current <= end:
            # Ping 테스트
            if not ping_ip(current):
                # 사용 가능한 IP 발견
                return str(current)
            current += 1
        
        # 사용 가능한 IP를 찾지 못함
        print(f"Error: IP Pool({start_ip} ~ {end_ip})에서 사용 가능한 IP를 찾을 수 없습니다.", file=sys.stderr)
        return None
        
    except ValueError as e:
        print(f"Error: 잘못된 IP 주소 형식: {e}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None

def main():
    parser = argparse.ArgumentParser(description='IP Pool에서 사용 가능한 IP 조회')
    parser.add_argument('--start', required=True, help='IP Pool 시작 주소')
    parser.add_argument('--end', required=True, help='IP Pool 종료 주소')
    parser.add_argument('--subnet', default='255.255.255.0', help='서브넷 마스크')
    
    args = parser.parse_args()
    
    available_ip = get_available_ip(args.start, args.end, args.subnet)
    
    if available_ip:
        print(available_ip)
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()

