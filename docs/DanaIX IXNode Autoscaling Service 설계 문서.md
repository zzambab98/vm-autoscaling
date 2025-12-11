<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DanaIX IXNode Autoscaling Service 설계 문서</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      mermaid.initialize({ 
        startOnLoad: true,
        theme: 'default',
        securityLevel: 'loose',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        padding: 20
      },
      sequence: {
        diagramMarginX: 50,
        diagramMarginY: 10,
        actorMargin: 50,
        width: 150,
        height: 65,
        boxMargin: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35
      },
        themeVariables: {
          primaryColor: '#546bff',
          primaryTextColor: '#fff',
          primaryBorderColor: '#546bff',
          lineColor: '#546bff',
          secondaryColor: '#1fc9a7',
          tertiaryColor: '#e1e9ff',
          background: '#ffffff',
          mainBkg: '#ffffff',
          secondBkg: '#f2f6ff',
          textColor: '#0d1538',
          secondaryTextColor: 'rgba(13, 21, 56, 0.65)',
          tertiaryTextColor: '#1f2f6b'
        }
      });
    });
  </script>
  <style>
    body {
      font-family: 'Poppins', 'Noto Sans KR', 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #0d1538;
      margin: 0;
      padding: 48px 32px 64px;
      background: linear-gradient(135deg, #f2f6ff 0%, #e1ecff 45%, #f8fbff 100%);
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
    }
    h1, h2, h3, h4 {
      color: #0d1538;
      margin-top: 32px;
      font-weight: 600;
    }
    h1 { 
      margin-top: 0;
      font-size: 36px;
      font-weight: 700;
      background: linear-gradient(120deg, #546bff, #1fc9a7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    h2 {
      font-size: 28px;
      margin-top: 48px;
      padding-bottom: 12px;
      border-bottom: 2px solid rgba(84, 107, 255, 0.2);
    }
    h3 {
      font-size: 22px;
      margin-top: 32px;
    }
    h4 {
      font-size: 18px;
      margin-top: 24px;
    }
    code, pre {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    pre {
      background: #0d1538;
      color: #e1e9ff;
      padding: 18px 20px;
      border-radius: 10px;
      overflow-x: auto;
      font-size: 14px;
      border: 1px solid rgba(84, 107, 255, 0.2);
      box-shadow: 0 10px 20px rgba(15, 28, 68, 0.25);
    }
    code {
      font-family: 'Poppins', 'Noto Sans KR', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 14px;
    }
    pre code {
      color: #e1e9ff;
    }
    .tag {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      background: rgba(84, 107, 255, 0.15);
      color: #546bff;
      font-size: 12px;
      font-weight: 600;
      margin-right: 6px;
    }
    .box {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(230, 240, 255, 0.96));
      border-radius: 18px;
      padding: 28px;
      margin: 24px 0;
      box-shadow: 0 20px 45px rgba(26, 45, 92, 0.18);
      border: 1px solid rgba(84, 107, 255, 0.25);
      backdrop-filter: blur(16px);
    }
    ul, ol { 
      margin-top: 8px;
      margin-bottom: 16px;
      padding-left: 24px;
    }
    li {
      margin: 8px 0;
      line-height: 1.7;
      color: rgba(13, 21, 56, 0.8);
    }
    a {
      color: #546bff;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s ease;
    }
    a:hover {
      color: #1fc9a7;
      text-decoration: underline;
    }
    p {
      margin: 12px 0;
      line-height: 1.7;
      color: rgba(13, 21, 56, 0.85);
    }
    strong {
      color: #0d1538;
      font-weight: 600;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 24px 0;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(84, 107, 255, 0.25);
      box-shadow: 0 10px 20px rgba(15, 28, 68, 0.15);
    }
    th, td {
      border-bottom: 1px solid rgba(84, 107, 255, 0.2);
      padding: 14px 16px;
      text-align: left;
    }
    th {
      background: linear-gradient(120deg, #546bff, #1fc9a7);
      color: #ffffff;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 12px;
    }
    tr:nth-child(even) {
      background-color: rgba(225, 233, 255, 0.3);
    }
    tr:hover {
      background-color: rgba(84, 107, 255, 0.1);
    }
    .warning {
      background: rgba(251, 191, 36, 0.2);
      border: 1px solid rgba(251, 191, 36, 0.35);
      border-left: 4px solid #fbbf24;
      padding: 14px 18px;
      margin: 20px 0;
      border-radius: 10px;
      color: #92400e;
      font-weight: 500;
    }
    .info {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-left: 4px solid #3b82f6;
      padding: 14px 18px;
      margin: 20px 0;
      border-radius: 10px;
      color: #1e40af;
      font-weight: 500;
    }
    .success {
      background: rgba(52, 211, 153, 0.12);
      border: 1px solid rgba(52, 211, 153, 0.35);
      border-left: 4px solid #34d399;
      padding: 14px 18px;
      margin: 20px 0;
      border-radius: 10px;
      color: #065f46;
      font-weight: 500;
    }
    .mermaid {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(230, 240, 255, 0.96));
      padding: 30px;
      border-radius: 18px;
      margin: 28px 0;
      box-shadow: 0 20px 45px rgba(26, 45, 92, 0.18);
      border: 1px solid rgba(84, 107, 255, 0.25);
      overflow-x: auto;
      text-align: center;
      min-height: 200px;
      backdrop-filter: blur(16px);
    }
    /* Mermaid 다이어그램이 로드될 때까지 로딩 표시 */
    .mermaid:empty::before {
      content: "다이어그램 로딩 중...";
      color: #666;
      font-style: italic;
    }
    pre code class*="language-mermaid"] {
      background: transparent !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    code.language-mermaid {
      display: none;
    }
  </style>
</head>
<body>
  <!-- 헤더 섹션 -->
  <div style="
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.97), rgba(230, 237, 255, 0.96));
    border-radius: 28px;
    padding: 40px;
    margin-bottom: 32px;
    box-shadow: 0 20px 45px rgba(26, 45, 92, 0.18);
    border: 1px solid rgba(84, 107, 255, 0.25);
    backdrop-filter: blur(16px);
  ">
    <div style="position: relative; z-index: 1;">
      <div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap;">
        <img
          src="/logo.svg"
          alt="DanaIX"
          style="height: 64px; width: auto;"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div style="
          width: 64px;
          height: 64px;
          background: linear-gradient(120deg, #546bff, #1fc9a7);
          border-radius: 12px;
          display: none;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 700;
          color: white;
          box-shadow: 0 10px 20px rgba(84, 107, 255, 0.3);
        ">V</div>
        <div>
            <p style="
              text-transform: uppercase;
              font-size: 12px;
              letter-spacing: 0.35em;
              color: rgba(13, 21, 56, 0.65);
              margin: 0;
              font-weight: 500;
            ">Dana Cloud</p>
          <h1 style="
            margin-top: 6px;
            margin-bottom: 0;
            font-size: 36px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #0d1538;
            background: none;
            -webkit-text-fill-color: #0d1538;
          ">DanaIX IXNode Autoscaling Service 설계 문서</h1>
        </div>
      </div>
      <p style="
        margin-top: 18px;
        color: rgba(13, 21, 56, 0.65);
        font-size: 16px;
        line-height: 1.6;
        margin-bottom: 0;
      ">
        DanaIX 확장 파이프라인을 한 화면에서 제어합니다. 이 문서는 전체 시스템의 아키텍처, 동작 원리, 설정 방법을 상세히 설명합니다.
      </p>

      <div style="
        margin-top: 28px;
        padding: 24px 32px;
        border-radius: 18px;
        border: 1px solid rgba(84, 107, 255, 0.25);
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(230, 240, 255, 0.9));
        box-shadow: 0 10px 30px rgba(26, 45, 92, 0.15);
        backdrop-filter: blur(16px);
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 16px;
          font-weight: 600;
          color: #0d1538;
        ">
          <div style="
            padding: 12px 20px;
            background: linear-gradient(120deg, #546bff, #1fc9a7);
            color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(84, 107, 255, 0.3);
            white-space: nowrap;
          ">템플릿</div>
          <div style="color: rgba(13, 21, 56, 0.6); font-size: 20px;">→</div>
          <div style="
            padding: 12px 20px;
            background: linear-gradient(120deg, #546bff, #1fc9a7);
            color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(84, 107, 255, 0.3);
            white-space: nowrap;
          ">Node Exporter</div>
          <div style="color: rgba(13, 21, 56, 0.6); font-size: 20px;">→</div>
          <div style="
            padding: 12px 20px;
            background: linear-gradient(120deg, #546bff, #1fc9a7);
            color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(84, 107, 255, 0.3);
            white-space: nowrap;
          ">Prometheus</div>
          <div style="color: rgba(13, 21, 56, 0.6); font-size: 20px;">→</div>
          <div style="
            padding: 12px 20px;
            background: linear-gradient(120deg, #546bff, #1fc9a7);
            color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(84, 107, 255, 0.3);
            white-space: nowrap;
          ">Autoscaling</div>
          <div style="color: rgba(13, 21, 56, 0.6); font-size: 20px;">→</div>
          <div style="
            padding: 12px 20px;
            background: linear-gradient(120deg, #546bff, #1fc9a7);
            color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(84, 107, 255, 0.3);
            white-space: nowrap;
          ">Alertmanager</div>
          <div style="color: rgba(13, 21, 56, 0.6); font-size: 20px;">→</div>
          <div style="
            padding: 12px 20px;
            background: linear-gradient(120deg, #546bff, #1fc9a7);
            color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(84, 107, 255, 0.3);
            white-space: nowrap;
          ">Grafana</div>
        </div>
      </div>
    </div>
  </div>


  <!-- 1. 서비스 개요 -->
  <h2>1. 서비스 개요</h2>

  <h3>1.1 IXNode Autoscaling 정의</h3>
  <p>IXNode Autoscaling은 다음 요소를 조합해 동작한다.</p>
  <ul>
    <li>vSphere(vCenter)를 통한 VM 템플릿 및 Clone</li>
    <li>PLG Stack (Prometheus, Alertmanager, Grafana)을 통한 메트릭 수집 및 알림</li>
    <li>Jenkins 파이프라인을 통한 VM 생성/삭제 작업 자동화</li>
    <li>F5 LTM Pool/VIP를 통한 트래픽 분산 및 Health Check</li>
  </ul>

  <h3>1.2 도입 목적</h3>
  <ul>
    <li>부하 증가 시 자동 증설을 통해 서비스 가용성 확보</li>
    <li>부하 감소 시 자동 축소로 비용 최적화</li>
    <li>DevOps/운영팀의 반복적인 VM 생성/삭제 및 F5 등록 작업 제거</li>
    <li>기존 인프라(PLG, F5, Jenkins, vSphere)를 최대한 재활용하는 비침투형 구조</li>
  </ul>

  <h3>1.3 제공 기능 요약</h3>
  <ul>
    <li>템플릿 기반 VM 자동 생성 및 삭제</li>
    <li>Prometheus Job / Alert Rule / Alertmanager Route 자동 생성·삭제</li>
    <li>Scale-Out / Scale-In Jenkins 파이프라인 자동 생성 및 실행</li>
    <li>F5 Pool Member 자동 등록/제거</li>
    <li>Node Exporter / Promtail 설치 및 Prometheus, Loki, Grafana 연동</li>
    <li>스케일 이벤트 기록 및 알림</li>
  </ul>

  <h3>1.4 주요 구성 요소</h3>
  <ul>
    <li><b>Frontend</b> (React): 템플릿 관리, 오토스케일링 설정, Node Exporter/Promtail 설치 UI</li>
    <li><b>Backend</b> (Node.js / TypeScript): 설정 저장, 검증, vCenter/PLG/Jenkins/F5 연동</li>
    <li><b>PLG Stack</b>: Prometheus, Alertmanager, Grafana</li>
    <li><b>Jenkins</b>: Autoscale-Out / Autoscale-In 파이프라인 실행</li>
    <li><b>F5 BIG-IP LTM</b>: VIP / Pool / Health Monitor</li>
    <li><b>vSphere (vCenter + ESXi)</b>: VM 및 템플릿 관리</li>
  </ul>

  <h3>1.5 전체 아키텍처 다이어그램</h3>
  <div class="box">
    <div class="mermaid">flowchart TB
  subgraph UserLayer[사용자 레이어]
    UI[Autoscaling UI&lt;br/&gt;React + Vite]
    ADMIN[운영자]
  end

  subgraph ControlLayer[제어 레이어]
    subgraph Backend[Backend API Server]
      CFG[Config Service&lt;br/&gt;설정 관리]
      VCAPI[vCenter Service&lt;br/&gt;VM/Template 관리]
      JAPI[Jenkins Service&lt;br/&gt;Job 생성/트리거]
      PAPI[Prometheus Service&lt;br/&gt;Job/Target 관리]
      AAPI[Alertmanager Service&lt;br/&gt;Route/Webhook 관리]
      F5API[F5 Service&lt;br/&gt;Pool Member 관리]
      COOLDOWN[Cooldown Service&lt;br/&gt;쿨다운 관리]
    end
  end

  subgraph MonitoringLayer[모니터링 레이어]
    subgraph PLG[PLG Stack]
      PM[Prometheus&lt;br/&gt;메트릭 수집]
      AM[Alertmanager&lt;br/&gt;알림 라우팅]
      GF[Grafana&lt;br/&gt;대시보드]
      LOKI[Loki&lt;br/&gt;로그 수집]
    end
  end

  subgraph AutomationLayer[자동화 레이어]
    subgraph CI[Jenkins]
      JN_OUT[plg-autoscale-out&lt;br/&gt;스케일아웃 파이프라인]
      JN_IN[plg-autoscale-in&lt;br/&gt;스케일인 파이프라인]
    end
  end

  subgraph InfrastructureLayer[인프라 레이어]
    subgraph VSphere[vSphere]
      VC[vCenter&lt;br/&gt;VM 관리]
      ESX[ESXi Cluster&lt;br/&gt;하이퍼바이저]
    end

    subgraph F5BOX[F5 BIG-IP]
      F5[F5 LTM&lt;br/&gt;VIP / Pool / Health Check]
    end

    subgraph NetworkLayer[네트워크]
      VLAN[VLAN 1048&lt;br/&gt;IP Pool 관리]
    end
  end

  subgraph ServiceLayer[서비스 레이어]
    subgraph Nodes[서비스 VM 인스턴스]
      VM1[VM #1&lt;br/&gt;Node Exporter&lt;br/&gt;Promtail]
      VM2[VM #2&lt;br/&gt;Node Exporter&lt;br/&gt;Promtail]
      VMN[VM #N&lt;br/&gt;Node Exporter&lt;br/&gt;Promtail]
    end
  end

  ADMIN --> UI
  UI -->|HTTP/REST| CFG
  CFG --> VCAPI
  CFG --> PAPI
  CFG --> AAPI
  CFG --> JAPI
  CFG --> F5API
  CFG --> COOLDOWN

  PAPI &lt;--&gt;|SSH/API| PM
  AAPI &lt;--&gt;|SSH/API| AM
  JAPI &lt;--&gt;|HTTP/API| JN_OUT
  JAPI &lt;--&gt;|HTTP/API| JN_IN
  VCAPI &lt;--&gt;|govc CLI| VC
  F5API &lt;--&gt;|REST API| F5

  PM -->|메트릭 수집| VM1
  PM -->|메트릭 수집| VM2
  PM -->|메트릭 수집| VMN
  PM -->|Alert 전송| AM
  AM -->|Webhook| JN_OUT
  AM -->|Webhook| JN_IN
  AM -->|Webhook| Backend

  JN_OUT -->|govc clone| VC
  JN_IN -->|govc destroy| VC
  JN_OUT -->|REST API| F5
  JN_IN -->|REST API| F5
  JN_OUT -->|SSH| VM1
  JN_OUT -->|SSH| VM2
  JN_OUT -->|SSH| VMN

  VC -->|VM 배포| ESX
  VM1 -->|트래픽| F5
  VM2 -->|트래픽| F5
  VMN -->|트래픽| F5
  F5 -->|Health Check| VM1
  F5 -->|Health Check| VM2
  F5 -->|Health Check| VMN

  PM -->|쿼리| GF
  LOKI -->|로그 수집| VM1
  LOKI -->|로그 수집| VM2
  LOKI -->|로그 수집| VMN</div>
  </div>

  <h3>1.6 데이터 플로우 다이어그램</h3>
  <div class="box">
    <div class="mermaid">flowchart TD
  START([설정 생성/활성화]) --> CONFIG[Backend: Config 저장]
  CONFIG --> PROM_CREATE[Prometheus: Job 생성]
  CONFIG --> ALERT_CREATE[Prometheus: Alert Rule 생성]
  CONFIG --> AM_CREATE[Alertmanager: Route/Webhook 생성]
  CONFIG --> JENKINS_CREATE[Jenkins: Job 생성]

  PROM_CREATE --> METRIC[Prometheus: 메트릭 수집 시작]
  METRIC --> CHECK{임계값 초과?}
  CHECK -->|Yes| ALERT_FIRE[Alert Firing]
  CHECK -->|No| METRIC

  ALERT_FIRE --> AM_RECEIVE[Alertmanager: Alert 수신]
  AM_RECEIVE --> AM_ROUTE{라우팅 규칙 매칭}
  AM_ROUTE -->|Scale-Out| WEBHOOK_OUT[Backend Webhook 호출]
  AM_ROUTE -->|Scale-In| WEBHOOK_IN[Backend Webhook 호출]

  WEBHOOK_OUT --> CHECK_COOLDOWN_OUT{쿨다운 체크}
  CHECK_COOLDOWN_OUT -->|쿨다운 중| BLOCK_OUT[차단]
  CHECK_COOLDOWN_OUT -->|가능| CHECK_MAX{최대 VM 개수 체크}
  CHECK_MAX -->|도달| BLOCK_MAX[차단 + 쿨다운 시작]
  CHECK_MAX -->|미도달| JENKINS_OUT[Jenkins: Scale-Out 실행]

  WEBHOOK_IN --> CHECK_COOLDOWN_IN{쿨다운 체크}
  CHECK_COOLDOWN_IN -->|쿨다운 중| BLOCK_IN[차단]
  CHECK_COOLDOWN_IN -->|가능| CHECK_MIN{최소 VM 개수 체크}
  CHECK_MIN -->|도달| BLOCK_MIN[차단 + 쿨다운 시작]
  CHECK_MIN -->|미도달| JENKINS_IN[Jenkins: Scale-In 실행]

  JENKINS_OUT --> VM_CREATE[VM 생성]
  VM_CREATE --> IP_SET[IP 설정]
  IP_SET --> F5_ADD[F5 Pool 추가]
  F5_ADD --> PROM_ADD[Prometheus Target 추가]
  PROM_ADD --> COOLDOWN_START_OUT[쿨다운 시작]

  JENKINS_IN --> VM_SELECT[VM 선택]
  VM_SELECT --> F5_REMOVE[F5 Pool 제거]
  F5_REMOVE --> PROM_REMOVE[Prometheus Target 제거]
  PROM_REMOVE --> VM_DELETE[VM 삭제]
  VM_DELETE --> COOLDOWN_START_IN[쿨다운 시작]

  BLOCK_OUT --> END([종료])
  BLOCK_MAX --> END
  BLOCK_IN --> END
  BLOCK_MIN --> END
  COOLDOWN_START_OUT --> END
  COOLDOWN_START_IN --> END</div>
  </div>

  <h3>1.7 전체 동작 시나리오 요약</h3>
  <ol>
    <li>운영자가 UI에서 템플릿 생성 및 오토스케일링 설정을 생성/활성화한다.</li>
    <li>Backend가 Prometheus Job/Alert Rule, Alertmanager Route, Jenkins Job을 자동 생성한다.</li>
    <li>Prometheus가 Node Exporter 메트릭을 수집하고 임계값을 초과하면 Alertmanager로 알림을 보낸다.</li>
    <li>Alertmanager가 백엔드 웹훅을 호출한다 (백엔드에서 쿨다운 및 최소/최대 VM 개수 체크).</li>
    <li>백엔드에서 검증 통과 시 Jenkins Webhook을 호출한다.</li>
    <li>Jenkins 파이프라인이 VM 생성/삭제, F5 Pool 등록/제거, Prometheus 타겟 추가/삭제를 수행한다.</li>
    <li>Prometheus Job에 등록된 VM 타겟 개수를 기준으로 최소/최대 VM 수를 제어한다.</li>
  </ol>

  <h3>1.8 컴포넌트 상호작용 다이어그램</h3>
  <div class="box">
    <div class="mermaid">graph TB
  subgraph SetupPhase[설정 단계]
    UI1[UI: 설정 생성] --> BE1[Backend: Config 저장]
    BE1 --> PM1[Prometheus: Job 생성]
    BE1 --> AR1[Prometheus: Alert Rule 생성]
    BE1 --> AM1[Alertmanager: Route 생성]
    BE1 --> JN1[Jenkins: Job 생성]
  end

  subgraph MonitoringPhase[모니터링 단계]
    VM_M[VM: Node Exporter] -->|메트릭| PM_M[Prometheus: 수집]
    PM_M -->|평가| AR_M[Alert Rule: 평가]
    AR_M -->|Alert Firing| AM_M[Alertmanager: 수신]
  end

  subgraph DecisionPhase[판단 단계]
    AM_M -->|Webhook| BE_D[Backend: Webhook 수신]
    BE_D --> CD[Cooldown 체크]
    BE_D --> CNT[VM 개수 체크]
    CD -->|통과| CNT
    CNT -->|통과| JN_D[Jenkins: 트리거]
    CD -->|차단| BLOCK[차단]
    CNT -->|차단| BLOCK
  end

  subgraph ExecutionPhase[실행 단계]
    JN_D -->|Scale-Out| VC_E[vCenter: VM 생성]
    JN_D -->|Scale-In| VC_D[vCenter: VM 삭제]
    VC_E --> F5_E[F5: Pool 추가]
    VC_D --> F5_D[F5: Pool 제거]
    F5_E --> PM_E[Prometheus: Target 추가]
    F5_D --> PM_D[Prometheus: Target 제거]
    PM_E --> COOLDOWN_E[쿨다운 시작]
    PM_D --> COOLDOWN_D[쿨다운 시작]
  end

  SetupPhase --> MonitoringPhase
  MonitoringPhase --> DecisionPhase
  DecisionPhase --> ExecutionPhase</div>
  </div>

  <!-- 2. 전제 조건 -->
  <h2>2. 전제 조건 및 준비사항</h2>

  <h3>2.1 인프라 준비</h3>
  <ul>
    <li>vSphere(vCenter) 접근 가능, govc CLI 사용 가능</li>
    <li>F5 BIG-IP LTM에 대상 서비스용 Pool, VIP, HTTP Health Monitor 구성 완료</li>
    <li>PLG Stack(Prometheus, Alertmanager, Grafana) 운영 중</li>
  </ul>

  <h3>2.2 서버 및 네트워크</h3>
  <ul>
    <li>초기 서비스 VM 최소 2대 이상 운영 (고정 IP)</li>
    <li>Node Exporter 설치 또는 Node Exporter 설치 기능 사용</li>
    <li>오토스케일링용 IP Pool 및 VLAN 정보 정의
      <ul>
        <li>예: 10.255.48.220 ~ 10.255.48.230 /24, Gateway 10.255.48.1, VLAN 1048</li>
      </ul>
    </li>
  </ul>

  <!-- 3. 동작 구조 -->
  <h2>3. Autoscaling 전체 동작 구조</h2>

  <h3>3.1 스케일 아웃 상세 프로세스</h3>
  <div class="box">
    <div class="mermaid">flowchart TD
  START([Alert 발생]) --> WEBHOOK[Backend Webhook 수신]
  WEBHOOK --> CHECK_COOLDOWN{쿨다운 체크}
  CHECK_COOLDOWN -->|쿨다운 중| REJECT1[차단: 쿨다운 중]
  CHECK_COOLDOWN -->|가능| CHECK_MAX{최대 VM 개수 체크}
  CHECK_MAX -->|currentVmCount >= maxVms| REJECT2[차단: 최대 개수 도달<br/>쿨다운 시작]
  CHECK_MAX -->|가능| JENKINS[Jenkins 파이프라인 시작]
  
  JENKINS --> GET_CONFIG[설정 조회]
  GET_CONFIG --> IP_ALLOC[IP Pool에서 IP 할당]
  IP_ALLOC --> VM_CLONE[vCenter: Template Clone]
  VM_CLONE --> VM_POWER[VM 전원 켜기]
  VM_POWER --> IP_CONFIG[SSH: IP 설정]
  IP_CONFIG --> HEALTH_CHECK[Health Check 대기]
  HEALTH_CHECK --> F5_ADD[F5: Pool Member 추가]
  F5_ADD --> PROM_ADD[Prometheus: Target 추가]
  PROM_ADD --> WEBHOOK_CALLBACK[Backend: VM 생성 완료 웹훅]
  WEBHOOK_CALLBACK --> COOLDOWN_START[쿨다운 시작]
  COOLDOWN_START --> END([완료])
  
  REJECT1 --> END
  REJECT2 --> END</div>
  </div>

  <h3>3.2 스케일 인 상세 프로세스</h3>
  <div class="box">
    <div class="mermaid">flowchart TD
  START([Alert 발생]) --> WEBHOOK[Backend Webhook 수신]
  WEBHOOK --> CHECK_COOLDOWN{쿨다운 체크}
  CHECK_COOLDOWN -->|쿨다운 중| REJECT1[차단: 쿨다운 중]
  CHECK_COOLDOWN -->|가능| CHECK_MIN{최소 VM 개수 체크}
  CHECK_MIN -->|currentVmCount <= minVms| REJECT2[차단: 최소 개수 도달<br/>쿨다운 시작]
  CHECK_MIN -->|가능| JENKINS[Jenkins 파이프라인 시작]
  
  JENKINS --> GET_CONFIG[설정 조회]
  GET_CONFIG --> GET_VMS[Prometheus: Target 목록 조회]
  GET_VMS --> FILTER_VMS[vCenter: VM Prefix로 필터링]
  FILTER_VMS --> SELECT_VM[가장 오래된 VM 선택<br/>LIFO 방식]
  SELECT_VM --> F5_REMOVE[F5: Pool Member 제거]
  F5_REMOVE --> F5_NODE[F5: Node 삭제]
  F5_NODE --> MONITOR_REMOVE[모니터링 제거<br/>Node Exporter/Promtail]
  MONITOR_REMOVE --> PROM_REMOVE[Prometheus: Target 제거]
  PROM_REMOVE --> VM_POWER_OFF[vCenter: VM 전원 끄기]
  VM_POWER_OFF --> VM_DELETE[vCenter: VM 삭제]
  VM_DELETE --> WEBHOOK_CALLBACK[Backend: VM 삭제 완료 웹훅]
  WEBHOOK_CALLBACK --> COOLDOWN_START[쿨다운 시작]
  COOLDOWN_START --> END([완료])
  
  REJECT1 --> END
  REJECT2 --> END</div>
  </div>

  <h3>3.3 스케일 아웃 시퀀스 다이어그램</h3>
  <div class="box">
    <div class="mermaid">sequenceDiagram
  participant User as User
  participant UI as Autoscaling UI
  participant BE as Backend API
  participant PM as Prometheus
  participant AM as Alertmanager
  participant JN as Jenkins
  participant VC as vCenter
  participant F5 as F5 LTM

  User->>UI: 오토스케일링 설정 생성/활성화
  UI->>BE: POST /api/autoscaling/configs
  BE->>PM: Job/Alert Rule 생성
  BE->>AM: Route/Webhook 생성
  BE->>JN: Autoscale Out/In Job 생성

  PM-->>PM: Node Exporter 메트릭 수집
  PM-->>AM: Alert (High CPU/Memory)
  AM-->>JN: Webhook 호출 (scale-out)

  JN->>BE: AutoscalingConfig 조회
  BE-->>JN: 설정 반환 (minVms, maxVms 등)

  JN->>PM: Prometheus Target 조회
  JN->>JN: currentVmCount 계산
  JN->>JN: decideScaleAction(config, state, "scale-out")
  JN->>VC: Template Clone &amp; VM 생성
  JN->>VM: Netplan IP 설정 및 HealthCheck
  JN->>F5: Pool Member 추가
  JN->>PM: Target 추가</div>
  </div>

  <h3>3.4 스케일 인 시퀀스 다이어그램</h3>
  <div class="box">
    <div class="mermaid">sequenceDiagram
  participant PM as Prometheus
  participant AM as Alertmanager
  participant JN as Jenkins
  participant BE as Backend API
  participant VC as vCenter
  participant F5 as F5 LTM

  PM-->>AM: Alert (Low CPU/Memory)
  AM-->>JN: Webhook 호출 (scale-in)

  JN->>BE: AutoscalingConfig 조회
  BE-->>JN: 설정 반환

  JN->>PM: Prometheus Target 조회
  JN->>JN: currentVmCount 계산
  JN->>JN: decideScaleAction(config, state, "scale-in")

  JN->>VC: vmPrefix 기반 VM 목록 조회
  JN->>JN: 가장 오래된 VM 선택
  JN->>F5: Pool Member 제거
  JN->>PM: Target 제거
  JN->>VC: VM 삭제</div>
  </div>

  <!-- 4. 데이터 모델 -->
  <h2>4. 데이터 모델 (TypeScript)</h2>

  <h3>4.1 템플릿 메타데이터</h3>
  <pre><code class="language-ts">export interface TemplateMetadata {
  id: string;
  name: string;
  sourceVmName: string;
  vcenterPath: string;
  datastore: string;
  createdAt: string;      // ISO8601
  description?: string;
  tags?: string[];
}</code></pre>

  <h3>4.2 오토스케일링 설정</h3>
  <pre><code class="language-ts">export interface AutoscalingMonitoringConfig {
  cpuThreshold: number;            // Scale-Out CPU (%)
  memoryThreshold: number;         // Scale-Out Memory (%)
  durationMinutes: number;         // Scale-Out 조건 유지 시간

  scaleInCpuThreshold: number;     // Scale-In CPU (%)
  scaleInMemoryThreshold: number;  // Scale-In Memory (%)
  scaleInDurationMinutes: number;  // Scale-In 조건 유지 시간

  cooldownSeconds: number;         // Scale-In/Out 공통 쿨다운
}

export interface AutoscalingNetworkConfig {
  ipPoolStart: string;     // 예: "10.255.48.220"
  ipPoolEnd: string;       // 예: "10.255.48.230"
  gateway: string;         // 예: "10.255.48.1"
  subnetCidr: string;      // 예: "10.255.48.0/24"
  vlanId: number;          // 예: 1048
}

export interface AutoscalingF5Config {
  poolName: string;        // 예: "auto-vm-test-pool"
  vipAddress: string;      // 예: "10.255.48.229"
  vipPort: number;         // 예: 80
  healthCheckPath: string; // 예: "/health"
}

export interface AutoscalingConfig {
  id: string;
  serviceName: string;         // 예: "auto-vm-test"
  prometheusJobName: string;   // 예: "auto-vm-test-service"

  templateId: string;
  vmPrefix: string;            // 예: "auto-vm-test"

  minVms: number;              // 최소 VM 개수
  maxVms: number;              // 최대 VM 개수
  scaleOutStep: number;        // 스케일 아웃 시 추가 VM 수
  scaleInStep: number;         // 스케일 인 시 삭제 VM 수

  monitoring: AutoscalingMonitoringConfig;
  network: AutoscalingNetworkConfig;
  f5: AutoscalingF5Config;

  sshUser: string;             // VM 접속 계정 (예: ubuntu)
  sshKeyPath: string;          // Jenkins 기준 SSH Key 경로

  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}</code></pre>

  <!-- 5. 스케일 조건 -->
  <h2>5. 스케일 아웃 / 스케일 인 조건</h2>

  <h3>5.1 스케일 아웃 조건</h3>
  <div class="info">
    <p><strong>주의:</strong> 스케일아웃 조건은 <code>max()</code> 함수를 사용하여 <strong>모든 인스턴스 중 최대값</strong>이 임계값을 초과할 때 트리거됩니다. 즉, 하나라도 높은 사용률이면 스케일아웃이 발생합니다.</p>
  </div>
  
  <h4>5.1.1 CPU 사용률 기반 스케일아웃 (예시 PromQL)</h4>
  <pre><code>max(
  100 - (avg by (instance) (
    rate(node_cpu_seconds_total{mode="idle",job="&lt;JOB_NAME&gt;"}[5m])
  ) * 100)
) &gt; CPU_THRESHOLD</code></pre>

  <pre><code>max(
  (1 - (avg by (instance) (
    node_memory_MemAvailable_bytes{job="&lt;JOB_NAME&gt;"}
  ) / avg by (instance) (
    node_memory_MemTotal_bytes{job="&lt;JOB_NAME&gt;"}
  ))) * 100
) &gt; MEMORY_THRESHOLD</code></pre>

  <h3>5.2 스케일 인 조건</h3>
  <div class="info">
    <p><strong>주의:</strong> 스케일인 조건은 <code>max()</code> 함수를 사용하여 <strong>모든 인스턴스의 최대값</strong>이 임계값 이하일 때 트리거됩니다. 즉, 모든 VM이 낮은 사용률일 때만 스케일인이 발생합니다.</p>
  </div>
  
  <h4>5.2.1 CPU 및 Memory 사용률 기반 스케일인 (예시 PromQL)</h4>
  <pre><code>(
  max(
    100 - (avg by (instance) (
      rate(node_cpu_seconds_total{mode="idle",job="&lt;JOB_NAME&gt;"}[5m])
    ) * 100)
  ) &lt; SCALE_IN_CPU_THRESHOLD
)
AND
(
  max(
    (1 - (avg by (instance) (
      node_memory_MemAvailable_bytes{job="&lt;JOB_NAME&gt;"}
    ) / avg by (instance) (
      node_memory_MemTotal_bytes{job="&lt;JOB_NAME&gt;"}
    ))) * 100
  ) &lt; SCALE_IN_MEMORY_THRESHOLD
)</code></pre>
  <div class="info">
    <p><strong>설명:</strong> <code>max()</code> 함수를 사용하여 모든 인스턴스의 최대 CPU/Memory 사용률이 임계값 이하일 때만 스케일인이 발생합니다. 즉, 모든 VM이 낮은 사용률일 때만 스케일인이 트리거됩니다.</p>
  </div>

  <!-- 6. 스케일 인/아웃 판단 로직(변경 내용) -->
  <h2>6. 스케일 인/아웃 개수 판단 로직 (변경 내용 포함)</h2>

  <h3>6.1 변경 전 문제점</h3>
  <ul>
    <li>스케일 인 시 vCenter, F5, Prometheus 등 여러 소스의 VM 목록을 복잡한 로직으로 필터링한 후 개수를 비교</li>
    <li>소스별 정보 불일치 시 최소/최대 VM 개수 판단이 달라질 수 있어 기준이 일관되지 않음</li>
  </ul>

  <h3>6.2 변경 후 정책</h3>
  <ul>
    <li><b>단일 기준:</b> 스케일 인/아웃 모두 <b>Prometheus Job에 등록된 VM 타겟 개수</b>(currentVmCount)를 기준으로 판단</li>
    <li><b>스케일 아웃 차단 조건:</b> currentVmCount &gt;= maxVms → 스케일 아웃 차단</li>
    <li><b>스케일 인 차단 조건:</b> currentVmCount &lt;= minVms → 스케일 인 차단</li>
    <li><b>쿨다운 시작:</b> 최소/최대 개수에 도달한 시점에 쿨다운을 시작하여 Alertmanager 반복 알림에 의한 파이프라인 폭주 방지</li>
    <li><b>로직 단순화:</b> 불필요한 중복 체크 제거, Prometheus Job 타겟만으로 최소/최대 개수 판단</li>
  </ul>

  <h3>6.3 판단 로직 플로우차트</h3>
  <div class="box">
    <div class="mermaid">flowchart TD
  START([웹훅 수신]) --> TYPE{스케일 타입}
  TYPE -->|Scale-Out| CHECK_COOLDOWN_OUT{쿨다운 체크}
  TYPE -->|Scale-In| CHECK_COOLDOWN_IN{쿨다운 체크}
  
  CHECK_COOLDOWN_OUT -->|쿨다운 중| REJECT_COOLDOWN_OUT[차단: 쿨다운]
  CHECK_COOLDOWN_OUT -->|가능| GET_COUNT_OUT[Prometheus Target 개수 조회]
  GET_COUNT_OUT --> CHECK_MAX{currentVmCount >= maxVms?}
  CHECK_MAX -->|Yes| REJECT_MAX[차단: 최대 개수 도달<br/>쿨다운 시작]
  CHECK_MAX -->|No| ALLOW_OUT[허용: 스케일아웃 실행]
  
  CHECK_COOLDOWN_IN -->|쿨다운 중| REJECT_COOLDOWN_IN[차단: 쿨다운]
  CHECK_COOLDOWN_IN -->|가능| GET_COUNT_IN[Prometheus Target 개수 조회]
  GET_COUNT_IN --> CHECK_MIN{currentVmCount <= minVms?}
  CHECK_MIN -->|Yes| REJECT_MIN[차단: 최소 개수 도달<br/>쿨다운 시작]
  CHECK_MIN -->|No| ALLOW_IN[허용: 스케일인 실행]
  
  REJECT_COOLDOWN_OUT --> END([종료])
  REJECT_MAX --> END
  REJECT_COOLDOWN_IN --> END
  REJECT_MIN --> END
  ALLOW_OUT --> END
  ALLOW_IN --> END</div>
  </div>

  <h3>6.4 TypeScript 의사 코드</h3>
  <pre><code class="language-ts">interface CurrentState {
  currentVmCount: number;       // Prometheus Job 타겟 수
  lastScaleOutAt?: number;      // epoch ms
  lastScaleInAt?: number;       // epoch ms
}

function isInCooldown(
  now: number,
  lastActionAt?: number,
  cooldownSeconds?: number
): boolean {
  if (!lastActionAt || !cooldownSeconds) return false;
  return now - lastActionAt &lt; cooldownSeconds * 1000;
}

export function decideScaleAction(
  config: AutoscalingConfig,
  state: CurrentState,
  alertType: "scale-out" | "scale-in"
): "ALLOW" | "BLOCK_MIN" | "BLOCK_MAX" | "BLOCK_COOLDOWN" {
  const { minVms, maxVms, monitoring } = config;
  const { currentVmCount, lastScaleOutAt, lastScaleInAt } = state;
  const now = Date.now();

  if (alertType === "scale-out") {
    if (currentVmCount &gt;= maxVms) {
      // 최대 개수 도달 → 스케일 아웃 차단 + 쿨다운 시작
      return "BLOCK_MAX";
    }
    if (isInCooldown(now, lastScaleOutAt, monitoring.cooldownSeconds)) {
      return "BLOCK_COOLDOWN";
    }
    return "ALLOW";
  }

  if (alertType === "scale-in") {
    if (currentVmCount &lt;= minVms) {
      // 최소 개수 도달 → 스케일 인 차단 + 쿨다운 시작
      return "BLOCK_MIN";
    }
    if (isInCooldown(now, lastScaleInAt, monitoring.cooldownSeconds)) {
      return "BLOCK_COOLDOWN";
    }
    return "ALLOW";
  }

  return "ALLOW";
}</code></pre>

  <p><b>요약:</b> 이제 스케일 인/아웃 최소·최대 개수 판단은 Prometheus Job에 등록된 VM 개수만으로 수행하며,</p>
  <ul>
    <li>스케일 아웃: currentVmCount &gt;= maxVms → 차단</li>
    <li>스케일 인: currentVmCount &lt;= minVms → 차단</li>
    <li>최소/최대 도달 시 쿨다운을 시작해 Alert 반복 알림에 의한 불필요한 실행을 막는다.</li>
  </ul>

  <!-- 7. Jenkins 파이프라인 -->
  <h2>7. Jenkins Autoscaling 파이프라인 개요</h2>

  <h3>7.1 Jenkins Job 아키텍처</h3>
  <div class="box">
    <div class="mermaid">graph TB
  subgraph AlertManager[Alertmanager]
    AM[Alert 발생]
  end
  
  subgraph Backend[Backend API]
    WEBHOOK[Webhook 엔드포인트<br/>/api/webhook/autoscale/:serviceName]
    CHECK[쿨다운 및 VM 개수 체크]
    JENKINS_TRIGGER[Jenkins Webhook 호출]
  end
  
  subgraph Jenkins[Jenkins Server]
    JOB_OUT[plg-autoscale-out<br/>스케일아웃 파이프라인]
    JOB_IN[plg-autoscale-in<br/>스케일인 파이프라인]
  end
  
  subgraph PipelineOut[Scale-Out Pipeline]
    STAGE1_OUT[1. Alert 파싱]
    STAGE2_OUT[2. 설정 조회]
    STAGE3_OUT[3. IP 할당]
    STAGE4_OUT[4. VM Clone]
    STAGE5_OUT[5. IP 설정]
    STAGE6_OUT[6. F5 등록]
    STAGE7_OUT[7. Prometheus 등록]
    STAGE8_OUT[8. 완료 웹훅]
  end
  
  subgraph PipelineIn[Scale-In Pipeline]
    STAGE1_IN[1. Alert 파싱]
    STAGE2_IN[2. 설정 조회]
    STAGE3_IN[3. VM 선택]
    STAGE4_IN[4. F5 제거]
    STAGE5_IN[5. 모니터링 제거]
    STAGE6_IN[6. Prometheus 제거]
    STAGE7_IN[7. VM 삭제]
    STAGE8_IN[8. 완료 웹훅]
  end
  
  AM -->|Webhook| WEBHOOK
  WEBHOOK --> CHECK
  CHECK -->|통과| JENKINS_TRIGGER
  JENKINS_TRIGGER -->|Scale-Out| JOB_OUT
  JENKINS_TRIGGER -->|Scale-In| JOB_IN
  
  JOB_OUT --> STAGE1_OUT
  STAGE1_OUT --> STAGE2_OUT
  STAGE2_OUT --> STAGE3_OUT
  STAGE3_OUT --> STAGE4_OUT
  STAGE4_OUT --> STAGE5_OUT
  STAGE5_OUT --> STAGE6_OUT
  STAGE6_OUT --> STAGE7_OUT
  STAGE7_OUT --> STAGE8_OUT
  
  JOB_IN --> STAGE1_IN
  STAGE1_IN --> STAGE2_IN
  STAGE2_IN --> STAGE3_IN
  STAGE3_IN --> STAGE4_IN
  STAGE4_IN --> STAGE5_IN
  STAGE5_IN --> STAGE6_IN
  STAGE6_IN --> STAGE7_IN
  STAGE7_IN --> STAGE8_IN</div>
  </div>

  <h3>7.2 Job 구성</h3>
  <ul>
    <li><code>plg-autoscale-out</code> : 스케일 아웃 전용 파이프라인</li>
    <li><code>plg-autoscale-in</code> : 스케일 인 전용 파이프라인</li>
    <li>Alertmanager Webhook의 라벨/파라미터로 서비스명(serviceName)을 전달하여 대상 AutoscalingConfig를 식별</li>
  </ul>

  <h3>7.2 Scale-Out 파이프라인 단계 (요약)</h3>
  <ol>
    <li>Webhook payload 파싱 (serviceName, alert 정보)</li>
    <li>Backend에서 AutoscalingConfig 조회</li>
    <li>Prometheus Job 타겟 조회 → currentVmCount 계산</li>
    <li><code>decideScaleAction(config, state, "scale-out")</code> 호출 → 실행 가능 여부 판단</li>
    <li>허용 시
      <ul>
        <li>IP Pool에서 사용 가능한 IP 확보</li>
        <li>govc를 이용해 템플릿에서 VM Clone (이름: <code>&lt;vmPrefix&gt;-YYYYMMDDHHmmss</code>)</li>
        <li>VM 부팅 후 SSH 접속 및 Netplan으로 IP 설정</li>
        <li>필요 시 Node Exporter / Promtail 설치</li>
        <li>F5 Pool Member 추가</li>
        <li>Prometheus 타겟 추가</li>
      </ul>
    </li>
  </ol>

  <h3>7.3 Scale-In 파이프라인 단계 (요약)</h3>
  <ol>
    <li>Webhook payload 파싱 (serviceName, alert 정보)</li>
    <li>Backend에서 AutoscalingConfig 조회</li>
    <li>Prometheus Job 타겟 조회 → currentVmCount 계산</li>
    <li><code>decideScaleAction(config, state, "scale-in")</code> 호출 → 실행 가능 여부 판단</li>
    <li>허용 시
      <ul>
        <li>vCenter에서 vmPrefix로 VM 목록 조회</li>
        <li>가장 오래된 VM 선택</li>
        <li>F5 Pool Member 제거</li>
        <li>Prometheus 타겟 제거</li>
        <li>VM OS 종료 후 vCenter에서 VM 삭제</li>
      </ul>
    </li>
  </ol>

  <!-- 8. Node Exporter / Promtail -->
  <h2>8. Node Exporter / Promtail 설치 개요</h2>
  <ul>
    <li>vCenter에서 VM 및 IP 목록을 조회하여 UI에 표시</li>
    <li>사용자가 설치 대상 VM과 SSH 설정(사용자/키)을 선택</li>
    <li>Backend에서 SSH를 통해 Node Exporter / Promtail 설치 스크립트를 실행</li>
    <li>성공 시 Prometheus Job과 Loki/Grafana에 자동 등록</li>
  </ul>

  <!-- 9. 모니터링 -->
  <h2>9. 모니터링 및 대시보드</h2>
  <ul>
    <li>Grafana 대시보드
      <ul>
        <li>CPU/Memory 사용률</li>
        <li>현재 VM 개수</li>
        <li>스케일 인/아웃 이벤트 타임라인</li>
      </ul>
    </li>
    <li>Alertmanager 알림 목록에서 스케일 트리거 원인 확인</li>
  </ul>

  <!-- 10. 이벤트 -->
  <h2>10. Autoscaling 이벤트 관리 (개념)</h2>
  <ul>
    <li>Scale-Out/Scale-In 실행 시 Backend로 이벤트 기록 요청</li>
    <li>예상 필드
      <ul>
        <li>serviceName, action(scale-out | scale-in)</li>
        <li>vmNames, beforeCount, afterCount</li>
        <li>reason, timestamp</li>
      </ul>
    </li>
    <li>향후 UI에서 서비스별 스케일 이력 조회 제공</li>
  </ul>

  <!-- 11. 운영 -->
  <h2>11. 운영 가이드</h2>

  <h3>11.1 초기 설정 절차</h3>
  <ol>
    <li><b>기본 VM 준비</b>
      <ul>
        <li>최소 2대 이상의 서비스 VM 생성 (고정 IP)</li>
        <li>Node Exporter 설치 및 Prometheus Job 등록</li>
        <li>F5 Pool에 기본 VM 등록 및 Health Check 확인</li>
      </ul>
    </li>
    <li><b>템플릿 생성</b>
      <ul>
        <li>UI에서 템플릿 생성 메뉴 선택</li>
        <li>소스 VM 선택 및 템플릿 이름 지정</li>
        <li>vCenter에서 템플릿 생성 완료 확인</li>
      </ul>
    </li>
    <li><b>오토스케일링 설정 생성</b>
      <ul>
        <li>서비스 이름, VM Prefix, 템플릿 선택</li>
        <li>모니터링 설정: CPU/Memory 임계값, 지속 시간</li>
        <li>스케일링 설정: 최소/최대 VM 개수, 스케일 단계</li>
        <li>네트워크 설정: IP Pool 범위, Gateway, VLAN</li>
        <li>F5 설정: Pool 이름, VIP, Health Check Path</li>
      </ul>
    </li>
    <li><b>설정 활성화</b>
      <ul>
        <li>설정 목록에서 활성화 버튼 클릭</li>
        <li>Prometheus Job, Alert Rule, Alertmanager Route 자동 생성 확인</li>
        <li>Jenkins Job 자동 생성 확인</li>
      </ul>
    </li>
    <li><b>테스트 및 검증</b>
      <ul>
        <li>부하 생성 스크립트로 CPU/Memory 사용률 증가</li>
        <li>스케일아웃 트리거 확인</li>
        <li>VM 생성, F5 등록, Prometheus Target 추가 확인</li>
        <li>부하 제거 후 스케일인 트리거 확인</li>
      </ul>
    </li>
  </ol>

  <h3>11.2 일상 운영</h3>
  <ul>
    <li><b>모니터링 대시보드 확인</b>
      <ul>
        <li>CPU/Memory 사용률 그래프 모니터링</li>
        <li>현재 VM 개수 및 스케일 이벤트 확인</li>
        <li>Alert 상태 확인</li>
      </ul>
    </li>
    <li><b>스케일 이벤트 확인</b>
      <ul>
        <li>스케일아웃/인 이벤트 목록에서 최근 작업 확인</li>
        <li>Jenkins 빌드 로그 확인</li>
        <li>에러 발생 시 롤백 여부 확인</li>
      </ul>
    </li>
    <li><b>설정 변경</b>
      <ul>
        <li>임계값 조정 시 설정 수정 후 저장</li>
        <li>Prometheus Alert Rule 자동 업데이트 확인</li>
        <li>변경사항 적용 확인</li>
      </ul>
    </li>
  </ul>

  <h3>11.3 트러블슈팅</h3>
  <div class="box">
    <h4>문제: 스케일아웃이 발생하지 않음</h4>
    <ul>
      <li>Prometheus Alert Rule이 정상적으로 생성되었는지 확인</li>
      <li>Alertmanager Route가 올바르게 설정되었는지 확인</li>
      <li>쿨다운 기간이 지났는지 확인</li>
      <li>최대 VM 개수에 도달하지 않았는지 확인</li>
      <li>Jenkins Job이 정상적으로 생성되었는지 확인</li>
    </ul>

    <h4>문제: 스케일인으로 VM이 계속 삭제됨</h4>
    <ul>
      <li>최소 VM 개수 설정 확인 (기본값: 2)</li>
      <li>스케일인 CPU/Memory 임계값이 너무 높은지 확인</li>
      <li>쿨다운 기간 확인</li>
      <li>Alertmanager가 반복 알림을 보내는지 확인</li>
    </ul>

    <h4>문제: VM 생성 후 F5에 등록되지 않음</h4>
    <ul>
      <li>Jenkins 빌드 로그에서 F5 등록 단계 확인</li>
      <li>F5 Pool 이름 및 VIP 설정 확인</li>
      <li>F5 인증 정보 확인</li>
      <li>네트워크 연결 확인</li>
    </ul>

    <h4>문제: Prometheus에 Target이 추가되지 않음</h4>
    <ul>
      <li>Prometheus Job 이름이 올바른지 확인</li>
      <li>VM IP와 포트(9100)가 올바른지 확인</li>
      <li>Prometheus 설정 파일이 올바르게 업데이트되었는지 확인</li>
      <li>Prometheus 컨테이너 재시작 여부 확인</li>
    </ul>
  </div>

  <!-- 12. 보안 -->
  <h2>12. 보안 및 권한 구조</h2>

  <h3>12.1 인증 및 권한 관리</h3>
  <ul>
    <li><b>vCenter 계정</b>
      <ul>
        <li>전용 서비스 계정 사용 (예: svc-auto)</li>
        <li>VM 생성/삭제, 템플릿 조회 권한만 부여</li>
        <li>관리자 권한 불필요</li>
      </ul>
    </li>
    <li><b>Jenkins 계정</b>
      <ul>
        <li>Webhook 트리거용 계정 (예: danacloud)</li>
        <li>Job 실행 권한만 부여</li>
        <li>Jenkins Credentials로 인증 정보 관리</li>
      </ul>
    </li>
    <li><b>F5 계정</b>
      <ul>
        <li>Pool Member 추가/제거 권한만 부여</li>
        <li>관리자 권한 불필요</li>
        <li>Jenkins Credentials로 관리</li>
      </ul>
    </li>
    <li><b>PLG Stack 계정</b>
      <ul>
        <li>SSH 접근용 계정 (예: ubuntu)</li>
        <li>설정 파일 수정 권한만 부여</li>
        <li>SSH 키 기반 인증 사용</li>
      </ul>
    </li>
  </ul>

  <h3>12.2 데이터 보안</h3>
  <ul>
    <li><b>환경 변수 관리</b>
      <ul>
        <li>모든 민감 정보는 환경 변수로 관리</li>
        <li>코드에 하드코딩 금지</li>
        <li>.env 파일은 .gitignore에 추가</li>
      </ul>
    </li>
    <li><b>네트워크 보안</b>
      <ul>
        <li>Backend/Frontend는 사내망에서만 접근 가능</li>
        <li>VPN 또는 방화벽 규칙으로 외부 접근 차단</li>
        <li>서비스 간 통신은 내부 네트워크 사용</li>
      </ul>
    </li>
    <li><b>SSH 키 관리</b>
      <ul>
        <li>SSH 키는 pemkey 디렉토리에 저장</li>
        <li>파일 권한 600으로 설정</li>
        <li>Git에 커밋하지 않음</li>
      </ul>
    </li>
  </ul>

  <h3>12.3 보안 모범 사례</h3>
  <ul>
    <li>정기적인 보안 업데이트 및 패치 적용</li>
    <li>로그 모니터링 및 이상 징후 탐지</li>
    <li>정기적인 권한 검토 및 최소 권한 원칙 준수</li>
    <li>민감 정보 암호화 저장 (향후 개선)</li>
  </ul>

  <!-- 13. 성능 및 확장성 -->
  <h2>13. 성능 및 확장성</h2>

  <h3>13.1 성능 고려사항</h3>
  <ul>
    <li><b>쿨다운 메커니즘</b>
      <ul>
        <li>기본 쿨다운 기간: 5분 (300초)</li>
        <li>스케일아웃/인 각각 독립적인 쿨다운 관리</li>
        <li>최소/최대 개수 도달 시 자동 쿨다운 시작</li>
        <li>Alertmanager 반복 알림 방지</li>
      </ul>
    </li>
    <li><b>VM 생성 시간</b>
      <ul>
        <li>템플릿 Clone: 약 1-2분</li>
        <li>VM 부팅 및 IP 설정: 약 1-2분</li>
        <li>Health Check 대기: 약 30초</li>
        <li>F5 등록 및 Prometheus 추가: 약 30초</li>
        <li>총 소요 시간: 약 3-5분</li>
      </ul>
    </li>
    <li><b>VM 삭제 시간</b>
      <ul>
        <li>F5 제거: 약 10초</li>
        <li>Prometheus 제거: 약 10초</li>
        <li>VM 전원 끄기: 약 30초</li>
        <li>VM 삭제: 약 1분</li>
        <li>총 소요 시간: 약 2분</li>
      </ul>
    </li>
  </ul>

  <h3>13.2 실제 스케일링 시나리오 예제</h3>
  <div class="box">
    <h4>시나리오 설정</h4>
    <ul>
      <li>초기 상태: VM 1번, VM 2번 운영 중 (최소 VM 개수: 2, 최대 VM 개수: 4)</li>
      <li>스케일아웃 CPU 임계값: 80%, 지속 시간: 1분</li>
      <li>스케일인 CPU 임계값: 30%, 지속 시간: 5분</li>
      <li>쿨다운 기간: 5분</li>
      <li>Alertmanager repeat_interval: 5분</li>
    </ul>

    <h4>스케일아웃 시나리오</h4>
    <div class="mermaid">gantt
    title 스케일아웃 타임라인
    dateFormat HH:mm
    axisFormat %H:%M
    
    section 초기 상태
    VM 1번 운영 :active, vm1, 00:00, 30m
    VM 2번 운영 :active, vm2, 00:00, 30m
    
    section 부하 증가
    CPU 80% 초과 :crit, load, 00:05, 1m
    Alert 발생 :milestone, alert1, 00:06, 0m
    쿨다운 체크 :done, cd1, 00:06, 1m
    
    section VM 3번 생성
    VM 3번 생성 시작 :active, vm3_create, 00:07, 5m
    VM 3번 서비스 투입 :done, vm3_ready, 00:12, 0m
    쿨다운 시작 (5분) :active, cooldown1, 00:12, 5m
    
    section VM 4번 생성
    CPU 여전히 80% 초과 :crit, load2, 00:12, 1m
    Alert 재발생 (5분 후) :milestone, alert2, 00:17, 0m
    쿨다운 종료 확인 :done, cd2, 00:17, 1m
    VM 4번 생성 시작 :active, vm4_create, 00:18, 5m
    VM 4번 서비스 투입 :done, vm4_ready, 00:23, 0m
    쿨다운 시작 (5분) :active, cooldown2, 00:23, 5m</div>

    <p><strong>스케일아웃 프로세스:</strong></p>
    <ol>
      <li><strong>초기 상태:</strong> VM 1번, VM 2번 운영 중</li>
      <li><strong>부하 증가:</strong> CPU 사용률이 80% 초과하여 1분 이상 지속</li>
      <li><strong>Alert 발생:</strong> Prometheus에서 Alert Firing → Alertmanager로 전달</li>
      <li><strong>VM 3번 생성:</strong> 
        <ul>
          <li>쿨다운 체크 통과 (초기 상태이므로 쿨다운 없음)</li>
          <li>최대 VM 개수 체크 통과 (현재 2개 < 최대 4개)</li>
          <li>Jenkins 파이프라인 실행: VM 생성, F5 등록, Prometheus 등록 (약 5분 소요)</li>
          <li>VM 3번 서비스 투입 완료</li>
          <li>쿨다운 시작 (5분)</li>
        </ul>
      </li>
      <li><strong>VM 4번 생성:</strong>
        <ul>
          <li>부하가 여전히 높아 CPU 80% 초과 지속</li>
          <li>쿨다운 종료 대기 (5분)</li>
          <li>Alertmanager가 5분 후 재전송 (repeat_interval)</li>
          <li>쿨다운 종료 확인 후 VM 4번 생성 (약 5분 소요)</li>
          <li>VM 4번 서비스 투입 완료</li>
          <li>최대 VM 개수(4개) 도달로 이후 스케일아웃 차단</li>
        </ul>
      </li>
    </ol>

    <h4>스케일인 시나리오</h4>
    <div class="mermaid">gantt
    title 스케일인 타임라인
    dateFormat HH:mm
    axisFormat %H:%M
    
    section 최대 개수 도달
    VM 1번 운영 :active, vm1_in, 00:00, 30m
    VM 2번 운영 :active, vm2_in, 00:00, 30m
    VM 3번 운영 :active, vm3_in, 00:00, 30m
    VM 4번 운영 :active, vm4_in, 00:00, 30m
    
    section 부하 감소
    전체 CPU 30% 이하 :done, low_load, 00:05, 5m
    Alert 발생 :milestone, alert_in1, 00:10, 0m
    쿨다운 체크 :done, cd_in1, 00:10, 1m
    
    section VM 4번 삭제
    VM 4번 삭제 시작 :active, vm4_del, 00:11, 2m
    VM 4번 삭제 완료 :milestone, vm4_done, 00:13, 0m
    쿨다운 시작 (5분) :active, cooldown_in1, 00:13, 5m
    
    section VM 3번 삭제
    CPU 여전히 30% 이하 :done, low_load2, 00:13, 5m
    Alert 재발생 (5분 후) :milestone, alert_in2, 00:18, 0m
    쿨다운 종료 확인 :done, cd_in2, 00:18, 1m
    VM 3번 삭제 시작 :active, vm3_del, 00:19, 2m
    VM 3번 삭제 완료 :milestone, vm3_done, 00:21, 0m
    쿨다운 시작 (5분) :active, cooldown_in2, 00:21, 5m
    
    section 최소 개수 유지
    VM 1번 유지 :active, vm1_keep, 00:21, 10m
    VM 2번 유지 :active, vm2_keep, 00:21, 10m
    최소 개수 도달로 스케일인 차단 :crit, block, 00:21, 10m</div>

    <p><strong>스케일인 프로세스:</strong></p>
    <ol>
      <li><strong>최대 개수 도달:</strong> VM 1번, 2번, 3번, 4번 모두 운영 중</li>
      <li><strong>부하 감소:</strong> 전체 CPU 사용률이 30% 이하로 5분 이상 지속</li>
      <li><strong>Alert 발생:</strong> Prometheus에서 Alert Firing → Alertmanager로 전달</li>
      <li><strong>VM 4번 삭제 (가장 최신 VM):</strong>
        <ul>
          <li>쿨다운 체크 통과</li>
          <li>최소 VM 개수 체크 통과 (현재 4개 > 최소 2개)</li>
          <li>Jenkins 파이프라인 실행: 가장 최신 VM(4번) 선택, F5 제거, Prometheus 제거, VM 삭제 (약 2분 소요)</li>
          <li>VM 4번 삭제 완료</li>
          <li>쿨다운 시작 (5분)</li>
        </ul>
      </li>
      <li><strong>VM 3번 삭제:</strong>
        <ul>
          <li>부하가 여전히 낮아 CPU 30% 이하 지속</li>
          <li>쿨다운 종료 대기 (5분)</li>
          <li>Alertmanager가 5분 후 재전송 (repeat_interval)</li>
          <li>쿨다운 종료 확인 후 VM 3번 삭제 (약 2분 소요)</li>
          <li>VM 3번 삭제 완료</li>
        </ul>
      </li>
      <li><strong>최소 개수 유지:</strong>
        <ul>
          <li>현재 VM 개수: 2개 (VM 1번, VM 2번)</li>
          <li>최소 VM 개수(2개)에 도달하여 이후 스케일인 차단</li>
          <li>VM 1번과 VM 2번은 최소 개수로 유지됨</li>
        </ul>
      </li>
    </ol>

    <h4>타이밍 요약</h4>
    <table>
      <tr>
        <th>이벤트</th>
        <th>소요 시간</th>
        <th>설명</th>
      </tr>
      <tr>
        <td>VM 생성 (스케일아웃)</td>
        <td>약 5분</td>
        <td>템플릿 Clone, IP 설정, F5 등록, Prometheus 등록</td>
      </tr>
      <tr>
        <td>VM 삭제 (스케일인)</td>
        <td>약 2분</td>
        <td>F5 제거, Prometheus 제거, VM 삭제</td>
      </tr>
      <tr>
        <td>쿨다운 기간</td>
        <td>5분</td>
        <td>스케일아웃/인 후 다음 액션까지 대기 시간</td>
      </tr>
      <tr>
        <td>Alertmanager 재전송</td>
        <td>5분</td>
        <td>Alert가 해결되지 않으면 5분마다 재전송</td>
      </tr>
      <tr>
        <td>스케일아웃: 3번 → 4번</td>
        <td>약 10분 후</td>
        <td>쿨다운(5분) + Alert 재전송(5분) = 최소 10분 후</td>
      </tr>
      <tr>
        <td>스케일인: 4번 삭제</td>
        <td>약 10분 후</td>
        <td>스케일인 조건 지속(5분) + Alert 발생 + 처리(2분) = 약 10분 후</td>
      </tr>
      <tr>
        <td>스케일인: 3번 삭제</td>
        <td>약 10분 후</td>
        <td>쿨다운(5분) + Alert 재전송(5분) + 처리(2분) = 약 10분 후</td>
      </tr>
    </table>
  </div>

  <h3>13.3 확장성</h3>
  <ul>
    <li><b>서비스별 독립 운영</b>
      <ul>
        <li>각 서비스는 독립적인 설정 및 Job 사용</li>
        <li>서비스 간 영향 없음</li>
        <li>동시에 여러 서비스 오토스케일링 가능</li>
      </ul>
    </li>
    <li><b>IP Pool 관리</b>
      <ul>
        <li>서비스별 IP Pool 범위 지정</li>
        <li>IP 충돌 방지</li>
        <li>IP Pool 부족 시 스케일아웃 차단</li>
      </ul>
    </li>
    <li><b>리소스 제한</b>
      <ul>
        <li>최대 VM 개수로 리소스 사용량 제한</li>
        <li>vCenter 리소스 풀 활용</li>
        <li>Datastore 용량 모니터링</li>
      </ul>
    </li>
  </ul>

  <h3>13.4 모니터링 및 알림</h3>
  <div class="box">
    <h4>모니터링 항목</h4>
    <ul>
      <li><b>시스템 메트릭</b>
        <ul>
          <li>CPU 사용률 (전체 및 인스턴스별)</li>
          <li>Memory 사용률 (전체 및 인스턴스별)</li>
          <li>현재 VM 개수</li>
          <li>스케일 이벤트 발생 횟수</li>
        </ul>
      </li>
      <li><b>인프라 메트릭</b>
        <ul>
          <li>vCenter 연결 상태</li>
          <li>Prometheus Target 상태</li>
          <li>F5 Pool Member 상태</li>
          <li>Jenkins Job 실행 상태</li>
        </ul>
      </li>
      <li><b>알림</b>
        <ul>
          <li>스케일아웃/인 이벤트 알림</li>
          <li>에러 발생 알림</li>
          <li>최대/최소 개수 도달 알림</li>
          <li>IP Pool 부족 알림</li>
        </ul>
      </li>
    </ul>
  </div>

  <!-- 14. 향후 고도화 -->
  <h2>14. 향후 고도화 방향</h2>

  <h3>14.1 고객사별 권한 분리</h3>
  <ul>
    <li>현재는 관리자만 모든 서비스에 대해 설정 가능</li>
    <li>향후에는 고객사(테넌트) 별로 접근 가능한 서비스와 오토스케일링 설정을 분리</li>
    <li>역할 기반 접근 제어(RBAC) 예:
      <ul>
        <li>GLOBAL_ADMIN, TENANT_ADMIN, TENANT_VIEWER 등</li>
      </ul>
    </li>
  </ul>

  <h3>14.2 고객사 전용 서버/인프라 제공</h3>
  <ul>
    <li>대형 고객사의 요구 시, Autoscaling Backend/Jenkins/PLG/F5 파티션을 전용 인스턴스로 제공</li>
    <li>각 고객사별로 min/maxVms, IP Pool, VLAN, 템플릿 및 모니터링을 완전히 분리 운영</li>
  </ul>

  <h3>14.3 고급 기능 아이디어</h3>
  <ul>
    <li><b>예측 스케일링</b>
      <ul>
        <li>AI/머신러닝 기반 트래픽 예측</li>
        <li>시간대별 패턴 분석</li>
        <li>사전 스케일아웃으로 응답 시간 단축</li>
      </ul>
    </li>
    <li><b>비용 최적화</b>
      <ul>
        <li>시간대/요일 기반 스케일링 정책</li>
        <li>비용 기반 스케일인 우선순위</li>
        <li>리소스 사용률 기반 최적화</li>
      </ul>
    </li>
    <li><b>하이브리드 오토스케일링</b>
      <ul>
        <li>Kubernetes(CAPV)와 연계</li>
        <li>클라우드와 온프레미스 통합 관리</li>
        <li>워크로드 특성에 따른 자동 배치</li>
      </ul>
    </li>
    <li><b>고급 모니터링</b>
      <ul>
        <li>애플리케이션 레벨 메트릭 기반 스케일링</li>
        <li>JMX 메트릭 활용</li>
        <li>커스텀 메트릭 지원</li>
      </ul>
    </li>
  </ul>

  <!-- 15. 요약 및 핵심 포인트 -->
  <h2>15. 요약 및 핵심 포인트</h2>

  <h3>15.1 핵심 아키텍처 원칙</h3>
  <div class="box">
    <ul>
      <li><b>비침투형 설계:</b> 기존 인프라(PLG Stack, Jenkins, F5, vSphere)를 최대한 재활용</li>
      <li><b>단일 기준 원칙:</b> Prometheus Job에 등록된 VM 개수만으로 최소/최대 개수 판단</li>
      <li><b>쿨다운 메커니즘:</b> 반복 알림 방지 및 리소스 보호</li>
      <li><b>서비스 독립성:</b> 각 서비스는 독립적으로 운영되며 서로 영향 없음</li>
      <li><b>자동화:</b> 설정부터 실행까지 전체 프로세스 자동화</li>
    </ul>
  </div>

  <h3>15.2 주요 특징</h3>
  <table>
    <tr>
      <th>항목</th>
      <th>설명</th>
    </tr>
    <tr>
      <td>템플릿 기반</td>
      <td>Golden Image 템플릿을 기반으로 빠른 VM 생성</td>
    </tr>
    <tr>
      <td>메트릭 기반</td>
      <td>Prometheus Node Exporter 메트릭 기반 자동 판단</td>
    </tr>
    <tr>
      <td>웹훅 기반</td>
      <td>Alertmanager → Backend → Jenkins 웹훅 체인</td>
    </tr>
    <tr>
      <td>자동 등록</td>
      <td>VM 생성 시 F5 Pool 및 Prometheus Target 자동 등록</td>
    </tr>
    <tr>
      <td>안전한 삭제</td>
      <td>F5 제거 → 모니터링 제거 → Prometheus 제거 → VM 삭제 순서 보장</td>
    </tr>
  </table>

  <h3>15.3 성능 지표</h3>
  <table>
    <tr>
      <th>작업</th>
      <th>예상 소요 시간</th>
    </tr>
    <tr>
      <td>스케일아웃 (VM 생성)</td>
      <td>약 3-5분</td>
    </tr>
    <tr>
      <td>스케일인 (VM 삭제)</td>
      <td>약 2분</td>
    </tr>
    <tr>
      <td>쿨다운 기간</td>
      <td>기본 5분 (설정 가능)</td>
    </tr>
    <tr>
      <td>Alert 평가 주기</td>
      <td>5분 (Prometheus scrape interval)</td>
    </tr>
    <tr>
      <td>Alertmanager 재전송 주기</td>
      <td>5분 (repeat_interval)</td>
    </tr>
  </table>

  <h3>15.4 제한사항 및 주의사항</h3>
  <div class="warning">
    <ul>
      <li><b>IP Pool 범위:</b> IP Pool이 부족하면 스케일아웃이 차단됩니다. 충분한 IP 범위를 확보하세요.</li>
      <li><b>템플릿 준비:</b> 템플릿이 올바르게 준비되지 않으면 VM 생성이 실패할 수 있습니다.</li>
      <li><b>네트워크 연결:</b> VM 생성 후 네트워크 연결이 안정적이어야 F5 Health Check가 통과합니다.</li>
      <li><b>쿨다운 기간:</b> 쿨다운 기간 중에는 스케일링이 발생하지 않으므로 급격한 부하 변화에 대응이 늦을 수 있습니다.</li>
      <li><b>최소 VM 개수:</b> 최소 VM 개수 이하로는 스케일인이 발생하지 않으므로 서비스 가용성이 보장됩니다.</li>
    </ul>
  </div>

  <!-- 16. 참고 자료 -->
  <h2>16. 참고 자료</h2>
  <ul>
    <li><a href="https://prometheus.io/docs/">Prometheus 공식 문서</a></li>
    <li><a href="https://prometheus.io/docs/alerting/latest/alertmanager/">Alertmanager 공식 문서</a></li>
    <li><a href="https://www.jenkins.io/doc/">Jenkins 공식 문서</a></li>
    <li><a href="https://github.com/vmware/govmomi">govc (vSphere CLI) 문서</a></li>
    <li><a href="https://clouddocs.f5.com/">F5 BIG-IP 문서</a></li>
  </ul>
  <ul>
    <li>AI/머신러닝 기반 예측 스케일링</li>
    <li>시간대/요일 기반 비용 최적화 정책</li>
    <li>Kubernetes(CAPV)와 연계한 하이브리드 오토스케일링</li>
  </ul>

</body>
</html>

