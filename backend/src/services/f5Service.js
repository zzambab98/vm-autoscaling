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
    // 환경 변수 확인
    if (!F5_SERVERS || F5_SERVERS.length === 0 || !F5_SERVERS[0]) {
      return { 
        success: false, 
        pools: [], 
        error: 'F5_SERVERS 환경 변수가 설정되지 않았습니다.' 
      };
    }
    if (!F5_USER) {
      return { 
        success: false, 
        pools: [], 
        error: 'F5_USER 환경 변수가 설정되지 않았습니다.' 
      };
    }
    if (!F5_PASSWORD) {
      return { 
        success: false, 
        pools: [], 
        error: 'F5_PASSWORD 환경 변수가 설정되지 않았습니다.' 
      };
    }

    const f5Server = F5_SERVERS[0]; // 첫 번째 서버 사용
    const token = await authenticate(f5Server);
    const path = `/mgmt/tm/ltm/pool?$select=name,partition`;
    const response = await f5ApiCall(f5Server, token, 'GET', path);
    
    const pools = (response.items || []).map(pool => ({
      name: pool.name,
      partition: pool.partition || F5_PARTITION,
      fullName: pool.name
    }));
    
    return { success: true, pools };
  } catch (error) {
    console.error('[F5 Service] Pool 목록 조회 실패:', error.message);
    // 환경 변수 관련 에러인지 확인
    if (error.message.includes('환경 변수') || !F5_SERVERS || !F5_USER || !F5_PASSWORD) {
      return { 
        success: false, 
        pools: [], 
        error: 'F5 API 연결 실패. 환경 변수(F5_SERVERS, F5_USER, F5_PASSWORD)를 확인하세요.' 
      };
    }
    return { success: false, pools: [], error: error.message };
  }
}

/**
 * F5 Virtual Server 목록 조회 (VIP 목록)
 * @returns {Promise<Array>} VIP 목록
 */
async function getF5VirtualServers() {
  try {
    // 환경 변수 확인
    if (!F5_SERVERS || F5_SERVERS.length === 0 || !F5_SERVERS[0]) {
      return { 
        success: false, 
        vips: [], 
        error: 'F5_SERVERS 환경 변수가 설정되지 않았습니다.' 
      };
    }
    if (!F5_USER) {
      return { 
        success: false, 
        vips: [], 
        error: 'F5_USER 환경 변수가 설정되지 않았습니다.' 
      };
    }
    if (!F5_PASSWORD) {
      return { 
        success: false, 
        vips: [], 
        error: 'F5_PASSWORD 환경 변수가 설정되지 않았습니다.' 
      };
    }

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
    // 환경 변수 관련 에러인지 확인
    if (error.message.includes('환경 변수') || !F5_SERVERS || !F5_USER || !F5_PASSWORD) {
      return { 
        success: false, 
        vips: [], 
        error: 'F5 API 연결 실패. 환경 변수(F5_SERVERS, F5_USER, F5_PASSWORD)를 확인하세요.' 
      };
    }
    return { success: false, vips: [], error: error.message };
  }
}

/**
 * F5 Pool에 멤버 추가 (POST 요청)
 * @param {string} f5Server - F5 서버 IP
 * @param {string} token - 인증 토큰
 * @param {string} path - API 경로
 * @param {object} data - POST 데이터
 * @returns {Promise<object>} API 응답
 */
