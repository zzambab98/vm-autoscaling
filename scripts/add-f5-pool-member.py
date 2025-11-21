#!/usr/bin/env python3
"""
F5 Pool에 Member 추가 스크립트
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

def add_pool_member(f5_server, username, password, pool_name, member_ip, member_port, vip=None):
    """F5 Pool에 Member 추가"""
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
        
        # 2. Node 생성 (Member IP 주소)
        node_name = member_ip
        node_url = f"https://{f5_server}/mgmt/tm/ltm/node/~{F5_PARTITION}~{node_name}"
        
        # Node 존재 확인
        node_check = requests.get(node_url, headers=headers, verify=False, timeout=10)
        
        if node_check.status_code == 404:
            # Node 생성
            node_data = {
                "name": node_name,
                "partition": F5_PARTITION,
                "address": member_ip
            }
            
            node_response = requests.post(
                f"https://{f5_server}/mgmt/tm/ltm/node",
                headers=headers,
                json=node_data,
                verify=False,
                timeout=10
            )
            
            if node_response.status_code not in [200, 201]:
                print(f"Error: Node 생성 실패: {node_response.status_code} - {node_response.text}", file=sys.stderr)
                return False
            
            print(f"Node 생성 완료: {node_name}")
        elif node_check.status_code == 200:
            print(f"Node 이미 존재: {node_name}")
        else:
            print(f"Error: Node 확인 실패: {node_check.status_code}", file=sys.stderr)
            return False
        
        # 3. Pool Member 추가
        member_name = f"{node_name}:{member_port}"
        pool_member_url = f"https://{f5_server}/mgmt/tm/ltm/pool/~{F5_PARTITION}~{pool_name}/members"
        
        # Member 존재 확인
        member_check_url = f"{pool_member_url}/~{F5_PARTITION}~{member_name}"
        member_check = requests.get(member_check_url, headers=headers, verify=False, timeout=10)
        
        if member_check.status_code == 404:
            # Member 추가
            member_data = {
                "name": member_name,
                "partition": F5_PARTITION
            }
            
            member_response = requests.post(
                pool_member_url,
                headers=headers,
                json=member_data,
                verify=False,
                timeout=10
            )
            
            if member_response.status_code not in [200, 201]:
                print(f"Error: Pool Member 추가 실패: {member_response.status_code} - {member_response.text}", file=sys.stderr)
                return False
            
            print(f"Pool Member 추가 완료: {member_name}")
            return True
        elif member_check.status_code == 200:
            print(f"Pool Member 이미 존재: {member_name}")
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
    parser = argparse.ArgumentParser(description='F5 Pool에 Member 추가')
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
    
    success = add_pool_member(
        args.server,
        args.username,
        args.password,
        args.pool,
        member_ip,
        member_port,
        args.vip
    )
    
    if success:
        print(f"Success: F5 Pool '{args.pool}'에 Member '{args.member}' 추가 완료")
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()

