const https = require('https');

// SSL 경고 비활성화
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// F5 설정 (환경 변수)
const F5_SERVERS = (process.env.F5_SERVERS || '10.255.1.80').split(',').map(s => s.trim());
const F5_USER = process.env.F5_USER || process.env.F5_WEBHOOK_USER || 'admin';
const F5_PASSWORD = process.env.F5_PASSWORD || process.env.F5_WEBHOOK_PASSWORD || '';
const F5_PARTITION = process.env.F5_PARTITION || 'Common';

/**
 * F5 인증 및 Token 획득
 * @param {string} f5Server - F5 서버 IP
 * @returns {Promise<string>} 인증 토큰
 */
async function authenticate(f5Server) {
  return new Promise((resolve, reject) => {
    const authUrl = `/mgmt/shared/authn/login`;
    const authData = JSON.stringify({
      username: F5_USER,
      password: F5_PASSWORD,
      loginProviderName: 'tmos'
    });

    const options = {
      hostname: f5Server,
      port: 443,
      path: authUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(authData)
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`F5 인증 실패: HTTP ${res.statusCode} - ${data.substring(0, 200)}`));
            return;
          }
          const response = JSON.parse(data);
          if (response.token && response.token.token) {
            resolve(response.token.token);
          } else {
            reject(new Error(`F5 인증 실패: 토큰을 받을 수 없습니다. 응답: ${JSON.stringify(response).substring(0, 200)}`));
          }
        } catch (error) {
          reject(new Error(`F5 인증 실패: ${error.message} - 응답: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`F5 인증 요청 실패: ${error.message}`));
    });

    req.write(authData);
    req.end();
  });
}

/**
 * F5 API 호출
 * @param {string} f5Server - F5 서버 IP
 * @param {string} token - 인증 토큰
 * @param {string} method - HTTP 메서드
 * @param {string} path - API 경로
 * @returns {Promise<object>} API 응답
 */
async function f5ApiCall(f5Server, token, method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: f5Server,
      port: 443,
      path: path,
      method: method,
      headers: {
        'X-F5-Auth-Token': token,
        'Content-Type': 'application/json'
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const response = JSON.parse(data);
            resolve(response);
          } else {
            reject(new Error(`F5 API 호출 실패: ${res.statusCode} - ${data}`));
          }
        } catch (error) {
          reject(new Error(`F5 API 응답 파싱 실패: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`F5 API 요청 실패: ${error.message}`));
    });

    req.end();
  });
}

/**
 * F5 Pool 목록 조회
 * @returns {Promise<Array>} Pool 목록
 */
async function getF5Pools() {
  try {
    const f5Server = F5_SERVERS[0]; // 첫 번째 서버 사용
    const token = await authenticate(f5Server);
    const path = `/mgmt/tm/ltm/pool?$select=name,partition,membersReference`;
    const response = await f5ApiCall(f5Server, token, 'GET', path);
    
    const pools = (response.items || []).map(pool => {
      const partition = pool.partition || F5_PARTITION;
      const poolName = pool.name;
      const fullName = partition === 'Common' ? poolName : `/${partition}/${poolName}`;
      
      return {
        name: poolName,
        partition: partition,
        fullName: fullName,
        displayName: fullName
      };
    });
    
    return { success: true, pools };
  } catch (error) {
    console.error('[F5 Service] Pool 목록 조회 실패:', error.message);
    return { success: false, pools: [], error: error.message };
  }
}

/**
 * F5 Pool 상세 정보 조회 (멤버 목록 포함)
 * @param {string} poolName - Pool 이름
 * @param {string} partition - Partition (선택, 기본값: Common)
 * @returns {Promise<object>} Pool 상세 정보
 */
async function getF5PoolDetails(poolName, partition = F5_PARTITION) {
  try {
    const f5Server = F5_SERVERS[0];
    const token = await authenticate(f5Server);
    const poolPath = partition === 'Common' ? poolName : `~${partition}~${poolName}`;
    const path = `/mgmt/tm/ltm/pool/${poolPath}?expandSubcollections=true`;
    const response = await f5ApiCall(f5Server, token, 'GET', path);
    
    // 멤버 목록 추출
    const members = (response.membersReference?.items || []).map(member => {
      const memberName = member.name || '';
      const parts = memberName.split(':');
      const ip = parts[0] || '';
      const port = parts[1] || '80';
      
      return {
        name: memberName,
        ip: ip,
        port: port,
        state: member.state || 'unknown',
        status: member.session || 'unknown'
      };
    });
    
    return {
      success: true,
      pool: {
        name: response.name,
        partition: response.partition || partition,
        members: members,
        memberCount: members.length
      }
    };
  } catch (error) {
    console.error('[F5 Service] Pool 상세 정보 조회 실패:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * F5 Virtual Server 목록 조회 (VIP 목록)
 * @returns {Promise<Array>} VIP 목록
 */
async function getF5VirtualServers() {
  try {
    const f5Server = F5_SERVERS[0]; // 첫 번째 서버 사용
    const token = await authenticate(f5Server);
    const path = `/mgmt/tm/ltm/virtual?$select=name,destination,partition,pool`;
    const response = await f5ApiCall(f5Server, token, 'GET', path);
    
    const vips = (response.items || []).map(vs => {
      // destination 형식: "/Common/10.255.48.229:80" 또는 "/Common/10.255.48.229"
      const destination = vs.destination || '';
      const parts = destination.split('/').pop().split(':');
      const ip = parts[0];
      const port = parts[1] || '80';
      
      return {
        name: vs.name,
        ip: ip,
        port: port,
        destination: destination,
        pool: vs.pool || '',
        partition: vs.partition || F5_PARTITION,
        displayName: `${ip}:${port} (${vs.name})`
      };
    });
    
    return { success: true, vips };
  } catch (error) {
    console.error('[F5 Service] Virtual Server 목록 조회 실패:', error.message);
    return { success: false, vips: [], error: error.message };
  }
}

module.exports = {
  getF5Pools,
  getF5VirtualServers,
  getF5PoolDetails
};

