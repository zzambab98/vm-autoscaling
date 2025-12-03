#!/usr/bin/env python3
"""
F5 Pool에서 Member 제거 스크립트
"""
import argparse
import requests
import json
import sys
from requests.auth import HTTPBasicAuth
from urllib3.exceptions import InsecureRequestWarning

# SSL 경고 비활성화 (자체 서명 인증서 사용 시)
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

F5_PARTITION = 'Common'

def remove_pool_member(f5_server, username, password, pool_name, member_ip, member_port, vip=None):
    """F5 Pool에서 Member 제거"""
    try:
        # 1. 인증 토큰 획득
        auth_url = f"https://{f5_server}/mgmt/shared/authn/login"
        auth_data = {
            "username": username,
            "password": password,
            "loginProviderName": "tmos"
        }
        
        auth_response = requests.post(
            auth_url,
            json=auth_data,
            verify=False,
            timeout=10
        )
        
        if auth_response.status_code != 200:
            print(f"Error: F5 인증 실패: {auth_response.status_code}", file=sys.stderr)
            return False
        
        token = auth_response.json()['token']['token']
        headers = {
            "X-F5-Auth-Token": token,
            "Content-Type": "application/json"
        }
        
        # 2. Pool Member 제거
        member_name = f"{member_ip}:{member_port}"
        pool_member_url = f"https://{f5_server}/mgmt/tm/ltm/pool/~{F5_PARTITION}~{pool_name}/members/~{F5_PARTITION}~{member_name}"
        
        # Member 존재 확인
        member_check = requests.get(pool_member_url, headers=headers, verify=False, timeout=10)
        
        if member_check.status_code == 404:
            print(f"Pool Member가 존재하지 않음: {member_name}")
            return True  # 이미 제거된 상태이므로 성공으로 처리
        elif member_check.status_code == 200:
            # Member 제거
            member_response = requests.delete(
                pool_member_url,
                headers=headers,
                verify=False,
                timeout=10
            )
            
            if member_response.status_code not in [200, 204]:
                print(f"Error: Pool Member 제거 실패: {member_response.status_code} - {member_response.text}", file=sys.stderr)
                return False
            
            print(f"Pool Member 제거 완료: {member_name}")
            
            # 3. Node가 다른 Pool에서 사용되지 않으면 Node도 제거 (선택사항)
            # 주의: Node가 다른 Pool에서 사용 중이면 제거하지 않음
            node_name = member_ip
            node_url = f"https://{f5_server}/mgmt/tm/ltm/node/~{F5_PARTITION}~{node_name}"
            
            # Node의 Pool 참조 확인
            node_info = requests.get(node_url, headers=headers, verify=False, timeout=10)
            if node_info.status_code == 200:
                # Node가 다른 Pool에서 사용 중인지 확인
                # 간단한 방법: Node를 조회하여 참조가 있는지 확인
                # 실제로는 더 정교한 로직이 필요할 수 있음
                # 여기서는 Node를 제거하지 않고 남겨둠 (다른 Pool에서 사용 가능)
                print(f"Node는 유지됨 (다른 Pool에서 사용 가능): {node_name}")
            
            return True
        else:
            print(f"Error: Pool Member 확인 실패: {member_check.status_code}", file=sys.stderr)
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"Error: F5 API 요청 실패: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False

def main():
    parser = argparse.ArgumentParser(description='F5 Pool에서 Member 제거')
    parser.add_argument('--pool', required=True, help='Pool 이름')
    parser.add_argument('--member', required=True, help='Member (IP:Port 형식)')
    parser.add_argument('--vip', help='VIP 주소 (선택사항)')
    parser.add_argument('--server', required=True, help='F5 서버 주소')
    parser.add_argument('--username', required=True, help='F5 사용자 이름')
    parser.add_argument('--password', required=True, help='F5 비밀번호')
    
    args = parser.parse_args()
    
    # Member 파싱 (IP:Port)
    try:
        member_ip, member_port = args.member.split(':')
        member_port = int(member_port)
    except ValueError:
        print("Error: Member 형식이 올바르지 않습니다. IP:Port 형식이어야 합니다.", file=sys.stderr)
        sys.exit(1)
    
    success = remove_pool_member(
        args.server,
        args.username,
        args.password,
        args.pool,
        member_ip,
        member_port,
        args.vip
    )
    
    if success:
        print(f"Success: F5 Pool '{args.pool}'에서 Member '{args.member}' 제거 완료")
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()


