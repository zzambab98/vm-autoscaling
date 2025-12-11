import { useState, useEffect } from 'react';
import { prometheusApi, promtailApi, alertmanagerApi } from '../services/api';
import { templateApi } from '../services/templateApi';

// 시스템 Job 목록 (삭제 불가)
const SYSTEM_JOBS = ['prometheus', 'alertmanager', 'loki'];

function PrometheusMonitoring() {
  const [vms, setVms] = useState([]);
  const [selectedVms, setSelectedVms] = useState([]); // 선택된 VM 목록 [{ vmName, ip, port }]
  const [selectedVmForManagement, setSelectedVmForManagement] = useState(null); // 관리할 VM
  const [vmStatus, setVmStatus] = useState(null); // VM별 등록 상태
  const [selectedFeatures, setSelectedFeatures] = useState({
    infraDashboard: false,
    loki: false,
    jvmDashboard: false
  });
  // 오토스케일링용 대시보드 타입 선택 (체크박스로 중복 선택 가능)
  const [dashboardTypes, setDashboardTypes] = useState({
    infra: true,  // 서버 인프라 대시보드 (기본값: 선택)
    jvm: false    // JVM 대시보드
  });
  // 로키 연동 선택 (기본값: true)
  const [enableLoki, setEnableLoki] = useState(true);
  // Job 등록 방식 선택 (개별 등록 vs 묶어서 등록)
  const [jobRegistrationMode, setJobRegistrationMode] = useState('individual'); // 'individual' or 'grouped'
  // 묶어서 등록 시 Job 이름
  const [groupedJobName, setGroupedJobName] = useState('');
  const [labels, setLabels] = useState({
    service: 'node-exporter',
    environment: 'production'
  });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingVms, setLoadingVms] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [targetStatus, setTargetStatus] = useState(null);
  const [routingRules, setRoutingRules] = useState([]);
  const [loadingRoutingRules, setLoadingRoutingRules] = useState(false);

  useEffect(() => {
    loadJobs();
    loadVmList();
    loadRoutingRules();
  }, []);

  // Alertmanager 라우팅 규칙 목록 조회
  const loadRoutingRules = async () => {
    setLoadingRoutingRules(true);
    try {
      const result = await alertmanagerApi.getRoutes();
      if (result.success) {
        setRoutingRules(result.routes || []);
      }
    } catch (error) {
      console.error('라우팅 규칙 조회 실패:', error);
      setMessage({ type: 'error', text: `라우팅 규칙 조회 실패: ${error.message}` });
    } finally {
      setLoadingRoutingRules(false);
    }
  };

  // 라우팅 규칙 삭제
  const deleteRoutingRule = async (serviceName) => {
    if (!confirm(`정말로 서비스 '${serviceName}'의 라우팅 규칙을 삭제하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await alertmanagerApi.deleteRoute(serviceName);
      if (result.success) {
        setMessage({ type: 'success', text: `라우팅 규칙 삭제 완료: ${serviceName}` });
        await loadRoutingRules();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `라우팅 규칙 삭제 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const loadVmList = async () => {
    setLoadingVms(true);
    setMessage(null);
    try {
      const result = await templateApi.getVmList();
      console.log('[PrometheusMonitoring] VM 목록 조회 결과:', result);
      
      if (result && result.success && result.vms) {
        const vmList = result.vms
          .filter(vm => !vm.name.startsWith('vCLS-')) // vCLS-로 시작하는 VM 제외
          .map(vm => ({
            name: vm.name,
            ip: vm.ips && vm.ips.length > 0 ? vm.ips[0] : '', // 첫 번째 IP 사용
            ips: vm.ips || [],
            port: '9100' // 기본 포트
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
        setVms(vmList);
        console.log('[PrometheusMonitoring] VM 목록 설정 완료:', vmList.length, '개');
      } else {
        console.warn('[PrometheusMonitoring] VM 목록 조회 실패 또는 빈 결과:', result);
        setVms([]);
        if (result && !result.success) {
          setMessage({ type: 'error', text: `VM 목록 조회 실패: ${result.error || '알 수 없는 오류'}` });
        }
      }
    } catch (error) {
      console.error('[PrometheusMonitoring] VM 목록 조회 실패:', error);
      setVms([]);
      const errorMsg = error.response?.data?.error || error.message || 'VM 목록 조회 실패';
      setMessage({ type: 'error', text: `VM 목록 조회 실패: ${errorMsg}` });
    } finally {
      setLoadingVms(false);
    }
  };

  const loadJobs = async () => {
    try {
      const result = await prometheusApi.getJobs();
      if (result.success) {
        // 시스템 Job 필터링 (삭제 불가능한 Job 제외)
        const filteredJobs = result.jobs.filter(
          job => !SYSTEM_JOBS.includes(job.jobName)
        );
        setJobs(filteredJobs);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  const addJob = async () => {
    setLoading(true);
    setMessage(null);

    try {
      if (selectedVms.length === 0) {
        setMessage({ type: 'error', text: '최소 하나의 VM을 선택해야 합니다.' });
        setLoading(false);
        return;
      }

      const results = [];
      const errors = [];

      // 묶어서 등록 모드
      if (jobRegistrationMode === 'grouped') {
        // Job 이름 검증
        if (!groupedJobName || groupedJobName.trim() === '') {
          setMessage({ type: 'error', text: '묶어서 등록 시 Job 이름을 입력해야 합니다.' });
          setLoading(false);
          return;
        }

        // 모든 VM의 target 목록 생성
        const targetList = [];
        const vmInfoList = [];
        
        for (const vm of selectedVms) {
          if (!vm.ip || !vm.port) {
            errors.push(`${vm.vmName}: IP 또는 포트가 설정되지 않았습니다.`);
            continue;
          }
          targetList.push(`${vm.ip}:${vm.port}`);
          vmInfoList.push({ vmName: vm.vmName, ip: vm.ip, port: vm.port });
        }

        if (targetList.length === 0) {
          setMessage({ type: 'error', text: '유효한 VM이 없습니다.' });
          setLoading(false);
          return;
        }

        try {
          // 묶어서 등록: 하나의 Job에 여러 target 추가
          const finalLabels = {
            ...labels,
            service: labels.service || 'node-exporter',
            environment: labels.environment || 'production'
          };

          const dashboardOptions = {
            createInfraDashboard: dashboardTypes.infra,
            createJvmDashboard: dashboardTypes.jvm,
            enableLoki: enableLoki
          };

          const result = await prometheusApi.addJob(groupedJobName.trim(), targetList, finalLabels, dashboardOptions);

          if (result.success) {
            results.push({ jobName: groupedJobName.trim(), success: true, result, vmCount: vmInfoList.length });
          } else {
            errors.push(`Job 등록 실패: ${result.error || '알 수 없는 오류'}`);
          }
        } catch (error) {
          errors.push(`Job 등록 실패: ${error.message}`);
        }
      } else {
        // 개별 등록 모드 (기존 로직)
        for (const vm of selectedVms) {
          if (!vm.ip || !vm.port) {
            errors.push(`${vm.vmName}: IP 또는 포트가 설정되지 않았습니다.`);
            continue;
          }

          try {
            const targetList = [`${vm.ip}:${vm.port}`];
            const jobName = vm.vmName; // VM 이름을 Job 이름으로 사용
            
            // VM 이름을 vmName label로 추가
            const finalLabels = {
              ...labels,
              vmName: vm.vmName,
              instance: vm.ip,
              service: labels.service || 'node-exporter',
              environment: labels.environment || 'production'
            };

            // 대시보드 생성 옵션 설정
            const dashboardOptions = {
              createInfraDashboard: dashboardTypes.infra,
              createJvmDashboard: dashboardTypes.jvm,
              enableLoki: enableLoki
            };

            const result = await prometheusApi.addJob(jobName, targetList, finalLabels, dashboardOptions);

            if (result.success) {
              results.push({ vmName: vm.vmName, success: true, result });
              
              // Promtail 연동 결과는 백엔드에서 처리됨
              if (result.promtail) {
                const promtailSuccess = result.promtail.results?.some(r => r.success) || false;
                if (promtailSuccess) {
                  console.log(`[PrometheusMonitoring] Promtail 연동 완료: ${vm.vmName} (${vm.ip})`);
                } else {
                  console.warn(`[PrometheusMonitoring] Promtail 연동 실패: ${vm.vmName} (${vm.ip})`);
                }
              }
            } else {
              errors.push(`${vm.vmName}: Job 등록 실패`);
            }
          } catch (error) {
            errors.push(`${vm.vmName}: ${error.message}`);
          }
        }
      }

      if (results.length > 0) {
        let messageText = '';
        
        if (jobRegistrationMode === 'grouped') {
          // 묶어서 등록 결과
          const result = results[0];
          messageText = `Prometheus Job 등록 완료: ${result.jobName} (${result.vmCount}개 VM)`;
          
          // Grafana 대시보드 생성 결과 포함
          if (result.result?.grafanaResults) {
            const dashboardCount = result.result.grafanaResults.filter(gr => gr.success).length;
            if (dashboardCount > 0) {
              messageText += `, 대시보드 ${dashboardCount}개 생성됨`;
            }
          } else if (result.result?.grafana?.success) {
            messageText += ', 대시보드 생성됨';
          }
          
          // Promtail 연동 결과 포함
          if (result.result?.promtail?.successCount > 0) {
            messageText += `, Promtail 연동 ${result.result.promtail.successCount}개 완료`;
          }
        } else {
          // 개별 등록 결과
          const successCount = results.length;
          const totalCount = selectedVms.length;
          messageText = `Prometheus Job 등록 완료: ${successCount}/${totalCount}개`;
          
          // Grafana 대시보드 생성 결과 포함 (여러 개 생성 가능)
          const dashboardResults = results.filter(r => r.result?.grafana?.success || (r.result?.grafanaResults && r.result.grafanaResults.some(gr => gr.success)));
          if (dashboardResults.length > 0) {
            // 각 VM별로 생성된 대시보드 개수 계산
            const totalDashboards = results.reduce((sum, r) => {
              if (r.result?.grafanaResults) {
                return sum + r.result.grafanaResults.filter(gr => gr.success).length;
              } else if (r.result?.grafana?.success) {
                return sum + 1;
              }
              return sum;
            }, 0);
            messageText += ` (Grafana 대시보드 ${totalDashboards}개 생성됨)`;
          }
          
          // Promtail 연동 결과 포함
          const promtailResults = results.filter(r => r.result?.promtail?.successCount > 0);
          if (promtailResults.length > 0) {
            const totalPromtailSuccess = promtailResults.reduce((sum, r) => sum + (r.result?.promtail?.successCount || 0), 0);
            messageText += ` (Promtail 연동 ${totalPromtailSuccess}개 완료)`;
          }
        }
        
        if (errors.length > 0) {
          messageText += `\n오류: ${errors.join(', ')}`;
        }
        
        setMessage({ type: errors.length > 0 ? 'warning' : 'success', text: messageText });
        await loadJobs();
        setSelectedVms([]); // 선택 초기화
        
        // 잠시 후 Target 상태 확인
        setTimeout(() => {
          if (results.length > 0) {
            checkTargetStatus(results[0].result.jobName);
          }
        }, 3000);
      } else {
        setMessage({ type: 'error', text: `Job 등록 실패: ${errors.join(', ')}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Job 추가 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const checkTargetStatus = async (jobNameToCheck) => {
    if (!jobNameToCheck) return;

    try {
      const result = await prometheusApi.getTargets(jobNameToCheck);
      if (result.success) {
        setTargetStatus(result);
      }
    } catch (error) {
      console.error('Failed to check target status:', error);
    }
  };

  const deleteJob = async (jobNameToDelete) => {
    if (!confirm(`정말로 Job '${jobNameToDelete}'을 삭제하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await prometheusApi.deleteJob(jobNameToDelete);
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        await loadJobs();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Job 삭제 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const toggleVmSelection = (vm) => {
    const isSelected = selectedVms.some(s => s.vmName === vm.name);
    if (isSelected) {
      setSelectedVms(prev => prev.filter(s => s.vmName !== vm.name));
    } else {
      setSelectedVms(prev => [...prev, {
        vmName: vm.name,
        ip: vm.ip,
        port: vm.port
      }]);
    }
  };

  const updateSelectedVm = (vmName, field, value) => {
    setSelectedVms(prev => prev.map(vm => 
      vm.vmName === vmName ? { ...vm, [field]: value } : vm
    ));
  };

  const removeSelectedVm = (vmName) => {
    setSelectedVms(prev => prev.filter(vm => vm.vmName !== vmName));
  };

  // VM별 등록 상태 조회
  const checkVmStatus = async (vmName) => {
    if (!vmName) {
      setMessage({ type: 'error', text: 'VM을 선택해주세요.' });
      return;
    }

    setLoadingStatus(true);
    setMessage(null);
    try {
      const result = await prometheusApi.getVmStatus(vmName);
      if (result.success) {
        setVmStatus(result.status);
        setSelectedVmForManagement(vmName);
        setMessage({ type: 'success', text: `${vmName} 등록 상태 조회 완료` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `상태 조회 실패: ${error.message}` });
      setVmStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  // 기능 추가
  const addFeatures = async () => {
    if (!selectedVmForManagement) {
      setMessage({ type: 'error', text: 'VM을 선택하고 조회해주세요.' });
      return;
    }

    const selectedCount = Object.values(selectedFeatures).filter(v => v).length;
    if (selectedCount === 0) {
      setMessage({ type: 'error', text: '최소 하나 이상의 기능을 선택해주세요.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const vm = vms.find(v => v.name === selectedVmForManagement);
      const selectedVm = selectedVms.find(v => v.vmName === selectedVmForManagement);
      
      if (!vm && !selectedVm) {
        setMessage({ type: 'error', text: 'VM 정보를 찾을 수 없습니다.' });
        setLoading(false);
        return;
      }

      const ip = selectedVm?.ip || vm?.ip;
      const port = selectedVm?.port || vm?.port;

      if (!ip) {
        setMessage({ type: 'error', text: 'IP 주소가 설정되지 않았습니다.' });
        setLoading(false);
        return;
      }

      const result = await prometheusApi.addFeatures(
        selectedVmForManagement,
        ip,
        port,
        selectedFeatures,
        labels
      );

      if (result.success) {
        const successFeatures = [];
        const failedFeatures = [];

        if (result.results.infraDashboard?.success) {
          successFeatures.push('서버 인프라 대시보드');
        } else if (selectedFeatures.infraDashboard) {
          failedFeatures.push('서버 인프라 대시보드');
        }

        if (result.results.jvmDashboard?.success) {
          successFeatures.push('JVM 대시보드');
        } else if (selectedFeatures.jvmDashboard) {
          failedFeatures.push('JVM 대시보드');
        }

        if (result.results.loki?.success) {
          successFeatures.push('로키');
        } else if (selectedFeatures.loki) {
          failedFeatures.push('로키');
        }

        let messageText = '';
        if (successFeatures.length > 0) {
          messageText = `기능 추가 완료: ${successFeatures.join(', ')}`;
        }
        if (failedFeatures.length > 0) {
          messageText += `\n실패: ${failedFeatures.join(', ')}`;
        }

        setMessage({ 
          type: failedFeatures.length > 0 ? 'warning' : 'success', 
          text: messageText 
        });

        // 상태 다시 조회
        await checkVmStatus(selectedVmForManagement);
        await loadJobs();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `기능 추가 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  // 기능 삭제
  const removeFeatures = async () => {
    if (!selectedVmForManagement) {
      setMessage({ type: 'error', text: 'VM을 선택하고 조회해주세요.' });
      return;
    }

    const selectedCount = Object.values(selectedFeatures).filter(v => v).length;
    if (selectedCount === 0) {
      setMessage({ type: 'error', text: '최소 하나 이상의 기능을 선택해주세요.' });
      return;
    }

    if (!confirm(`선택한 기능을 삭제하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await prometheusApi.removeFeatures(
        selectedVmForManagement,
        selectedFeatures
      );

      if (result.success) {
        const successFeatures = [];
        const failedFeatures = [];

        if (result.results.infraDashboard?.success) {
          successFeatures.push('서버 인프라 대시보드');
        } else if (selectedFeatures.infraDashboard && result.results.infraDashboard) {
          failedFeatures.push('서버 인프라 대시보드');
        }

        if (result.results.jvmDashboard?.success) {
          successFeatures.push('JVM 대시보드');
        } else if (selectedFeatures.jvmDashboard && result.results.jvmDashboard) {
          failedFeatures.push('JVM 대시보드');
        }

        if (result.results.loki?.success) {
          successFeatures.push('로키');
        } else if (selectedFeatures.loki && result.results.loki) {
          failedFeatures.push('로키');
        }

        let messageText = '';
        if (successFeatures.length > 0) {
          messageText = `기능 삭제 완료: ${successFeatures.join(', ')}`;
        }
        if (failedFeatures.length > 0) {
          messageText += `\n실패: ${failedFeatures.join(', ')}`;
        }

        setMessage({ 
          type: failedFeatures.length > 0 ? 'warning' : 'success', 
          text: messageText 
        });

        // 상태 다시 조회
        await checkVmStatus(selectedVmForManagement);
        await loadJobs();
      }
    } catch (error) {
      setMessage({ type: 'error', text: `기능 삭제 실패: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>PLG Stack 모니터링 등록</h2>

      {message && (
        <div 
          className={message.type === 'success' ? 'success' : 'error'}
          dangerouslySetInnerHTML={{ __html: message.text }}
        />
      )}

      <div style={{ marginBottom: '20px' }}>
        <label className="label">Labels (라벨)</label>
        <p style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '-10px', marginBottom: '10px' }}>
          Prometheus에서 메트릭을 필터링하고 그룹화하는 데 사용됩니다. Alertmanager가 알림을 라우팅할 때도 사용됩니다.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '4px' }}>
              service *: 어떤 서비스인지 (Alertmanager 라우팅에 사용)
            </label>
            <input
              type="text"
              className="input"
              value={labels.service}
              onChange={(e) => setLabels({ ...labels, service: e.target.value })}
              placeholder="service (예: node-exporter)"
              required
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '4px' }}>
              environment: 환경 (test, prod, dev 등) - 선택사항
            </label>
            <input
              type="text"
              className="input"
              value={labels.environment}
              onChange={(e) => setLabels({ ...labels, environment: e.target.value })}
              placeholder="environment (기본값: production)"
            />
          </div>
        </div>
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '12px', color: '#6c757d' }}>
          <strong>참고:</strong> Job 이름은 VM 이름으로 자동 설정되며, instance label은 각 서버의 IP 주소로 자동 설정됩니다.
        </div>
      </div>

      {/* Job 등록 방식 선택 */}
      <div style={{ marginBottom: '20px' }}>
        <label className="label">Job 등록 방식</label>
        <p style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '-10px', marginBottom: '10px' }}>
          여러 VM을 개별 Job으로 등록할지, 하나의 Job으로 묶어서 등록할지 선택합니다.
        </p>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="jobRegistrationMode"
              value="individual"
              checked={jobRegistrationMode === 'individual'}
              onChange={(e) => {
                setJobRegistrationMode(e.target.value);
                setGroupedJobName('');
              }}
            />
            <span>개별 등록 (기본값)</span>
            <span style={{ fontSize: '11px', color: '#7f8c8d' }}>각 VM마다 개별 Job 생성</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="jobRegistrationMode"
              value="grouped"
              checked={jobRegistrationMode === 'grouped'}
              onChange={(e) => setJobRegistrationMode(e.target.value)}
            />
            <span>묶어서 등록</span>
            <span style={{ fontSize: '11px', color: '#7f8c8d' }}>여러 VM을 하나의 Job으로 묶기</span>
          </label>
        </div>
        {jobRegistrationMode === 'grouped' && (
          <div style={{ marginTop: '10px' }}>
            <label style={{ fontSize: '12px', color: '#7f8c8d', display: 'block', marginBottom: '4px' }}>
              Job 이름 *: 여러 VM을 묶을 Job 이름을 입력하세요
            </label>
            <input
              type="text"
              className="input"
              value={groupedJobName}
              onChange={(e) => setGroupedJobName(e.target.value)}
              placeholder="예: web-service"
              style={{ maxWidth: '400px' }}
            />
            <div style={{ marginTop: '5px', fontSize: '11px', color: '#6c757d' }}>
              이 Job 이름은 오토스케일링 설정에서 선택할 수 있습니다.
            </div>
          </div>
        )}
        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '12px', color: '#856404' }}>
          <strong>참고:</strong> 묶어서 등록 시 여러 VM이 하나의 Job으로 관리되며, 오토스케일링 설정에서 하나의 Job만 선택하면 됩니다.
        </div>
      </div>

      {/* 대시보드 타입 선택 (오토스케일링용) */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '6px', border: '1px solid #546bff' }}>
        <label className="label" style={{ marginBottom: '8px' }}>대시보드 타입 선택 (오토스케일링용)</label>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '-8px', marginBottom: '10px' }}>
          오토스케일링을 위한 모니터링 Job 등록 시 생성할 대시보드를 선택하세요. 여러 개 선택 가능합니다.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px', backgroundColor: '#fff', borderRadius: '4px' }}>
            <input
              type="checkbox"
              checked={dashboardTypes.infra}
              onChange={(e) => setDashboardTypes({ ...dashboardTypes, infra: e.target.checked })}
            />
            <div>
              <div style={{ fontWeight: '500', fontSize: '14px' }}>서버 인프라 대시보드 (Node Exporter)</div>
              <div style={{ fontSize: '12px', color: '#666' }}>CPU, Memory, Disk, Network 등 시스템 메트릭 모니터링</div>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px', backgroundColor: '#fff', borderRadius: '4px' }}>
            <input
              type="checkbox"
              checked={dashboardTypes.jvm}
              onChange={(e) => setDashboardTypes({ ...dashboardTypes, jvm: e.target.checked })}
            />
            <div>
              <div style={{ fontWeight: '500', fontSize: '14px' }}>JVM 대시보드 (JMX Exporter)</div>
              <div style={{ fontSize: '12px', color: '#666' }}>힙 메모리, GC, 스레드 등 Java 애플리케이션 메트릭 모니터링</div>
            </div>
          </label>
        </div>
        <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#fff', borderRadius: '4px', fontSize: '12px', color: '#666' }}>
          <strong>참고:</strong> 대시보드 생성 여부와 관계없이 Prometheus Job은 등록되며, 오토스케일링 Alert Rule에서 메트릭을 모니터링할 수 있습니다. 두 대시보드를 모두 선택하면 각각 생성됩니다.
        </div>
      </div>

      {/* 로키 연동 선택 (오토스케일링용) */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #0ea5e9' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={enableLoki}
            onChange={(e) => setEnableLoki(e.target.checked)}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
          <div>
            <div style={{ fontWeight: '500', fontSize: '14px', marginBottom: '4px' }}>로키 연동 (Promtail)</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Promtail 설정 업데이트하여 로그를 Loki로 전송합니다. Promtail이 설치된 서버에만 적용됩니다.
            </div>
          </div>
        </label>
        <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#fff', borderRadius: '4px', fontSize: '12px', color: '#666' }}>
          <strong>참고:</strong> 로키 연동은 Promtail이 설치된 서버에만 적용됩니다. Promtail이 설치되지 않은 서버는 자동으로 건너뜁니다.
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label className="label" style={{ marginBottom: 0 }}>Targets (VM 목록)</label>
          <button className="button" onClick={loadVmList} disabled={loadingVms}>
            {loadingVms ? '로딩 중...' : 'VM 목록 새로고침'}
          </button>
        </div>
        
        {loadingVms ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>VM 목록을 불러오는 중...</div>
        ) : vms.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>VM 목록이 없습니다.</div>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '10px' }}>
            {vms.map((vm, index) => {
              const isSelected = selectedVms.some(s => s.vmName === vm.name);
              const selectedVm = selectedVms.find(s => s.vmName === vm.name);
              
              return (
                <div key={index} style={{ 
                  display: 'flex', 
                  gap: '10px', 
                  marginBottom: '10px', 
                  alignItems: 'center',
                  padding: '8px',
                  backgroundColor: isSelected ? '#e7f3ff' : '#fff',
                  borderRadius: '4px',
                  border: isSelected ? '2px solid #546bff' : '1px solid #dee2e6'
                }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleVmSelection(vm)}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>{vm.name}</div>
                    {isSelected ? (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '2px' }}>IP 주소</label>
                          {vm.ips && vm.ips.length > 1 ? (
                            <select
                              className="input"
                              value={selectedVm?.ip || vm.ip}
                              onChange={(e) => updateSelectedVm(vm.name, 'ip', e.target.value)}
                              style={{ fontSize: '12px', padding: '4px 8px' }}
                            >
                              {vm.ips.map((ip, ipIndex) => (
                                <option key={ipIndex} value={ip}>{ip}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              className="input"
                              value={selectedVm?.ip || vm.ip}
                              onChange={(e) => updateSelectedVm(vm.name, 'ip', e.target.value)}
                              placeholder="IP 주소"
                              style={{ fontSize: '12px', padding: '4px 8px' }}
                            />
                          )}
                        </div>
                        <div style={{ width: '100px' }}>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '2px' }}>포트</label>
                          <input
                            type="text"
                            className="input"
                            value={selectedVm?.port || vm.port}
                            onChange={(e) => updateSelectedVm(vm.name, 'port', e.target.value)}
                            placeholder="9100"
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                          />
                        </div>
                        <button
                          className="button button-danger"
                          onClick={() => removeSelectedVm(vm.name)}
                          style={{ fontSize: '12px', padding: '4px 8px' }}
                        >
                          삭제
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {vm.ip || 'IP 없음'} : {vm.port}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {selectedVms.length > 0 && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px', fontSize: '12px' }}>
            <strong>선택된 VM:</strong> {selectedVms.map(vm => vm.vmName).join(', ')} ({selectedVms.length}개)
          </div>
        )}
      </div>

      {/* 기존 Job 등록 섹션 (하위 호환성 유지) */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '6px', border: '1px solid #ffc107' }}>
        <h3 style={{ marginTop: '0', marginBottom: '10px', fontSize: '16px', color: '#856404' }}>
          ⚠️ 기존 방식 (하위 호환성)
        </h3>
        <p style={{ fontSize: '12px', color: '#856404', marginBottom: '10px' }}>
          아래 버튼은 기존 방식으로 모든 기능을 한 번에 등록합니다. 아래의 "VM별 모니터링 기능 관리" 섹션을 사용하는 것을 권장합니다.
        </p>
        <button
          className="button button-success"
          onClick={addJob}
          disabled={loading}
        >
          {loading ? '등록 중...' : 'Prometheus Job 등록'}
        </button>
        {targetStatus && (
          <button
            className="button"
            onClick={() => checkTargetStatus(targetStatus.jobName)}
            disabled={loading}
            style={{ marginLeft: '10px' }}
          >
            Target 상태 확인
          </button>
        )}
        <button
          className="button"
          onClick={loadJobs}
          disabled={loading}
          style={{ marginLeft: '10px' }}
        >
          Job 목록 새로고침
        </button>
      </div>

      {/* VM별 모니터링 기능 관리 섹션 */}
      <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
        <h3 style={{ marginTop: '0', marginBottom: '15px', fontSize: '18px', color: '#2c3e50' }}>
          📊 VM별 모니터링 기능 관리
        </h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label className="label" style={{ marginBottom: '8px' }}>VM 선택</label>
          <select
            className="input"
            value={selectedVmForManagement || ''}
            onChange={(e) => {
              setSelectedVmForManagement(e.target.value || null);
              setVmStatus(null);
            }}
            style={{ width: '100%', maxWidth: '400px' }}
          >
            <option value="">VM을 선택하세요</option>
            {vms.map((vm) => (
              <option key={vm.name} value={vm.name}>
                {vm.name} ({vm.ip || 'IP 없음'})
              </option>
            ))}
          </select>
        </div>

        {selectedVmForManagement && (
          <>
            <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
              <button
                className="button"
                onClick={() => checkVmStatus(selectedVmForManagement)}
                disabled={loadingStatus || !selectedVmForManagement}
              >
                {loadingStatus ? '조회 중...' : '조회'}
              </button>
            </div>

            {vmStatus && (
              <>
                <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                  <h4 style={{ marginTop: '0', marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>
                    등록 상태
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>
                        {vmStatus.infraDashboard?.registered ? '☑' : '☐'}
                      </span>
                      <span style={{ fontSize: '13px' }}>
                        서버 인프라 대시보드
                        {vmStatus.infraDashboard?.registered && (
                          <span style={{ color: '#28a745', marginLeft: '8px' }}>
                            (등록됨: {vmStatus.infraDashboard.jobName})
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>
                        {vmStatus.jvmDashboard?.registered ? '☑' : '☐'}
                      </span>
                      <span style={{ fontSize: '13px' }}>
                        JVM 대시보드
                        {vmStatus.jvmDashboard?.registered && (
                          <span style={{ color: '#28a745', marginLeft: '8px' }}>
                            (등록됨: {vmStatus.jvmDashboard.jobName})
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>
                        {vmStatus.loki?.enabled ? '☑' : '☐'}
                      </span>
                      <span style={{ fontSize: '13px' }}>
                        로키 (Promtail 연동)
                        {vmStatus.loki?.enabled && (
                          <span style={{ color: '#28a745', marginLeft: '8px' }}>
                            (연동됨)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #dee2e6' }}>
                  <h4 style={{ marginTop: '0', marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>
                    추가/삭제할 기능 선택
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedFeatures.infraDashboard}
                        onChange={(e) => setSelectedFeatures({ ...selectedFeatures, infraDashboard: e.target.checked })}
                      />
                      <span style={{ fontSize: '13px' }}>서버 인프라 대시보드</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedFeatures.jvmDashboard}
                        onChange={(e) => setSelectedFeatures({ ...selectedFeatures, jvmDashboard: e.target.checked })}
                      />
                      <span style={{ fontSize: '13px' }}>JVM 대시보드</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedFeatures.loki}
                        onChange={(e) => setSelectedFeatures({ ...selectedFeatures, loki: e.target.checked })}
                      />
                      <span style={{ fontSize: '13px' }}>로키 (Promtail 연동)</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="button button-success"
                    onClick={addFeatures}
                    disabled={loading || loadingStatus}
                  >
                    {loading ? '추가 중...' : '추가'}
                  </button>
                  <button
                    className="button button-danger"
                    onClick={removeFeatures}
                    disabled={loading || loadingStatus}
                  >
                    {loading ? '삭제 중...' : '삭제'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {targetStatus && targetStatus.targets && (
        <div style={{ marginTop: '20px' }}>
          <h3>Target 상태</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Instance</th>
                <th>Health</th>
                <th>Last Error</th>
                <th>Last Scrape</th>
              </tr>
            </thead>
            <tbody>
              {targetStatus.targets.map((target, index) => (
                <tr key={index}>
                  <td>{target.instance}</td>
                  <td>
                    <span className={`status-badge ${
                      target.health === 'up' ? 'status-success' : 'status-error'
                    }`}>
                      {target.health}
                    </span>
                  </td>
                  <td>{target.lastError || '-'}</td>
                  <td>{target.lastScrape ? new Date(target.lastScrape).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {/* Alertmanager 라우팅 규칙 목록 */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Alertmanager 라우팅 규칙</h2>
            <button className="button" onClick={loadRoutingRules} disabled={loadingRoutingRules}>
              {loadingRoutingRules ? '로딩 중...' : '라우팅 규칙 새로고침'}
            </button>
          </div>
          {loadingRoutingRules ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>라우팅 규칙을 불러오는 중...</div>
          ) : routingRules.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              등록된 라우팅 규칙이 없습니다.
            </div>
          ) : (
            <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>서비스명</th>
                  <th style={{ width: '40%' }}>수신자</th>
                  <th style={{ width: '30%' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {routingRules.map((rule, index) => (
                  <tr key={index}>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rule.service}>
                      {rule.service}
                    </td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rule.receiver}>
                      {rule.receiver}
                    </td>
                    <td>
                      <button
                        className="button button-danger"
                        onClick={() => deleteRoutingRule(rule.service)}
                        disabled={loading}
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '12px', color: '#856404' }}>
            <strong>참고:</strong> 오토스케일링 설정을 삭제했지만 라우팅 규칙이 남아있는 경우, 여기서 수동으로 삭제할 수 있습니다.
          </div>
        </div>
        
        {/* 등록된 Job 목록 */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>등록된 Job 목록</h2>
            <button className="button" onClick={loadJobs} disabled={loading}>
              {loading ? '로딩 중...' : 'Job 목록 새로고침'}
            </button>
          </div>
          
          {jobs.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              등록된 Job이 없습니다.
            </div>
          ) : (
            <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>Job명</th>
                  <th style={{ width: '25%' }}>타겟</th>
                  <th style={{ width: '40%' }}>라벨</th>
                  <th style={{ width: '15%' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, index) => (
                  <tr key={index}>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.jobName}>
                      {job.jobName}
                    </td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.targets.join(', ')}>
                      {job.targets.join(', ')}
                    </td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={JSON.stringify(job.labels)}>
                      {JSON.stringify(job.labels)}
                    </td>
                    <td>
                      <button
                        className="button button-danger"
                        onClick={() => deleteJob(job.jobName)}
                        disabled={loading}
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default PrometheusMonitoring;