async function f5ApiCallPost(f5Server, token, path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: f5Server,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'X-F5-Auth-Token': token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const response = responseData ? JSON.parse(responseData) : {};
            resolve(response);
          } else {
            reject(new Error(`F5 API 호출 실패: ${res.statusCode} - ${responseData}`));
          }
        } catch (error) {
          reject(new Error(`F5 API 응답 파싱 실패: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`F5 API 요청 실패: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * F5 Pool에 멤버 제거 (DELETE 요청)
 * @param {string} f5Server - F5 서버 IP
 * @param {string} token - 인증 토큰
 * @param {string} path - API 경로
 * @returns {Promise<object>} API 응답
 */
async function f5ApiCallDelete(f5Server, token, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: f5Server,
      port: 443,
      path: path,
      method: 'DELETE',
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
            const response = data ? JSON.parse(data) : {};
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
 * F5 Pool에서 멤버 제거
 * @param {string} poolName - Pool 이름
 * @param {string} memberIp - 멤버 IP 주소
 * @param {string} memberPort - 멤버 포트 (기본값: 80)
 * @param {string} partition - Partition (기본값: Common)
 * @returns {Promise<object>} 제거 결과
 */
async function removeF5PoolMember(poolName, memberIp, memberPort = '80', partition = F5_PARTITION) {
  try {
    // 환경 변수 확인
    if (!F5_SERVERS || F5_SERVERS.length === 0 || !F5_SERVERS[0]) {
      throw new Error('F5_SERVERS 환경 변수가 설정되지 않았습니다.');
    }
    if (!F5_USER || !F5_PASSWORD) {
      throw new Error('F5_USER 또는 F5_PASSWORD 환경 변수가 설정되지 않았습니다.');
    }

    const f5Server = F5_SERVERS[0];
    const token = await authenticate(f5Server);

    // 멤버 경로 구성
    // 형식: /mgmt/tm/ltm/pool/~{partition}~{poolName}/members/~{partition}~{memberIp}:{memberPort}
    const memberPath = `/mgmt/tm/ltm/pool/~${partition}~${poolName}/members/~${partition}~${memberIp}:${memberPort}`;

    // 멤버 제거
    await f5ApiCallDelete(f5Server, token, memberPath);

    console.log(`[F5 Service] Pool '${poolName}'에서 멤버 '${memberIp}:${memberPort}' 제거 완료`);

    return {
      success: true,
      poolName: poolName,
      memberIp: memberIp,
      memberPort: memberPort,
      message: `Pool '${poolName}'에서 멤버 '${memberIp}:${memberPort}'가 제거되었습니다.`
    };
  } catch (error) {
    console.error(`[F5 Service] Pool 멤버 제거 실패:`, error.message);
    throw new Error(`Pool 멤버 제거 실패: ${error.message}`);
  }
}

/**
 * F5 Pool의 멤버 목록 조회
 * @param {string} poolName - Pool 이름
 * @param {string} partition - Partition (기본값: Common)
 * @returns {Promise<object>} 멤버 목록
 */
async function getF5PoolMembers(poolName, partition = F5_PARTITION) {
  try {
    // 환경 변수 확인
    if (!F5_SERVERS || F5_SERVERS.length === 0 || !F5_SERVERS[0]) {
      return {
        success: false,
        members: [],
        error: 'F5_SERVERS 환경 변수가 설정되지 않았습니다.'
      };
    }
    if (!F5_USER || !F5_PASSWORD) {
      return {
        success: false,
        members: [],
        error: 'F5_USER 또는 F5_PASSWORD 환경 변수가 설정되지 않았습니다.'
      };
    }

    const f5Server = F5_SERVERS[0];
    const token = await authenticate(f5Server);

    // Pool 멤버 경로 구성
    const membersPath = `/mgmt/tm/ltm/pool/~${partition}~${poolName}/members`;

    // 멤버 목록 조회
    const response = await f5ApiCall(f5Server, token, 'GET', membersPath);

    // 멤버 목록 파싱
    const members = (response.items || []).map(member => {
      // member.name 형식: "/Common/10.255.48.201:80" 또는 "10.255.48.201:80"
      const memberName = member.name || '';
      const parts = memberName.split('/').pop().split(':');
      const ip = parts[0];
      const port = parts[1] || '80';

      return {
        name: member.name,
        ip: ip,
        port: port,
        state: member.state || 'unknown',
        enabled: member.enabled !== false, // 기본값 true
        session: member.session || 'user-enabled'
      };
    });

    return {
      success: true,
      poolName: poolName,
      members: members,
      count: members.length
    };
  } catch (error) {
    console.error(`[F5 Service] Pool 멤버 조회 실패:`, error.message);
    // 404 에러는 pool이 없거나 멤버가 없는 경우
    if (error.message.includes('404')) {
      return {
        success: true,
        poolName: poolName,
        members: [],
        count: 0
      };
    }
    return {
      success: false,
      members: [],
      error: error.message
    };
  }
}

module.exports = {
  getF5Pools,
  getF5VirtualServers,
  removeF5PoolMember,
  getF5PoolMembers
};

